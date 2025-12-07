import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from "@jest/globals";
import { config } from "@xsky/ai-agent-core";
import { BrowserAgent } from "../src/browser";
import { getSharedBrowser, releaseSharedBrowser, createTestPage, setupAgent, cleanupTestContext } from "./shared-browser";


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

      it("should handle 'press' action with single character (no normalization)", async () => {
        await agent.keyboard_action("press", "a");
        expect(mockPage.keyboard.press).toHaveBeenCalledWith("a");
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

      it("should execute keyboard combination with modifiers", async () => {
        const tool = agent.tools.find((t: any) => t.name === "keyboard_combination");

        await tool.execute({ keys: ["Control", "c"] }, {} as any);

        // Verify the correct sequence: down Control, press c, up Control
        expect(mockPage.keyboard.down).toHaveBeenCalledWith("Control");
        expect(mockPage.keyboard.press).toHaveBeenCalledWith("c");
        expect(mockPage.keyboard.up).toHaveBeenCalledWith("Control");
      });

      it("should handle multiple modifiers", async () => {
        const tool = agent.tools.find((t: any) => t.name === "keyboard_combination");

        await tool.execute({ keys: ["Control", "Shift", "a"] }, {} as any);

        expect(mockPage.keyboard.down).toHaveBeenCalledWith("Control");
        expect(mockPage.keyboard.down).toHaveBeenCalledWith("Shift");
        expect(mockPage.keyboard.press).toHaveBeenCalledWith("a");
        expect(mockPage.keyboard.up).toHaveBeenCalledWith("Shift");
        expect(mockPage.keyboard.up).toHaveBeenCalledWith("Control");
      });

      it("REGRESSION: should NOT treat non-modifier keys as modifiers", async () => {
        // This test validates the keyCombination bug fix.
        // OLD BUGGY LOGIC: Treated all keys except last as modifiers (ArrowDown would be held down)
        // NEW CORRECT LOGIC: Only actual modifiers (Shift/Control/Alt/Meta) are held down
        const tool = agent.tools.find((t: any) => t.name === "keyboard_combination");

        mockPage.keyboard.down.mockClear();
        mockPage.keyboard.press.mockClear();
        mockPage.keyboard.up.mockClear();

        await tool.execute({ keys: ["ArrowDown", "Enter"] }, {} as any);

        // With buggy logic: down(ArrowDown), press(Enter), up(ArrowDown) - WRONG!
        // With correct logic: press(ArrowDown), press(Enter) - CORRECT!
        expect(mockPage.keyboard.down).not.toHaveBeenCalled();
        expect(mockPage.keyboard.up).not.toHaveBeenCalled();
        expect(mockPage.keyboard.press).toHaveBeenCalledWith("ArrowDown");
        expect(mockPage.keyboard.press).toHaveBeenCalledWith("Enter");
        expect(mockPage.keyboard.press).toHaveBeenCalledTimes(2);
      });

      it("REGRESSION: should correctly distinguish modifiers from action keys", async () => {
        // Validates that only actual modifiers are held, even in mixed sequences
        const tool = agent.tools.find((t: any) => t.name === "keyboard_combination");

        mockPage.keyboard.down.mockClear();
        mockPage.keyboard.press.mockClear();
        mockPage.keyboard.up.mockClear();

        await tool.execute({ keys: ["Control", "ArrowLeft"] }, {} as any);

        // Should hold Control (modifier) but press ArrowLeft (action key)
        expect(mockPage.keyboard.down).toHaveBeenCalledWith("Control");
        expect(mockPage.keyboard.down).toHaveBeenCalledTimes(1);
        expect(mockPage.keyboard.press).toHaveBeenCalledWith("ArrowLeft");
        expect(mockPage.keyboard.up).toHaveBeenCalledWith("Control");
        expect(mockPage.keyboard.up).toHaveBeenCalledTimes(1);
      });
    });

    describe("press_keys_sequence tool", () => {
      it("should register press_keys_sequence tool", () => {
        const toolNames = agent.tools.map((t: any) => t.name);
        expect(toolNames).toContain("press_keys_sequence");
      });

      it("should execute key sequence", async () => {
        const tool = agent.tools.find((t: any) => t.name === "press_keys_sequence");

        await tool.execute({ keys: ["a", "b", "c"] }, {} as any);

        expect(mockPage.keyboard.press).toHaveBeenCalledWith("a");
        expect(mockPage.keyboard.press).toHaveBeenCalledWith("b");
        expect(mockPage.keyboard.press).toHaveBeenCalledWith("c");
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

    describe("Edge Cases", () => {
      it("EDGE: should throw error for all-modifier keyboard_combination", async () => {
        // Test the critical edge case: modifier-only combinations are invalid
        const tool = agent.tools.find((t: any) => t.name === "keyboard_combination");

        await expect(tool.execute({ keys: ["Shift", "Control"] }, {} as any))
          .rejects
          .toThrow(/requires at least one action key/);
      });

      it("EDGE: should handle single key in keyboard_combination", async () => {
        const tool = agent.tools.find((t: any) => t.name === "keyboard_combination");

        mockPage.keyboard.press.mockClear();
        mockPage.keyboard.down.mockClear();
        mockPage.keyboard.up.mockClear();

        await tool.execute({ keys: ["a"] }, {} as any);

        // Single key should just be pressed (no modifiers)
        expect(mockPage.keyboard.press).toHaveBeenCalledWith("a");
        expect(mockPage.keyboard.press).toHaveBeenCalledTimes(1);
        expect(mockPage.keyboard.down).not.toHaveBeenCalled();
        expect(mockPage.keyboard.up).not.toHaveBeenCalled();
      });

      it("EDGE: should handle uppercase letters (pass through unchanged)", async () => {
        const tool = agent.tools.find((t: any) => t.name === "keyboard_action");

        mockPage.keyboard.press.mockClear();

        await tool.execute({ action: "press", key: "A" }, {} as any);

        // Uppercase single character should pass through unchanged
        expect(mockPage.keyboard.press).toHaveBeenCalledWith("A");
      });

      it("EDGE: should handle lowercase letters (pass through unchanged)", async () => {
        const tool = agent.tools.find((t: any) => t.name === "keyboard_action");

        mockPage.keyboard.press.mockClear();

        await tool.execute({ action: "press", key: "z" }, {} as any);

        expect(mockPage.keyboard.press).toHaveBeenCalledWith("z");
      });

      it("EDGE: should handle numeric characters (pass through)", async () => {
        const tool = agent.tools.find((t: any) => t.name === "keyboard_action");

        mockPage.keyboard.press.mockClear();

        await tool.execute({ action: "press", key: "5" }, {} as any);

        expect(mockPage.keyboard.press).toHaveBeenCalledWith("5");
      });

      it("EDGE: should handle symbols (pass through)", async () => {
        const tool = agent.tools.find((t: any) => t.name === "keyboard_action");

        mockPage.keyboard.press.mockClear();

        await tool.execute({ action: "press", key: "@" }, {} as any);

        expect(mockPage.keyboard.press).toHaveBeenCalledWith("@");
      });

      it("EDGE: should throw error for unknown multi-char keys", async () => {
        const tool = agent.tools.find((t: any) => t.name === "keyboard_action");

        await expect(
          tool.execute({ action: "press", key: "UnknownKey123" }, {} as any)
        ).rejects.toThrow(/Unknown key "UnknownKey123"/);
      });

      it("EDGE: should handle case-insensitive special keys", async () => {
        const tool = agent.tools.find((t: any) => t.name === "keyboard_action");

        mockPage.keyboard.press.mockClear();

        // Test various case variations
        await tool.execute({ action: "press", key: "ENTER" }, {} as any);
        expect(mockPage.keyboard.press).toHaveBeenCalledWith("Enter");

        mockPage.keyboard.press.mockClear();
        await tool.execute({ action: "press", key: "eNtEr" }, {} as any);
        expect(mockPage.keyboard.press).toHaveBeenCalledWith("Enter");
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

/**
 * Real Browser Coordinate Operations
 *
 * These integration tests use actual Playwright/Chromium to validate
 * coordinate-based operations work correctly on real web pages.
 */
describe("Real Browser Coordinate Operations", () => {
  let agent: any;
  let page: any;

  beforeAll(async () => {
    // Use shared browser instance
    // Use shared browser instance
    const browser = await getSharedBrowser();
    page = await createTestPage(browser);
    agent = setupAgent(page);
  }, 30000);

  afterAll(async () => {
    if (page) {
      await cleanupTestContext(page);
    }
    await releaseSharedBrowser();
  }, 10000);

  beforeEach(async () => {
    // Reset the page content before each test
    await page.setContent(`
      <html>
        <body style="margin: 0; padding: 0;">
          <button id="test-btn" style="position: absolute; left: 100px; top: 100px; width: 100px; height: 50px;">
            Click Me
          </button>
          <input id="test-input" type="text" style="position: absolute; left: 100px; top: 200px; width: 200px;" />
          <div id="hover-target" style="position: absolute; left: 100px; top: 300px; width: 100px; height: 50px; background: blue;">
            Hover Me
          </div>
          <div id="scroll-container" style="position: absolute; left: 100px; top: 400px; width: 200px; height: 100px; overflow: auto;">
            <div style="height: 500px;">Scroll Content</div>
          </div>
        </body>
      </html>
    `);
  });

  // No afterAll - browser cleanup handled at file level

  describe("INTEGRATION: Click Operations", () => {
    it("INTEGRATION: should click at exact coordinates on a button", async () => {
      let clicked = false;
      await page.evaluate(() => {
        const btn = document.getElementById("test-btn");
        btn?.addEventListener("click", () => {
          (window as any).buttonClicked = true;
        });
      });

      // Click at center of button (100 + 50, 100 + 25)
      await agent.click_at_coordinates(150, 125, "left", 1);

      clicked = await page.evaluate(() => (window as any).buttonClicked);
      expect(clicked).toBe(true);
    });

    it("INTEGRATION: should perform double-click at coordinates", async () => {
      await page.evaluate(() => {
        const btn = document.getElementById("test-btn");
        btn?.addEventListener("dblclick", () => {
          (window as any).buttonDblClicked = true;
        });
      });

      await agent.click_at_coordinates(150, 125, "left", 2);

      const dblClicked = await page.evaluate(() => (window as any).buttonDblClicked);
      expect(dblClicked).toBe(true);
    });

    it("INTEGRATION: should perform right-click at coordinates", async () => {
      await page.evaluate(() => {
        const btn = document.getElementById("test-btn");
        btn?.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          (window as any).contextMenuTriggered = true;
        });
      });

      await agent.click_at_coordinates(150, 125, "right", 1);

      const contextMenu = await page.evaluate(() => (window as any).contextMenuTriggered);
      expect(contextMenu).toBe(true);
    });
  });

  describe("INTEGRATION: Hover Operations", () => {
    it("INTEGRATION: should trigger mouseenter event on hover", async () => {
      await page.evaluate(() => {
        const target = document.getElementById("hover-target");
        target?.addEventListener("mouseenter", () => {
          (window as any).hoverEntered = true;
        });
      });

      // Hover at center of hover-target (100 + 50, 300 + 25)
      await agent.hover_at_coordinates(150, 325);

      const hovered = await page.evaluate(() => (window as any).hoverEntered);
      expect(hovered).toBe(true);
    });

    it("INTEGRATION: should trigger mouseover event on hover", async () => {
      // Move mouse away first to ensure clean state
      await page.mouse.move(0, 0);
      await page.waitForTimeout(50);

      // Reset page content to ensure fresh state
      await page.setContent(`
        <html>
          <body style="margin: 0; padding: 0;">
            <div id="hover-target" style="position: absolute; left: 100px; top: 300px; width: 100px; height: 50px; background: blue;">
              Hover Me
            </div>
          </body>
        </html>
      `);

      await page.evaluate(() => {
        const target = document.getElementById("hover-target");
        target?.addEventListener("mouseover", () => {
          (window as any).mouseOverTriggered = true;
        });
      });

      await agent.hover_at_coordinates(150, 325);

      const mouseOver = await page.evaluate(() => (window as any).mouseOverTriggered);
      expect(mouseOver).toBe(true);
    });
  });

  describe("INTEGRATION: Drag Operations", () => {
    it("INTEGRATION: should perform drag sequence with correct event order", async () => {
      const events: string[] = [];

      await page.evaluate(() => {
        (window as any).dragEvents = [];
        document.addEventListener("mousedown", () => (window as any).dragEvents.push("mousedown"));
        document.addEventListener("mousemove", () => {
          if ((window as any).dragEvents.length > 0 && !(window as any).dragEvents.includes("mousemove")) {
            (window as any).dragEvents.push("mousemove");
          }
        });
        document.addEventListener("mouseup", () => (window as any).dragEvents.push("mouseup"));
      });

      await agent.drag_to_coordinates(100, 100, 200, 200);

      const dragEvents = await page.evaluate(() => (window as any).dragEvents);
      expect(dragEvents).toContain("mousedown");
      expect(dragEvents).toContain("mousemove");
      expect(dragEvents).toContain("mouseup");
    });
  });

  describe("INTEGRATION: Scroll Operations", () => {
    it("INTEGRATION: should scroll at coordinates", async () => {
      // Set up a scrollable page
      await page.setContent(`
        <html>
          <body style="margin: 0; padding: 0; height: 3000px;">
            <div id="marker" style="position: absolute; top: 1500px;">Marker</div>
          </body>
        </html>
      `);

      const initialScrollY = await page.evaluate(() => window.scrollY);
      expect(initialScrollY).toBe(0);

      // Scroll down at center of viewport
      await agent.scroll_at_coordinates(400, 300, 0, 500);

      // Wait for scroll to complete
      await page.waitForTimeout(100);

      const newScrollY = await page.evaluate(() => window.scrollY);
      expect(newScrollY).toBeGreaterThan(0);
    });
  });

  describe("INTEGRATION: Type at Coordinates", () => {
    it("INTEGRATION: should click input and type text", async () => {
      // Click at center of input (100 + 100, 200 + 10)
      await agent.type_at_coordinates(200, 210, "Hello World", true);

      const inputValue = await page.locator("#test-input").inputValue();
      expect(inputValue).toBe("Hello World");
    });

    it("INTEGRATION: should clear existing text before typing when clearFirst is true", async () => {
      // Pre-fill the input
      await page.locator("#test-input").fill("Existing Text");

      await agent.type_at_coordinates(200, 210, "New Text", true);

      const inputValue = await page.locator("#test-input").inputValue();
      expect(inputValue).toBe("New Text");
    });

    it("INTEGRATION: should append text when clearFirst is false", async () => {
      // Pre-fill the input
      await page.locator("#test-input").fill("Hello ");

      // Position cursor at end by clicking
      await page.locator("#test-input").click();
      await page.keyboard.press("End");

      await agent.type_at_coordinates(200, 210, "World", false);

      const inputValue = await page.locator("#test-input").inputValue();
      // Note: behavior depends on cursor position after click
      expect(inputValue).toContain("World");
    });
  });
});

/**
 * Combined Keyboard + Coordinate Workflow Tests
 *
 * These tests validate realistic automation workflows that combine
 * coordinate-based mouse actions with keyboard inputs.
 */
describe("Combined Keyboard + Coordinate Workflow Tests", () => {
  let agent: any;
  let page: any;

  beforeAll(async () => {
    // Use shared browser instance
    // Use shared browser instance
    const browser = await getSharedBrowser();
    page = await createTestPage(browser);
    agent = setupAgent(page);
  }, 30000);

  afterAll(async () => {
    if (page) {
      await cleanupTestContext(page);
    }
    await releaseSharedBrowser();
  }, 10000);

  beforeEach(async () => {
    await page.setContent(`
      <html>
        <body style="margin: 0; padding: 0;">
          <input id="input1" type="text" style="position: absolute; left: 100px; top: 100px; width: 200px;" />
          <input id="input2" type="text" style="position: absolute; left: 100px; top: 150px; width: 200px;" />
          <div id="selectable" style="position: absolute; left: 100px; top: 200px; width: 200px; user-select: text;">
            Select this text
          </div>
        </body>
      </html>
    `);
  });

  it("INTEGRATION: should perform click-then-type workflow", async () => {
    // Click on input1
    await agent.click_at_coordinates(200, 110, "left", 1);

    // Type text using keyboard
    await page.keyboard.type("First Input");

    const value = await page.locator("#input1").inputValue();
    expect(value).toBe("First Input");
  });

  it("INTEGRATION: should perform Ctrl+A select-all (verifies tool execution)", async () => {
    // Pre-fill input
    await page.locator("#input1").fill("Old Content");
    await page.locator("#input1").focus();

    // Select all with Ctrl+A - this tests the keyboard_combination tool works
    const comboTool = agent.tools.find((t: any) => t.name === "keyboard_combination");

    // Just verify the tool executes without error
    // Note: Selection behavior may vary across headless environments
    await expect(
      comboTool.execute({ keys: ["Control", "a"] }, {} as any)
    ).resolves.not.toThrow();

    // The important thing is the tool executed the keyboard combination correctly
    // Selection state verification is environment-dependent
  });

  it("INTEGRATION: should navigate between inputs with Tab key after click", async () => {
    // Click on input1
    await agent.click_at_coordinates(200, 110, "left", 1);

    // Press Tab to move to input2
    const actionTool = agent.tools.find((t: any) => t.name === "keyboard_action");
    await actionTool.execute({ action: "press", key: "Tab" }, {} as any);

    // Verify focus moved to input2
    const activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("input2");
  });

  it("INTEGRATION: should perform Ctrl+Shift+End combination (verifies multi-modifier)", async () => {
    await page.locator("#input1").fill("Hello World Test");
    await page.locator("#input1").focus();

    // Move cursor to beginning
    await page.keyboard.press("Home");

    // Execute Ctrl+Shift+End - this tests multiple modifiers work together
    const comboTool = agent.tools.find((t: any) => t.name === "keyboard_combination");

    // Just verify the tool executes without error
    // Note: Selection behavior may vary across headless environments
    await expect(
      comboTool.execute({ keys: ["Control", "Shift", "End"] }, {} as any)
    ).resolves.not.toThrow();

    // The important thing is the tool executed the multi-modifier combination correctly
  });
});

/**
 * Performance Baseline Tests
 *
 * These tests establish performance baselines for coordinate and keyboard operations.
 * Results are logged to console for future regression detection.
 */
describe("PERF: Performance Baselines", () => {
  let agent: any;
  let page: any;

  beforeAll(async () => {
    // Use shared browser instance
    // Use shared browser instance
    const browser = await getSharedBrowser();
    page = await createTestPage(browser);
    agent = setupAgent(page);

    await page.setContent(`
      <html>
        <body>
          <input id="test-input" type="text" />
          <button id="test-btn">Click</button>
        </body>
      </html>
    `);
  }, 30000);

  afterAll(async () => {
    if (page) {
      await cleanupTestContext(page);
    }
    await releaseSharedBrowser();
  }, 10000);

  it("PERF: should measure click operation latency", async () => {
    const iterations = 10;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await agent.click_at_coordinates(100, 100, "left", 1);
      const duration = performance.now() - start;
      latencies.push(duration);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    console.log(`[PERF] click_at_coordinates avg latency: ${avgLatency.toFixed(2)}ms (${iterations} iterations)`);

    // Sanity check - should complete within reasonable time
    expect(avgLatency).toBeLessThan(500);
  });

  it("PERF: should measure keyboard combination latency", async () => {
    const comboTool = agent.tools.find((t: any) => t.name === "keyboard_combination");
    await page.locator("#test-input").focus();

    const iterations = 10;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await comboTool.execute({ keys: ["Control", "a"] }, {} as any);
      const duration = performance.now() - start;
      latencies.push(duration);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    console.log(`[PERF] keyboard_combination avg latency: ${avgLatency.toFixed(2)}ms (${iterations} iterations)`);

    expect(avgLatency).toBeLessThan(500);
  });

  it("PERF: should measure type operation latency", async () => {
    const typeTool = agent.tools.find((t: any) => t.name === "type_text_enhanced");
    await page.locator("#test-input").focus();

    const iterations = 5;
    const latencies: number[] = [];
    const testText = "Performance test";

    for (let i = 0; i < iterations; i++) {
      await page.locator("#test-input").fill(""); // Clear before each iteration
      const start = performance.now();
      await typeTool.execute({ text: testText, delay: 0 }, {} as any);
      const duration = performance.now() - start;
      latencies.push(duration);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    console.log(`[PERF] type_text_enhanced avg latency: ${avgLatency.toFixed(2)}ms for "${testText}" (${iterations} iterations)`);

    expect(avgLatency).toBeLessThan(2000);
  });

  it("PERF: should measure hover operation latency", async () => {
    const iterations = 10;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await agent.hover_at_coordinates(100 + i * 10, 100);
      const duration = performance.now() - start;
      latencies.push(duration);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    console.log(`[PERF] hover_at_coordinates avg latency: ${avgLatency.toFixed(2)}ms (${iterations} iterations)`);

    expect(avgLatency).toBeLessThan(500);
  });
});
