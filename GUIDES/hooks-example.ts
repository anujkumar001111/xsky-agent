/**
 * Example: Production-Ready E-Commerce Agent Hooks
 *
 * This is a documentation example showing hook patterns.
 * To use: copy into your project that has @xsky/ai-agent-core installed.
 *
 * This example demonstrates:
 * 1. Rate limiting for scraping
 * 2. Database logging for compliance
 * 3. Human approval for purchases > $100
 * 4. Error recovery for network glitches
 */

// When using in your project:
// import { Eko, EkoConfig, AgentHooks } from '@xsky/ai-agent-core';
// import type { AgentContext, ToolResult } from '@xsky/ai-agent-core';

import {
  Eko,
  EkoConfig,
  AgentHooks,
  AgentContext,
  ToolResult
} from '@xsky/ai-agent-core';

// Mock database and external services
const db = {
  logAction: async (action: string, data: any) => console.log(`[DB] ${action}`, data),
  getUser: async (id: string) => ({ id, role: 'admin' })
};

const notifications = {
  sendApprovalRequest: async (msg: string) => console.log(`[SLACK] ${msg}`)
};

// Define our production hooks
const productionHooks: AgentHooks = {

  // 1. Context Injection: Load user data before starting
  beforeAgentStart: async (context: AgentContext) => {
    const userId = context.variables.get('userId');
    if (userId) {
      const user = await db.getUser(userId);
      context.variables.set('userContext', user);
      console.log(`Agent starting for user: ${userId}`);
    }
  },

  // 2. Tool Control: Validation & Approval
  beforeToolCall: async (context, toolName, args) => {
    // Rate Limit: Prevent scraping too fast
    if (toolName === 'scrape_product') {
      const lastScrape = context.variables.get('lastScrapeTime') || 0;
      const timeSinceLast = Date.now() - lastScrape;

      if (timeSinceLast < 2000) { // 2 second limit
        // Option: Delay instead of block
        await new Promise(r => setTimeout(r, 2000 - timeSinceLast));
      }
      context.variables.set('lastScrapeTime', Date.now());
    }

    // Approval Gate: High value transactions
    if (toolName === 'purchase_item' && args.price > 100) {
      await notifications.sendApprovalRequest(
        `Agent wants to buy item for $${args.price}. Approve?`
      );

      return {
        allow: false,
        escalate: true,
        reason: 'Purchase over $100 requires human approval'
      };
    }

    // Security: Block shell commands in production
    if (toolName === 'execute_shell' && process.env.NODE_ENV === 'production') {
      return {
        allow: false,
        reason: 'Shell execution disabled in production'
      };
    }

    return { allow: true };
  },

  // 3. Observability: Log results
  afterToolCall: async (context, toolName, args, result) => {
    await db.logAction('tool_execution', {
      agent: context.agent.Name, // Access agent name via context.agent.Name
      tool: toolName,
      args,
      success: true,
      timestamp: Date.now()
    });
  },

  // 4. Reliability: Error Handling
  onToolError: async (context, toolName, error, args) => {
    console.error(`Tool ${toolName} failed:`, error.message);

    // Network glitches -> Retry
    if (error.message.includes('ECONNRESET') || error.message.includes('timeout')) {
      return 'retry';
    }

    // Auth errors -> Escalate
    if (error.message.includes('401') || error.message.includes('403')) {
      return 'escalate';
    }

    // Default: Continue and let agent handle it
    return 'continue';
  }
};

// Usage Example
async function runProductionAgent() {
  const config: EkoConfig = {
    llms: {
      default: 'claude-3-sonnet'
    },
    hooks: productionHooks,
    // Other config...
  };

  const eko = new Eko(config);

  try {
    const result = await eko.run(
      'Find the cheapest laptop on amazon and buy it',
      'task-123',
      { userId: 'user-001' }
    );
    console.log('Task Complete:', result);
  } catch (error) {
    console.error('Task Failed:', error);
  }
}
