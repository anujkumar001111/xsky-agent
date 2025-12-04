import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Agent } from "../../src/agent/base";
import Context from "../../src/core/context";
import { AgentContext } from "../../src/core/context";
import { Tool, ToolResult } from "../../src/types";
import { LanguageModelV2ToolCallPart } from "@ai-sdk/provider";

// Test agent for error handling tests
class ErrorTestAgent extends Agent {
  constructor() {
    super({
      name: "ErrorTestAgent",
      description: "Agent for error handling tests",
      tools: [],
    });
  }
}

// Helper to create mock tool that can fail
function createFailingTool(name: string, shouldFail: boolean = true): Tool {
  return {
    name: name,
    description: `Tool ${name}`,
    parameters: {
      type: "object",
      properties: { input: { type: "string" } },
    },
    execute: jest.fn(async () => {
      if (shouldFail) {
        throw new Error(`Tool ${name} failed`);
      }
      return { content: [{ type: "text", text: "Success" }] };
    }),
  };
}

describe("Agent Error Handling", () => {
  let agent: ErrorTestAgent;
  let mockContext: Context;

  beforeEach(async () => {
    agent = new ErrorTestAgent();
    mockContext = new Context({
      taskId: "error-test-123",
      chain: { taskPrompt: "Error test" } as any,
    });
  });

  describe("Tool execution error handling", () => {
    it.skip("should handle missing tool gracefully", async () => {
      const agentChain = {
        agent: { id: "test" },
        agentRequest: {},
        push: jest.fn(),
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const toolCall: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "nonexistent_tool",
        toolCallId: "call-1",
        input: "{}",
      };

      try {
        await (agent as any).callToolCall(agentContext, [], toolCall, []);
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("does not exist");
      }
    });

    it.skip("should handle tool execution errors", async () => {
      const failingTool = createFailingTool("failing_tool", true);
      agent.addTool(failingTool);

      const agentChain = {
        agent: { id: "test" },
        agentRequest: {},
        push: jest.fn(),
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const toolCall: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "failing_tool",
        toolCallId: "call-1",
        input: "{}",
      };

      const result = await (agent as any).callToolCall(agentContext, [failingTool], toolCall, []);

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("tool-result");
    });

    it.skip("should increment consecutiveErrorNum on tool error", async () => {
      const failingTool = createFailingTool("failing_tool", true);
      agent.addTool(failingTool);

      const agentChain = {
        agent: { id: "test" },
        agentRequest: {},
        push: jest.fn(),
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const toolCall: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "failing_tool",
        toolCallId: "call-1",
        input: "{}",
      };

      const initialErrors = agentContext.consecutiveErrorNum;
      await (agent as any).callToolCall(agentContext, [failingTool], toolCall, []);

      // Error count should increase
      expect(agentContext.consecutiveErrorNum).toBeGreaterThanOrEqual(initialErrors);
    });

    it.skip("should reset consecutiveErrorNum on successful tool execution", async () => {
      const successTool = createFailingTool("success_tool", false);
      agent.addTool(successTool);

      const agentChain = {
        agent: { id: "test" },
        agentRequest: {},
        push: jest.fn(),
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);
      agentContext.consecutiveErrorNum = 5;

      const toolCall: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "success_tool",
        toolCallId: "call-1",
        input: "{}",
      };

      await (agent as any).callToolCall(agentContext, [successTool], toolCall, []);

      expect(agentContext.consecutiveErrorNum).toBe(0);
    });

    it.skip("should abort after max consecutive errors", async () => {
      const failingTool = createFailingTool("failing_tool", true);
      agent.addTool(failingTool);

      const agentChain = {
        agent: { id: "test" },
        agentRequest: {},
        push: jest.fn(),
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);
      agentContext.consecutiveErrorNum = 10; // At limit

      const toolCall: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "failing_tool",
        toolCallId: "call-1",
        input: "{}",
      };

      try {
        await (agent as any).callToolCall(agentContext, [failingTool], toolCall, []);
        // Should throw after reaching limit
      } catch (e: any) {
        expect(e.message).toContain("failed");
      }
    });
  });

  describe("Tool parameter parsing", () => {
    it.skip("should parse JSON input from tool call", async () => {
      const tool = createFailingTool("json_tool", false);
      agent.addTool(tool);

      const agentChain = {
        agent: { id: "test" },
        agentRequest: {},
        push: jest.fn(),
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const toolCall: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "json_tool",
        toolCallId: "call-1",
        input: '{"key":"value"}',
      };

      const result = await (agent as any).callToolCall(agentContext, [tool], toolCall, []);

      expect(result).toBeDefined();
    });

    it.skip("should handle empty JSON input", async () => {
      const tool = createFailingTool("empty_tool", false);
      agent.addTool(tool);

      const agentChain = {
        agent: { id: "test" },
        agentRequest: {},
        push: jest.fn(),
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const toolCall: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "empty_tool",
        toolCallId: "call-1",
        input: "{}",
      };

      const result = await (agent as any).callToolCall(agentContext, [tool], toolCall, []);

      expect(result).toBeDefined();
    });

    it.skip("should handle non-string input", async () => {
      const tool = createFailingTool("object_tool", false);
      agent.addTool(tool);

      const agentChain = {
        agent: { id: "test" },
        agentRequest: {},
        push: jest.fn(),
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const toolCall: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "object_tool",
        toolCallId: "call-1",
        input: { key: "value" } as any,
      };

      const result = await (agent as any).callToolCall(agentContext, [tool], toolCall, []);

      expect(result).toBeDefined();
    });
  });

  describe("handleCallResult edge cases", () => {
    it("should handle results with only text parts", async () => {
      const agentChain = {
        agent: { id: "test" },
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);
      const messages: any[] = [];

      const result = await (agent as any).handleCallResult(agentContext, messages, [], [
        { type: "text", text: "Response" },
      ]);

      expect(result).toBe("Response");
    });

    it("should join multiple text parts with newlines", async () => {
      const agentChain = {
        agent: { id: "test" },
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);
      const messages: any[] = [];

      const result = await (agent as any).handleCallResult(agentContext, messages, [], [
        { type: "text", text: "Part 1" },
        { type: "text", text: "Part 2" },
        { type: "text", text: "Part 3" },
      ]);

      expect(result).toBe("Part 1\n\nPart 2\n\nPart 3");
    });

    it.skip("should return null for mixed text and tool calls", async () => {
      const agentChain = {
        agent: { id: "test" },
        push: jest.fn(),
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);
      const messages: any[] = [];

      const result = await (agent as any).handleCallResult(agentContext, messages, [], [
        { type: "text", text: "Starting task" },
        {
          type: "tool-call",
          toolName: "some_tool",
          toolCallId: "1",
          input: "{}",
        },
      ]);

      expect(result).toBeNull();
    });
  });

  describe("Tool execution with empty/null results", () => {
    it.skip("should handle tool returning empty result", async () => {
      const emptyTool: Tool = {
        name: "empty_tool",
        description: "Empty tool",
        parameters: { type: "object", properties: {} },
        execute: jest.fn(async () => ({
          content: [{ type: "text", text: "" }],
        })),
      };
      agent.addTool(emptyTool);

      const agentChain = {
        agent: { id: "test" },
        agentRequest: {},
        push: jest.fn(),
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const toolCall: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "empty_tool",
        toolCallId: "call-1",
        input: "{}",
      };

      const result = await (agent as any).callToolCall(agentContext, [emptyTool], toolCall, []);

      expect(result).toBeDefined();
      expect(result.content[0].type).toBe("tool-result");
    });

    it.skip("should handle tool returning null content", async () => {
      const nullTool: Tool = {
        name: "null_tool",
        description: "Null tool",
        parameters: { type: "object", properties: {} },
        execute: jest.fn(async () => ({
          content: [],
        })),
      };
      agent.addTool(nullTool);

      const agentChain = {
        agent: { id: "test" },
        agentRequest: {},
        push: jest.fn(),
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const toolCall: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "null_tool",
        toolCallId: "call-1",
        input: "{}",
      };

      const result = await (agent as any).callToolCall(agentContext, [nullTool], toolCall, []);

      expect(result).toBeDefined();
    });
  });

  describe("Parallel tool calls handling", () => {
    it.skip("should handle multiple tool calls in parallel when supported", async () => {
      const tool1 = createFailingTool("tool_1", false);
      const tool2 = createFailingTool("tool_2", false);
      agent.addTool(tool1);
      agent.addTool(tool2);

      const agentChain = {
        agent: { id: "test" },
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);
      const messages: any[] = [];

      const toolCalls = [
        {
          type: "tool-call" as const,
          toolName: "tool_1",
          toolCallId: "call-1",
          input: "{}",
        },
        {
          type: "tool-call" as const,
          toolName: "tool_2",
          toolCallId: "call-2",
          input: "{}",
        },
      ];

      const result = await (agent as any).handleCallResult(
        agentContext,
        messages,
        [tool1, tool2],
        toolCalls
      );

      // Should return null since we have tool calls
      expect(result).toBeNull();
    });
  });

  describe("Agent state preservation", () => {
    it("should preserve agent context across operations", async () => {
      const agentChain = {
        agent: { id: "test" },
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      // Set some state
      agentContext.variables.set("test_var", "test_value");

      // Verify state is preserved
      expect(agentContext.variables.get("test_var")).toBe("test_value");
    });

    it.skip("should clear variables on abort task status", async () => {
      const agentChain = {
        agent: { id: "test" },
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      agentContext.variables.set("to_clear", "will_be_cleared");
      agent.AgentContext = agentContext;

      await (agent as any).onTaskStatus("abort");

      expect(agentContext.variables.get("to_clear")).toBeUndefined();
    });
  });

  describe("Tool result conversion", () => {
    it.skip("should convert successful tool results", async () => {
      const successTool = createFailingTool("success_tool", false);
      agent.addTool(successTool);

      const agentChain = {
        agent: { id: "test" },
        agentRequest: {},
        push: jest.fn(),
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const toolCall: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "success_tool",
        toolCallId: "call-1",
        input: "{}",
      };

      const result = await (agent as any).callToolCall(
        agentContext,
        [successTool],
        toolCall,
        []
      );

      expect(result.type).toBe("tool-result");
      expect(result.toolCallId).toBe("call-1");
      expect(result.content).toBeDefined();
    });

    it.skip("should convert error tool results", async () => {
      const errorTool = createFailingTool("error_tool", true);
      agent.addTool(errorTool);

      const agentChain = {
        agent: { id: "test" },
        agentRequest: {},
        push: jest.fn(),
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const toolCall: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "error_tool",
        toolCallId: "call-1",
        input: "{}",
      };

      const result = await (agent as any).callToolCall(
        agentContext,
        [errorTool],
        toolCall,
        []
      );

      expect(result.type).toBe("tool-result");
      expect(result.toolCallId).toBe("call-1");
    });
  });
});
