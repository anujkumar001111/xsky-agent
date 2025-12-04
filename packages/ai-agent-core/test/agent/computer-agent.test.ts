import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { BaseComputerAgent } from "../../src/agent/computer";
import Context from "../../src/core/context";
import { AgentContext } from "../../src/core/context";
import { ToolResult } from "../../src/types";

// Mock implementation for testing
class TestComputerAgent extends BaseComputerAgent {
  private screenshotCalls = 0;

  protected async screenshot(agentContext: AgentContext): Promise<{
    imageBase64: string;
    imageType: "image/jpeg" | "image/png";
  }> {
    this.screenshotCalls++;
    return {
      imageBase64: "fake-base64-image-" + this.screenshotCalls,
      imageType: "image/jpeg",
    };
  }

  protected async typing(agentContext: AgentContext, text: string): Promise<void> {
    if (text.length > 10000) {
      throw new Error("Text too long");
    }
  }

  protected async click(
    agentContext: AgentContext,
    x: number,
    y: number,
    num_clicks: number,
    button_type: "left" | "right" | "middle"
  ): Promise<void> {
    if (x < 0 || y < 0) {
      throw new Error("Invalid coordinates");
    }
  }

  protected async scroll(agentContext: AgentContext, amount: number): Promise<void> {
    if (Math.abs(amount) > 10000) {
      throw new Error("Scroll amount too large");
    }
  }

  protected async move_to(agentContext: AgentContext, x: number, y: number): Promise<void> {
    if (x < 0 || y < 0) {
      throw new Error("Invalid coordinates");
    }
  }

  protected async press(agentContext: AgentContext, key: string): Promise<void> {
    if (!key || key.length === 0) {
      throw new Error("Invalid key");
    }
  }

  protected async hotkey(agentContext: AgentContext, keys: string): Promise<void> {
    if (!keys || keys.length === 0) {
      throw new Error("Invalid hotkey");
    }
  }

  protected async drag_and_drop(
    agentContext: AgentContext,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): Promise<void> {
    if (x1 < 0 || y1 < 0 || x2 < 0 || y2 < 0) {
      throw new Error("Invalid coordinates");
    }
  }

  getScreenshotCalls(): number {
    return this.screenshotCalls;
  }
}

describe("BaseComputerAgent", () => {
  let agent: TestComputerAgent;
  let mockContext: Context;

  beforeEach(async () => {
    agent = new TestComputerAgent();
    mockContext = new Context({
      taskId: "test-task-123",
      chain: { taskPrompt: "Test task" } as any,
    });
  });

  describe("Constructor", () => {
    it("should initialize with correct name", () => {
      expect(agent.Name).toBe("Computer");
    });

    it("should have computer operation description", () => {
      expect(agent.Description).toContain("computer");
      expect(agent.Description).toContain("mouse");
      expect(agent.Description).toContain("keyboard");
    });

    it("should have required tools for Windows platform", () => {
      const tools = agent.Tools;
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain("typing");
      expect(toolNames).toContain("click");
      expect(toolNames).toContain("scroll");
      expect(toolNames).toContain("move_to");
      expect(toolNames).toContain("press");
      expect(toolNames).toContain("hotkey");
      expect(toolNames).toContain("drag_and_drop");
      expect(toolNames).toContain("wait");
    });

    it("should initialize with default keyboard keys", () => {
      const tools = agent.Tools;
      expect(tools.length).toBeGreaterThan(0);
    });

    it("should accept custom keyboard keys", () => {
      const customKeys = ["a", "b", "custom_key"];
      const customAgent = new (class extends BaseComputerAgent {
        protected screenshot(): Promise<any> {
          return Promise.resolve({ imageBase64: "", imageType: "image/jpeg" });
        }
        protected typing(): Promise<void> {
          return Promise.resolve();
        }
        protected click(): Promise<void> {
          return Promise.resolve();
        }
        protected scroll(): Promise<void> {
          return Promise.resolve();
        }
        protected move_to(): Promise<void> {
          return Promise.resolve();
        }
        protected press(): Promise<void> {
          return Promise.resolve();
        }
        protected hotkey(): Promise<void> {
          return Promise.resolve();
        }
        protected drag_and_drop(): Promise<void> {
          return Promise.resolve();
        }
      })(undefined, undefined, undefined, customKeys);

      expect(customAgent.Tools).toBeDefined();
    });

    it("should merge external tools if provided", () => {
      const externalTool = {
        name: "custom_tool",
        description: "Custom",
        parameters: { type: "object", properties: {} },
        execute: async () => ({ content: [{ type: "text", text: "result" }] }),
      };
      const agentWithTools = new (class extends BaseComputerAgent {
        protected screenshot(): Promise<any> {
          return Promise.resolve({ imageBase64: "", imageType: "image/jpeg" });
        }
        protected typing(): Promise<void> {
          return Promise.resolve();
        }
        protected click(): Promise<void> {
          return Promise.resolve();
        }
        protected scroll(): Promise<void> {
          return Promise.resolve();
        }
        protected move_to(): Promise<void> {
          return Promise.resolve();
        }
        protected press(): Promise<void> {
          return Promise.resolve();
        }
        protected hotkey(): Promise<void> {
          return Promise.resolve();
        }
        protected drag_and_drop(): Promise<void> {
          return Promise.resolve();
        }
      })(undefined, [externalTool]);

      const toolNames = agentWithTools.Tools.map((t) => t.name);
      expect(toolNames).toContain("custom_tool");
    });
  });

  describe("typing tool", () => {
    it("should type text", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const typingTool = agent.Tools.find((t) => t.name === "typing");
      const result = (await typingTool!.execute({ text: "Hello World" }, agentContext)) as ToolResult;

      expect(result.content[0].type).toBe("text");
      expect((result.content[0] as any).text).toContain("Successful");
    });

    it("should handle typing errors", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const typingTool = agent.Tools.find((t) => t.name === "typing");

      try {
        await typingTool!.execute({ text: "x".repeat(10001) }, agentContext);
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("too long");
      }
    });

    it("should handle empty text", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const typingTool = agent.Tools.find((t) => t.name === "typing");
      const result = (await typingTool!.execute({ text: "" }, agentContext)) as ToolResult;

      expect(result.content[0].type).toBe("text");
    });
  });

  describe("click tool", () => {
    it("should click at coordinates", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const clickTool = agent.Tools.find((t) => t.name === "click");
      const result = (await clickTool!.execute(
        { x: 100, y: 200, num_clicks: 1, button: "left" },
        agentContext
      )) as ToolResult;

      expect(result.content[0].type).toBe("text");
      expect((result.content[0] as any).text).toContain("Successful");
    });

    it("should support multiple clicks", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const clickTool = agent.Tools.find((t) => t.name === "click");
      const result = (await clickTool!.execute(
        { x: 100, y: 200, num_clicks: 3, button: "left" },
        agentContext
      )) as ToolResult;

      expect(result.content[0].type).toBe("text");
    });

    it("should support different button types", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const clickTool = agent.Tools.find((t) => t.name === "click");

      for (const button of ["left", "right", "middle"]) {
        const result = (await clickTool!.execute(
          { x: 100, y: 200, num_clicks: 1, button },
          agentContext
        )) as ToolResult;
        expect(result.content[0].type).toBe("text");
      }
    });

    it("should handle invalid coordinates", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const clickTool = agent.Tools.find((t) => t.name === "click");

      try {
        await clickTool!.execute({ x: -1, y: 200, num_clicks: 1 }, agentContext);
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("Invalid coordinates");
      }
    });

    it("should default num_clicks to 1", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const clickTool = agent.Tools.find((t) => t.name === "click");
      const result = (await clickTool!.execute({ x: 100, y: 200 }, agentContext)) as ToolResult;

      expect(result.content[0].type).toBe("text");
    });
  });

  describe("move_to tool", () => {
    it("should move mouse to coordinates", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const moveTool = agent.Tools.find((t) => t.name === "move_to");
      const result = (await moveTool!.execute({ x: 500, y: 600 }, agentContext)) as ToolResult;

      expect(result.content[0].type).toBe("text");
    });

    it("should handle invalid coordinates", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const moveTool = agent.Tools.find((t) => t.name === "move_to");

      try {
        await moveTool!.execute({ x: -10, y: 600 }, agentContext);
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("Invalid coordinates");
      }
    });
  });

  describe("scroll tool", () => {
    it("should scroll down", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const scrollTool = agent.Tools.find((t) => t.name === "scroll");
      const result = (await scrollTool!.execute(
        { amount: 3, direction: "down" },
        agentContext
      )) as ToolResult;

      expect(result.content[0].type).toBe("text");
    });

    it("should scroll up", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const scrollTool = agent.Tools.find((t) => t.name === "scroll");
      const result = (await scrollTool!.execute(
        { amount: 3, direction: "up" },
        agentContext
      )) as ToolResult;

      expect(result.content[0].type).toBe("text");
    });

    it("should handle scroll errors", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const scrollTool = agent.Tools.find((t) => t.name === "scroll");

      try {
        await scrollTool!.execute({ amount: 20000, direction: "down" }, agentContext);
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("too large");
      }
    });
  });

  describe("press tool", () => {
    it("should press a key", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const pressTool = agent.Tools.find((t) => t.name === "press");
      const result = (await pressTool!.execute({ key: "enter" }, agentContext)) as ToolResult;

      expect(result.content[0].type).toBe("text");
    });

    it("should handle invalid keys", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const pressTool = agent.Tools.find((t) => t.name === "press");

      try {
        await pressTool!.execute({ key: "" }, agentContext);
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("Invalid key");
      }
    });
  });

  describe("hotkey tool", () => {
    it("should execute hotkey combination", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const hotkeyTool = agent.Tools.find((t) => t.name === "hotkey");
      const result = (await hotkeyTool!.execute({ keys: "ctrl+c" }, agentContext)) as ToolResult;

      expect(result.content[0].type).toBe("text");
    });

    it("should handle invalid hotkeys", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const hotkeyTool = agent.Tools.find((t) => t.name === "hotkey");

      try {
        await hotkeyTool!.execute({ keys: "" }, agentContext);
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("Invalid hotkey");
      }
    });
  });

  describe("drag_and_drop tool", () => {
    it("should perform drag and drop", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const dragTool = agent.Tools.find((t) => t.name === "drag_and_drop");
      const result = (await dragTool!.execute(
        { x1: 100, y1: 100, x2: 200, y2: 200 },
        agentContext
      )) as ToolResult;

      expect(result.content[0].type).toBe("text");
    });

    it("should handle invalid drag coordinates", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const dragTool = agent.Tools.find((t) => t.name === "drag_and_drop");

      try {
        await dragTool!.execute({ x1: -1, y1: 100, x2: 200, y2: 200 }, agentContext);
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("Invalid coordinates");
      }
    });
  });

  describe("wait tool", () => {
    it("should wait for specified duration", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const waitTool = agent.Tools.find((t) => t.name === "wait");
      const startTime = Date.now();
      const result = (await waitTool!.execute({ duration: 100 }, agentContext)) as ToolResult;
      const elapsed = Date.now() - startTime;

      expect(result.content[0].type).toBe("text");
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    it("should default to 200ms", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const waitTool = agent.Tools.find((t) => t.name === "wait");
      const result = (await waitTool!.execute({}, agentContext)) as ToolResult;

      expect(result.content[0].type).toBe("text");
    });
  });

  describe("screenshot method", () => {
    it("should return screenshot with proper format", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const screenshot = await (agent as any).screenshot(agentContext);

      expect(screenshot).toBeDefined();
      expect(screenshot.imageBase64).toBeDefined();
      expect(screenshot.imageType).toMatch(/image\/(jpeg|png)/);
    });
  });
});
