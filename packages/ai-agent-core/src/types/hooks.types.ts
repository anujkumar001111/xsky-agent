import type { AgentContext } from "../core/context";
import type { ToolResult } from "./tools.types";
import type { Workflow, WorkflowAgent, EkoResult } from "./core.types";
import type Context from "../core/context";
import type { SecurityConfig } from "./security.types";


/**
 * Result returned by beforeToolCall hook to control tool execution.
 */
export type ToolHookResult = {
  /**
   * Whether to allow the tool call to proceed.
   * If false, the tool call is blocked and the reason is returned to the LLM.
   */
  allow: boolean;

  /**
   * Reason for blocking the tool call (shown to LLM if allow is false).
   */
  reason?: string;

  /**
   * Modified arguments to use instead of original (if allow is true).
   */
  modifiedArgs?: Record<string, any>;

  /**
   * Whether to escalate this to human review instead of blocking.
   */
  escalate?: boolean;

  /**
   * Skip this tool entirely without error (for scraping/batch scenarios).
   */
  skip?: boolean;
};

/**
 * Result returned by approval request hooks.
 */
export type ApprovalResult = {
  /**
   * Whether the action was approved.
   */
  approved: boolean;

  /**
   * Feedback from the approver (if any).
   */
  feedback?: string;

  /**
   * Who approved/rejected the action.
   */
  approver?: string;

  /**
   * Timestamp of the approval decision.
   */
  timestamp?: number;
};

/**
 * Request for human approval of an action.
 */
export type ApprovalRequest = {
  /**
   * Type of approval being requested.
   */
  type: string;

  /**
   * Description of what is being approved.
   */
  description: string;

  /**
   * Additional context for the approval decision.
   */
  context?: Record<string, any>;

  /**
   * Timeout in milliseconds for the approval request.
   */
  timeout?: number;

  /**
   * Channel to send approval request to (e.g., "slack", "email").
   */
  channel?: string;

  /**
   * Required approvers (by role or identifier).
   */
  requiredApprovers?: string[];

  /**
   * Minimum number of approvals needed.
   */
  minimumApprovals?: number;
};

/**
 * Result returned by agent lifecycle hooks to control execution.
 */
export type AgentHookResult = {
  /**
   * Whether to block the agent from starting/completing.
   */
  block?: boolean;

  /**
   * Reason for blocking the agent.
   */
  reason?: string;

  /**
   * Whether to retry the agent with modifications.
   */
  retry?: boolean;

  /**
   * Whether to escalate to human review.
   */
  escalate?: boolean;
};

/**
 * Result returned by error handling hooks.
 */
export type ErrorHookResult =
  | "retry"      // Retry the failed operation
  | "skip"       // Skip this item and continue
  | "abort"      // Abort the entire task
  | "escalate"   // Escalate to human
  | "continue";  // Continue without retry

/**
 * Checkpoint data for state persistence.
 */
export type Checkpoint = {
  /**
   * Unique identifier for the checkpoint.
   */
  id: string;

  /**
   * Task/thread ID this checkpoint belongs to.
   */
  taskId: string;

  /**
   * Serialized state at this checkpoint.
   */
  state: string;

  /**
   * Additional metadata about the checkpoint.
   */
  metadata: Record<string, any>;

  /**
   * Timestamp when checkpoint was created.
   */
  createdAt: number;
};

/**
 * Configuration for workflow steps with approval gates.
 */
export type WorkflowStep = {
  /**
   * Name of the workflow step.
   */
  name: string;

  /**
   * Agent to use for this step.
   */
  agent: string;

  /**
   * Task description for this step.
   */
  task: string;

  /**
   * Whether to auto-approve this step.
   */
  autoApprove?: boolean;

  /**
   * Whether this step requires human approval before proceeding.
   */
  requiresApproval?: boolean;

  /**
   * Channel for approval requests.
   */
  approvalChannel?: string;

  /**
   * Timeout for approval in milliseconds.
   */
  approvalTimeout?: number;

  /**
   * Only execute if previous approval was granted.
   */
  onlyIfApproved?: boolean;
};

/**
 * Comprehensive hooks interface for production-ready agent control.
 * Implements 12-Factor Agents patterns for enterprise use.
 */
export interface AgentHooks {
  // ============ AGENT LIFECYCLE HOOKS ============

  /**
   * Called before an agent starts executing.
   * Use to inject context, validate prerequisites, or block execution.
   *
   * @example
   * beforeAgentStart: async (ctx) => {
   *   const lead = await crm.getLead(ctx.variables.get('leadId'));
   *   ctx.variables.set('leadHistory', lead.interactions);
   * }
   */
  beforeAgentStart?: (
    context: AgentContext
  ) => Promise<AgentHookResult | void>;

  /**
   * Called after an agent completes successfully.
   * Use for tracking metrics, triggering follow-ups, or validating results.
   *
   * @example
   * afterAgentComplete: async (ctx, result) => {
   *   await analytics.track('agent_completed', {
   *     agent: ctx.agent.Name,
   *     tokensUsed: ctx.usage.totalTokens
   *   });
   * }
   */
  afterAgentComplete?: (
    context: AgentContext,
    result: string
  ) => Promise<AgentHookResult | void>;

  // ============ TOOL LIFECYCLE HOOKS ============

  /**
   * Called before a tool is executed.
   * Use for validation, rate limiting, argument modification, or blocking.
   *
   * @example
   * beforeToolCall: async (ctx, toolName, args) => {
   *   if (toolName === 'send_email' && args.content.includes('refund')) {
   *     return { allow: false, escalate: true, reason: 'Refunds require human approval' };
   *   }
   *   return { allow: true };
   * }
   */
  beforeToolCall?: (
    context: AgentContext,
    toolName: string,
    args: Record<string, any>
  ) => Promise<ToolHookResult>;

  /**
   * Called after a tool executes successfully.
   * Use for logging, data persistence, or result validation.
   *
   * @example
   * afterToolCall: async (ctx, toolName, result) => {
   *   if (toolName === 'extract_price') {
   *     await db.prices.insert({
   *       product: ctx.variables.get('currentProduct'),
   *       price: result.price,
   *       timestamp: Date.now()
   *     });
   *   }
   * }
   */
  afterToolCall?: (
    context: AgentContext,
    toolName: string,
    args: Record<string, any>,
    result: ToolResult
  ) => Promise<void>;

  // ============ ERROR HANDLING HOOKS ============

  /**
   * Called when a tool execution fails.
   * Use for error recovery, retry logic, or escalation.
   *
   * @example
   * onToolError: async (ctx, toolName, error) => {
   *   if (error.message.includes('CAPTCHA')) {
   *     await ctx.requestHumanHelp('captcha', 'Please solve the CAPTCHA');
   *     return 'retry';
   *   }
   *   return 'escalate';
   * }
   */
  onToolError?: (
    context: AgentContext,
    toolName: string,
    error: Error,
    args: Record<string, any>
  ) => Promise<ErrorHookResult>;

  /**
   * Called when an agent encounters an error.
   * Use for cleanup, notification, or recovery strategies.
   */
  onAgentError?: (
    context: AgentContext,
    error: Error
  ) => Promise<ErrorHookResult>;

  // ============ APPROVAL & HUMAN-IN-THE-LOOP HOOKS ============

  /**
   * Called when human approval is required for an action.
   * Use for multi-channel approval workflows (Slack, email, etc.).
   *
   * @example
   * onApprovalRequired: async (ctx, request) => {
   *   if (request.type === 'price_change') {
   *     await slack.send('#pricing', {
   *       text: `Price change detected: ${request.description}`,
   *       actions: ['Approve', 'Reject']
   *     });
   *     return { approved: false, waitForWebhook: true };
   *   }
   * }
   */
  onApprovalRequired?: (
    context: AgentContext,
    request: ApprovalRequest
  ) => Promise<ApprovalResult>;

  // ============ STATE PERSISTENCE HOOKS ============

  /**
   * Called when a checkpoint should be saved.
   * Use for long-running tasks that need resume capability.
   *
   * @example
   * onCheckpoint: async (checkpoint) => {
   *   await redis.hset(`task:${checkpoint.taskId}`, {
   *     state: checkpoint.state,
   *     progress: checkpoint.metadata.itemsProcessed
   *   });
   * }
   */
  onCheckpoint?: (checkpoint: Checkpoint) => Promise<void>;

  /**
   * Called when state changes and should be persisted.
   * Use for real-time state synchronization.
   */
  onStateChange?: (
    context: Context,
    key: string,
    value: any
  ) => Promise<void>;

  // ============ WORKFLOW HOOKS ============

  /**
   * Called when a workflow is generated/modified.
   * Use for workflow validation, logging, or customization.
   */
  onWorkflowGenerated?: (
    context: Context,
    workflow: Workflow
  ) => Promise<void>;

  /**
   * Called when a workflow step completes.
   * Use for progress tracking or step-level approval gates.
   */
  onWorkflowStepComplete?: (
    context: Context,
    step: WorkflowAgent,
    result: string
  ) => Promise<AgentHookResult | void>;

  /**
   * Called when the entire workflow completes.
   * Use for final validation, notifications, or cleanup.
   */
  onWorkflowComplete?: (
    context: Context,
    result: EkoResult
  ) => Promise<void>;
}

/**
 * Configuration for state persistence.
 */
export interface StateConfig {
  /**
   * Persistence backend: "memory", "redis", "postgresql", etc.
   */
  persistence: "memory" | "redis" | "postgresql" | "custom";

  /**
   * Time-to-live for persisted state in seconds.
   */
  ttl?: number;

  /**
   * Interval for automatic checkpoints in milliseconds.
   */
  checkpointInterval?: number;

  /**
   * Custom persistence handlers (when persistence is "custom").
   */
  customHandlers?: {
    save: (taskId: string, state: any) => Promise<void>;
    load: (taskId: string) => Promise<any>;
    delete: (taskId: string) => Promise<void>;
  };
}

/**
 * Configuration for approval workflows.
 */
export interface ApprovalConfig {
  /**
   * Default timeout for approval requests in milliseconds.
   */
  defaultTimeout?: number;

  /**
   * Default channel for approval requests.
   */
  defaultChannel?: string;

  /**
   * Action to take when approval times out.
   */
  onTimeout?: "abort" | "skip" | "auto-approve" | "escalate";

  /**
   * Conditional approval rules.
   */
  rules?: ApprovalRule[];
}

/**
 * A conditional approval rule.
 */
export interface ApprovalRule {
  /**
   * Condition function to determine if this rule applies.
   */
  condition: (context: AgentContext) => boolean;

  /**
   * Channel to send approval request to.
   */
  channel?: string;

  /**
   * Timeout for this specific rule.
   */
  timeout?: number;

  /**
   * Whether to auto-approve if condition matches.
   */
  autoApprove?: boolean;

  /**
   * Who to escalate to if approval times out.
   */
  escalateTo?: string;

  /**
   * Required approvers for this rule.
   */
  requiredApprovers?: string[];

  /**
   * Whether signature is required for approval.
   */
  requiresSignature?: boolean;
}

/**
 * Rate limiting configuration for tools/actions.
 */
export interface RateLimitConfig {
  /**
   * Maximum operations per time window.
   */
  maxOperations: number;

  /**
   * Time window in milliseconds.
   */
  windowMs: number;

  /**
   * Optional per-tool rate limits.
   */
  perTool?: Record<string, { maxOperations: number; windowMs: number }>;
}

/**
 * Extended EkoConfig with production-ready hooks and configuration.
 */
export interface ProductionEkoConfig {
  /**
   * Agent lifecycle and tool execution hooks.
   */
  hooks?: AgentHooks;

  /**
   * State persistence configuration.
   */
  stateConfig?: StateConfig;

  /**
   * Approval workflow configuration.
   */
  approvalConfig?: ApprovalConfig;

  /**
   * Rate limiting configuration.
   */
  rateLimits?: RateLimitConfig;

  /**
   * Multi-step workflow configuration with approval gates.
   */
  workflow?: {
    steps: WorkflowStep[];
  };

  /**
   * Webhook handlers for external integrations.
   */
  webhooks?: Record<string, (request: any) => Promise<void>>;

  /**
   * Security configuration for sandboxing and permissions.
   */
  security?: SecurityConfig;
}
