import Chain, { AgentChain, ToolChain } from "../../src/core/chain";
import { WorkflowAgent } from "../../src/types/core.types";
import { LLMRequest } from "../../src/types/llm.types";
import { LanguageModelV2ToolCallPart } from "@ai-sdk/provider";

describe("Chain", () => {
  describe("Chain class", () => {
    test("should create a Chain instance with task prompt", () => {
      const taskPrompt = "Find information about AI";
      const chain = new Chain(taskPrompt);

      expect(chain.taskPrompt).toBe(taskPrompt);
      expect(chain.agents).toEqual([]);
      expect(chain.planRequest).toBeUndefined();
      expect(chain.planResult).toBeUndefined();
    });

    test("should push agent chains and trigger listeners", () => {
      const chain = new Chain("Test task");
      const agent: WorkflowAgent = {
        id: "agent-1",
        name: "TestAgent",
        description: "Test agent",
        status: "init",
        tools: [],
      };
      const agentChain = new AgentChain(agent);
      const listener = jest.fn();

      chain.addListener(listener);
      chain.push(agentChain);

      expect(chain.agents).toHaveLength(1);
      expect(chain.agents[0]).toBe(agentChain);
      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][1].target).toBe(agentChain);
    });

    test("should add and remove listeners", () => {
      const chain = new Chain("Test task");
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      chain.addListener(listener1);
      chain.addListener(listener2);

      const agent: WorkflowAgent = {
        id: "agent-1",
        name: "TestAgent",
        description: "Test agent",
        status: "init",
        tools: [],
      };
      const agentChain = new AgentChain(agent);
      chain.push(agentChain);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      // Remove listener1
      chain.removeListener(listener1);

      const agent2: WorkflowAgent = {
        id: "agent-2",
        name: "TestAgent2",
        description: "Test agent 2",
        status: "init",
        tools: [],
      };
      const agentChain2 = new AgentChain(agent2);
      chain.push(agentChain2);

      expect(listener1).toHaveBeenCalledTimes(1); // Should not be called again
      expect(listener2).toHaveBeenCalledTimes(2); // Should be called again
    });

    test("should handle multiple agent chains in order", () => {
      const chain = new Chain("Test task");

      const agents: WorkflowAgent[] = [
        {
          id: "agent-1",
          name: "Agent1",
          description: "Agent 1",
          status: "init",
          tools: [],
        },
        {
          id: "agent-2",
          name: "Agent2",
          description: "Agent 2",
          status: "init",
          tools: [],
        },
      ];

      agents.forEach((agent) => {
        chain.push(new AgentChain(agent));
      });

      expect(chain.agents).toHaveLength(2);
      expect(chain.agents[0].agent.name).toBe("Agent1");
      expect(chain.agents[1].agent.name).toBe("Agent2");
    });

    test("should store plan request and result", () => {
      const chain = new Chain("Test task");
      const request: LLMRequest = {
        maxTokens: 8192,
        temperature: 0.7,
        messages: [{ role: "user", content: [{ type: "text", text: "test" }] }],
      };
      const result = "<workflow>...</workflow>";

      chain.planRequest = request;
      chain.planResult = result;

      expect(chain.planRequest).toBe(request);
      expect(chain.planResult).toBe(result);
    });
  });

  describe("AgentChain class", () => {
    test("should create an AgentChain with agent", () => {
      const agent: WorkflowAgent = {
        id: "agent-1",
        name: "TestAgent",
        description: "Test agent",
        status: "init",
        tools: [],
      };
      const agentChain = new AgentChain(agent);

      expect(agentChain.agent).toBe(agent);
      expect(agentChain.tools).toEqual([]);
      expect(agentChain.agentRequest).toBeUndefined();
      expect(agentChain.agentResult).toBeUndefined();
    });

    test("should push tool chains and trigger update callback", () => {
      const agent: WorkflowAgent = {
        id: "agent-1",
        name: "TestAgent",
        description: "Test agent",
        status: "init",
        tools: [],
      };
      const agentChain = new AgentChain(agent);
      const onUpdate = jest.fn();
      agentChain.onUpdate = onUpdate;

      const toolUse: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "test_tool",
        toolCallId: "call-1",
        args: "{}",
      };
      const request: LLMRequest = {
        maxTokens: 8192,
        temperature: 0.7,
        messages: [{ role: "user", content: [{ type: "text", text: "test" }] }],
      };
      const toolChain = new ToolChain(toolUse, request);

      agentChain.push(toolChain);

      expect(agentChain.tools).toHaveLength(1);
      expect(agentChain.tools[0]).toBe(toolChain);
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "update",
          target: agentChain,
        })
      );
    });

    test("should propagate tool update callbacks", () => {
      const agent: WorkflowAgent = {
        id: "agent-1",
        name: "TestAgent",
        description: "Test agent",
        status: "init",
        tools: [],
      };
      const agentChain = new AgentChain(agent);
      const onUpdate = jest.fn();
      agentChain.onUpdate = onUpdate;

      const toolUse: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "test_tool",
        toolCallId: "call-1",
        args: "{}",
      };
      const request: LLMRequest = {
        maxTokens: 8192,
        temperature: 0.7,
        messages: [{ role: "user", content: [{ type: "text", text: "test" }] }],
      };
      const toolChain = new ToolChain(toolUse, request);
      agentChain.push(toolChain);

      // Reset mock to count only subsequent calls
      onUpdate.mockClear();

      // Update tool params should trigger agent's onUpdate
      toolChain.updateParams({ key: "value" });

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "update",
          target: toolChain,
        })
      );
    });

    test("should store agent request and result", () => {
      const agent: WorkflowAgent = {
        id: "agent-1",
        name: "TestAgent",
        description: "Test agent",
        status: "init",
        tools: [],
      };
      const agentChain = new AgentChain(agent);
      const request: LLMRequest = {
        maxTokens: 8192,
        temperature: 0.7,
        messages: [{ role: "user", content: [{ type: "text", text: "test" }] }],
      };
      const result = "Agent result text";

      agentChain.agentRequest = request;
      agentChain.agentResult = result;

      expect(agentChain.agentRequest).toBe(request);
      expect(agentChain.agentResult).toBe(result);
    });

    test("should handle multiple tool chains", () => {
      const agent: WorkflowAgent = {
        id: "agent-1",
        name: "TestAgent",
        description: "Test agent",
        status: "init",
        tools: [],
      };
      const agentChain = new AgentChain(agent);
      const request: LLMRequest = {
        maxTokens: 8192,
        temperature: 0.7,
        messages: [{ role: "user", content: [{ type: "text", text: "test" }] }],
      };

      const toolUse1: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "tool1",
        toolCallId: "call-1",
        args: "{}",
      };
      const toolUse2: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "tool2",
        toolCallId: "call-2",
        args: "{}",
      };

      const toolChain1 = new ToolChain(toolUse1, request);
      const toolChain2 = new ToolChain(toolUse2, request);

      agentChain.push(toolChain1);
      agentChain.push(toolChain2);

      expect(agentChain.tools).toHaveLength(2);
      expect(agentChain.tools[0].toolName).toBe("tool1");
      expect(agentChain.tools[1].toolName).toBe("tool2");
    });
  });

  describe("ToolChain class", () => {
    test("should create a ToolChain with tool use and request", () => {
      const toolUse: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "test_tool",
        toolCallId: "call-123",
        args: '{"param": "value"}',
      };
      const request: LLMRequest = {
        maxTokens: 8192,
        temperature: 0.7,
        messages: [{ role: "user", content: [{ type: "text", text: "test" }] }],
      };
      const toolChain = new ToolChain(toolUse, request);

      expect(toolChain.toolName).toBe("test_tool");
      expect(toolChain.toolCallId).toBe("call-123");
      expect(toolChain.params).toBeUndefined();
      expect(toolChain.toolResult).toBeUndefined();
      expect(toolChain.request).toEqual(request);
    });

    test("should update tool parameters", () => {
      const toolUse: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "test_tool",
        toolCallId: "call-123",
        args: "{}",
      };
      const request: LLMRequest = {
        maxTokens: 8192,
        temperature: 0.7,
        messages: [{ role: "user", content: [{ type: "text", text: "test" }] }],
      };
      const toolChain = new ToolChain(toolUse, request);
      const onUpdate = jest.fn();
      toolChain.onUpdate = onUpdate;

      const newParams = { key: "value", number: 42 };
      toolChain.updateParams(newParams);

      expect(toolChain.params).toEqual(newParams);
      expect(onUpdate).toHaveBeenCalled();
    });

    test("should update tool result", () => {
      const toolUse: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "test_tool",
        toolCallId: "call-123",
        args: "{}",
      };
      const request: LLMRequest = {
        maxTokens: 8192,
        temperature: 0.7,
        messages: [{ role: "user", content: [{ type: "text", text: "test" }] }],
      };
      const toolChain = new ToolChain(toolUse, request);
      const onUpdate = jest.fn();
      toolChain.onUpdate = onUpdate;

      const toolResult = {
        content: [{ type: "text" as const, text: "Tool executed successfully" }],
      };
      toolChain.updateToolResult(toolResult);

      expect(toolChain.toolResult).toEqual(toolResult);
      expect(onUpdate).toHaveBeenCalled();
    });

    test("should deep copy request to prevent mutation", () => {
      const request: LLMRequest = {
        maxTokens: 8192,
        temperature: 0.7,
        messages: [{ role: "user", content: [{ type: "text", text: "test" }] }],
      };
      const toolUse: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "test_tool",
        toolCallId: "call-123",
        args: "{}",
      };
      const toolChain = new ToolChain(toolUse, request);

      // Modify original request
      request.temperature = 0.1;

      // ToolChain should have the original value
      expect(toolChain.request.temperature).toBe(0.7);
    });

    test("should not call onUpdate if not set", () => {
      const toolUse: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "test_tool",
        toolCallId: "call-123",
        args: "{}",
      };
      const request: LLMRequest = {
        maxTokens: 8192,
        temperature: 0.7,
        messages: [{ role: "user", content: [{ type: "text", text: "test" }] }],
      };
      const toolChain = new ToolChain(toolUse, request);

      // Should not throw even without onUpdate
      toolChain.updateParams({ key: "value" });
      toolChain.updateToolResult({
        content: [{ type: "text", text: "result" }],
      });

      expect(toolChain.params).toEqual({ key: "value" });
    });

    test("should handle complex tool parameters", () => {
      const toolUse: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "complex_tool",
        toolCallId: "call-456",
        args: "{}",
      };
      const request: LLMRequest = {
        maxTokens: 8192,
        temperature: 0.7,
        messages: [{ role: "user", content: [{ type: "text", text: "test" }] }],
      };
      const toolChain = new ToolChain(toolUse, request);

      const complexParams = {
        nested: {
          level2: {
            value: "deep",
          },
        },
        array: [1, 2, 3],
        mixed: {
          string: "text",
          number: 123,
          boolean: true,
          null: null,
        },
      };

      toolChain.updateParams(complexParams);

      expect(toolChain.params).toEqual(complexParams);
    });

    test("should handle multiple updates", () => {
      const toolUse: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "test_tool",
        toolCallId: "call-123",
        args: "{}",
      };
      const request: LLMRequest = {
        maxTokens: 8192,
        temperature: 0.7,
        messages: [{ role: "user", content: [{ type: "text", text: "test" }] }],
      };
      const toolChain = new ToolChain(toolUse, request);
      const onUpdate = jest.fn();
      toolChain.onUpdate = onUpdate;

      toolChain.updateParams({ version: 1 });
      toolChain.updateParams({ version: 2 });
      toolChain.updateToolResult({
        content: [{ type: "text", text: "result" }],
      });

      expect(onUpdate).toHaveBeenCalledTimes(3);
      expect(toolChain.params?.version).toBe(2);
    });
  });

  describe("Chain event propagation", () => {
    test("should propagate events from tool through agent to chain", () => {
      const chain = new Chain("Test task");
      const chainListener = jest.fn();
      chain.addListener(chainListener);

      const agent: WorkflowAgent = {
        id: "agent-1",
        name: "TestAgent",
        description: "Test agent",
        status: "init",
        tools: [],
      };
      const agentChain = new AgentChain(agent);
      chain.push(agentChain);

      chainListener.mockClear();

      const toolUse: LanguageModelV2ToolCallPart = {
        type: "tool-call",
        toolName: "test_tool",
        toolCallId: "call-123",
        args: "{}",
      };
      const request: LLMRequest = {
        maxTokens: 8192,
        temperature: 0.7,
        messages: [{ role: "user", content: [{ type: "text", text: "test" }] }],
      };
      const toolChain = new ToolChain(toolUse, request);
      agentChain.push(toolChain);

      chainListener.mockClear();
      toolChain.updateParams({ key: "value" });

      // Should propagate from tool -> agent -> chain
      expect(chainListener).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({
          type: "update",
          target: toolChain,
        })
      );
    });

    test("should handle multiple listeners receiving events", () => {
      const chain = new Chain("Test task");
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      chain.addListener(listener1);
      chain.addListener(listener2);
      chain.addListener(listener3);

      const agent: WorkflowAgent = {
        id: "agent-1",
        name: "TestAgent",
        description: "Test agent",
        status: "init",
        tools: [],
      };
      const agentChain = new AgentChain(agent);
      chain.push(agentChain);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
    });
  });
});
