# XSky Agent Hooks & 12-Factor Control

This guide explains how to use the XSky Agent Hooks system to build production-ready, 12-Factor Agents. The hooks system provides fine-grained control over agent execution, tool usage, error handling, and human-in-the-loop workflows.

## 1. Introduction

The Agent Hooks system separates your business logic (control flow) from the agent's reasoning. This aligns with **Factor III (Control Flow)** and **Factor IX (Human-in-the-Loop)** of the 12-Factor Agent methodology.

### Why use hooks?

- **Reliability**: Prevent infinite loops and handle errors gracefully.
- **Security**: Block dangerous tool calls or validate arguments.
- **Control**: Implement approval gates and rate limits.
- **Integration**: Trigger external webhooks or database updates.
- **Observability**: Log every action and decision.

## 2. Core Concepts

Hooks are callbacks defined in the `AgentHooks` interface. They are executed at specific points in the agent lifecycle.

### Lifecycle Overview

**All 12 hooks are fully implemented:**

**Agent Lifecycle:**
1. **`beforeAgentStart`**: Called before the agent begins execution.
2. **`afterAgentComplete`**: Called after the agent finishes its task.
3. **`onAgentError`**: Called if the agent encounters an unrecoverable error.

**Tool Lifecycle:**
4. **`beforeToolCall`**: Called before any tool is executed.
5. **`afterToolCall`**: Called after a tool executes successfully.
6. **`onToolError`**: Called if a tool execution fails.

**Approval & State:**
7. **`onApprovalRequired`**: Called when escalation is triggered for human approval.
8. **`onCheckpoint`**: Called at intervals to save workflow state.
9. **`onStateChange`**: Called when context variables change (debounced).

**Workflow Lifecycle:**
10. **`onWorkflowGenerated`**: Called when a workflow plan is created.
11. **`onWorkflowStepComplete`**: Called after each workflow step.
12. **`onWorkflowComplete`**: Called when the entire workflow finishes.

## 3. Implementation Patterns

### 3.1 Validation & Security (Blocking Tools)

Use `beforeToolCall` to validate arguments or block specific tools based on policy.

```typescript
const securityHooks: AgentHooks = {
  beforeToolCall: async (context, toolName, args) => {
    // Block dangerous tools in production
    if (toolName === 'delete_database' && context.config.env === 'production') {
      return {
        allow: false,
        reason: 'Database deletion is disabled in production'
      };
    }

    // Validate arguments
    if (toolName === 'send_email' && !args.to.endsWith('@company.com')) {
      return {
        allow: false,
        reason: 'Emails can only be sent to internal domains'
      };
    }

    return { allow: true };
  }
};
```

### 3.2 Rate Limiting

Prevent agents from overwhelming external APIs using `beforeToolCall`.

```typescript
const rateLimitHooks: AgentHooks = {
  beforeToolCall: async (context, toolName, args) => {
    const lastCall = context.variables.get(`last_call_${toolName}`) || 0;
    const now = Date.now();

    if (now - lastCall < 1000) { // 1 second rate limit
      // Option A: Block
      // return { allow: false, reason: 'Rate limit exceeded' };

      // Option B: Wait (simulate delay)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    context.variables.set(`last_call_${toolName}`, Date.now());
    return { allow: true };
  }
};
```

### 3.3 Human-in-the-Loop Approval

Escalate decisions to humans when confidence is low or risks are high.

```typescript
const approvalHooks: AgentHooks = {
  beforeToolCall: async (context, toolName, args) => {
    if (toolName === 'refund_customer' && args.amount > 500) {
      return {
        allow: false,
        escalate: true, // Triggers human intervention
        reason: 'Refunds over $500 require human approval'
      };
    }
    return { allow: true };
  }
};
```

### 3.4 Error Recovery & Retries

Handle errors intelligently with `onToolError`. Note: The framework caps retries at **3 attempts** to prevent infinite loops.

```typescript
const retryHooks: AgentHooks = {
  onToolError: async (context, toolName, error, args) => {
    // Retry on network glitches (max 3 retries enforced by framework)
    if (error.message.includes('ECONNRESET')) {
      return 'retry';
    }

    // Skip non-critical errors
    if (toolName === 'log_analytics') {
      return 'skip'; // Agent continues as if tool succeeded
    }

    // Escalate auth issues
    if (error.message.includes('401 Unauthorized')) {
      return 'escalate'; // Human needs to log in
    }

    return 'continue'; // Let the agent see the error and handle it
  }
};
```

### 3.5 Context Injection

Inject dynamic data into the agent's context before it starts.

```typescript
const contextHooks: AgentHooks = {
  beforeAgentStart: async (context) => {
    // Load user profile
    const user = await db.getUser(context.variables.get('userId'));
    context.variables.set('user_profile', user);

    // Set current time
    context.variables.set('current_time', new Date().toISOString());
  }
};
```

## 4. Configuration

Configure hooks when initializing the `XSky` instance.

```typescript
import { XSky, XSkyConfig, AgentHooks } from '@xsky/ai-agent-core';

const myHooks: AgentHooks = {
  // ... implementation ...
};

const config: XSkyConfig = {
  llms: { /* ... */ },
  hooks: myHooks, // Attach hooks here

  // Optional: Configure state persistence for long-running tasks
  stateConfig: {
    persistence: 'redis',
    ttl: 3600,
    checkpointInterval: 60000
  }
};

const xsky = new XSky(config);
```

## 5. Best Practices (12-Factor Agent)

1.  **Keep Hooks Fast**: Hooks run synchronously in the agent loop. Avoid long-blocking operations unless necessary (e.g., approval waits).
2.  **Idempotency**: Ensure hooks can be re-run safely if the agent is restarted.
3.  **Statelessness**: Don't store state in local variables outside `context.variables`.
4.  **Fail Safe**: If a hook throws an error, it may crash the agent. Wrap hook logic in try/catch blocks.
5.  **Logging**: Use `afterToolCall` for comprehensive audit logging of all agent actions.

## 6. Advanced: Workflow Approval Gates

For more advanced use cases, the framework provides `ProductionXSkyConfig` which extends the base config with workflow-level approval gates. This is defined in `hooks.types.ts`:

```typescript
import { ProductionXSkyConfig } from '@xsky/ai-agent-core';

// Note: ProductionXSkyConfig extends XSkyConfig with additional features
const config: ProductionXSkyConfig = {
  llms: { /* ... */ },
  hooks: { /* ... */ },
  workflow: {
    steps: [
      {
        name: 'research',
        agent: 'BrowserAgent',
        task: 'Research topic',
        autoApprove: true
      },
      {
        name: 'publish',
        agent: 'ContentAgent',
        task: 'Publish article',
        requiresApproval: true, // Forces stop before this step
        approvalChannel: 'slack'
      }
    ]
  }
};
```

> **Note**: `ProductionXSkyConfig` is a type definition for advanced patterns. The actual workflow execution logic for approval gates should be implemented via hooks.

## 7. Built-in Utilities

XSky provides pre-built utilities to simplify common hook patterns:

### 7.1 RateLimiter

A sliding window rate limiter for controlling operation frequency:

```typescript
import { RateLimiter, RateLimitPresets } from '@xsky/ai-agent-core';

// Use preset
const limiter = new RateLimiter(RateLimitPresets.scraping);

// Or custom config
const customLimiter = new RateLimiter({
  maxOperations: 10,
  windowMs: 60000,
  perTool: {
    navigate: { maxOperations: 5, windowMs: 60000 }
  }
});

// Check if allowed
if (limiter.checkLimit('navigate')) {
  // Proceed
} else {
  const waitTime = limiter.getWaitTime('navigate');
  console.log(`Rate limited, wait ${waitTime}ms`);
}
```

### 7.2 Hook Helpers

Pre-built hook implementations:

```typescript
import {
  createRateLimitedHook,
  createBlocklistHook,
  createApprovalRequiredHook,
  createUrlSanitizerHook,
  combineHooks,
  createAuditHook,
  createErrorRecoveryHook
} from '@xsky/ai-agent-core';

const hooks: AgentHooks = {
  // Combine multiple hooks
  beforeToolCall: combineHooks([
    createBlocklistHook(['dangerous_tool', 'delete_file']),
    createRateLimitedHook({ maxOperations: 10, windowMs: 60000 }),
    createApprovalRequiredHook(['purchase', 'deploy']),
    createUrlSanitizerHook()
  ]),

  // Audit logging
  afterToolCall: createAuditHook((entry) => {
    console.log('[AUDIT]', entry);
  }),

  // Error recovery
  onToolError: createErrorRecoveryHook(
    ['timeout', 'ECONNRESET', '429'], // Retryable errors
    ['analytics', 'metrics']           // Skippable tools
  )
};
```

## 8. Checkpoint & Resume

For long-running tasks, use the checkpoint system:

```typescript
const config: XSkyConfig = {
  llms: { /* ... */ },
  hooks: {
    onCheckpoint: async (checkpoint) => {
      // Save to Redis/DB for resume capability
      await redis.set(`checkpoint:${checkpoint.taskId}`, checkpoint.state);
      console.log(`Checkpoint saved: ${checkpoint.id}`);
    },

    onStateChange: async (context, key, value) => {
      // Real-time state sync (debounced)
      await redis.hset(`state:${context.taskId}`, key, JSON.stringify(value));
    }
  }
};

// Enable automatic checkpoints every 5 minutes
const context = await xsky.initContext(workflow);
context.startCheckpointing(300000);

// Resume from checkpoint
const savedState = await redis.get(`checkpoint:${taskId}`);
if (savedState) {
  context.restore(JSON.parse(savedState));
}
```

## 9. Approval Workflows

Implement human-in-the-loop approval:

```typescript
const config: XSkyConfig = {
  llms: { /* ... */ },
  hooks: {
    beforeToolCall: async (ctx, toolName, args) => {
      if (toolName === 'purchase' && args.amount > 1000) {
        return { allow: false, escalate: true, reason: 'Large purchase' };
      }
      return { allow: true };
    },

    onApprovalRequired: async (ctx, request) => {
      // Send to Slack/email/webhook
      const response = await slack.sendApprovalRequest({
        channel: '#approvals',
        message: request.description,
        context: request.context
      });

      return {
        approved: response.approved,
        approver: response.user,
        feedback: response.comment
      };
    }
  }
};
```

