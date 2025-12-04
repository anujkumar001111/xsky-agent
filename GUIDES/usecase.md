  ---
  1. E-Commerce Price Monitoring Agent

  // USE CASE: Monitor competitor prices and alert when action needed

  const eko = new Eko({
    llms: { default: anthropicConfig },
    agents: [new BrowserAgent()],
    hooks: {
      // HUMAN APPROVAL: Before price changes
      onApprovalRequired: async (ctx, request) => {
        if (request.type === 'price_change') {
          // Send to Slack for manager approval
          await slack.send('#pricing', {
            text: `Price change detected: ${request.description}`,
            actions: ['Approve', 'Reject', 'Investigate']
          });
          // Pause and wait for webhook response
          return { approved: false, waitForWebhook: true };
        }
      },

      // STATE PERSISTENCE: Save after each product check
      afterToolCall: async (ctx, toolName, result) => {
        if (toolName === 'extract_price') {
          await db.prices.insert({
            product: ctx.variables.get('currentProduct'),
            price: result.price,
            competitor: result.source,
            timestamp: Date.now()
          });
        }
      }
    },

    // RESUME FROM WEBHOOK
    webhookHandler: {
      endpoint: '/api/agent/resume',
      onResume: async (threadId, payload) => {
        const thread = await eko.loadThread(threadId);
        thread.events.push({ type: 'human_approval', data: payload });
        await eko.resume(threadId);
      }
    }
  });

  // Run daily monitoring
  await eko.run(`
    Monitor these competitor sites for product prices:
    - Amazon: ${productUrls.amazon}
    - Walmart: ${productUrls.walmart}
    
    If price difference > 10%, create alert for human review.
    If price difference > 20%, request approval to adjust our price.
  `);

  Real Companies Doing This: Prisync, Competera, Intelligence Node

  ---
  2. Customer Support Ticket Agent

  // USE CASE: Auto-triage and respond to support tickets

  const supportAgent = new Eko({
    llms: { default: openaiConfig },
    agents: [new BrowserAgent(), new EmailAgent()],

    // CUSTOM PROMPTS: Domain-specific
    promptBuilder: {
      buildSystemPrompt: async (ctx) => `
        You are a Tier-1 support agent for ${companyName}.
        
        KNOWLEDGE BASE:
        ${await loadKnowledgeBase(ctx.variables.get('ticketCategory'))}
        
        ESCALATION RULES:
        - Billing issues > $500: Escalate to billing team
        - Technical issues unresolved after 2 attempts: Escalate to Tier-2
        - Angry customer (sentiment < -0.5): Escalate to manager
        
        RESPONSE STYLE:
        - Professional but friendly
        - Always apologize for inconvenience
        - Provide specific next steps
      `
    },

    hooks: {
      // HUMAN ESCALATION
      beforeToolCall: async (ctx, toolName, args) => {
        if (toolName === 'send_customer_email') {
          const sentiment = await analyzeSentiment(args.content);
          if (sentiment.score < -0.5 || args.isRefund) {
            return {
              allow: false,
              escalate: true,
              reason: 'Requires human review before sending'
            };
          }
        }
        return { allow: true };
      },

      // ERROR RECOVERY
      onToolError: async (ctx, toolName, error) => {
        if (toolName === 'access_customer_account' && error.code === 'AUTH_REQUIRED') {
          // Request human to log in
          await ctx.requestHumanHelp('login', 'Please log into customer portal');
          return 'retry';
        }
        return 'escalate';
      }
    },

    // STATE: Resume ticket handling after human response
    stateConfig: {
      persistence: 'redis',
      ttl: 24 * 60 * 60, // 24 hours
      onStateChange: async (thread) => {
        await updateTicketStatus(thread.metadata.ticketId, thread.metadata.status);
      }
    }
  });

  // Process incoming ticket
  await supportAgent.run(`
    Handle support ticket #${ticketId}:
    
    Customer: ${customer.name}
    Issue: ${ticket.subject}
    Description: ${ticket.body}
    Priority: ${ticket.priority}
    
    1. Search knowledge base for solution
    2. Draft response
    3. If confident (>80%), send response
    4. Otherwise, escalate to human
  `);

  Real Companies Doing This: Intercom, Zendesk, Freshdesk

  ---
  3. Sales Lead Research & Outreach Agent

  // USE CASE: Research leads and personalize outreach

  const salesAgent = new Eko({
    llms: {
      default: anthropicConfig,
      research: { provider: 'openai', model: 'gpt-4o' },
      writing: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }
    },
    agents: [new BrowserAgent(), new LinkedInAgent(), new EmailAgent()],

    // MULTI-STEP WORKFLOW WITH APPROVAL GATES
    workflow: {
      steps: [
        {
          name: 'research',
          agent: 'Browser',
          task: 'Research company and decision makers',
          autoApprove: true
        },
        {
          name: 'analyze',
          agent: 'Browser',
          task: 'Analyze pain points and opportunities',
          autoApprove: true
        },
        {
          name: 'draft_email',
          agent: 'Browser',
          task: 'Draft personalized outreach email',
          requiresApproval: true,  // HUMAN REVIEW
          approvalChannel: 'slack',
          approvalTimeout: 4 * 60 * 60 // 4 hours
        },
        {
          name: 'send_email',
          agent: 'Email',
          task: 'Send approved email',
          onlyIfApproved: true
        }
      ]
    },

    hooks: {
      // CUSTOM CONTEXT: Add CRM data
      beforeAgentStart: async (ctx) => {
        const lead = await crm.getLead(ctx.variables.get('leadId'));
        ctx.variables.set('leadHistory', lead.interactions);
        ctx.variables.set('companyData', await enrichCompany(lead.company));
      },

      // TRACK METRICS
      afterAgentComplete: async (ctx, result) => {
        await analytics.track('agent_completed', {
          leadId: ctx.variables.get('leadId'),
          step: ctx.agentChain.agent.name,
          tokensUsed: ctx.usage.totalTokens
        });
      }
    },

    // CALLBACK FOR EMAIL TRACKING
    callbacks: {
      onEmailSent: async (ctx, emailId) => {
        // Schedule follow-up if no reply in 3 days
        await scheduler.schedule({
          taskId: `followup-${emailId}`,
          runAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
          action: 'resume',
          threadId: ctx.threadId,
          payload: { type: 'no_reply_followup' }
        });
      }
    }
  });

  // Process lead batch
  for (const lead of leads) {
    await salesAgent.run(`
      Research and reach out to:
      Company: ${lead.company}
      Contact: ${lead.name}, ${lead.title}
      LinkedIn: ${lead.linkedinUrl}
      
      Goal: Book a demo call
      Angle: ${lead.suggestedAngle}
    `);
  }

  Real Companies Doing This: Apollo.io, Outreach, SalesLoft

  ---
  4. Document Processing & Compliance Agent

  // USE CASE: Process contracts and flag compliance issues

  const complianceAgent = new Eko({
    llms: { default: anthropicConfig },
    agents: [new BrowserAgent(), new FileAgent()],

    // CUSTOM CONTEXT SERIALIZATION (Factor 3)
    contextSerializer: {
      format: 'xml',
      serialize: (events) => events.map(e => `
        <event type="${e.type}" timestamp="${e.timestamp}">
          <data>${JSON.stringify(e.data)}</data>
          ${e.compliance ? `<compliance_flags>${e.compliance.join(',')}</compliance_flags>` :
   ''}
        </event>
      `).join('\n')
    },

    // APPROVAL WORKFLOW FOR FLAGGED ITEMS
    approvalConfig: {
      rules: [
        {
          condition: (ctx) => ctx.variables.get('riskScore') > 7,
          channel: 'legal_team',
          timeout: 24 * 60 * 60,
          escalateTo: 'general_counsel'
        },
        {
          condition: (ctx) => ctx.variables.get('contractValue') > 100000,
          channel: 'cfo_approval',
          requiresSignature: true
        }
      ]
    },

    hooks: {
      // AUDIT TRAIL
      afterToolCall: async (ctx, toolName, result) => {
        await auditLog.record({
          action: toolName,
          document: ctx.variables.get('documentId'),
          user: ctx.variables.get('initiatedBy'),
          result: result.summary,
          timestamp: Date.now(),
          ipAddress: ctx.metadata.clientIp
        });
      },

      // COMPLIANCE CHECK
      beforeAgentComplete: async (ctx, result) => {
        const complianceCheck = await runComplianceRules(result);
        if (complianceCheck.violations.length > 0) {
          ctx.variables.set('complianceViolations', complianceCheck.violations);
          return {
            block: true,
            reason: 'Compliance violations detected',
            escalate: true
          };
        }
      }
    },

    // STATE PERSISTENCE FOR LONG-RUNNING REVIEWS
    stateConfig: {
      persistence: 'postgresql',
      checkpointInterval: 5 * 60 * 1000, // Every 5 minutes
      onCheckpoint: async (checkpoint) => {
        await db.checkpoints.upsert({
          threadId: checkpoint.threadId,
          state: checkpoint.state,
          documentId: checkpoint.metadata.documentId
        });
      }
    }
  });

  // Process contract
  await complianceAgent.run(`
    Review contract: ${contractUrl}
    
    Check for:
    1. Non-standard liability clauses
    2. IP assignment terms
    3. Termination conditions
    4. Payment terms vs our standard (Net 30)
    5. Auto-renewal clauses
    
    Flag any deviations for legal review.
    Generate summary report.
  `);

  Real Companies Doing This: Ironclad, DocuSign Insight, Kira Systems

  ---
  5. CI/CD Deployment Agent

  // USE CASE: Automated deployment with human approval gates

  const deployAgent = new Eko({
    llms: { default: anthropicConfig },
    agents: [new ShellAgent(), new BrowserAgent()],

    // APPROVAL GATES FOR PRODUCTION
    approvalGates: {
      staging: { autoApprove: true },
      production: {
        requiredApprovers: ['tech_lead', 'devops'],
        minimumApprovals: 2,
        channel: 'slack:#deployments',
        timeout: 30 * 60 * 1000, // 30 minutes
        onTimeout: 'abort'
      }
    },

    hooks: {
      // PRE-DEPLOYMENT CHECKS
      beforeToolCall: async (ctx, toolName, args) => {
        if (toolName === 'deploy_to_production') {
          // Run automated checks
          const checks = await runPreDeployChecks({
            tests: await runTests(),
            security: await runSecurityScan(),
            performance: await runLoadTest()
          });

          if (!checks.passed) {
            return {
              allow: false,
              reason: `Pre-deploy checks failed: ${checks.failures.join(', ')}`
            };
          }

          // Request human approval
          const approval = await ctx.requestApproval({
            type: 'deployment',
            environment: 'production',
            version: args.version,
            changes: args.changelog,
            checks: checks.results
          });

          return { allow: approval.approved };
        }
        return { allow: true };
      },

      // ROLLBACK ON FAILURE
      onToolError: async (ctx, toolName, error) => {
        if (toolName === 'deploy_to_production') {
          await ctx.variables.set('deploymentFailed', true);
          await slack.alert('#incidents', {
            text: `🚨 Deployment failed: ${error.message}`,
            actions: ['Rollback', 'Investigate', 'Retry']
          });
          return 'abort';
        }
        return 'retry';
      },

      // POST-DEPLOYMENT MONITORING
      afterToolCall: async (ctx, toolName, result) => {
        if (toolName === 'deploy_to_production' && result.success) {
          // Schedule health check
          await scheduler.schedule({
            taskId: `healthcheck-${result.deploymentId}`,
            runAt: Date.now() + 5 * 60 * 1000, // 5 minutes
            action: 'run',
            prompt: `Check health of deployment ${result.deploymentId}`
          });
        }
      }
    },

    // WEBHOOK FOR APPROVAL RESPONSES
    webhooks: {
      '/api/deploy/approve': async (req) => {
        const { threadId, approved, approver } = req.body;
        await eko.addEvent(threadId, {
          type: 'human_approval',
          data: { approved, approver, timestamp: Date.now() }
        });
        await eko.resume(threadId);
      }
    }
  });

  // Triggered by GitHub webhook
  await deployAgent.run(`
    Deploy version ${version} to production:
    
    1. Run all tests
    2. Build production artifacts
    3. Deploy to staging
    4. Run smoke tests on staging
    5. Request approval for production
    6. Deploy to production (blue-green)
    7. Monitor for 5 minutes
    8. Complete or rollback
  `);

  Real Companies Doing This: GitHub Actions + AI, Harness, Spinnaker

  ---
  6. Web Scraping & Data Extraction Agent

  // USE CASE: Intelligent web scraping with anti-bot handling

  const scraperAgent = new Eko({
    llms: { default: anthropicConfig },
    agents: [new BrowserAgent()],

    // BROWSER CONFIGURATION
    browserConfig: {
      headless: true,
      proxy: process.env.PROXY_URL,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      viewport: { width: 1920, height: 1080 }
    },

    hooks: {
      // ANTI-BOT DETECTION HANDLING
      onToolError: async (ctx, toolName, error) => {
        if (error.message.includes('CAPTCHA') || error.message.includes('blocked')) {
          // Option 1: Request human help
          const resolved = await ctx.requestHumanHelp('captcha',
            'Please solve the CAPTCHA to continue scraping');
          if (resolved) return 'retry';

          // Option 2: Switch proxy
          await ctx.variables.set('proxyIndex',
            (ctx.variables.get('proxyIndex') || 0) + 1);
          return 'retry';
        }
        return 'skip'; // Skip this item, continue with others
      },

      // RATE LIMITING
      beforeToolCall: async (ctx, toolName, args) => {
        if (toolName === 'navigate' || toolName === 'click') {
          const lastRequest = ctx.variables.get('lastRequestTime') || 0;
          const minDelay = 2000 + Math.random() * 3000; // 2-5 seconds
          const elapsed = Date.now() - lastRequest;

          if (elapsed < minDelay) {
            await sleep(minDelay - elapsed);
          }
          ctx.variables.set('lastRequestTime', Date.now());
        }
        return { allow: true };
      },

      // DATA VALIDATION & STORAGE
      afterToolCall: async (ctx, toolName, result) => {
        if (toolName === 'extract_data') {
          // Validate extracted data
          const validated = await validateSchema(result.data, ctx.variables.get('schema'));
          if (!validated.valid) {
            ctx.variables.set('validationErrors', validated.errors);
            return; // Will trigger retry or skip
          }

          // Store to database
          await db.scrapedData.insertMany(result.data.map(item => ({
            ...item,
            source: ctx.variables.get('currentUrl'),
            scrapedAt: new Date(),
            jobId: ctx.taskId
          })));
        }
      }
    },

    // CHECKPOINT FOR LONG SCRAPING JOBS
    stateConfig: {
      persistence: 'redis',
      checkpointInterval: 60 * 1000, // Every minute
      onCheckpoint: async (checkpoint) => {
        await redis.hset(`scrape:${checkpoint.threadId}`, {
          progress: checkpoint.metadata.itemsProcessed,
          total: checkpoint.metadata.totalItems,
          lastUrl: checkpoint.metadata.currentUrl
        });
      }
    }
  });

  // Run scraping job
  await scraperAgent.run(`
    Scrape product listings from ${targetSite}:

    1. Navigate to category page: ${categoryUrl}
    2. For each product listing:
       - Extract: name, price, SKU, description, images
       - Handle pagination (up to 50 pages)
       - Handle lazy-loaded content
    3. If blocked, wait and retry with different approach
    4. Save all data to database

    Expected schema: { name: string, price: number, sku: string, ... }
  `);

  Real Companies Doing This: Bright Data, Apify, ScrapingBee

  ---
  7. Social Media Management Agent

  // USE CASE: Monitor mentions, engage, and schedule posts

  const socialAgent = new Eko({
    llms: {
      default: anthropicConfig,
      content: { provider: 'openai', model: 'gpt-4o' } // For creative content
    },
    agents: [new BrowserAgent(), new TwitterAgent(), new LinkedInAgent()],

    // CONTENT APPROVAL WORKFLOW
    approvalConfig: {
      rules: [
        {
          // Auto-approve replies to positive mentions
          condition: (ctx) => ctx.variables.get('sentiment') > 0.5 &&
                             ctx.variables.get('actionType') === 'reply',
          autoApprove: true
        },
        {
          // Human approval for negative sentiment
          condition: (ctx) => ctx.variables.get('sentiment') < 0,
          channel: 'slack:#social-escalations',
          timeout: 30 * 60 * 1000
        },
        {
          // Marketing approval for new posts
          condition: (ctx) => ctx.variables.get('actionType') === 'new_post',
          channel: 'slack:#marketing-approval',
          requiredApprovers: ['marketing_lead']
        }
      ]
    },

    hooks: {
      // SENTIMENT ANALYSIS BEFORE RESPONSE
      beforeToolCall: async (ctx, toolName, args) => {
        if (toolName === 'post_reply' || toolName === 'send_dm') {
          // Analyze our response tone
          const toneCheck = await analyzeTone(args.content);
          if (toneCheck.isControversial || toneCheck.sentiment < 0) {
            return {
              allow: false,
              escalate: true,
              reason: `Response tone flagged: ${toneCheck.issues.join(', ')}`
            };
          }

          // Check for brand guidelines
          const brandCheck = await checkBrandGuidelines(args.content);
          if (!brandCheck.compliant) {
            args.content = await rewriteForBrand(args.content, brandCheck.suggestions);
          }
        }
        return { allow: true, modifiedArgs: args };
      },

      // ENGAGEMENT TRACKING
      afterToolCall: async (ctx, toolName, result) => {
        if (['post_reply', 'like', 'retweet', 'send_dm'].includes(toolName)) {
          await analytics.track('social_engagement', {
            platform: ctx.variables.get('platform'),
            action: toolName,
            targetUser: result.targetUser,
            mentionId: result.mentionId,
            responseTime: Date.now() - ctx.variables.get('mentionTime')
          });
        }
      },

      // RATE LIMIT MANAGEMENT
      onToolError: async (ctx, toolName, error) => {
        if (error.code === 'RATE_LIMITED') {
          const retryAfter = error.retryAfter || 60000;
          await ctx.pause(retryAfter);
          return 'retry';
        }
        return 'escalate';
      }
    },

    // SCHEDULED EXECUTION
    schedule: {
      // Check mentions every 5 minutes
      mentionCheck: '*/5 * * * *',
      // Post scheduled content at optimal times
      scheduledPosts: '0 9,12,17 * * *' // 9am, 12pm, 5pm
    }
  });

  // Monitor and engage
  await socialAgent.run(`
    Monitor brand mentions on Twitter and LinkedIn:

    1. Search for mentions of @${brandHandle} and "${brandKeywords}"
    2. For each mention:
       - Analyze sentiment (positive/negative/neutral)
       - Categorize: complaint, question, praise, spam
       - If complaint: Draft empathetic response, escalate to support
       - If question: Draft helpful response with relevant links
       - If praise: Like and reply with thanks
    3. Track all engagements for reporting
  `);

  Real Companies Doing This: Sprout Social, Hootsuite, Buffer

  ---
  8. QA Testing & Bug Reproduction Agent

  // USE CASE: Automated testing and bug reproduction

  const qaAgent = new Eko({
    llms: { default: anthropicConfig },
    agents: [new BrowserAgent()],

    // TEST ENVIRONMENT CONFIG
    browserConfig: {
      recordVideo: true,
      recordTrace: true,
      screenshotOnFailure: true
    },

    hooks: {
      // CAPTURE EVIDENCE ON FAILURE
      onToolError: async (ctx, toolName, error) => {
        const evidence = {
          screenshot: await ctx.agent.screenshot(),
          console: await ctx.agent.getConsoleLogs(),
          network: await ctx.agent.getNetworkLogs(),
          dom: await ctx.agent.getPageSource(),
          timestamp: Date.now()
        };

        ctx.variables.set('failureEvidence', evidence);

        // Create bug report automatically
        if (ctx.variables.get('autoCreateBugs')) {
          await jira.createBug({
            title: `[Auto] ${toolName} failed: ${error.message}`,
            description: await generateBugReport(ctx, error, evidence),
            attachments: [evidence.screenshot],
            labels: ['auto-detected', 'needs-triage']
          });
        }

        return 'continue'; // Continue with other tests
      },

      // TEST RESULT TRACKING
      afterToolCall: async (ctx, toolName, result) => {
        if (toolName === 'assert' || toolName === 'expect') {
          await testResults.record({
            testId: ctx.variables.get('currentTestId'),
            step: ctx.variables.get('currentStep'),
            passed: result.passed,
            actual: result.actual,
            expected: result.expected,
            duration: result.duration
          });
        }
      },

      // SMART TEST RETRY
      beforeAgentComplete: async (ctx, result) => {
        const failures = ctx.variables.get('testFailures') || [];
        if (failures.length > 0 && ctx.variables.get('retryCount') < 2) {
          // Retry failed tests with fresh browser
          ctx.variables.set('retryCount', (ctx.variables.get('retryCount') || 0) + 1);
          ctx.variables.set('testsToRun', failures);
          return { retry: true };
        }
      }
    },

    // PARALLEL TEST EXECUTION
    parallelConfig: {
      maxWorkers: 4,
      shardBy: 'file', // or 'test'
      isolateBrowsers: true
    }
  });

  // Run test suite
  await qaAgent.run(`
    Run E2E tests for ${appUrl}:

    Test Suite: User Authentication
    1. Test: Login with valid credentials
       - Navigate to /login
       - Enter email: ${testUser.email}
       - Enter password: ${testUser.password}
       - Click submit
       - Assert: Redirected to /dashboard
       - Assert: Welcome message contains user name

    2. Test: Login with invalid credentials
       - Navigate to /login
       - Enter email: invalid@test.com
       - Enter password: wrongpassword
       - Click submit
       - Assert: Error message displayed
       - Assert: Still on /login page

    3. Test: Password reset flow
       - Navigate to /forgot-password
       - Enter email: ${testUser.email}
       - Click submit
       - Assert: Success message displayed

    If any test fails, capture screenshot and create bug report.
  `);

  Real Companies Doing This: Testim, Mabl, Functionize

  ---
  9. Job Application Agent

  // USE CASE: Automated job searching and application

  const jobAgent = new Eko({
    llms: { default: anthropicConfig },
    agents: [new BrowserAgent(), new FileAgent()],

    // APPLICATION APPROVAL
    approvalConfig: {
      rules: [
        {
          // Auto-apply to matching jobs
          condition: (ctx) => ctx.variables.get('matchScore') > 85,
          autoApprove: true,
          maxPerDay: 10
        },
        {
          // Human review for borderline matches
          condition: (ctx) => ctx.variables.get('matchScore') >= 60,
          channel: 'email',
          timeout: 24 * 60 * 60 * 1000
        }
      ]
    },

    hooks: {
      // JOB MATCHING ANALYSIS
      beforeToolCall: async (ctx, toolName, args) => {
        if (toolName === 'apply_to_job') {
          const job = args.jobDetails;
          const resume = ctx.variables.get('userResume');

          // Calculate match score
          const matchScore = await calculateJobMatch(job, resume);
          ctx.variables.set('matchScore', matchScore.score);

          if (matchScore.score < 60) {
            return {
              allow: false,
              reason: `Low match score: ${matchScore.score}%`,
              skipJob: true
            };
          }

          // Customize resume for this job
          if (ctx.variables.get('customizeResume')) {
            args.resume = await tailorResume(resume, job, matchScore.suggestions);
          }

          // Generate custom cover letter
          args.coverLetter = await generateCoverLetter(job, resume);
        }
        return { allow: true, modifiedArgs: args };
      },

      // APPLICATION TRACKING
      afterToolCall: async (ctx, toolName, result) => {
        if (toolName === 'apply_to_job') {
          await db.applications.insert({
            jobId: result.jobId,
            company: result.company,
            position: result.position,
            appliedAt: new Date(),
            status: 'applied',
            matchScore: ctx.variables.get('matchScore'),
            resumeVersion: ctx.variables.get('resumeVersion')
          });

          // Schedule follow-up
          await scheduler.schedule({
            taskId: `followup-${result.jobId}`,
            runAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1 week
            action: 'check_status',
            jobId: result.jobId
          });
        }
      },

      // CAPTCHA/LOGIN HANDLING
      onToolError: async (ctx, toolName, error) => {
        if (error.type === 'LOGIN_REQUIRED') {
          const loginSuccess = await ctx.requestHumanHelp('login',
            `Please log into ${error.platform} to continue applications`);
          return loginSuccess ? 'retry' : 'skip';
        }
        if (error.type === 'CAPTCHA') {
          await ctx.requestHumanHelp('captcha', 'Please solve CAPTCHA');
          return 'retry';
        }
        return 'skip';
      }
    },

    // DAILY LIMITS
    rateLimits: {
      applicationsPerDay: 20,
      searchesPerHour: 10
    }
  });

  // Run job search
  await jobAgent.run(`
    Search and apply for jobs matching my profile:

    Target: Senior Software Engineer roles
    Location: Remote or San Francisco Bay Area
    Salary: $150k+

    Platforms to search:
    - LinkedIn Jobs
    - Indeed
    - Glassdoor

    Preferences:
    - Company size: 50-500 employees
    - Industries: SaaS, Fintech, AI/ML
    - Must have: TypeScript, React, Node.js
    - Nice to have: AWS, Kubernetes

    For each matching job:
    1. Analyze job requirements vs my resume
    2. If match > 85%, auto-apply with tailored resume
    3. If match 60-85%, save for my review
    4. Track all applications in spreadsheet
  `);

  Real Companies Doing This: LazyApply, Sonara, Massive (YC)

  ---
  10. Research & Report Generation Agent

  // USE CASE: Automated research and report compilation

  const researchAgent = new Eko({
    llms: {
      default: anthropicConfig,
      summarization: { provider: 'anthropic', model: 'claude-3-haiku-20240307' },
      analysis: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }
    },
    agents: [new BrowserAgent(), new FileAgent()],

    // SOURCE CREDIBILITY CONFIG
    sourceConfig: {
      trustedDomains: ['reuters.com', 'wsj.com', 'techcrunch.com', 'arxiv.org'],
      blockedDomains: ['spam-site.com'],
      minCredibilityScore: 0.7
    },

    hooks: {
      // SOURCE VALIDATION
      beforeToolCall: async (ctx, toolName, args) => {
        if (toolName === 'extract_content') {
          const url = new URL(args.url);

          // Check domain credibility
          const credibility = await checkSourceCredibility(url.hostname);
          if (credibility.score < ctx.config.sourceConfig.minCredibilityScore) {
            ctx.variables.set('skippedSources', [
              ...(ctx.variables.get('skippedSources') || []),
              { url: args.url, reason: 'Low credibility' }
            ]);
            return { allow: false, skipSource: true };
          }

          // Track source for citations
          ctx.variables.set('sources', [
            ...(ctx.variables.get('sources') || []),
            { url: args.url, title: args.title, accessedAt: new Date() }
          ]);
        }
        return { allow: true };
      },

      // FACT CHECKING
      afterToolCall: async (ctx, toolName, result) => {
        if (toolName === 'extract_facts') {
          // Cross-reference facts with other sources
          const verifiedFacts = await Promise.all(
            result.facts.map(async fact => ({
              ...fact,
              verified: await crossReferenceFact(fact, ctx.variables.get('sources')),
              confidence: await calculateFactConfidence(fact)
            }))
          );

          ctx.variables.set('verifiedFacts', verifiedFacts);
        }
      },

      // REPORT REVIEW
      beforeAgentComplete: async (ctx, result) => {
        if (ctx.variables.get('requiresReview')) {
          // Generate draft for human review
          const draft = await generateReportDraft(ctx.variables.get('verifiedFacts'));

          const approval = await ctx.requestApproval({
            type: 'report_review',
            draft: draft,
            sources: ctx.variables.get('sources'),
            factCount: ctx.variables.get('verifiedFacts').length
          });

          if (!approval.approved) {
            ctx.variables.set('reviewFeedback', approval.feedback);
            return { revise: true };
          }
        }
      }
    },

    // OUTPUT FORMATS
    outputConfig: {
      formats: ['pdf', 'docx', 'markdown'],
      includeCitations: true,
      citationStyle: 'APA'
    }
  });

  // Generate research report
  await researchAgent.run(`
    Research and compile a report on: "${researchTopic}"

    Scope:
    - Time period: Last 12 months
    - Focus areas: ${focusAreas.join(', ')}
    - Target audience: ${audience}

    Process:
    1. Search for relevant articles, papers, and reports
    2. Extract key facts and statistics
    3. Cross-reference facts across multiple sources
    4. Identify trends and patterns
    5. Generate executive summary
    6. Compile full report with citations

    Output:
    - Executive summary (1 page)
    - Full report (10-15 pages)
    - Key statistics table
    - Source bibliography

    Quality requirements:
    - Minimum 10 credible sources
    - All facts must be verified by 2+ sources
    - Include data visualizations where relevant
  `);

  Real Companies Doing This: Perplexity, Elicit, Consensus

  ---
  ## Summary: XSky Use Case Categories

  | Category | Use Cases | Key Features Used |
  |----------|-----------|-------------------|
  | **E-Commerce** | Price monitoring, Product scraping | Hooks, State persistence, Webhooks |
  | **Customer Service** | Ticket handling, Chat support | Custom prompts, Escalation, Error recovery |
  | **Sales** | Lead research, Outreach automation | Multi-step workflows, Approval gates |
  | **Compliance** | Document review, Audit trails | Context serialization, Checkpoints |
  | **DevOps** | CI/CD automation, Deployment | Approval gates, Rollback hooks |
  | **Data** | Web scraping, Research reports | Rate limiting, Source validation |
  | **Social Media** | Monitoring, Engagement | Sentiment analysis, Scheduling |
  | **QA** | Testing, Bug reproduction | Evidence capture, Parallel execution |
  | **Personal** | Job applications | Matching algorithms, Tracking |

  ---
  ## 12-Factor Features by Use Case

  | Factor | E-Commerce | Support | Sales | Compliance | DevOps |
  |--------|------------|---------|-------|------------|--------|
  | 1. NL→Tools | ✅ | ✅ | ✅ | ✅ | ✅ |
  | 2. Own Prompts | - | ✅ | ✅ | ✅ | - |
  | 3. Own Context | - | - | ✅ | ✅ | - |
  | 4. Structured Output | ✅ | ✅ | ✅ | ✅ | ✅ |
  | 5. Unified State | ✅ | ✅ | ✅ | ✅ | ✅ |
  | 6. Pause/Resume | ✅ | ✅ | ✅ | ✅ | ✅ |
  | 7. Human Tools | ✅ | ✅ | ✅ | ✅ | ✅ |
  | 8. Control Flow | ✅ | ✅ | ✅ | ✅ | ✅ |
  | 9. Error Handling | ✅ | ✅ | ✅ | ✅ | ✅ |
  | 10. Small Agents | ✅ | ✅ | ✅ | ✅ | ✅ |
  | 11. Multi-Trigger | ✅ | ✅ | ✅ | - | ✅ |
  | 12. Stateless | ✅ | ✅ | ✅ | ✅ | ✅ |