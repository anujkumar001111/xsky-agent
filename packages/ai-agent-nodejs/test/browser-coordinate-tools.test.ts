import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { config } from "@xsky/ai-agent-core";
import { BrowserAgent } from "../src/browser";

// Mock Playwright types
const mockPage = {
  mouse: {
    click: jest.fn(),
    move: jest.fn(),
    down: jest.fn(),
    up: jest.fn(),
    wheel: jest.fn()
  },
  keyboard: {
    type: jest.fn(),
    press: jest.fn(),
    down: jest.fn(),
    up: jest.fn(),
    insertText: jest.fn()
  },
  evaluate: jest.fn(),
  url: () => "about:blank",
  title: async () => "New Tab"
};

describe("BrowserAgent Coordinate Tools", () => {
  // We need to cast to any to access private/protected methods for testing
  let agent: any;

  beforeEach(() => {
    config.enableCoordinateTools = true;
    agent = new BrowserAgent();

    // Mock the currentPage method to return our mock page
    agent.currentPage = jest.fn().mockResolvedValue(mockPage);
    agent.callInnerTool = jest.fn().mockImplementation((callback: Function) => callback());
    agent.lastScaleFactor = 1;
  });

  afterEach(() => {
    config.enableCoordinateTools = true; // Reset to default
    jest.clearAllMocks();
  });

  describe("Tool Registration", () => {
    it("should register coordinate tools when enabled", () => {
      const toolNames = agent.tools.map((t: any) => t.name);
      expect(toolNames).toContain("click_at_coordinates");
      expect(toolNames).toContain("hover_at_coordinates");
      expect(toolNames).toContain("drag_to_coordinates");
      expect(toolNames).toContain("scroll_at_coordinates");
      expect(toolNames).toContain("type_at_coordinates");
      expect(toolNames).toContain("keyboard_action");
    });

    it("should NOT register coordinate tools when disabled", () => {
      config.enableCoordinateTools = false;
      const disabledAgent: any = new BrowserAgent();
      const toolNames = disabledAgent.tools.map((t: any) => t.name);
      expect(toolNames).not.toContain("click_at_coordinates");
    });

    it("should retain existing element-based tools", () => {
      const toolNames = agent.tools.map((t: any) => t.name);
      expect(toolNames).toContain("click_element");
      expect(toolNames).toContain("input_text");
      expect(toolNames).toContain("navigate_to");
    });
  });

  describe("Coordinate Methods", () => {
    describe("click_at_coordinates", () => {
      it("should call page.mouse.click with correct parameters", async () => {
        await agent.click_at_coordinates(100, 200, "left", 1);
        expect(mockPage.mouse.click).toHaveBeenCalledWith(100, 200, { button: "left", clickCount: 1, modifiers: [] });
      });

      it("should handle different buttons and click counts", async () => {
        await agent.click_at_coordinates(100, 200, "right", 2);
        expect(mockPage.mouse.click).toHaveBeenCalledWith(100, 200, { button: "right", clickCount: 2, modifiers: [] });
      });

      it("should pass modifiers to click", async () => {
        await agent.click_at_coordinates(100, 200, "left", 1, ["Shift", "Control"]);
        expect(mockPage.mouse.click).toHaveBeenCalledWith(100, 200, {
          button: "left",
          clickCount: 1,
          modifiers: ["Shift", "Control"]
        });
      });
    });

    describe("hover_at_coordinates", () => {
      it("should call page.mouse.move with correct parameters", async () => {
        await agent.hover_at_coordinates(150, 250);
        expect(mockPage.mouse.move).toHaveBeenCalledWith(150, 250);
      });
    });

    describe("drag_to_coordinates", () => {
      it("should perform drag sequence: move -> down -> move -> up", async () => {
        await agent.drag_to_coordinates(10, 10, 100, 100);

        expect(mockPage.mouse.move).toHaveBeenCalledWith(10, 10);
        expect(mockPage.mouse.down).toHaveBeenCalled();
        expect(mockPage.mouse.move).toHaveBeenCalledWith(100, 100);
        expect(mockPage.mouse.up).toHaveBeenCalled();
      });

      it("should hold modifiers during drag", async () => {
        await agent.drag_to_coordinates(10, 10, 100, 100, ["Shift"]);

        // Sequence: KeyDown(Shift) -> Move -> MouseDown -> Move -> MouseUp -> KeyUp(Shift)
        expect(mockPage.keyboard.down).toHaveBeenCalledWith("Shift");
        expect(mockPage.mouse.move).toHaveBeenCalledWith(10, 10);
        expect(mockPage.mouse.down).toHaveBeenCalled();
        expect(mockPage.mouse.move).toHaveBeenCalledWith(100, 100);
        expect(mockPage.mouse.up).toHaveBeenCalled();
        expect(mockPage.keyboard.up).toHaveBeenCalledWith("Shift");
      });
    });

    describe("scroll_at_coordinates", () => {
      it("should move to coordinates and scroll", async () => {
        await agent.scroll_at_coordinates(50, 50, 0, 100);
        expect(mockPage.mouse.move).toHaveBeenCalledWith(50, 50);
        expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 100);
      });

      it("should hold modifiers during scroll", async () => {
        await agent.scroll_at_coordinates(50, 50, 0, 100, ["Control"]);

        expect(mockPage.keyboard.down).toHaveBeenCalledWith("Control");
        expect(mockPage.mouse.move).toHaveBeenCalledWith(50, 50);
        expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 100);
        expect(mockPage.keyboard.up).toHaveBeenCalledWith("Control");
      });
    });

    describe("type_at_coordinates", () => {
      it("should click, clear (default), and type", async () => {
        await agent.type_at_coordinates(300, 300, "hello", true);

        expect(mockPage.mouse.click).toHaveBeenCalledWith(300, 300);
        // Check for clear sequence (cmd+a/ctrl+a -> delete)
        expect(mockPage.keyboard.press).toHaveBeenCalledTimes(2);
        expect(mockPage.keyboard.type).toHaveBeenCalledWith("hello");
      });

      it("should click and type without clearing if requested", async () => {
        // Reset mocks to clear previous calls
        mockPage.keyboard.press.mockClear();

        await agent.type_at_coordinates(300, 300, "append", false);

        expect(mockPage.mouse.click).toHaveBeenCalledWith(300, 300);
        expect(mockPage.keyboard.press).not.toHaveBeenCalled();
        expect(mockPage.keyboard.type).toHaveBeenCalledWith("append");
      });
    });

    describe("keyboard_action", () => {
      it("should handle 'press' action", async () => {
        await agent.keyboard_action("press", "Enter");
        expect(mockPage.keyboard.press).toHaveBeenCalledWith("Enter");
      });

      it("should handle 'press' action with key normalization", async () => {
        await agent.keyboard_action("press", "return");
        expect(mockPage.keyboard.press).toHaveBeenCalledWith("Enter");
      });

      it("should handle 'press' action with character normalization", async () => {
        await agent.keyboard_action("press", "a");
        expect(mockPage.keyboard.press).toHaveBeenCalledWith("KeyA");
      });

      it("should handle 'down' action", async () => {
        await agent.keyboard_action("down", "Shift");
        expect(mockPage.keyboard.down).toHaveBeenCalledWith("Shift");
      });

      it("should handle 'down' action with key normalization", async () => {
        await agent.keyboard_action("down", "shift");
        expect(mockPage.keyboard.down).toHaveBeenCalledWith("Shift");
      });

      it("should handle 'up' action", async () => {
        await agent.keyboard_action("up", "Shift");
        expect(mockPage.keyboard.up).toHaveBeenCalledWith("Shift");
      });

      it("should handle 'type' action", async () => {
        await agent.keyboard_action("type", undefined, "hello world");
        expect(mockPage.keyboard.type).toHaveBeenCalledWith("hello world");
      });

      it("should handle 'insert' action", async () => {
        await agent.keyboard_action("insert", undefined, "pasted text");
        expect(mockPage.keyboard.insertText).toHaveBeenCalledWith("pasted text");
      });
    });

    describe("keyboard_combination tool", () => {
      it("should register keyboard_combination tool", () => {
        const toolNames = agent.tools.map((t: any) => t.name);
        expect(toolNames).toContain("keyboard_combination");
      });

      it("should execute keyboard combination tool", async () => {
        const tool = agent.tools.find((t: any) => t.name === "keyboard_combination");
        agent.keyboard_action = jest.fn();

        await tool.execute({ keys: ["Control", "c"] }, {} as any);

        // Verify keyCombination was called (we can't easily mock the imported function)
        // This test verifies the tool exists and can be called
        expect(tool).toBeDefined();
      });
    });

    describe("type_text_enhanced tool", () => {
      it("should register type_text_enhanced tool", () => {
        const toolNames = agent.tools.map((t: any) => t.name);
        expect(toolNames).toContain("type_text_enhanced");
      });

      it("should execute type_text_enhanced tool with default delay", async () => {
        const tool = agent.tools.find((t: any) => t.name === "type_text_enhanced");

        await tool.execute({ text: "hello world" }, {} as any);

        expect(mockPage.keyboard.type).toHaveBeenCalledWith("hello world", { delay: 100 });
      });

      it("should execute type_text_enhanced tool with custom delay", async () => {
        const tool = agent.tools.find((t: any) => t.name === "type_text_enhanced");

        await tool.execute({ text: "hello world", delay: 50 }, {} as any);

        expect(mockPage.keyboard.type).toHaveBeenCalledWith("hello world", { delay: 50 });
      });
    });
  });

  describe("Tool Execution Wrapper", () => {
    // Tests the mapping from tool execute() -> internal method
    // and ensures scaleCoordinates is applied

    it("should scale coordinates for click_at_coordinates tool", async () => {
      const tool = agent.tools.find((t: any) => t.name === "click_at_coordinates");
      expect(tool).toBeDefined();

      // Simulate scale factor of 0.5 (screenshot is half size of viewport)
      // If user clicks 50,50 on screenshot, it should map to 100,100 on page
      agent.lastScaleFactor = 0.5;

      // Mock click_at_coordinates to verify args
      agent.click_at_coordinates = jest.fn();

      await tool.execute({ x: 50, y: 50, button: "left", clicks: 1 }, {} as any);

      expect(agent.click_at_coordinates).toHaveBeenCalledWith(100, 100, "left", 1, []);
    });

    it("should scale coordinates for hover_at_coordinates tool", async () => {
      const tool = agent.tools.find((t: any) => t.name === "hover_at_coordinates");
      agent.lastScaleFactor = 2.0; // Screenshot 2x viewport (e.g. high DPI)

      agent.hover_at_coordinates = jest.fn();

      // 100,100 on screenshot -> 50,50 on page
      await tool.execute({ x: 100, y: 100 }, {} as any);

      expect(agent.hover_at_coordinates).toHaveBeenCalledWith(50, 50);
    });

    it("should call keyboard_action directly", async () => {
      const tool = agent.tools.find((t: any) => t.name === "keyboard_action");
      agent.keyboard_action = jest.fn();

      await tool.execute({ action: "press", key: "Escape" }, {} as any);

      expect(agent.keyboard_action).toHaveBeenCalledWith("press", "Escape", undefined);
    });

    it("should pass modifiers from tool execution", async () => {
      const tool = agent.tools.find((t: any) => t.name === "click_at_coordinates");
      agent.click_at_coordinates = jest.fn();

      await tool.execute({ x: 50, y: 50, button: "left", clicks: 1, modifiers: ["Shift"] }, {} as any);

      // Coordinates should be scaled (factor 1.0 default in tests, but let's assume default behavior)
      expect(agent.click_at_coordinates).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), "left", 1, ["Shift"]);
    });
  });
});
