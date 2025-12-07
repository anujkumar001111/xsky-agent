import Context, { AgentContext } from "../../src/core/context";
import Chain from "../../src/core/chain";
import { Agent } from "../../src/agent";
import { XSkyConfig } from "../../src/types/core.types";

describe("Context", () => {
  const createMockConfig = (): XSkyConfig => ({
    llms: {
      default: {
        provider: "openai",
        model: "gpt-4",
        apiKey: "test-key",
      },
    },
  });

  describe("Context initialization", () => {
    test("should create a Context instance with required parameters", () => {
      const taskId = "task-123";
      const config = createMockConfig();
      const agents: Agent[] = [];
      const chain = new Chain("Test prompt");

      const context = new Context(taskId, config, agents, chain);

      expect(context.taskId).toBe(taskId);
      expect(context.config).toBe(config);
      expect(context.agents).toBe(agents);
      expect(context.chain).toBe(chain);
      expect(context.variables).toBeInstanceOf(Map);
      expect(context.variables.size).toBe(0);
      expect(context.conversation).toEqual([]);
      expect(context.controller).toBeInstanceOf(AbortController);
      expect(context.pause).toBe(false);
    });

    test("should initialize with AbortController signal not aborted", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      expect(context.controller.signal.aborted).toBe(false);
    });

    test("should initialize empty currentStepControllers set", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      expect(context.currentStepControllers).toBeInstanceOf(Set);
      expect(context.currentStepControllers.size).toBe(0);
    });
  });

  describe("Variable management", () => {
    test("should set and get variables", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      context.variables.set("key1", "value1");
      context.variables.set("key2", 42);

      expect(context.variables.get("key1")).toBe("value1");
      expect(context.variables.get("key2")).toBe(42);
      expect(context.variables.size).toBe(2);
    });

    test("should support complex variable values", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      const complexValue = {
        nested: {
          data: [1, 2, 3],
        },
        function: () => "test",
      };

      context.variables.set("complex", complexValue);

      expect(context.variables.get("complex")).toBe(complexValue);
    });

    test("should persist variables on reset", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      context.variables.set("key1", "value1");
      context.variables.set("key2", "value2");

      context.reset();

      // Variables should persist through reset
      expect(context.variables.size).toBe(2);
      expect(context.variables.get("key1")).toBe("value1");
    });
  });

  describe("Pause/Resume functionality", () => {
    test("should set pause status to 1 when paused without aborting step", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      context.setPause(true, false);

      expect(context.pause).toBe(true);
    });

    test("should set pause status to 2 when paused with aborting step", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      const stepController = new AbortController();
      context.currentStepControllers.add(stepController);

      context.setPause(true, true);

      expect(context.pause).toBe(true);
      expect(stepController.signal.aborted).toBe(true);
      expect(context.currentStepControllers.size).toBe(0);
    });

    test("should resume when pause is false", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      context.setPause(true);
      expect(context.pause).toBe(true);

      context.setPause(false);
      expect(context.pause).toBe(false);
    });

    test("should abort all step controllers when pausing with abort", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      const controller1 = new AbortController();
      const controller2 = new AbortController();
      context.currentStepControllers.add(controller1);
      context.currentStepControllers.add(controller2);

      context.setPause(true, true);

      expect(controller1.signal.aborted).toBe(true);
      expect(controller2.signal.aborted).toBe(true);
      expect(context.currentStepControllers.size).toBe(0);
    });
  });

  describe("Abort functionality", () => {
    test("should check abort without throwing when not aborted", async () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      await expect(context.checkAborted()).resolves.not.toThrow();
    });

    test("should throw AbortError when controller is aborted", async () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      context.controller.abort();

      await expect(context.checkAborted()).rejects.toThrow("Operation was interrupted");
    });

    test("should have AbortError name when aborted", async () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      context.controller.abort();

      try {
        await context.checkAborted();
        fail("Should have thrown");
      } catch (error: any) {
        expect(error.name).toBe("AbortError");
      }
    });

    test("should wait for pause to be released before continuing", async () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      context.setPause(true);

      const checkPromise = context.checkAborted();

      await new Promise((resolve) => setTimeout(resolve, 100));
      context.setPause(false);

      await expect(checkPromise).resolves.not.toThrow();
    });

    test("should throw abort error when aborted while paused", async () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      context.setPause(true);

      setTimeout(() => {
        context.controller.abort();
      }, 100);

      await expect(context.checkAborted()).rejects.toThrow("Operation was interrupted");
    });

    test("should skip pause check when noCheckPause is true", async () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      context.setPause(true);

      await expect(context.checkAborted(true)).resolves.not.toThrow();
    });

    test("should abort current step controllers when pause status is 2", async () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      const stepController = new AbortController();
      context.currentStepControllers.add(stepController);
      context.setPause(true, true); // pause with abort current step

      // Wait for the check to process
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(stepController.signal.aborted).toBe(true);
    });
  });

  describe("Context reset", () => {
    test("should reset pause status, controllers, and clear step controllers", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      context.setPause(true);
      const stepController = new AbortController();
      context.currentStepControllers.add(stepController);

      const oldController = context.controller;
      context.reset();

      expect(context.pause).toBe(false);
      expect(oldController.signal.aborted).toBe(true);
      expect(context.currentStepControllers.size).toBe(0);
      expect(context.controller).not.toBe(oldController);
    });

    test("should create new AbortController after reset", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      const oldController = context.controller;
      context.reset();

      expect(context.controller).toBeInstanceOf(AbortController);
      expect(context.controller).not.toBe(oldController);
      expect(context.controller.signal.aborted).toBe(false);
    });

    test("should handle reset when no step controllers are active", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      expect(() => context.reset()).not.toThrow();
    });
  });

  describe("Checkpointing functionality", () => {
    test("should start and stop checkpointing", async () => {
      const config = createMockConfig();
      const checkpointHook = jest.fn();
      config.hooks = {
        onCheckpoint: checkpointHook,
      };

      const context = new Context("task-1", config, [], new Chain("Test"));

      context.startCheckpointing(100);
      expect((context as any).checkpointTimer).toBeDefined();

      // Wait for at least one checkpoint
      await new Promise((resolve) => setTimeout(resolve, 150));

      context.stopCheckpointing();
      expect((context as any).checkpointTimer).toBeUndefined();
      expect(checkpointHook).toHaveBeenCalled();
    });

    test("should create checkpoint with correct structure", async () => {
      const config = createMockConfig();
      let capturedCheckpoint;
      config.hooks = {
        onCheckpoint: async (checkpoint) => {
          capturedCheckpoint = checkpoint;
        },
      };

      const context = new Context("task-1", config, [], new Chain("Test"));
      context.variables.set("key", "value");

      const checkpoint = await context.createCheckpoint();

      expect(checkpoint).toBeDefined();
      expect(checkpoint?.id).toBeDefined();
      expect(checkpoint?.taskId).toBe("task-1");
      expect(checkpoint?.state).toBeDefined();
      expect(checkpoint?.metadata).toBeDefined();
      expect(checkpoint?.metadata.agentCount).toBe(0);
      expect(checkpoint?.metadata.variableCount).toBe(1);
      expect(checkpoint?.createdAt).toBeDefined();
    });

    test("should not fail when checkpoint hook is not configured", async () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      const checkpoint = await context.createCheckpoint();

      expect(checkpoint).toBeUndefined();
    });

    test("should handle checkpoint hook errors gracefully", async () => {
      const config = createMockConfig();
      const checkpointError = new Error("Checkpoint hook failed");
      config.hooks = {
        onCheckpoint: async () => {
          throw checkpointError;
        },
      };

      const context = new Context("task-1", config, [], new Chain("Test"));
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const checkpoint = await context.createCheckpoint();

      expect(checkpoint).toBeDefined(); // Should still return checkpoint
      expect(consoleSpy).toHaveBeenCalledWith("Checkpoint hook error:", checkpointError);

      consoleSpy.mockRestore();
    });
  });

  describe("Context serialization and restoration", () => {
    test("should serialize context state", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      context.variables.set("key1", "value1");
      context.variables.set("key2", 42);
      context.conversation.push("message1");
      context.conversation.push("message2");

      const serialized = context.serialize();

      expect(serialized.taskId).toBe("task-1");
      expect(serialized.variables).toEqual({
        key1: "value1",
        key2: 42,
      });
      expect(serialized.conversation).toEqual(["message1", "message2"]);
    });

    test("should restore context state", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      const state = {
        taskId: "task-1",
        variables: {
          key1: "restored1",
          key2: 100,
        },
        conversation: ["restored message"],
        workflowProgress: [],
      };

      context.restore(state);

      expect(context.variables.get("key1")).toBe("restored1");
      expect(context.variables.get("key2")).toBe(100);
      expect(context.conversation).toEqual(["restored message"]);
    });

    test("should handle restore with partial state", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      context.variables.set("existing", "value");

      const state = {
        variables: {
          key1: "new",
        },
      };

      context.restore(state);

      expect(context.variables.get("key1")).toBe("new");
      expect(context.variables.get("existing")).toBeUndefined();
    });
  });

  describe("State change tracking and debouncing", () => {
    test("should set variable and queue state change", async () => {
      const config = createMockConfig();
      const stateChangeHook = jest.fn();
      config.hooks = {
        onStateChange: stateChangeHook,
      };

      const context = new Context("task-1", config, [], new Chain("Test"));

      context.setVariable("key", "value");

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(stateChangeHook).toHaveBeenCalledWith(context, "key", "value");
    });

    test("should get variable", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      context.variables.set("key", "value");

      expect(context.getVariable("key")).toBe("value");
      expect(context.getVariable("nonexistent")).toBeUndefined();
    });

    test("should debounce multiple state changes", async () => {
      const config = createMockConfig();
      const stateChangeHook = jest.fn();
      config.hooks = {
        onStateChange: stateChangeHook,
      };

      const context = new Context("task-1", config, [], new Chain("Test"));

      context.setVariable("key1", "value1");
      context.setVariable("key2", "value2");
      context.setVariable("key3", "value3");

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be called 3 times (once per key)
      expect(stateChangeHook.mock.calls.length).toBe(3);
    });

    test("should not fire state change hook if not configured", async () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      expect(() => context.setVariable("key", "value")).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    test("should handle state change hook errors gracefully", async () => {
      const config = createMockConfig();
      const stateChangeError = new Error("State change hook failed");
      config.hooks = {
        onStateChange: async () => {
          throw stateChangeError;
        },
      };

      const context = new Context("task-1", config, [], new Chain("Test"));
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      context.setVariable("key", "value");

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(consoleSpy).toHaveBeenCalledWith("onStateChange hook error:", stateChangeError);

      consoleSpy.mockRestore();
    });
  });

  describe("Conversation management", () => {
    test("should maintain conversation history", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      context.conversation.push("message1");
      context.conversation.push("message2");

      expect(context.conversation).toEqual(["message1", "message2"]);
      expect(context.conversation.length).toBe(2);
    });

    test("should clear conversation", () => {
      const context = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      context.conversation.push("message1");
      context.conversation.splice(0, context.conversation.length);

      expect(context.conversation).toEqual([]);
    });
  });
});

describe("AgentContext", () => {
  const createMockConfig = (): XSkyConfig => ({
    llms: {
      default: {
        provider: "openai",
        model: "gpt-4",
        apiKey: "test-key",
      },
    },
  });

  describe("AgentContext initialization", () => {
    test("should create AgentContext with required parameters", () => {
      const taskContext = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      const agent = {} as Agent;
      const agentChain = new (require("../../src/core/chain").AgentChain)({
        id: "agent-1",
        name: "TestAgent",
        description: "Test",
        status: "init",
        tools: [],
      });

      const agentContext = new AgentContext(taskContext, agent, agentChain);

      expect(agentContext.context).toBe(taskContext);
      expect(agentContext.agent).toBe(agent);
      expect(agentContext.agentChain).toBe(agentChain);
      expect(agentContext.variables).toBeInstanceOf(Map);
      expect(agentContext.consecutiveErrorNum).toBe(0);
      expect(agentContext.adaptiveWaitSignals).toEqual([]);
    });
  });

  describe("Agent variables", () => {
    test("should manage agent-level variables", () => {
      const taskContext = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      const agent = {} as Agent;
      const agentChain = new (require("../../src/core/chain").AgentChain)({
        id: "agent-1",
        name: "TestAgent",
        description: "Test",
        status: "init",
        tools: [],
      });

      const agentContext = new AgentContext(taskContext, agent, agentChain);

      agentContext.variables.set("agentKey", "agentValue");

      expect(agentContext.variables.get("agentKey")).toBe("agentValue");
      expect(agentContext.variables.size).toBe(1);
    });
  });

  describe("Adaptive wait signals", () => {
    test("should add adaptive wait signals", () => {
      const taskContext = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      const agent = {} as Agent;
      const agentChain = new (require("../../src/core/chain").AgentChain)({
        id: "agent-1",
        name: "TestAgent",
        description: "Test",
        status: "init",
        tools: [],
      });

      const agentContext = new AgentContext(taskContext, agent, agentChain);

      const signal = {
        type: "mutation" as const,
        elementId: "elem-1",
        timestamp: Date.now(),
        data: "test data",
      };

      agentContext.addAdaptiveWaitSignal(signal);

      expect(agentContext.adaptiveWaitSignals).toHaveLength(1);
      expect(agentContext.adaptiveWaitSignals[0]).toEqual(signal);
    });

    test("should filter old signals (older than 5 seconds)", () => {
      const taskContext = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      const agent = {} as Agent;
      const agentChain = new (require("../../src/core/chain").AgentChain)({
        id: "agent-1",
        name: "TestAgent",
        description: "Test",
        status: "init",
        tools: [],
      });

      const agentContext = new AgentContext(taskContext, agent, agentChain);
      const now = Date.now();

      // Add old signal
      const oldSignal = {
        type: "mutation" as const,
        elementId: "elem-1",
        timestamp: now - 6000,
        data: "old",
      };

      // Add recent signal
      const recentSignal = {
        type: "event" as const,
        elementId: "elem-2",
        timestamp: now,
        data: "recent",
      };

      agentContext.addAdaptiveWaitSignal(oldSignal);
      agentContext.addAdaptiveWaitSignal(recentSignal);

      expect(agentContext.adaptiveWaitSignals).toHaveLength(1);
      expect(agentContext.adaptiveWaitSignals[0]).toEqual(recentSignal);
    });

    test("should get latest signal", () => {
      const taskContext = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      const agent = {} as Agent;
      const agentChain = new (require("../../src/core/chain").AgentChain)({
        id: "agent-1",
        name: "TestAgent",
        description: "Test",
        status: "init",
        tools: [],
      });

      const agentContext = new AgentContext(taskContext, agent, agentChain);

      const signal1 = {
        type: "mutation" as const,
        timestamp: Date.now(),
        data: "data1",
      };
      const signal2 = {
        type: "event" as const,
        timestamp: Date.now() + 100,
        data: "data2",
      };

      agentContext.addAdaptiveWaitSignal(signal1);
      agentContext.addAdaptiveWaitSignal(signal2);

      const latest = agentContext.getLatestSignal();
      expect(latest).toEqual(signal2);
    });

    test("should get latest signal by type", () => {
      const taskContext = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      const agent = {} as Agent;
      const agentChain = new (require("../../src/core/chain").AgentChain)({
        id: "agent-1",
        name: "TestAgent",
        description: "Test",
        status: "init",
        tools: [],
      });

      const agentContext = new AgentContext(taskContext, agent, agentChain);

      const mutationSignal = {
        type: "mutation" as const,
        timestamp: Date.now(),
        data: "mutation",
      };
      const eventSignal = {
        type: "event" as const,
        timestamp: Date.now() + 100,
        data: "event",
      };
      const animationSignal = {
        type: "animation" as const,
        timestamp: Date.now() + 200,
        data: "animation",
      };

      agentContext.addAdaptiveWaitSignal(mutationSignal);
      agentContext.addAdaptiveWaitSignal(eventSignal);
      agentContext.addAdaptiveWaitSignal(animationSignal);

      expect(agentContext.getLatestSignal("mutation")).toEqual(mutationSignal);
      expect(agentContext.getLatestSignal("event")).toEqual(eventSignal);
      expect(agentContext.getLatestSignal("animation")).toEqual(animationSignal);
    });

    test("should return undefined for non-existent signal type", () => {
      const taskContext = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      const agent = {} as Agent;
      const agentChain = new (require("../../src/core/chain").AgentChain)({
        id: "agent-1",
        name: "TestAgent",
        description: "Test",
        status: "init",
        tools: [],
      });

      const agentContext = new AgentContext(taskContext, agent, agentChain);

      const signal = {
        type: "mutation" as const,
        timestamp: Date.now(),
        data: "test",
      };

      agentContext.addAdaptiveWaitSignal(signal);

      expect(agentContext.getLatestSignal("load")).toBeUndefined();
    });
  });

  describe("Consecutive error tracking", () => {
    test("should track consecutive errors", () => {
      const taskContext = new Context(
        "task-1",
        createMockConfig(),
        [],
        new Chain("Test")
      );

      const agent = {} as Agent;
      const agentChain = new (require("../../src/core/chain").AgentChain)({
        id: "agent-1",
        name: "TestAgent",
        description: "Test",
        status: "init",
        tools: [],
      });

      const agentContext = new AgentContext(taskContext, agent, agentChain);

      agentContext.consecutiveErrorNum = 3;

      expect(agentContext.consecutiveErrorNum).toBe(3);
    });
  });
});
