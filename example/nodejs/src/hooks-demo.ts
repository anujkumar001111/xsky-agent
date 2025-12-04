/**
 * XSky Hooks Demo - Production-Ready Agent Control
 *
 * This example demonstrates how to use the hooks system for:
 * - Rate limiting
 * - Tool validation and blocking
 * - Human-in-the-loop approval
 * - Error recovery
 * - Audit logging
 *
 * Run with: npx ts-node hooks-demo.ts
 */

import {
  Eko,
  EkoConfig,
  AgentHooks,
  ToolHookResult,
  RateLimitConfig,
} from "@xsky/ai-agent-core";

// ============================================================
// Rate Limiter Implementation
// ============================================================

class RateLimiter {
  private operations: Map<string, number[]> = new Map();

  constructor(private config: RateLimitConfig) {}

  checkLimit(toolName: string): boolean {
    const limit = this.config.perTool?.[toolName] || this.config;
    const now = Date.now();
    const ops = this.operations.get(toolName) || [];

    // Remove expired operations
    const valid = ops.filter((t) => now - t < limit.windowMs);

    if (valid.length >= limit.maxOperations) {
      return false; // Rate limited
    }

    valid.push(now);
    this.operations.set(toolName, valid);
    return true;
  }
}

// ============================================================
// Production Hooks Implementation
// ============================================================

// Audit log (in production, send to your logging service)
const auditLog: Array<{
  timestamp: number;
  event: string;
  toolName?: string;
  details?: any;
}> = [];

function log(event: string, toolName?: string, details?: any) {
  const entry = { timestamp: Date.now(), event, toolName, details };
  auditLog.push(entry);
  console.log(`[AUDIT] ${event}`, toolName ? `tool=${toolName}` : "", details || "");
}

// Rate limiter instance
const rateLimiter = new RateLimiter({
  maxOperations: 10,
  windowMs: 60000, // 1 minute
  perTool: {
    navigate: { maxOperations: 5, windowMs: 60000 },
    scrape: { maxOperations: 3, windowMs: 60000 },
  },
});

// Blocked tools list
const BLOCKED_TOOLS = ["execute_shell", "delete_file", "drop_database"];

// High-risk tools requiring approval
const APPROVAL_REQUIRED_TOOLS = ["purchase", "send_email", "deploy"];

const productionHooks: AgentHooks = {
  // ============ AGENT LIFECYCLE ============

  beforeAgentStart: async (context) => {
    log("agent_start");

    // Inject runtime context
    context.variables.set("startTime", Date.now());
    context.variables.set("environment", process.env.NODE_ENV || "development");

    // You could load user preferences, feature flags, etc. here
    // const user = await db.getUser(context.variables.get('userId'));
    // context.variables.set('userPreferences', user.preferences);

    return undefined; // Continue normally
  },

  afterAgentComplete: async (context, result) => {
    const startTime = context.variables.get("startTime");
    const duration = Date.now() - startTime;

    log("agent_complete", undefined, {
      duration: `${duration}ms`,
      resultLength: result.length,
    });

    return undefined;
  },

  // ============ TOOL LIFECYCLE ============

  beforeToolCall: async (context, toolName, args): Promise<ToolHookResult> => {
    // 1. Security: Block dangerous tools
    if (BLOCKED_TOOLS.includes(toolName)) {
      log("tool_blocked", toolName, { reason: "security_policy" });
      return {
        allow: false,
        reason: `Tool "${toolName}" is blocked by security policy`,
      };
    }

    // 2. Rate limiting
    if (!rateLimiter.checkLimit(toolName)) {
      log("tool_rate_limited", toolName);
      return {
        allow: false,
        reason: `Rate limit exceeded for "${toolName}". Please wait.`,
      };
    }

    // 3. Human approval for high-risk operations
    if (APPROVAL_REQUIRED_TOOLS.includes(toolName)) {
      log("tool_approval_required", toolName, args);
      return {
        allow: false,
        escalate: true,
        reason: `Tool "${toolName}" requires human approval`,
      };
    }

    // 4. Argument sanitization (example: force HTTPS)
    if (toolName === "navigate" && args.url?.startsWith("http://")) {
      log("tool_args_modified", toolName, { original: args.url });
      return {
        allow: true,
        modifiedArgs: { ...args, url: args.url.replace("http://", "https://") },
      };
    }

    log("tool_allowed", toolName);
    return { allow: true };
  },

  afterToolCall: async (context, toolName, args, result) => {
    log("tool_complete", toolName, {
      success: !result.isError,
      resultSize: JSON.stringify(result).length,
    });

    // Persist important results (example: price monitoring)
    if (toolName === "extract_price" && result.content) {
      // await db.prices.insert({
      //   product: context.variables.get('currentProduct'),
      //   price: result.result,
      //   timestamp: Date.now()
      // });
    }
  },

  // ============ ERROR HANDLING ============

  onToolError: async (context, toolName, error, args) => {
    log("tool_error", toolName, { error: error.message });

    // Retry transient errors
    if (
      error.message.includes("ECONNRESET") ||
      error.message.includes("timeout") ||
      error.message.includes("429")
    ) {
      const retryCount = context.variables.get(`retry_${toolName}`) || 0;
      if (retryCount < 3) {
        context.variables.set(`retry_${toolName}`, retryCount + 1);
        log("tool_retry", toolName, { attempt: retryCount + 1 });
        return "retry";
      }
    }

    // Skip non-critical tools
    const nonCritical = ["analytics", "log", "metrics"];
    if (nonCritical.includes(toolName)) {
      log("tool_skipped", toolName);
      return "skip";
    }

    // Escalate auth errors
    if (error.message.includes("401") || error.message.includes("403")) {
      log("tool_escalate", toolName, { reason: "auth_error" });
      return "escalate";
    }

    // Default: let agent handle the error
    return "continue";
  },

  onAgentError: async (context, error) => {
    log("agent_error", undefined, { error: error.message });

    // You could notify on-call here
    // await pagerduty.alert({ message: error.message, context });

    return "escalate";
  },

  // ============ WORKFLOW LIFECYCLE ============

  onWorkflowGenerated: async (context, workflow) => {
    log("workflow_generated", undefined, {
      name: workflow.name,
      agentCount: workflow.agents.length,
    });
  },

  onWorkflowStepComplete: async (context, step, result) => {
    log("workflow_step_complete", undefined, {
      step: step.name,
      status: step.status,
    });
  },

  onWorkflowComplete: async (context, result) => {
    log("workflow_complete", undefined, {
      success: result.success,
      stopReason: result.stopReason,
    });

    // Print audit summary
    console.log("\n=== AUDIT LOG SUMMARY ===");
    console.log(`Total events: ${auditLog.length}`);
    console.log(`Tools called: ${auditLog.filter((e) => e.event === "tool_complete").length}`);
    console.log(`Errors: ${auditLog.filter((e) => e.event.includes("error")).length}`);
    console.log(`Blocked: ${auditLog.filter((e) => e.event === "tool_blocked").length}`);
  },
};

// ============================================================
// Example Usage
// ============================================================

async function main() {
  console.log("XSky Hooks Demo\n");

  // This would be your actual config with LLM keys
  const config: EkoConfig = {
    llms: {
      default: {
        provider: "openai",
        model: "gpt-4",
        apiKey: process.env.OPENAI_API_KEY || "demo-key-not-used",
      },
    },
    hooks: productionHooks,
  };

  // Demonstrate hook behavior without running full agent
  console.log("Testing hooks directly:\n");

  // Mock context
  const mockContext = {
    variables: new Map<string, any>(),
  } as any;

  // Test 1: Agent start
  await productionHooks.beforeAgentStart!(mockContext);
  console.log("✓ beforeAgentStart called\n");

  // Test 2: Allowed tool
  const allowedResult = await productionHooks.beforeToolCall!(mockContext, "click", {
    selector: "#btn",
  });
  console.log("click tool:", allowedResult.allow ? "✓ allowed" : "✗ blocked");

  // Test 3: Blocked tool
  const blockedResult = await productionHooks.beforeToolCall!(mockContext, "execute_shell", {
    command: "rm -rf /",
  });
  console.log("execute_shell:", blockedResult.allow ? "✓ allowed" : "✗ blocked");

  // Test 4: URL sanitization
  const sanitizedResult = await productionHooks.beforeToolCall!(mockContext, "navigate", {
    url: "http://example.com",
  });
  console.log(
    "navigate http://:",
    sanitizedResult.modifiedArgs?.url === "https://example.com"
      ? "✓ upgraded to HTTPS"
      : "✗ not modified"
  );

  // Test 5: Approval required
  const approvalResult = await productionHooks.beforeToolCall!(mockContext, "purchase", {
    amount: 100,
  });
  console.log("purchase:", approvalResult.escalate ? "✓ escalated for approval" : "✗ auto-approved");

  // Test 6: Error recovery
  const errorResult = await productionHooks.onToolError!(
    mockContext,
    "fetch",
    new Error("Request timeout"),
    {}
  );
  console.log("timeout error:", errorResult === "retry" ? "✓ will retry" : "✗ no retry");

  console.log("\n=== Demo Complete ===");
}

main().catch(console.error);
