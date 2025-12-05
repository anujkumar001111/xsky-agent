/**
 * Security and sandboxing types for XSky agent framework.
 * Enables trust boundaries, permission systems, and audit logging for tool execution.
 */

import type { AgentContext } from '../core/context';

/**
 * Permission level for tool execution.
 */
export type PermissionLevel = 'allow' | 'require_approval' | 'sandbox' | 'deny';

/**
 * Resource type that can be protected.
 */
export type ResourceType =
  | 'file_system'
  | 'network'
  | 'browser'
  | 'database'
  | 'system_command'
  | 'environment'
  | 'mcp_server';

/**
 * Definition of a security permission for a tool or resource.
 */
export interface SecurityPermission {
  /**
   * Unique identifier for this permission.
   */
  id: string;

  /**
   * Tool name this permission applies to (e.g., "read_file", "send_email").
   * Use "*" for wildcard permissions.
   */
  toolName: string;

  /**
   * Resource type being accessed.
   */
  resourceType: ResourceType;

  /**
   * Permission level for this resource.
   */
  level: PermissionLevel;

  /**
   * Specific resource path or pattern (e.g., "/data/**", "*.com").
   * Supports glob patterns.
   */
  resourcePattern?: string;

  /**
   * Additional constraints on the permission.
   */
  constraints?: ToolConstraint[];

  /**
   * Whether this permission is explicitly granted (true) or revoked (false).
   */
  grant: boolean;

  /**
   * Reason for this permission policy.
   */
  reason?: string;

  /**
   * When this permission expires (timestamp in ms). Undefined = never expires.
   */
  expiresAt?: number;

  /**
   * Who created this permission.
   */
  createdBy?: string;

  /**
   * When this permission was created (timestamp in ms).
   */
  createdAt: number;
}

/**
 * Constraint that limits tool execution within a permission.
 */
export interface ToolConstraint {
  /**
   * Type of constraint.
   */
  type:
    | 'rate_limit'        // Max calls per time window
    | 'arg_validation'     // Validate arguments match pattern
    | 'output_filter'      // Filter/redact output
    | 'size_limit'         // Max data size
    | 'timeout'            // Max execution duration
    | 'context_bound';     // Only accessible to specific agents/contexts

  /**
   * Constraint parameters (varies by type).
   */
  params: Record<string, any>;
}

/**
 * Security context for a single tool execution.
 */
export interface SecurityContext {
  /**
   * Unique execution ID for audit trail.
   */
  executionId: string;

  /**
   * The agent requesting tool execution.
   */
  agentName: string;

  /**
   * Tool being executed.
   */
  toolName: string;

  /**
   * Arguments passed to the tool.
   */
  args: Record<string, any>;

  /**
   * Resources this tool will access.
   */
  requestedResources: ResourceAccess[];

  /**
   * Effective permission level after evaluation.
   */
  effectivePermission: PermissionLevel;

  /**
   * Whether execution is allowed.
   */
  isAllowed: boolean;

  /**
   * Reason for allow/deny decision.
   */
  decision: string;

  /**
   * Applied constraints for this execution.
   */
  appliedConstraints: ToolConstraint[];

  /**
   * Timestamp when context was created (ms).
   */
  createdAt: number;

  /**
   * Timestamp when tool execution started (ms).
   */
  executionStartedAt?: number;

  /**
   * Timestamp when tool execution completed (ms).
   */
  executionCompletedAt?: number;

  /**
   * The actual result from tool execution (for audit logging).
   */
  result?: any;

  /**
   * Any error that occurred during execution.
   */
  error?: Error;

  /**
   * Metadata tags for organizing audit logs.
   */
  tags?: string[];
}

/**
 * Represents a resource being accessed by a tool.
 */
export interface ResourceAccess {
  /**
   * Type of resource.
   */
  type: ResourceType;

  /**
   * Resource identifier (path, URL, command, etc).
   */
  identifier: string;

  /**
   * Type of access (read, write, execute, etc).
   */
  accessType: 'read' | 'write' | 'execute' | 'delete' | 'admin';

  /**
   * Permission status for this access.
   */
  permission: PermissionLevel;

  /**
   * Whether this access is allowed.
   */
  allowed: boolean;

  /**
   * Reason for permission decision.
   */
  reason?: string;
}

/**
 * Result from evaluating tool permissions.
 */
export interface PermissionEvaluation {
  /**
   * Whether tool execution is allowed.
   */
  allowed: boolean;

  /**
   * Effective permission level.
   */
  effectiveLevel: PermissionLevel;

  /**
   * Matched permissions that apply.
   */
  applicablePermissions: SecurityPermission[];

  /**
   * Constraints to apply during execution.
   */
  constraints: ToolConstraint[];

  /**
   * Reason for the decision.
   */
  reason: string;

  /**
   * If false, this requires escalation to human.
   */
  requiresApproval?: boolean;

  /**
   * Approvers who should review this (if requiresApproval is true).
   */
  requiredApprovers?: string[];
}

/**
 * Audit log entry for a tool execution.
 */
export interface AuditLogEntry {
  /**
   * Unique audit log ID.
   */
  id: string;

  /**
   * Task ID this execution belongs to.
   */
  taskId: string;

  /**
   * Security context for this execution.
   */
  securityContext: SecurityContext;

  /**
   * Approval information (if required).
   */
  approval?: {
    required: boolean;
    approved: boolean;
    approver?: string;
    timestamp?: number;
    reason?: string;
  };

  /**
   * Execution outcome.
   */
  outcome: 'success' | 'blocked' | 'failed' | 'escalated';

  /**
   * Additional metadata for compliance/reporting.
   */
  metadata?: Record<string, any>;

  /**
   * Timestamp when logged (ms).
   */
  loggedAt: number;
}

/**
 * Configuration for security sandboxing.
 */
export interface SecurityConfig {
  /**
   * Whether security checks are enabled.
   */
  enabled: boolean;

  /**
   * Default permission level for unknown tools.
   */
  defaultPermissionLevel: PermissionLevel;

  /**
   * Whether to require approval for high-risk operations.
   */
  requireApprovalForHighRisk: boolean;

  /**
   * Tools/resources considered high-risk.
   */
  highRiskPatterns?: {
    tools: string[];        // Tool name patterns
    resources: string[];    // Resource patterns
  };

  /**
   * Audit logging configuration.
   */
  auditLogging?: {
    enabled: boolean;
    logAllExecutions: boolean;
    onlyFailures: boolean;
    persistenceBackend?: 'memory' | 'file' | 'database' | 'custom';
  };

  /**
   * Whether to sandbox risky tool executions.
   */
  sandboxingEnabled: boolean;

  /**
   * Sandbox capabilities (restricted execution environment).
   */
  sandboxCapabilities?: {
    allowFileSystemAccess: boolean;
    allowNetworkAccess: boolean;
    allowProcessSpawn: boolean;
    cpuTimeLimit?: number;    // ms
    memoryLimit?: number;     // MB
  };

  /**
   * Defined permissions for tools.
   */
  permissions?: SecurityPermission[];
}

/**
 * Permission evaluator interface for custom permission logic.
 */
export interface IPermissionEvaluator {
  /**
   * Evaluate whether a tool can be executed.
   */
  evaluate(
    context: AgentContext,
    toolName: string,
    args: Record<string, any>,
    requestedResources: ResourceAccess[]
  ): Promise<PermissionEvaluation>;

  /**
   * Check if a specific resource access is allowed.
   * @param toolName - Optional tool name to check permissions for. If not provided, checks agent-level permissions.
   */
  checkResourceAccess(
    context: AgentContext,
    resource: ResourceAccess,
    toolName?: string
  ): Promise<PermissionLevel>;

  /**
   * Get all permissions that apply to a tool.
   */
  getApplicablePermissions(
    toolName: string
  ): Promise<SecurityPermission[]>;
}

/**
 * Audit logger interface for custom audit implementations.
 */
export interface IAuditLogger {
  /**
   * Log a tool execution.
   */
  log(entry: AuditLogEntry): Promise<void>;

  /**
   * Query audit logs.
   */
  query(filter: {
    taskId?: string;
    toolName?: string;
    agentName?: string;
    outcome?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): Promise<AuditLogEntry[]>;

  /**
   * Export audit logs for compliance.
   */
  export(format: 'json' | 'csv'): Promise<string>;
}
