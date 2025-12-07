/**
 * Integration tests for the AgentHooks system
 * Tests that hooks are actually called during workflow execution
 */

import { jest } from "@jest/globals";
import {
  AgentHooks,
  ToolHookResult,
  ErrorHookResult,
  ApprovalRequest,
  Checkpoint,
} from "../../src/types/hooks.types";
import type { AgentContext } from "../../src/core/context";
import type { ToolResult, Tool } from "../../src/types/tools.types";
import Context from "../../src/core/context";
import Chain from "../../src/core/chain";
import type { XSkyConfig } from "../../src/types/core.types";

describe("AgentHooks Integration", () => {
  // Mock tracking for hook calls
  let hookCalls: {
    beforeAgentStart: number;
    afterAgentComplete: number;
    beforeToolCall: Array<{ toolName: string; args: any }>;
    afterToolCall: Array<{ toolName: string; result: any }>;
    onToolError: Array<{ toolName: string; error: Error }>;
    onAgentError: number;
    onWorkflowGenerated: number;
    onWorkflowStepComplete: number;
    onWorkflowComplete: number;
  };

  beforeEach(() => {
    hookCalls = {
      beforeAgentStart: 0,
      afterAgentComplete: 0,
      beforeToolCall: [],
      afterToolCall: [],
      onToolError: [],
      onAgentError: 0,
      onWorkflowGenerated: 0,
      onWorkflowStepComplete: 0,
      onWorkflowComplete: 0,
    };
  });

  describe("Hook Call Tracking", () => {
    it("should track beforeToolCall invocations", () => {
      const hooks: AgentHooks = {
        beforeToolCall: async (ctx, toolName, args) => {
          hookCalls.beforeToolCall.push({ toolName, args });
          return { allow: true };
        },
      };

      // Simulate hook being called
      const mockContext = {} as AgentContext;
      hooks.beforeToolCall!(mockContext, "navigate", { url: "https://example.com" });

      expect(hookCalls.beforeToolCall).toHaveLength(1);
      expect(hookCalls.beforeToolCall[0].toolName).toBe("navigate");
    });

    it("should track afterToolCall invocations", async () => {
      const hooks: AgentHooks = {
        afterToolCall: async (ctx, toolName, args, result) => {
          hookCalls.afterToolCall.push({ toolName, result });
        },
      };

      const mockContext = {} as AgentContext;
      const mockResult: ToolResult = { result: "success" };
      await hooks.afterToolCall!(mockContext, "click", { selector: "#btn" }, mockResult);

      expect(hookCalls.afterToolCall).toHaveLength(1);
      expect(hookCalls.afterToolCall[0].toolName).toBe("click");
    });

    it("should track onToolError invocations", async () => {
      const hooks: AgentHooks = {
        onToolError: async (ctx, toolName, error, args) => {
          hookCalls.onToolError.push({ toolName, error });
          return "continue";
        },
      };

      const mockContext = {} as AgentContext;
      const testError = new Error("Connection reset");
      const result = await hooks.onToolError!(mockContext, "fetch", testError, {});

      expect(hookCalls.onToolError).toHaveLength(1);
      expect(hookCalls.onToolError[0].error.message).toBe("Connection reset");
      expect(result).toBe("continue");
    });
  });

  describe("Hook Return Value Effects", () => {
    it("should block tool execution when allow is false", async () => {
      const hooks: AgentHooks = {
        beforeToolCall: async (ctx, toolName, args) => {
          if (toolName === "dangerous_tool") {
            return {
              allow: false,
              reason: "Tool blocked by security policy",
            };
          }
          return { allow: true };
        },
      };

      const mockContext = {} as AgentContext;

      const safeResult = await hooks.beforeToolCall!(mockContext, "safe_tool", {});
      expect(safeResult.allow).toBe(true);

      const dangerousResult = await hooks.beforeToolCall!(mockContext, "dangerous_tool", {});
      expect(dangerousResult.allow).toBe(false);
      expect(dangerousResult.reason).toBe("Tool blocked by security policy");
    });

    it("should modify arguments when modifiedArgs is provided", async () => {
      const hooks: AgentHooks = {
        beforeToolCall: async (ctx, toolName, args) => {
          if (toolName === "navigate") {
            return {
              allow: true,
              modifiedArgs: { ...args, url: args.url.replace("http://", "https://") },
            };
          }
          return { allow: true };
        },
      };

      const mockContext = {} as AgentContext;
      const result = await hooks.beforeToolCall!(mockContext, "navigate", {
        url: "http://example.com",
      });

      expect(result.allow).toBe(true);
      expect(result.modifiedArgs?.url).toBe("https://example.com");
    });

    it("should escalate when escalate is true", async () => {
      const hooks: AgentHooks = {
        beforeToolCall: async (ctx, toolName, args) => {
          if (toolName === "purchase" && args.amount > 1000) {
            return {
              allow: false,
              escalate: true,
              reason: "Large purchase requires approval",
            };
          }
          return { allow: true };
        },
      };

      const mockContext = {} as AgentContext;

      const smallPurchase = await hooks.beforeToolCall!(mockContext, "purchase", { amount: 50 });
      expect(smallPurchase.allow).toBe(true);

      const largePurchase = await hooks.beforeToolCall!(mockContext, "purchase", { amount: 5000 });
      expect(largePurchase.allow).toBe(false);
      expect(largePurchase.escalate).toBe(true);
    });

    it("should skip tool when skip is true", async () => {
      const hooks: AgentHooks = {
        beforeToolCall: async (ctx, toolName, args) => {
          if (toolName === "analytics") {
            return {
              allow: false,
              skip: true,
              reason: "Analytics disabled in test mode",
            };
          }
          return { allow: true };
        },
      };

      const mockContext = {} as AgentContext;
      const result = await hooks.beforeToolCall!(mockContext, "analytics", {});

      expect(result.allow).toBe(false);
      expect(result.skip).toBe(true);
    });
  });

  describe("Error Hook Return Values", () => {
    it("should return retry for transient errors", async () => {
      const hooks: AgentHooks = {
        onToolError: async (ctx, toolName, error, args) => {
          if (error.message.includes("timeout") || error.message.includes("ECONNRESET")) {
            return "retry";
          }
          return "continue";
        },
      };

      const mockContext = {} as AgentContext;

      const timeoutResult = await hooks.onToolError!(
        mockContext,
        "fetch",
        new Error("Request timeout"),
        {}
      );
      expect(timeoutResult).toBe("retry");

      const otherResult = await hooks.onToolError!(
        mockContext,
        "fetch",
        new Error("Invalid response"),
        {}
      );
      expect(otherResult).toBe("continue");
    });

    it("should return skip for non-critical tools", async () => {
      const hooks: AgentHooks = {
        onToolError: async (ctx, toolName, error, args) => {
          const nonCriticalTools = ["log", "analytics", "metrics"];
          if (nonCriticalTools.includes(toolName)) {
            return "skip";
          }
          return "abort";
        },
      };

      const mockContext = {} as AgentContext;

      const logResult = await hooks.onToolError!(mockContext, "log", new Error("Log failed"), {});
      expect(logResult).toBe("skip");

      const criticalResult = await hooks.onToolError!(
        mockContext,
        "payment",
        new Error("Payment failed"),
        {}
      );
      expect(criticalResult).toBe("abort");
    });

    it("should return escalate for auth errors", async () => {
      const hooks: AgentHooks = {
        onToolError: async (ctx, toolName, error, args) => {
          if (error.message.includes("401") || error.message.includes("403")) {
            return "escalate";
          }
          return "continue";
        },
      };

      const mockContext = {} as AgentContext;

      const authResult = await hooks.onToolError!(
        mockContext,
        "api_call",
        new Error("401 Unauthorized"),
        {}
      );
      expect(authResult).toBe("escalate");
    });
  });

  describe("Lifecycle Hook Combinations", () => {
    it("should support full lifecycle hook chain", async () => {
      const lifecycle: string[] = [];

      const hooks: AgentHooks = {
        beforeAgentStart: async (ctx) => {
          lifecycle.push("beforeAgentStart");
          return undefined;
        },
        beforeToolCall: async (ctx, toolName, args) => {
          lifecycle.push(`beforeToolCall:${toolName}`);
          return { allow: true };
        },
        afterToolCall: async (ctx, toolName, args, result) => {
          lifecycle.push(`afterToolCall:${toolName}`);
        },
        afterAgentComplete: async (ctx, result) => {
          lifecycle.push("afterAgentComplete");
          return undefined;
        },
      };

      const mockContext = {} as AgentContext;

      // Simulate lifecycle
      await hooks.beforeAgentStart!(mockContext);
      await hooks.beforeToolCall!(mockContext, "navigate", {});
      await hooks.afterToolCall!(mockContext, "navigate", {}, { result: "ok" });
      await hooks.beforeToolCall!(mockContext, "click", {});
      await hooks.afterToolCall!(mockContext, "click", {}, { result: "ok" });
      await hooks.afterAgentComplete!(mockContext, "Task completed");

      expect(lifecycle).toEqual([
        "beforeAgentStart",
        "beforeToolCall:navigate",
        "afterToolCall:navigate",
        "beforeToolCall:click",
        "afterToolCall:click",
        "afterAgentComplete",
      ]);
    });
  });

  describe("Context Variable Access", () => {
    it("should allow hooks to read and write context variables", async () => {
      const mockVariables = new Map<string, any>();
      const mockContext = {
        variables: mockVariables,
      } as unknown as AgentContext;

      const hooks: AgentHooks = {
        beforeAgentStart: async (ctx) => {
          ctx.variables.set("startTime", Date.now());
          ctx.variables.set("toolCount", 0);
          return undefined;
        },
        beforeToolCall: async (ctx, toolName, args) => {
          const count = ctx.variables.get("toolCount") || 0;
          ctx.variables.set("toolCount", count + 1);
          return { allow: true };
        },
        afterAgentComplete: async (ctx, result) => {
          const startTime = ctx.variables.get("startTime");
          const toolCount = ctx.variables.get("toolCount");
          ctx.variables.set("duration", Date.now() - startTime);
          return undefined;
        },
      };

      await hooks.beforeAgentStart!(mockContext);
      expect(mockVariables.has("startTime")).toBe(true);

      await hooks.beforeToolCall!(mockContext, "tool1", {});
      await hooks.beforeToolCall!(mockContext, "tool2", {});
      expect(mockVariables.get("toolCount")).toBe(2);

      await hooks.afterAgentComplete!(mockContext, "done");
      expect(mockVariables.has("duration")).toBe(true);
    });
  });

  describe("Context Integration - onCheckpoint and onStateChange", () => {
    it("should trigger onCheckpoint when createCheckpoint is called", async () => {
      const checkpoints: Checkpoint[] = [];

      const hooks: AgentHooks = {
        onCheckpoint: async (checkpoint) => {
          checkpoints.push(checkpoint);
        },
      };

      const config: XSkyConfig = {
        llms: {
          default: { provider: "openai", model: "gpt-4" },
        },
        hooks,
      };

      const context = new Context("test-task-id", config, [], new Chain("test-task-id"));

      // Trigger checkpoint
      await context.createCheckpoint();

      expect(checkpoints).toHaveLength(1);
      expect(checkpoints[0].taskId).toBe("test-task-id");
      expect(checkpoints[0].id).toBeDefined();
      expect(checkpoints[0].state).toBeDefined();
      expect(checkpoints[0].createdAt).toBeDefined();
    });

    it("should trigger onStateChange when setVariable is called (debounced)", async () => {
      const stateChanges: Array<{ key: string; value: any }> = [];

      const hooks: AgentHooks = {
        onStateChange: async (ctx, key, value) => {
          stateChanges.push({ key, value });
        },
      };

      const config: XSkyConfig = {
        llms: {
          default: { provider: "openai", model: "gpt-4" },
        },
        hooks,
      };

      const context = new Context("test-task-id", config, [], new Chain("test-task-id"));

      // Set multiple variables rapidly
      context.setVariable("key1", "value1");
      context.setVariable("key2", "value2");
      context.setVariable("key3", "value3");

      // Wait for debounce (100ms + buffer)
      await new Promise((resolve) => setTimeout(resolve, 150));

      // All changes should be batched and fired
      expect(stateChanges.length).toBeGreaterThan(0);
      expect(stateChanges.some((c) => c.key === "key1")).toBe(true);
      expect(stateChanges.some((c) => c.key === "key2")).toBe(true);
      expect(stateChanges.some((c) => c.key === "key3")).toBe(true);

      // Cleanup
      context.stopCheckpointing();
    });

    it("should not trigger onCheckpoint if no hook is defined", async () => {
      const config: XSkyConfig = {
        llms: {
          default: { provider: "openai", model: "gpt-4" },
        },
        // No hooks defined
      };

      const context = new Context("test-task-id", config, [], new Chain("test-task-id"));

      // Should not throw, just return undefined
      const result = await context.createCheckpoint();
      expect(result).toBeUndefined();
    });

    it("should start and stop checkpointing interval", async () => {
      const checkpoints: Checkpoint[] = [];

      const hooks: AgentHooks = {
        onCheckpoint: async (checkpoint) => {
          checkpoints.push(checkpoint);
        },
      };

      const config: XSkyConfig = {
        llms: {
          default: { provider: "openai", model: "gpt-4" },
        },
        hooks,
      };

      const context = new Context("test-task-id", config, [], new Chain("test-task-id"));

      // Start checkpointing every 50ms
      context.startCheckpointing(50);

      // Wait for a few intervals
      await new Promise((resolve) => setTimeout(resolve, 130));

      // Stop checkpointing
      context.stopCheckpointing();

      const countAfterStop = checkpoints.length;
      expect(countAfterStop).toBeGreaterThanOrEqual(2);

      // Wait a bit more and ensure no new checkpoints
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(checkpoints.length).toBe(countAfterStop);
    });
  });

  describe("onApprovalRequired Hook Integration", () => {
    it("should provide correct ApprovalRequest structure", async () => {
      let capturedRequest: ApprovalRequest | null = null;

      const hooks: AgentHooks = {
        onApprovalRequired: async (ctx, request) => {
          capturedRequest = request;
          return { approved: true, approver: "test-user" };
        },
      };

      // Simulate the approval request that would be created in base.ts
      const mockContext = {} as AgentContext;
      const toolName = "purchase";
      const args = { amount: 5000, item: "laptop" };
      const blockReason = "Large purchase requires approval";

      const approvalRequest: ApprovalRequest = {
        type: "tool_execution",
        description: `Approve execution of tool "${toolName}"?`,
        context: {
          toolName,
          args,
          reason: blockReason,
        },
      };

      const result = await hooks.onApprovalRequired!(mockContext, approvalRequest);

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest!.type).toBe("tool_execution");
      expect(capturedRequest!.context.toolName).toBe("purchase");
      expect(capturedRequest!.context.args.amount).toBe(5000);
      expect(result.approved).toBe(true);
      expect(result.approver).toBe("test-user");
    });

    it("should handle approval denial", async () => {
      const hooks: AgentHooks = {
        onApprovalRequired: async (ctx, request) => {
          return {
            approved: false,
            feedback: "Purchase exceeds budget limit",
          };
        },
      };

      const mockContext = {} as AgentContext;
      const request: ApprovalRequest = {
        type: "tool_execution",
        description: "Test approval",
        context: {},
      };

      const result = await hooks.onApprovalRequired!(mockContext, request);

      expect(result.approved).toBe(false);
      expect(result.feedback).toBe("Purchase exceeds budget limit");
    });
  });
});
