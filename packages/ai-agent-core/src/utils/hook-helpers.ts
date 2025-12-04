/**
 * Hook Helper Functions
 *
 * Pre-built hook implementations for common patterns.
 * Use these as building blocks for your production hooks.
 */

import type {
  AgentHooks,
  ToolHookResult,
  RateLimitConfig,
} from "../types/hooks.types";
import { RateLimiter } from "./rate-limiter";

/**
 * Creates a rate-limited beforeToolCall hook.
 *
 * @param config - Rate limit configuration.
 * @returns A beforeToolCall hook function.
 *
 * @example
 * ```typescript
 * const hooks: AgentHooks = {
 *   beforeToolCall: createRateLimitedHook({
 *     maxOperations: 10,
 *     windowMs: 60000,
 *     perTool: {
 *       navigate: { maxOperations: 5, windowMs: 60000 }
 *     }
 *   })
 * };
 * ```
 */
export function createRateLimitedHook(
  config: RateLimitConfig
): NonNullable<AgentHooks["beforeToolCall"]> {
  const limiter = new RateLimiter(config);

  return async (context, toolName, args): Promise<ToolHookResult> => {
    const allowed = limiter.checkLimit(toolName);
    if (!allowed) {
      const usage = limiter.getUsage(toolName);
      return {
        allow: false,
        reason: `Rate limit exceeded for "${toolName}": ${usage.current}/${usage.max} operations in ${usage.windowMs}ms window`,
      };
    }
    return { allow: true };
  };
}

/**
 * Creates a tool blocking hook based on a blocklist.
 *
 * @param blockedTools - Array of tool names to block.
 * @param reason - Optional reason to provide when blocking.
 * @returns A beforeToolCall hook function.
 *
 * @example
 * ```typescript
 * const hooks: AgentHooks = {
 *   beforeToolCall: createBlocklistHook(
 *     ['execute_shell', 'delete_file'],
 *     'Tool blocked by security policy'
 *   )
 * };
 * ```
 */
export function createBlocklistHook(
  blockedTools: string[],
  reason: string = "Tool blocked by policy"
): NonNullable<AgentHooks["beforeToolCall"]> {
  const blockedSet = new Set(blockedTools);

  return async (context, toolName, args): Promise<ToolHookResult> => {
    if (blockedSet.has(toolName)) {
      return {
        allow: false,
        reason: `${reason}: ${toolName}`,
      };
    }
    return { allow: true };
  };
}

/**
 * Creates a hook that requires approval for specific tools.
 *
 * @param approvalTools - Array of tool names requiring approval.
 * @param reason - Optional reason for requiring approval.
 * @returns A beforeToolCall hook function.
 *
 * @example
 * ```typescript
 * const hooks: AgentHooks = {
 *   beforeToolCall: createApprovalRequiredHook(
 *     ['purchase', 'send_email', 'deploy'],
 *     'High-risk action requires approval'
 *   )
 * };
 * ```
 */
export function createApprovalRequiredHook(
  approvalTools: string[],
  reason: string = "Action requires human approval"
): NonNullable<AgentHooks["beforeToolCall"]> {
  const approvalSet = new Set(approvalTools);

  return async (context, toolName, args): Promise<ToolHookResult> => {
    if (approvalSet.has(toolName)) {
      return {
        allow: false,
        escalate: true,
        reason: `${reason}: ${toolName}`,
      };
    }
    return { allow: true };
  };
}

/**
 * Creates a hook that sanitizes URLs (upgrades HTTP to HTTPS).
 *
 * @returns A beforeToolCall hook function.
 *
 * @example
 * ```typescript
 * const hooks: AgentHooks = {
 *   beforeToolCall: createUrlSanitizerHook()
 * };
 * ```
 */
export function createUrlSanitizerHook(): NonNullable<AgentHooks["beforeToolCall"]> {
  return async (context, toolName, args): Promise<ToolHookResult> => {
    // Check for URL in common argument names
    const urlKeys = ["url", "href", "src", "link"];
    let modified = false;
    const modifiedArgs = { ...args };

    for (const key of urlKeys) {
      if (typeof args[key] === "string" && args[key].startsWith("http://")) {
        modifiedArgs[key] = args[key].replace("http://", "https://");
        modified = true;
      }
    }

    if (modified) {
      return {
        allow: true,
        modifiedArgs,
      };
    }

    return { allow: true };
  };
}

/**
 * Combines multiple beforeToolCall hooks into one.
 * Hooks are executed in order. If any hook blocks, execution stops.
 *
 * @param hooks - Array of beforeToolCall hooks to combine.
 * @returns A combined beforeToolCall hook function.
 *
 * @example
 * ```typescript
 * const hooks: AgentHooks = {
 *   beforeToolCall: combineHooks([
 *     createBlocklistHook(['dangerous_tool']),
 *     createRateLimitedHook({ maxOperations: 10, windowMs: 60000 }),
 *     createUrlSanitizerHook()
 *   ])
 * };
 * ```
 */
export function combineHooks(
  hooks: NonNullable<AgentHooks["beforeToolCall"]>[]
): NonNullable<AgentHooks["beforeToolCall"]> {
  return async (context, toolName, args): Promise<ToolHookResult> => {
    let currentArgs = args;

    for (const hook of hooks) {
      const result = await hook(context, toolName, currentArgs);

      if (!result.allow) {
        return result; // Stop on first block
      }

      // Apply modified args for next hook
      if (result.modifiedArgs) {
        currentArgs = result.modifiedArgs;
      }
    }

    // All hooks passed
    return {
      allow: true,
      modifiedArgs: currentArgs !== args ? currentArgs : undefined,
    };
  };
}

/**
 * Creates an audit logging hook.
 *
 * @param logger - Function to call with audit entries.
 * @returns An afterToolCall hook function.
 *
 * @example
 * ```typescript
 * const hooks: AgentHooks = {
 *   afterToolCall: createAuditHook((entry) => {
 *     console.log('[AUDIT]', entry);
 *     // Or send to logging service
 *   })
 * };
 * ```
 */
export function createAuditHook(
  logger: (entry: {
    timestamp: number;
    toolName: string;
    args: Record<string, any>;
    success: boolean;
    resultSize: number;
  }) => void | Promise<void>
): NonNullable<AgentHooks["afterToolCall"]> {
  return async (context, toolName, args, result) => {
    await logger({
      timestamp: Date.now(),
      toolName,
      args,
      success: !result.isError,
      resultSize: JSON.stringify(result).length,
    });
  };
}

/**
 * Creates an error recovery hook with retry logic.
 *
 * @param retryableErrors - Array of error message substrings that should trigger retry.
 * @param skippableTools - Array of tool names that can be skipped on error.
 * @returns An onToolError hook function.
 *
 * @example
 * ```typescript
 * const hooks: AgentHooks = {
 *   onToolError: createErrorRecoveryHook(
 *     ['timeout', 'ECONNRESET', '429'],
 *     ['analytics', 'metrics']
 *   )
 * };
 * ```
 */
export function createErrorRecoveryHook(
  retryableErrors: string[] = ["timeout", "ECONNRESET", "429"],
  skippableTools: string[] = []
): NonNullable<AgentHooks["onToolError"]> {
  const skippableSet = new Set(skippableTools);

  return async (context, toolName, error, args) => {
    // Check if error is retryable
    for (const pattern of retryableErrors) {
      if (error.message.includes(pattern)) {
        return "retry";
      }
    }

    // Check if tool is skippable
    if (skippableSet.has(toolName)) {
      return "skip";
    }

    // Default: let agent handle the error
    return "continue";
  };
}
