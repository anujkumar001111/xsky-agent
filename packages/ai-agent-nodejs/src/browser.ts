import { AgentContext, BaseBrowserLabelsAgent, config, scaleCoordinates } from "@xsky/ai-agent-core";
import { Tool, IMcpClient } from "@xsky/ai-agent-core/types";
import {
  chromium,
  Browser,
  Page,
  ElementHandle,
  BrowserContext,
} from "playwright";
import { getDefaultChromeUserDataDir } from "./utils";

/**
 * @file browser.ts
 * @description Implementation of the BrowserAgent for Node.js environments using Playwright.
 * This class extends the core browser agent logic to provide concrete browser automation
 * capabilities on the server/desktop side.
 *
 * Capabilities:
 * - Headless and headful browser automation via Chromium.
 * - Persistent sessions via User Data Directory.
 * - CDP (Chrome DevTools Protocol) connection support.
 * - Anti-bot detection evasion techniques.
 * - Coordinate-based interaction (click, scroll, drag).
 */

/**
 * A specialized Agent that controls a real browser instance using Playwright.
 * Can connect to existing browser sessions or launch new ones.
 */
export default class BrowserAgent extends BaseBrowserLabelsAgent {
  private cdpWsEndpoint?: string;
  private userDataDir?: string;
  private options?: Record<string, any>;
  protected browser: Browser | null = null;
  private browser_context: BrowserContext | null = null;
  private current_page: Page | null = null;
  private headless: boolean = false;

  /**
   * Initializes the BrowserAgent with optional LLMs, tools, and MCP client.
   * @param llms - List of LLM identifiers.
   * @param ext_tools - Additional tools to register.
   * @param mcpClient - MCP client for external tools.
   */
  constructor(llms?: string[], ext_tools?: Tool[], mcpClient?: IMcpClient) {
    super(llms, ext_tools, mcpClient);

    // Add coordinate tools if enabled
    if (config.enableCoordinateTools) {
      const coordinateTools = this.buildCoordinateTools();
      coordinateTools.forEach(tool => this.tools.push(tool));
    }
  }

  /**
   * Sets whether to run the browser in headless mode.
   * @param headless - Whether to run the browser in headless mode.
   */
  public setHeadless(headless: boolean) {
    this.headless = headless;
  }

  /**
   * Sets the CDP websocket endpoint to connect to an existing browser instance.
   * @param cdpWsEndpoint - The CDP websocket endpoint.
   */
  public setCdpWsEndpoint(cdpWsEndpoint: string) {
    this.cdpWsEndpoint = cdpWsEndpoint;
  }

  /**
   * Initializes the user data directory for session persistence.
   * @param userDataDir - Custom path for user data (defaults to system default if not provided).
   * @returns The resolved user data directory path.
   */
  public initUserDataDir(userDataDir?: string): string | undefined {
    if (userDataDir) {
      this.userDataDir = userDataDir;
    } else {
      this.userDataDir = getDefaultChromeUserDataDir(true);
    }
    return this.userDataDir;
  }

  /**
   * Sets additional Playwright launch options.
   * @param options - Dictionary of Playwright options.
   */
  public setOptions(options?: Record<string, any>) {
    this.options = options;
  }

  /**
   * Captures a screenshot of the current page.
   * @param agentContext - Execution context.
   * @returns Base64 encoded JPEG image.
   */
  protected async screenshot(
    agentContext: AgentContext
  ): Promise<{ imageBase64: string; imageType: "image/jpeg" | "image/png" }> {
    let page = await this.currentPage();
    let screenshotBuffer = await page.screenshot({
      fullPage: false,
      type: "jpeg",
      quality: 60,
    });
    let base64 = screenshotBuffer.toString("base64");
    return {
      imageType: "image/jpeg",
      imageBase64: base64,
    };
  }

  protected async navigate_to(
    agentContext: AgentContext,
    url: string
  ): Promise<{
    url: string;
    title?: string;
    tabId?: number;
  }> {
    let page = await this.open_url(agentContext, url);
    await this.sleep(200);
    return {
      url: page.url(),
      title: await page.title(),
    };
  }

  protected async get_all_tabs(
    agentContext: AgentContext
  ): Promise<Array<{ tabId: number; url: string; title: string }>> {
    if (!this.browser_context) {
      return [];
    }
    let result: Array<{ tabId: number; url: string; title: string }> = [];
    const pages = await this.browser_context.pages();
    for (let i = 0; i < pages.length; i++) {
      let page = pages[i];
      result.push({
        tabId: i,
        url: page.url(),
        title: await page.title(),
      });
    }
    return result;
  }

  protected async switch_tab(
    agentContext: AgentContext,
    tabId: number
  ): Promise<{ tabId: number; url: string; title: string }> {
    if (!this.browser_context) {
      throw new Error("tabId does not exist: " + tabId);
    }
    const pages = await this.browser_context.pages();
    const page = pages[tabId];
    if (!page) {
      throw new Error("tabId does not exist: " + tabId);
    }
    this.current_page = page;
    return {
      tabId: tabId,
      url: page.url(),
      title: await page.title(),
    };
  }

  protected async input_text(
    agentContext: AgentContext,
    index: number,
    text: string,
    enter: boolean
  ): Promise<any> {
    try {
      let elementHandle = await this.get_element(index, true);
      await elementHandle.fill("");
      await elementHandle.fill(text);
      if (enter) {
        await elementHandle.press("Enter");
        await this.sleep(200);
      }
    } catch (e) {
      await super.input_text(agentContext, index, text, enter);
    }
  }

  protected async click_element(
    agentContext: AgentContext,
    index: number,
    num_clicks: number,
    button: "left" | "right" | "middle"
  ): Promise<any> {
    try {
      let elementHandle = await this.get_element(index, true);
      await elementHandle.click({
        button,
        clickCount: num_clicks,
        force: true,
      });
    } catch (e) {
      await super.click_element(agentContext, index, num_clicks, button);
    }
  }

  protected async hover_to_element(
    agentContext: AgentContext,
    index: number
  ): Promise<void> {
    try {
      let elementHandle = await this.get_element(index, true);
      elementHandle.hover({ force: true });
    } catch (e) {
      await super.hover_to_element(agentContext, index);
    }
  }

  /**
   * Clicks at specific viewport coordinates using Playwright mouse API.
   */
  protected async click_at_coordinates(
    x: number,
    y: number,
    button: "left" | "right" | "middle" = "left",
    clickCount: number = 1
  ): Promise<void> {
    const page = await this.currentPage();
    await page.mouse.click(x, y, { button, clickCount });
  }

  /**
   * Moves cursor to specific coordinates (triggers hover states).
   */
  protected async hover_at_coordinates(x: number, y: number): Promise<void> {
    const page = await this.currentPage();
    await page.mouse.move(x, y);
  }

  /**
   * Drags from one coordinate to another.
   */
  protected async drag_to_coordinates(
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): Promise<void> {
    const page = await this.currentPage();
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2);
    await page.mouse.up();
  }

  /**
   * Scrolls at specific coordinates using mouse wheel.
   */
  protected async scroll_at_coordinates(
    x: number,
    y: number,
    deltaX: number,
    deltaY: number
  ): Promise<void> {
    const page = await this.currentPage();
    await page.mouse.move(x, y);
    await page.mouse.wheel(deltaX, deltaY);
  }

  /**
   * Clicks at coordinates and types text.
   */
  protected async type_at_coordinates(
    x: number,
    y: number,
    text: string,
    clearFirst: boolean = true
  ): Promise<void> {
    const page = await this.currentPage();
    await page.mouse.click(x, y);
    if (clearFirst) {
      const modifier = process.platform === "darwin" ? "Meta" : "Control";
      await page.keyboard.press(`${modifier}+a`);
      await page.keyboard.press("Delete");
    }
    await page.keyboard.type(text);
  }

  /**
   * Sends keyboard shortcuts or single keys.
   */
  protected async send_keys(keys: string): Promise<void> {
    const page = await this.currentPage();
    await page.keyboard.press(keys);
  }

  private buildCoordinateTools(): Tool[] {
    return [
      {
        name: "click_at_coordinates",
        description: "Click at specific X,Y coordinates in the browser viewport. Use when element labels are unavailable (canvas, SVG, video players, custom widgets).",
        parameters: {
          type: "object",
          properties: {
            x: { type: "number", description: "X coordinate from screenshot" },
            y: { type: "number", description: "Y coordinate from screenshot" },
            button: { type: "string", enum: ["left", "right", "middle"], default: "left" },
            clicks: { type: "number", minimum: 1, maximum: 3, default: 1 }
          },
          required: ["x", "y"]
        },
        execute: async (args, agentContext) => {
          const scaled = scaleCoordinates(args.x as number, args.y as number, this.lastScaleFactor);
          return await this.callInnerTool(() =>
            this.click_at_coordinates(scaled.x, scaled.y, args.button as any || "left", args.clicks as number || 1)
          );
        }
      },
      {
        name: "hover_at_coordinates",
        description: "Move cursor to X,Y coordinates to trigger hover states and reveal dynamic content (tooltips, dropdowns, menus).",
        parameters: {
          type: "object",
          properties: {
            x: { type: "number", description: "X coordinate from screenshot" },
            y: { type: "number", description: "Y coordinate from screenshot" }
          },
          required: ["x", "y"]
        },
        execute: async (args, agentContext) => {
          const scaled = scaleCoordinates(args.x as number, args.y as number, this.lastScaleFactor);
          return await this.callInnerTool(() =>
            this.hover_at_coordinates(scaled.x, scaled.y)
          );
        }
      },
      {
        name: "drag_to_coordinates",
        description: "Drag from one position to another. Useful for sliders, resizing, reordering, drawing on canvas.",
        parameters: {
          type: "object",
          properties: {
            start_x: { type: "number", description: "Starting X coordinate" },
            start_y: { type: "number", description: "Starting Y coordinate" },
            end_x: { type: "number", description: "Ending X coordinate" },
            end_y: { type: "number", description: "Ending Y coordinate" }
          },
          required: ["start_x", "start_y", "end_x", "end_y"]
        },
        execute: async (args, agentContext) => {
          const start = scaleCoordinates(args.start_x as number, args.start_y as number, this.lastScaleFactor);
          const end = scaleCoordinates(args.end_x as number, args.end_y as number, this.lastScaleFactor);
          return await this.callInnerTool(() =>
            this.drag_to_coordinates(start.x, start.y, end.x, end.y)
          );
        }
      },
      {
        name: "scroll_at_coordinates",
        description: "Scroll at specific coordinates using mouse wheel. Useful for scrolling within specific containers.",
        parameters: {
          type: "object",
          properties: {
            x: { type: "number", description: "X coordinate to position cursor" },
            y: { type: "number", description: "Y coordinate to position cursor" },
            direction: { type: "string", enum: ["up", "down", "left", "right"] },
            amount: { type: "number", minimum: 1, maximum: 10, default: 3 }
          },
          required: ["x", "y", "direction"]
        },
        execute: async (args, agentContext) => {
          const scaled = scaleCoordinates(args.x as number, args.y as number, this.lastScaleFactor);
          const amount = (args.amount as number || 3) * 100;
          let deltaX = 0, deltaY = 0;
          switch (args.direction) {
            case "up": deltaY = -amount; break;
            case "down": deltaY = amount; break;
            case "left": deltaX = -amount; break;
            case "right": deltaX = amount; break;
          }
          return await this.callInnerTool(() =>
            this.scroll_at_coordinates(scaled.x, scaled.y, deltaX, deltaY)
          );
        }
      },
      {
        name: "type_at_coordinates",
        description: "Click at coordinates and type text. Use for inputs not accessible via element labels.",
        parameters: {
          type: "object",
          properties: {
            x: { type: "number", description: "X coordinate to click" },
            y: { type: "number", description: "Y coordinate to click" },
            text: { type: "string", description: "Text to type" },
            clear_first: { type: "boolean", description: "Clear existing text before typing", default: true }
          },
          required: ["x", "y", "text"]
        },
        execute: async (args, agentContext) => {
          const scaled = scaleCoordinates(args.x as number, args.y as number, this.lastScaleFactor);
          return await this.callInnerTool(() =>
            this.type_at_coordinates(scaled.x, scaled.y, args.text as string, args.clear_first !== false)
          );
        }
      },
      {
        name: "send_keys",
        description: "Send keyboard shortcuts or single keys. Use for system commands (Copy/Paste), navigation (Tab/Arrows), or closing modals (Escape).",
        parameters: {
          type: "object",
          properties: {
            keys: {
              type: "string",
              description: "Key combination (e.g., 'Enter', 'Control+C', 'Meta+v', 'ArrowDown', 'Escape'). Follows Playwright key format."
            }
          },
          required: ["keys"]
        },
        execute: async (args, agentContext) => {
          return await this.callInnerTool(() =>
            this.send_keys(args.keys as string)
          );
        }
      }
    ];
  }

  protected async execute_script(
    agentContext: AgentContext,
    func: (...args: any[]) => void,
    args: any[]
  ): Promise<any> {
    let page = await this.currentPage();
    return await page.evaluate(func, ...args);
  }

  private async open_url(
    agentContext: AgentContext,
    url: string
  ): Promise<Page> {
    let browser_context = await this.getBrowserContext();
    const page: Page = await browser_context.newPage();
    // await page.setViewportSize({ width: 1920, height: 1080 });
    await page.setViewportSize({ width: 1536, height: 864 });
    try {
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 10000,
      });
      await page.waitForLoadState("load", { timeout: 8000 });
    } catch (e) {
      if ((e + "").indexOf("Timeout") == -1) {
        throw e;
      }
    }
    this.current_page = page;
    return page;
  }

  protected async currentPage(): Promise<Page> {
    if (this.current_page == null) {
      throw new Error("There is no page, please call navigate_to first");
    }
    let page = this.current_page as Page;
    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
    } catch (e) {}
    return page;
  }

  private async get_element(
    index: number,
    findInput?: boolean
  ): Promise<ElementHandle> {
    let page = await this.currentPage();
    return await page.evaluateHandle(
      (params: any) => {
        let element = (window as any).get_highlight_element(params.index);
        if (element && params.findInput) {
          if (
            element.tagName != "INPUT" &&
            element.tagName != "TEXTAREA" &&
            element.childElementCount != 0
          ) {
            element =
              element.querySelector("input") ||
              element.querySelector("textarea") ||
              element;
          }
        }
        return element;
      },
      { index, findInput }
    );
  }

  private sleep(time: number): Promise<void> {
    return new Promise((resolve) => setTimeout(() => resolve(), time));
  }

  /**
   * Initializes or retrieves the browser context.
   * Handles CDP connection, persistent context launch, or temporary context launch.
   * Injects anti-bot scripts.
   */
  protected async getBrowserContext() {
    if (!this.browser_context) {
      this.current_page = null;
      this.browser_context = null;
      if (this.cdpWsEndpoint) {
        this.browser = await chromium.connectOverCDP(
          this.cdpWsEndpoint,
          this.options
        );
        this.browser_context = await this.browser.newContext();
      } else if (this.userDataDir) {
        this.browser_context = await chromium.launchPersistentContext(
          this.userDataDir,
          {
            headless: this.headless,
            // channel: 'chrome',
            args: [
              "--no-sandbox",
              "--remote-allow-origins=*",
              "--disable-dev-shm-usage",
              "--disable-popup-blocking",
              "--enable-automation",
              "--ignore-ssl-errors",
              "--ignore-certificate-errors",
              "--ignore-certificate-errors-spki-list",
              "--disable-blink-features=AutomationControlled",
            ],
            ...this.options,
          }
        );
      } else {
        this.browser = await chromium.launch({
          headless: this.headless,
          args: [
            "--no-sandbox",
            "--remote-allow-origins=*",
            "--disable-dev-shm-usage",
            "--disable-popup-blocking",
            "--enable-automation",
            "--ignore-ssl-errors",
            "--ignore-certificate-errors",
            "--ignore-certificate-errors-spki-list",
            "--disable-blink-features=AutomationControlled",
          ],
          ...this.options,
        });
        this.browser_context = await this.browser.newContext();
      }
      // Anti-crawling detection website:
      // https://bot.sannysoft.com/
      let init_script = await this.initScript();
      this.browser_context.addInitScript(init_script);
    }
    return this.browser_context;
  }

  /**
   * Generates a script to evade browser fingerprinting and bot detection.
   * Overrides navigator properties to mimic a standard user browser.
   */
  protected async initScript(): Promise<{ path?: string; content?: string }> {
    return {
      content: `
      // Webdriver property
			Object.defineProperty(navigator, 'webdriver', {
				get: () => undefined
			});

			// Languages
			Object.defineProperty(navigator, 'languages', {
				get: () => ['en-US']
			});

			// Plugins
			Object.defineProperty(navigator, 'plugins', {
				get: () => [{name:"1"}, {name:"2"}, {name:"3"}, {name:"4"}, {name:"5"}]
			});

			// Chrome runtime
			window.chrome = { runtime: {} };

			// Permissions
			const originalQuery = window.navigator.permissions.query;
			window.navigator.permissions.query = (parameters) => (
				parameters.name === 'notifications' ?
					Promise.resolve({ state: Notification.permission }) :
					originalQuery(parameters)
			);
			(function () {
				const originalAttachShadow = Element.prototype.attachShadow;
				Element.prototype.attachShadow = function attachShadow(options) {
					return originalAttachShadow.call(this, { ...options, mode: "open" });
				};
			})();
      `,
    };
  }
}

export { BrowserAgent };
