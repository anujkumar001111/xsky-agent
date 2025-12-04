import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { BaseBrowserLabelsAgent } from "../../src/agent/browser/browser_labels";
import Context from "../../src/core/context";
import { AgentContext } from "../../src/core/context";
import { ToolResult } from "../../src/types";

// Mock browser agent for testing
class TestBrowserAgent extends BaseBrowserLabelsAgent {
  private screenshotCalls = 0;
  private navigationHistory: Array<{ url: string; title: string }> = [];

  constructor() {
    super([], [], undefined);
    this.navigationHistory.push({ url: "about:blank", title: "New Tab" });
  }

  protected async screenshot(agentContext: AgentContext): Promise<{
    imageBase64: string;
    imageType: "image/jpeg" | "image/png";
  }> {
    this.screenshotCalls++;
    return {
      imageBase64: "fake-screenshot-" + this.screenshotCalls,
      imageType: "image/png",
    };
  }

  protected async navigate_to(
    agentContext: AgentContext,
    url: string
  ): Promise<{ url: string; title?: string }> {
    if (!url || !url.startsWith("http")) {
      throw new Error("Invalid URL");
    }
    this.navigationHistory.push({ url, title: "Page: " + url });
    this.lastScaleFactor = 0.75; // Simulate scaling
    return { url, title: "Page: " + url };
  }

  protected async execute_script(
    agentContext: AgentContext,
    func: (...args: any[]) => void,
    args: any[]
  ): Promise<any> {
    if (!func) {
      throw new Error("Function required");
    }
    return { result: "executed" };
  }

  protected async get_all_tabs(agentContext: AgentContext): Promise<
    Array<{ tabId: number; url: string; title: string }>
  > {
    return this.navigationHistory.map((h, i) => ({
      tabId: i,
      url: h.url,
      title: h.title,
    }));
  }

  protected async switch_tab(
    agentContext: AgentContext,
    tabId: number
  ): Promise<{ tabId: number; url: string; title: string }> {
    if (tabId < 0 || tabId >= this.navigationHistory.length) {
      throw new Error("Tab not found");
    }
    const tab = this.navigationHistory[tabId];
    return { tabId, url: tab.url, title: tab.title };
  }

  getScreenshotCallCount(): number {
    return this.screenshotCalls;
  }
}

describe("BaseBrowserLabelsAgent", () => {
  let agent: TestBrowserAgent;
  let mockContext: Context;

  beforeEach(async () => {
    agent = new TestBrowserAgent();
    mockContext = new Context({
      taskId: "browser-test-123",
      chain: { taskPrompt: "Browser test" } as any,
    });
  });

  describe("Initialization", () => {
    it("should have correct name", () => {
      expect(agent.Name).toBe("Browser");
    });

    it("should have browser description with system capabilities", () => {
      expect(agent.Description).toContain("browser");
      expect(agent.Description).toContain("labeled elements");
      expect(agent.Description).toContain("SYSTEM_CAPABILITY");
    });

    it("should include interaction rules in description", () => {
      expect(agent.Description).toContain("INTERACTION_RULES");
      expect(agent.Description).toContain("[index]");
    });

    it("should include screenshot guidance in description", () => {
      expect(agent.Description).toContain("SCREENSHOT_GUIDANCE");
    });

    it("should include constraints in description", () => {
      expect(agent.Description).toContain("CONSTRAINTS");
    });

    it("should include error handling in description", () => {
      expect(agent.Description).toContain("ERROR_HANDLING");
    });

    it("should initialize lastScaleFactor to 1", () => {
      expect(agent.lastScaleFactor).toBe(1);
    });
  });

  describe("Browser-specific tools", () => {
    it("should have navigate_to tool", () => {
      const tool = agent.Tools.find((t) => t.name === "navigate_to");
      expect(tool).toBeDefined();
      expect(tool!.description.toLowerCase()).toContain("navigate");
    });

    it("should have screenshot tool or capability", () => {
      const tools = agent.Tools;
      expect(tools.length).toBeGreaterThan(0);
    });

    it("should have get_all_tabs tool", () => {
      const tool = agent.Tools.find((t) => t.name === "get_all_tabs");
      expect(tool).toBeDefined();
    });

    it("should have switch_tab tool", () => {
      const tool = agent.Tools.find((t) => t.name === "switch_tab");
      expect(tool).toBeDefined();
    });

    it("should have go_back tool", () => {
      const tool = agent.Tools.find((t) => t.name === "go_back");
      expect(tool).toBeDefined();
    });

    it("should have extract_page_content tool", () => {
      const tool = agent.Tools.find((t) => t.name === "extract_page_content");
      expect(tool).toBeDefined();
    });
  });

  describe("navigate_to functionality", () => {
    it("should navigate to valid URL", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const navTool = agent.Tools.find((t) => t.name === "navigate_to");
      const result = (await navTool!.execute(
        { url: "https://example.com" },
        agentContext
      )) as ToolResult;

      expect(result.content[0].type).toBe("text");
      expect((result.content[0] as any).text).toContain("example.com");
    });

    it("should reject invalid URLs", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const navTool = agent.Tools.find((t) => t.name === "navigate_to");

      try {
        await navTool!.execute({ url: "not-a-url" }, agentContext);
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("Invalid URL");
      }
    });

    it("should update scale factor during navigation", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const initialScale = agent.lastScaleFactor;
      const navTool = agent.Tools.find((t) => t.name === "navigate_to");
      await navTool!.execute({ url: "https://test.com" }, agentContext);

      // Mock implementation sets it to 0.75
      expect(agent.lastScaleFactor).toBe(0.75);
      expect(agent.lastScaleFactor).not.toBe(initialScale);
    });
  });

  describe("Tab management", () => {
    it("should get all tabs", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const tabsTool = agent.Tools.find((t) => t.name === "get_all_tabs");
      const result = (await tabsTool!.execute({}, agentContext)) as ToolResult;

      expect(result.content[0].type).toBe("text");
      expect((result.content[0] as any).text).toContain("about:blank");
    });

    it("should switch to existing tab", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const switchTool = agent.Tools.find((t) => t.name === "switch_tab");
      const result = (await switchTool!.execute({ tabId: 0 }, agentContext)) as ToolResult;

      expect(result.content[0].type).toBe("text");
    });

    it("should handle switching to invalid tab", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const switchTool = agent.Tools.find((t) => t.name === "switch_tab");

      try {
        await switchTool!.execute({ tabId: 999 }, agentContext);
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("not found");
      }
    });
  });

  describe("Screenshot functionality", () => {
    it("should take screenshot", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const screenshot = await (agent as any).screenshot(agentContext);

      expect(screenshot.imageBase64).toBeDefined();
      expect(screenshot.imageType).toMatch(/image\/(jpeg|png)/);
    });

    it("should increment screenshot call count", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const initialCount = agent.getScreenshotCallCount();
      await (agent as any).screenshot(agentContext);
      await (agent as any).screenshot(agentContext);

      expect(agent.getScreenshotCallCount()).toBe(initialCount + 2);
    });
  });

  describe("Go back functionality", () => {
    it("should execute go_back tool", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const backTool = agent.Tools.find((t) => t.name === "go_back");
      const result = (await backTool!.execute({}, agentContext)) as ToolResult;

      expect(result.content[0].type).toBe("text");
      expect((result.content[0] as any).text).toContain("Successful");
    });
  });

  describe("Description structure", () => {
    it("should have all required XML-like sections", () => {
      const description = agent.Description;

      const sections = [
        "<SYSTEM_CAPABILITY>",
        "</SYSTEM_CAPABILITY>",
        "<INTERACTION_RULES>",
        "</INTERACTION_RULES>",
        "<SCREENSHOT_GUIDANCE>",
        "</SCREENSHOT_GUIDANCE>",
        "<CONSTRAINTS>",
        "</CONSTRAINTS>",
        "<ERROR_HANDLING>",
        "</ERROR_HANDLING>",
        "<IMPORTANT>",
        "</IMPORTANT>",
      ];

      sections.forEach((section) => {
        expect(description).toContain(section);
      });
    });

    it("should mention labeled elements", () => {
      expect(agent.Description).toContain("labeled");
      expect(agent.Description).toContain("[index]");
    });

    it("should mention screenshot with element labels", () => {
      expect(agent.Description).toContain("bounding box");
    });

    it("should include element index usage guidelines", () => {
      expect(agent.Description).toContain("[index]");
      expect(agent.Description).toContain("screenshot");
    });
  });

  describe("Script execution", () => {
    it("should execute provided function", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const func = () => {
        return "executed";
      };

      const result = await (agent as any).execute_script(agentContext, func, []);

      expect(result).toBeDefined();
      expect(result.result).toBe("executed");
    });

    it("should handle script execution errors", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      try {
        await (agent as any).execute_script(agentContext, null, []);
        expect(true).toBe(false); // Should not reach here
      } catch (e: any) {
        expect(e.message).toContain("Function required");
      }
    });
  });

  describe("Scale factor management", () => {
    it("should initialize with scale factor of 1", () => {
      const newAgent = new TestBrowserAgent();
      expect(newAgent.lastScaleFactor).toBe(1);
    });

    it("should allow modification of scale factor", () => {
      agent.lastScaleFactor = 0.5;
      expect(agent.lastScaleFactor).toBe(0.5);

      agent.lastScaleFactor = 2;
      expect(agent.lastScaleFactor).toBe(2);
    });

    it("should maintain scale factor across operations", () => {
      agent.lastScaleFactor = 0.75;
      const originalScale = agent.lastScaleFactor;

      // Scale factor should be preserved
      expect(agent.lastScaleFactor).toBe(originalScale);
    });
  });

  describe("Tool parameter validation", () => {
    it("should validate navigate_to parameters", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const navTool = agent.Tools.find((t) => t.name === "navigate_to");
      expect(navTool!.parameters.properties).toHaveProperty("url");
    });

    it("should validate switch_tab parameters", async () => {
      const agentChain = { agent: { id: "test" }, agentRequest: {} } as any;
      const agentContext = new AgentContext(mockContext, agent, agentChain);

      const switchTool = agent.Tools.find((t) => t.name === "switch_tab");
      expect(switchTool!.parameters.properties).toHaveProperty("tabId");
    });
  });
});
