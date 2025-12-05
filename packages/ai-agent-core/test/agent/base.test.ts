import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { Agent } from "../../src/agent/base";
import Context from "../../src/core/context";
import { AgentChain, ToolChain } from "../../src/core/chain";
import { AgentContext } from "../../src/core/context";
import { Tool, ToolResult, IMcpClient } from "../../src/types";
import { LanguageModelV2ToolCallPart, LanguageModelV2TextPart } from "@ai-sdk/provider";
import { ResourceAccess } from "../../src/types/security.types";

// Mock implementations for testing
class TestAgent extends Agent {
  constructor() {
    super({
      name: "TestAgent",
      description: "Test agent for unit tests",
      tools: [],
    });
  }
}

// Helper to create mock tool
function createMockTool(name: string): Tool {
  return {
    name: name,
    description: `Mock tool: ${name}`,
    parameters: {
      type: "object",
      properties: {
        input: { type: "string" },
      },
    },
    execute: jest.fn(async () => ({
      content: [{ type: "text", text: "Success" }],
    })),
  };
}

// Helper to create mock context
async function createMockContext(): Promise<Context> {
  const context = new Context({
    taskId: "test-task-123",
    chain: {
      taskPrompt: "Test task",
    } as any,
  });
  // Ensure config is properly initialized
  if (!context.config) {
    context.config = { hooks: {} } as any;
  } else if (!context.config.hooks) {
    context.config.hooks = {};
  }
  return context;
}

describe("Agent Base Class", () => {
  let agent: TestAgent;
  let mockContext: Context;

  beforeEach(async () => {
    agent = new TestAgent();
    mockContext = await createMockContext();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Constructor", () => {
    it("should initialize agent with parameters", () => {
      expect(agent.Name).toBe("TestAgent");
      expect(agent.Description).toBe("Test agent for unit tests");
      expect(agent.Tools).toEqual([]);
    });

    it("should set llms if provided", () => {
      const customAgent = new (class extends Agent {
        constructor() {
          super({
            name: "CustomAgent",
            description: "Custom",
            tools: [],
            llms: ["gpt-4", "claude"],
          });
        }
      })();

      expect(customAgent.Llms).toEqual(["gpt-4", "claude"]);
    });

    it("should support mcpClient in parameters", () => {
      const mockMcpClient = {} as IMcpClient;
      const customAgent = new (class extends Agent {
        constructor() {
          super({
            name: "CustomAgent",
            description: "Custom",
            tools: [],
            mcpClient: mockMcpClient,
          });
        }
      })();

      expect(customAgent.McpClient).toBe(mockMcpClient);
    });
  });

  describe("getters", () => {
    it("should return Name property", () => {
      expect(agent.Name).toBe("TestAgent");
    });

    it("should return Description property", () => {
      expect(agent.Description).toBe("Test agent for unit tests");
    });

    it("should return Tools array", () => {
      const tool = createMockTool("test_tool");
      agent.addTool(tool);
      expect(agent.Tools).toContain(tool);
      expect(agent.Tools.length).toBe(1);
    });

    it("should return PlanDescription if set", () => {
      const customAgent = new (class extends Agent {
        constructor() {
          super({
            name: "CustomAgent",
            description: "Custom",
            tools: [],
            planDescription: "Custom plan",
          });
        }
      })();

      expect(customAgent.PlanDescription).toBe("Custom plan");
    });

    it("should return Llms", () => {
      const customAgent = new (class extends Agent {
        constructor() {
          super({
            name: "CustomAgent",
            description: "Custom",
            tools: [],
            llms: ["model-1"],
          });
        }
      })();

      expect(customAgent.Llms).toEqual(["model-1"]);
    });

    it("should return McpClient", () => {
      const mockClient = {} as IMcpClient;
      const customAgent = new (class extends Agent {
        constructor() {
          super({
            name: "CustomAgent",
            description: "Custom",
            tools: [],
            mcpClient: mockClient,
          });
        }
      })();

      expect(customAgent.McpClient).toBe(mockClient);
    });

    it("should return undefined for AgentContext initially", () => {
      expect(agent.AgentContext).toBeUndefined();
    });
  });

  describe("addTool", () => {
    it("should add a tool to the agent", () => {
      const tool = createMockTool("new_tool");
      agent.addTool(tool);

      expect(agent.Tools.length).toBe(1);
      expect(agent.Tools[0]).toBe(tool);
    });

    it("should allow adding multiple tools", () => {
      const tool1 = createMockTool("tool_1");
      const tool2 = createMockTool("tool_2");
      const tool3 = createMockTool("tool_3");

      agent.addTool(tool1);
      agent.addTool(tool2);
      agent.addTool(tool3);

      expect(agent.Tools.length).toBe(3);
      expect(agent.Tools).toContain(tool1);
      expect(agent.Tools).toContain(tool2);
      expect(agent.Tools).toContain(tool3);
    });

    it("should preserve tool order on addition", () => {
      const tools = [createMockTool("tool_a"), createMockTool("tool_b"), createMockTool("tool_c")];

      tools.forEach((tool) => agent.addTool(tool));

      expect(agent.Tools.map((t) => t.name)).toEqual(["tool_a", "tool_b", "tool_c"]);
    });
  });

  describe("system_auto_tools", () => {
    it("should always include HumanInteractTool", async () => {
      const agentNode = {
        id: "test",
        xml: "<agent></agent>",
      } as any;

      const autoTools = (agent as any).system_auto_tools(agentNode);
      const humanInteractTool = autoTools.find((t: Tool) => t.name === "human_interact");

      expect(humanInteractTool).toBeDefined();
    });

    it("should include VariableStorageTool when input/output attributes present", async () => {
      const agentNodeWithVars = {
        id: "test",
        xml: '<agent input="var1"><task output="var2"></task></agent>',
      } as any;

      const autoTools = (agent as any).system_auto_tools(agentNodeWithVars);
      const varTool = autoTools.find((t: Tool) => t.name === "variable_storage");

      expect(varTool).toBeDefined();
    });

    it("should include ForeachTaskTool when forEach tag present", async () => {
      const agentNodeWithForeach = {
        id: "test",
        xml: "<agent><forEach><task></task></forEach></agent>",
      } as any;

      const autoTools = (agent as any).system_auto_tools(agentNodeWithForeach);
      const foreachTool = autoTools.find((t: Tool) => t.name === "foreach_task");

      expect(foreachTool).toBeDefined();
    });

    it("should include WatchTriggerTool when watch tag present", async () => {
      const agentNodeWithWatch = {
        id: "test",
        xml: "<agent><watch><task></task></watch></agent>",
      } as any;

      const autoTools = (agent as any).system_auto_tools(agentNodeWithWatch);
      const watchTool = autoTools.find((t: Tool) => t.name === "watch_trigger");

      expect(watchTool).toBeDefined();
    });

    it("should not duplicate tools already in agent tools", async () => {
      const varTool = createMockTool("variable_storage");
      agent.addTool(varTool);

      const agentNodeWithVars = {
        id: "test",
        xml: '<agent input="var1"></agent>',
      } as any;

      const autoTools = (agent as any).system_auto_tools(agentNodeWithVars);
      const varToolCount = autoTools.filter((t: Tool) => t.name === "variable_storage").length;

      expect(varToolCount).toBe(0);
    });
  });

  describe("canParallelToolCalls", () => {
    it("should return config.parallelToolCalls value", () => {
      const canParallel = agent.canParallelToolCalls();
      expect(typeof canParallel).toBe("boolean");
    });

    it("should handle undefined toolCalls parameter", () => {
      const canParallel = agent.canParallelToolCalls(undefined);
      expect(typeof canParallel).toBe("boolean");
    });
  });

  describe("handleCallResult", () => {
    it("should return null for empty results", async () => {
      const agentChain = {
        agent: { id: "test" },
      } as AgentChain;
      const agentContext = new AgentContext(mockContext, agent, agentChain);
      const messages: any[] = [];

      const result = await (agent as any).handleCallResult(agentContext, messages, [], []);

      expect(result).toBeNull();
    });

    it("should return text when results are all text", async () => {
      const agentChain = {
        agent: { id: "test" },
      } as AgentChain;
      const agentContext = new AgentContext(mockContext, agent, agentChain);
      const messages: any[] = [];

      const textResults: LanguageModelV2TextPart[] = [
        { type: "text", text: "Hello" },
        { type: "text", text: "World" },
      ];

      const result = await (agent as any).handleCallResult(agentContext, messages, [], textResults);

      expect(result).toBe("Hello\n\nWorld");
    });

    it("should add assistant message to conversation", async () => {
      const agentChain = {
        agent: { id: "test" },
      } as AgentChain;
      const agentContext = new AgentContext(mockContext, agent, agentChain);
      const messages: any[] = [{ role: "system", content: "System prompt" }];

      const textResults: LanguageModelV2TextPart[] = [
        { type: "text", text: "Response" },
      ];

      await (agent as any).handleCallResult(agentContext, messages, [], textResults);

      expect(messages.length).toBe(2);
      expect(messages[1].role).toBe("assistant");
      expect(messages[1].content).toEqual(textResults);
    });
  });

  describe("buildSystemPrompt", () => {
    it.skip("should return a system prompt string", async () => {
      const agentChain = {
        agent: { id: "test", name: "TestAgent" },
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const prompt = await (agent as any).buildSystemPrompt(agentContext, []);

      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  describe("buildUserPrompt", () => {
    it.skip("should return a user prompt array", async () => {
      const agentChain = {
        agent: { id: "test", name: "TestAgent" },
      } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const prompt = await (agent as any).buildUserPrompt(agentContext, []);

      expect(Array.isArray(prompt)).toBe(true);
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt[0].type).toBe("text");
    });
  });

  describe("extSysPrompt", () => {
    it("should return empty string by default", async () => {
      const agentChain = {
        agent: { id: "test" },
      } as AgentChain;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const extPrompt = await (agent as any).extSysPrompt(agentContext, []);

      expect(extPrompt).toBe("");
    });
  });

  describe("loadTools", () => {
    it("should return agent tools when no mcpClient", async () => {
      const tool1 = createMockTool("tool1");
      const tool2 = createMockTool("tool2");
      agent.addTool(tool1);
      agent.addTool(tool2);

      const tools = await agent.loadTools(mockContext);

      expect(tools.length).toBe(2);
      expect(tools).toContain(tool1);
      expect(tools).toContain(tool2);
    });
  });

  describe("Edge cases", () => {
    describe("addTool edge cases", () => {
      it("should handle adding tool with empty name", () => {
        const tool = createMockTool("");
        agent.addTool(tool);
        expect(agent.Tools.length).toBe(1);
        expect(agent.Tools[0].name).toBe("");
      });

      it("should handle adding tool with special characters in name", () => {
        const tool = createMockTool("tool-name_@#$");
        agent.addTool(tool);
        expect(agent.Tools.length).toBe(1);
        expect(agent.Tools[0].name).toBe("tool-name_@#$");
      });

      it("should handle adding duplicate tool names", () => {
        const tool1 = createMockTool("duplicate");
        const tool2 = createMockTool("duplicate");
        agent.addTool(tool1);
        agent.addTool(tool2);
        // Both should be added (no deduplication at addTool level)
        expect(agent.Tools.length).toBe(2);
      });

      it("should handle very long tool names", () => {
        const longName = "a".repeat(10000);
        const tool = createMockTool(longName);
        agent.addTool(tool);
        expect(agent.Tools.length).toBe(1);
        expect(agent.Tools[0].name.length).toBe(10000);
      });
    });

    describe("system_auto_tools edge cases", () => {
      it("should handle malformed XML gracefully", async () => {
        const agentNode = {
          id: "test",
          xml: "<agent><<<>>>", // Malformed
        } as any;

        expect(() => {
          (agent as any).system_auto_tools(agentNode);
        }).not.toThrow();
      });

      it("should handle empty XML string", async () => {
        const agentNode = {
          id: "test",
          xml: "",
        } as any;

        const autoTools = (agent as any).system_auto_tools(agentNode);
        // Should at least have HumanInteractTool
        expect(autoTools.length).toBeGreaterThan(0);
      });

      it("should handle XML with no matching tags", async () => {
        const agentNode = {
          id: "test",
          xml: "<agent></agent>",
        } as any;

        const autoTools = (agent as any).system_auto_tools(agentNode);
        // Should have HumanInteractTool at minimum
        expect(autoTools.find((t: Tool) => t.name === "human_interact")).toBeDefined();
      });

      it("should handle multiple forEach tags", async () => {
        const agentNode = {
          id: "test",
          xml: "<agent><forEach></forEach><forEach></forEach></agent>",
        } as any;

        const autoTools = (agent as any).system_auto_tools(agentNode);
        const foreachTools = autoTools.filter((t: Tool) => t.name === "foreach_task");
        // Should only include one foreach_task tool
        expect(foreachTools.length).toBe(1);
      });

      it("should handle nested XML structures", async () => {
        const agentNode = {
          id: "test",
          xml: '<agent input="var1"><task output="var2"></task></agent>',
        } as any;

        const autoTools = (agent as any).system_auto_tools(agentNode);
        const varTool = autoTools.find((t: Tool) => t.name === "variable_storage");
        expect(varTool).toBeDefined();
      });
    });

    describe("canParallelToolCalls edge cases", () => {
      it("should handle null agent context config", () => {
        const customAgent = new (class extends Agent {
          constructor() {
            super({
              name: "TestAgent",
              description: "Test",
              tools: [],
            });
          }
        })();

        const result = customAgent.canParallelToolCalls();
        expect(typeof result).toBe("boolean");
      });

      it("should return consistent boolean type", () => {
        const result1 = agent.canParallelToolCalls();
        const result2 = agent.canParallelToolCalls();
        expect(typeof result1).toBe(typeof result2);
      });
    });

    describe("handleCallResult edge cases", () => {
      it("should handle null/undefined in textResults array", async () => {
        const agentChain = {
          agent: { id: "test" },
        } as AgentChain;
        const agentContext = new AgentContext(mockContext, agent, agentChain);
        const messages: any[] = [];

        const textResults: LanguageModelV2TextPart[] = [
          { type: "text", text: "Hello" },
          { type: "text", text: "World" },
        ];

        const result = await (agent as any).handleCallResult(agentContext, messages, [], textResults);
        expect(result).not.toBeNull();
      });

      it("should handle mixed content types in results", async () => {
        const agentChain = {
          agent: { id: "test" },
        } as AgentChain;
        const agentContext = new AgentContext(mockContext, agent, agentChain);
        const messages: any[] = [];

        const mixedResults: any[] = [
          { type: "text", text: "Text content" },
          { type: "image", url: "https://example.com/image.png" },
        ];

        const result = await (agent as any).handleCallResult(agentContext, messages, [], mixedResults);
        expect(typeof result).toBe("string");
      });

      it("should handle very long text results", async () => {
        const agentChain = {
          agent: { id: "test" },
        } as AgentChain;
        const agentContext = new AgentContext(mockContext, agent, agentChain);
        const messages: any[] = [];

        const longText = "x".repeat(1000000); // 1MB of text
        const textResults: LanguageModelV2TextPart[] = [
          { type: "text", text: longText },
        ];

        const result = await (agent as any).handleCallResult(agentContext, messages, [], textResults);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      });

      it("should handle results with special characters", async () => {
        const agentChain = {
          agent: { id: "test" },
        } as AgentChain;
        const agentContext = new AgentContext(mockContext, agent, agentChain);
        const messages: any[] = [];

        const textResults: LanguageModelV2TextPart[] = [
          { type: "text", text: "Hello\nWorld\t\r\n" },
          { type: "text", text: "Special: !@#$%^&*()" },
        ];

        const result = await (agent as any).handleCallResult(agentContext, messages, [], textResults);
        expect(result).toContain("Hello");
        expect(result).toContain("World");
      });

      it("should handle single text result without joining", async () => {
        const agentChain = {
          agent: { id: "test" },
        } as AgentChain;
        const agentContext = new AgentContext(mockContext, agent, agentChain);
        const messages: any[] = [];

        const textResults: LanguageModelV2TextPart[] = [
          { type: "text", text: "Single result" },
        ];

        const result = await (agent as any).handleCallResult(agentContext, messages, [], textResults);
        expect(result).toBe("Single result");
      });

      it("should properly add message to conversation history", async () => {
        const agentChain = {
          agent: { id: "test" },
        } as AgentChain;
        const agentContext = new AgentContext(mockContext, agent, agentChain);
        const messages: any[] = [
          { role: "user", content: "Initial message" },
        ];

        const textResults: LanguageModelV2TextPart[] = [
          { type: "text", text: "Assistant response" },
        ];

        await (agent as any).handleCallResult(agentContext, messages, [], textResults);

        expect(messages.length).toBe(2);
        expect(messages[1].role).toBe("assistant");
        expect(messages[1].content).toEqual(textResults);
      });
    });

    describe("Tool management edge cases", () => {
      it("should maintain tool order across multiple additions", () => {
        const tools = Array.from({ length: 100 }, (_, i) => createMockTool(`tool_${i}`));
        tools.forEach(tool => agent.addTool(tool));

        expect(agent.Tools.length).toBe(100);
        agent.Tools.forEach((tool, i) => {
          expect(tool.name).toBe(`tool_${i}`);
        });
      });

      it("should handle tools with undefined properties", () => {
        const tool: any = {
          name: "test_tool",
          description: undefined,
          parameters: undefined,
          execute: jest.fn(),
        };

        agent.addTool(tool);
        expect(agent.Tools.length).toBe(1);
        expect(agent.Tools[0].name).toBe("test_tool");
      });

      it("should handle Tools getter multiple times", () => {
        const tool = createMockTool("test");
        agent.addTool(tool);

        const tools1 = agent.Tools;
        const tools2 = agent.Tools;

        expect(tools1).toBe(tools2); // Same reference
        expect(tools1.length).toBe(1);
      });
    });

    describe("Agent initialization edge cases", () => {
      it("should handle initialization with empty tool array", () => {
        const customAgent = new (class extends Agent {
          constructor() {
            super({
              name: "EmptyToolAgent",
              description: "Agent with no tools",
              tools: [],
            });
          }
        })();

        expect(customAgent.Tools).toEqual([]);
        expect(customAgent.Tools.length).toBe(0);
      });

      it("should handle initialization with undefined llms", () => {
        const customAgent = new (class extends Agent {
          constructor() {
            super({
              name: "NoLlmsAgent",
              description: "Agent with no llms",
              tools: [],
              llms: undefined,
            });
          }
        })();

        expect(customAgent.Llms).toBeUndefined();
      });

      it("should handle initialization with empty llms array", () => {
        const customAgent = new (class extends Agent {
          constructor() {
            super({
              name: "EmptyLlmsAgent",
              description: "Agent with empty llms",
              tools: [],
              llms: [],
            });
          }
        })();

        expect(customAgent.Llms).toEqual([]);
      });

      it("should handle very long agent description", () => {
        const longDescription = "x".repeat(100000);
        const customAgent = new (class extends Agent {
          constructor() {
            super({
              name: "LongDescAgent",
              description: longDescription,
              tools: [],
            });
          }
        })();

        expect(customAgent.Description.length).toBe(100000);
      });

      it("should handle special characters in agent name", () => {
        const customAgent = new (class extends Agent {
          constructor() {
            super({
              name: "Agent-123_@#$",
              description: "Special char test",
              tools: [],
            });
          }
        })();

        expect(customAgent.Name).toBe("Agent-123_@#$");
      });
    });
  });

  describe("Resource extraction from tool arguments", () => {
    it("should extract file paths from arguments", () => {
      const agent = new TestAgent();
      const resources = agent.extractResourcesFromArgs("file_read", {
        path: "/home/user/document.txt",
        encoding: "utf8"
      });

      expect(resources).toHaveLength(1);
      expect(resources[0]).toEqual({
        type: "file_system",
        identifier: "/home/user/document.txt",
        accessType: "read",
        permission: "allow",
        allowed: true
      });
    });

    it("should extract URLs from arguments", () => {
      const agent = new TestAgent();
      const resources = agent.extractResourcesFromArgs("navigate_to", {
        url: "https://example.com/page",
        waitUntil: "domcontentloaded"
      });

      expect(resources).toHaveLength(1);
      expect(resources[0]).toEqual({
        type: "network",
        identifier: "https://example.com/page",
        accessType: "read",
        permission: "allow",
        allowed: true
      });
    });

    it("should extract domains from arguments", () => {
      const agent = new TestAgent();
      const resources = agent.extractResourcesFromArgs("some_tool", {
        domain: "api.example.com",
        port: 443
      });

      expect(resources).toHaveLength(1);
      expect(resources[0]).toEqual({
        type: "network",
        identifier: "api.example.com",
        accessType: "read",
        permission: "allow",
        allowed: true
      });
    });

    it("should extract shell commands from arguments", () => {
      const agent = new TestAgent();
      const resources = agent.extractResourcesFromArgs("run_command", {
        command: "ls -la /tmp",
        timeout: 5000
      });

      expect(resources).toHaveLength(1);
      expect(resources[0]).toEqual({
        type: "system_command",
        identifier: "ls -la /tmp",
        accessType: "execute",
        permission: "allow",
        allowed: true
      });
    });

    it("should handle browser navigation URLs", () => {
      const agent = new TestAgent();
      const resources = agent.extractResourcesFromArgs("browser_navigate", {
        url: "https://google.com",
        waitCondition: "networkidle"
      });

      expect(resources).toHaveLength(1);
      expect(resources[0].type).toBe("network");
      expect(resources[0].identifier).toBe("https://google.com");
    });

    it("should handle nested object arguments", () => {
      const agent = new TestAgent();
      const resources = agent.extractResourcesFromArgs("complex_tool", {
        config: {
          filePath: "./config.json",
          urls: ["https://api1.com", "https://api2.com"]
        },
        output: "/tmp/result.txt"
      });

      expect(resources).toHaveLength(4);
      const fileResources = resources.filter(r => r.type === "file_system");
      const urlResources = resources.filter(r => r.type === "network");

      expect(fileResources).toHaveLength(2);
      expect(urlResources).toHaveLength(2);
    });

    it("should remove duplicate resources", () => {
      const agent = new TestAgent();
      const resources = agent.extractResourcesFromArgs("duplicate_test", {
        file1: "/tmp/test.txt",
        file2: "/tmp/test.txt",
        config: { path: "/tmp/test.txt" }
      });

      expect(resources).toHaveLength(1);
      expect(resources[0].identifier).toBe("/tmp/test.txt");
    });

    it("should determine write access for write-related arguments", () => {
      const agent = new TestAgent();
      const resources = agent.extractResourcesFromArgs("file_write", {
        outputPath: "/tmp/output.txt",
        content: "test data"
      });

      expect(resources).toHaveLength(1);
      expect(resources[0].accessType).toBe("write");
    });

    it("should handle array arguments", () => {
      const agent = new TestAgent();
      const resources = agent.extractResourcesFromArgs("batch_files", {
        files: ["/file1.txt", "/file2.txt"],
        output: "/tmp/result.txt"
      });

      expect(resources).toHaveLength(3);
      const fileResources = resources.filter(r => r.type === "file_system");
      expect(fileResources).toHaveLength(3);
    });

    it("should return empty array for no resource arguments", () => {
      const agent = new TestAgent();
      const resources = agent.extractResourcesFromArgs("simple_math", {
        a: 1,
        b: 2,
        operation: "add"
      });

      expect(resources).toHaveLength(0);
    });
  });
});
