/**
 * Tool execution sandbox for XSky security framework.
 * Wraps tool execution with security checks, approval gates, and audit logging.
 */

import Log from '../common/log';
import { uuidv4 } from '../common/utils';
import type { AgentContext } from '../core/context';
import {
  SecurityContext,
  AuditLogEntry,
  ToolConstraint,
  ResourceAccess,
  PermissionLevel,
} from '../types/security.types';
import { DefaultPermissionEvaluator } from './permission-evaluator';
import { InMemoryAuditLogger } from './audit-logger';
import type { IPermissionEvaluator, IAuditLogger, SecurityConfig } from '../types/security.types';

/**
 * Options for tool execution sandboxing.
 */
export interface ToolSandboxOptions {
  permissionEvaluator: IPermissionEvaluator;
  auditLogger: IAuditLogger;
  config: SecurityConfig;
}

/**
 * Result from sandboxed tool execution.
 */
export interface SandboxResult {
  /**
   * Whether execution was allowed to proceed.
   */
  allowed: boolean;

  /**
   * Reason for allow/deny decision.
   */
  reason: string;

  /**
   * Actual tool result (if execution succeeded).
   */
  result?: any;

  /**
   * Error that occurred during execution.
   */
  error?: Error;

  /**
   * Security context for this execution.
   */
  securityContext: SecurityContext;

  /**
   * Whether execution required human approval.
   */
  requiresApproval?: boolean;

  /**
   * Whether execution was approved (if requiresApproval is true).
   */
  approved?: boolean;
}

/**
 * Sandbox for secure tool execution with permission checks and audit logging.
 */
export class ToolExecutionSandbox {
  private options: ToolSandboxOptions;

  /**
   * Creates a new ToolExecutionSandbox.
   */
  constructor(options: ToolSandboxOptions) {
    this.options = options;
  }

  /**
   * Execute a tool with security checks, approval gates, and audit logging.
   */
  async execute(
    context: AgentContext,
    toolName: string,
    args: Record<string, any>,
    toolExecutor: () => Promise<any>,
    requestedResources: ResourceAccess[] = []
  ): Promise<SandboxResult> {
    const executionId = uuidv4();
    const createdAt = Date.now();
    let securityContext: SecurityContext = {
        executionId,
        agentName: context.agent.Name,
        toolName,
        args,
        requestedResources,
        effectivePermission: 'allow',
        isAllowed: false,
        decision: 'pending',
        appliedConstraints: [],
        createdAt,
    };

    try {
      // Step 1: Evaluate permissions
      const evaluation = await this.options.permissionEvaluator.evaluate(
        context,
        toolName,
        args,
        requestedResources
      );

      securityContext.effectivePermission = evaluation.effectiveLevel;
      securityContext.isAllowed = evaluation.allowed;
      securityContext.decision = evaluation.reason;
      securityContext.appliedConstraints = evaluation.constraints;

      Log.debug(`Permission evaluation for ${toolName}:`, {
        executionId,
        allowed: evaluation.allowed,
        level: evaluation.effectiveLevel,
      });

      // If denied, return immediately
      if (!evaluation.allowed) {
        const result: SandboxResult = {
          allowed: false,
          reason: evaluation.reason,
          requiresApproval: false,
          securityContext,
          error: new Error(`Tool execution denied: ${evaluation.reason}`),
        };

        await this.logAudit(context.context.taskId, securityContext, result, 'blocked');
        return result;
      }

      // Step 2: Check if approval is required
      let approved = true;
      if (evaluation.requiresApproval) {
        approved = await this.requestApproval(context, securityContext, evaluation);

        if (!approved) {
          const result: SandboxResult = {
            allowed: false,
            reason: 'Approval denied by user',
            requiresApproval: true,
            approved: false,
            securityContext,
            error: new Error('Tool execution rejected by approver'),
          };

          await this.logAudit(context.context.taskId, securityContext, result, 'blocked', {
            approval: {
              required: true,
              approved: false,
            },
          });

          return result;
        }
      }

      // Step 3: Execute tool with constraints applied
      securityContext.executionStartedAt = Date.now();

      let toolResult: any;
      let executionError: Error | undefined;

      try {
        // Apply constraints (timeout, validation, etc.)
        toolResult = await this.executeWithConstraints(
          toolExecutor,
          evaluation.constraints
        );
      } catch (error) {
        executionError = error instanceof Error ? error : new Error(String(error));
      }

      securityContext.executionCompletedAt = Date.now();
      securityContext.result = toolResult;
      securityContext.error = executionError;

      // Step 4: Log execution
      const outcome =
        executionError || !evaluation.allowed ? 'failed' : 'success';

      await this.logAudit(
        context.context.taskId,
        securityContext,
        {
          allowed: evaluation.allowed,
          reason: evaluation.reason,
          result: toolResult,
          error: executionError,
          requiresApproval: evaluation.requiresApproval,
          securityContext,
        } as SandboxResult,
        outcome,
        evaluation.requiresApproval
          ? {
              approval: {
                required: true,
                approved: true,
              },
            }
          : undefined
      );

      if (executionError) {
        return {
          allowed: true,
          reason: `Tool execution failed: ${executionError}`,
          requiresApproval: evaluation.requiresApproval,
          approved: approved,
          securityContext,
          error: executionError,
        };
      }

      return {
        allowed: true,
        reason: 'Tool execution successful',
        result: toolResult,
        requiresApproval: evaluation.requiresApproval,
        approved: approved,
        securityContext,
      };
    } catch (error) {
      // Use existing security context if available (meaning we passed permission check)
      // Otherwise create a new one (meaning we failed before/during check)
      const isPostCheck = securityContext.isAllowed;

      if (!isPostCheck) {
         // This was a pre-execution error or check failure
         securityContext.effectivePermission = 'deny';
         securityContext.isAllowed = false;
         securityContext.decision = `Execution error: ${error}`;
         securityContext.error = error instanceof Error ? error : new Error(String(error));
         securityContext.executionCompletedAt = Date.now();

          await this.logAudit(context.context.taskId, securityContext, {
            allowed: false,
            reason: 'Tool execution failed',
            requiresApproval: false,
            securityContext,
            error: securityContext.error,
          }, 'failed');

          return {
            allowed: false,
            reason: `Tool execution failed: ${error}`,
            requiresApproval: false,
            securityContext,
            error: error instanceof Error ? error : new Error(String(error)),
          };
      }

      // This was an execution error AFTER permission granted
      securityContext.executionCompletedAt = Date.now();
      securityContext.error = error instanceof Error ? error : new Error(String(error));

      await this.logAudit(context.context.taskId, securityContext, {
        allowed: true,
        reason: 'Tool execution failed',
        requiresApproval: false,
        securityContext,
        error: securityContext.error,
      }, 'failed');

      return {
        allowed: true, // It WAS allowed, but failed
        reason: `Tool execution failed: ${error}`,
        requiresApproval: false,
        securityContext,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Execute tool function with constraints applied.
   */
  private async executeWithConstraints(
    toolExecutor: () => Promise<any>,
    constraints: ToolConstraint[]
  ): Promise<any> {
    // Find timeout constraint
    const timeoutConstraint = constraints.find((c) => c.type === 'timeout');
    const timeoutMs = timeoutConstraint?.params.timeoutMs || 30000;

    // Wrap execution with timeout
    return Promise.race([
      toolExecutor(),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(new Error(`Tool execution timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Request human approval for sensitive operations.
   */
  private async requestApproval(
    context: AgentContext,
    securityContext: SecurityContext,
    evaluation: any
  ): Promise<boolean> {
    Log.info(`Approval required for tool: ${securityContext.toolName}`, {
      executionId: securityContext.executionId,
      reason: evaluation.reason,
    });

    // Check if context has approval handler
    if (context.context.config.hooks?.onApprovalRequired) {
      try {
        const result = await context.context.config.hooks.onApprovalRequired(context, {
          type: 'tool_execution',
          description: `Execute tool "${securityContext.toolName}" with high-risk resources`,
          context: {
            toolName: securityContext.toolName,
            args: securityContext.args,
            resources: securityContext.requestedResources,
            reason: evaluation.reason,
          },
          requiredApprovers: evaluation.requiredApprovers,
        });

        return result?.approved || false;
      } catch (error) {
        Log.error('Approval request failed:', error);
        return false;
      }
    }

    // Default: deny if no approval handler available
    Log.warn('No approval handler configured, denying tool execution');
    return false;
  }

  /**
   * Log tool execution to audit logger.
   */
  private async logAudit(
    taskId: string,
    securityContext: SecurityContext,
    result: SandboxResult,
    outcome: 'success' | 'blocked' | 'failed' | 'escalated',
    approval?: any
  ): Promise<void> {
    if (!this.options.config.auditLogging?.enabled) {
      return;
    }

    try {
      const entry: AuditLogEntry = {
        id: uuidv4(),
        taskId,
        securityContext,
        outcome,
        approval,
        metadata: {
          executionTimeMs: securityContext.executionCompletedAt
            ? securityContext.executionCompletedAt - securityContext.createdAt
            : null,
        },
        loggedAt: Date.now(),
      };

      await this.options.auditLogger.log(entry);
    } catch (error) {
      Log.error('Failed to log audit entry:', error);
    }
  }
}

/**
 * Factory for creating tool execution sandboxes.
 */
export class ToolSandboxFactory {
  /**
   * Create a sandbox with default configuration.
   */
  static createDefault(config: SecurityConfig): ToolExecutionSandbox {
    const evaluator = new DefaultPermissionEvaluator(config);
    const logger = new InMemoryAuditLogger();

    return new ToolExecutionSandbox({
      permissionEvaluator: evaluator,
      auditLogger: logger,
      config,
    });
  }

  /**
   * Create a sandbox with custom evaluator and logger.
   */
  static create(options: ToolSandboxOptions): ToolExecutionSandbox {
    return new ToolExecutionSandbox(options);
  }
}
