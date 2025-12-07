import { AgentContext, BaseBrowserLabelsAgent, config, scaleCoordinates } from "@xsky/ai-agent-core";
import { Tool, IMcpClient } from "@xsky/ai-agent-core/types";
import { normalizeKey, keyCombination, pressKeysInSequence, typeText } from "@xsky/ai-agent-core";
import {
  chromium,
  Browser,
  Page,
  ElementHandle,
  BrowserContext,
} from "playwright";
import { getDefaultChromeUserDataDir } from "./utils";
import * as fs from "fs";
import * as path from "path";

/**
 * BrowserAgent provides web automation capabilities using Playwright.
 *
 * This agent can:
 * - Launch and control browser instances (Chrome, Firefox, Safari)
 * - Navigate web pages and interact with DOM elements
 * - Execute JavaScript in page context
 * - Handle file downloads and uploads
 * - Take screenshots and extract page content
 * - Connect to existing browser instances via CDP
 * - Support both headless and headed modes for debugging
 *
 * The agent automatically injects coordinate-based interaction tools when enabled,
 * allowing pixel-perfect mouse and keyboard control for complex web interactions.
 */
export default class BrowserAgent extends BaseBrowserLabelsAgent {
  /** CDP WebSocket endpoint for connecting to existing browser instances */
  private cdpWsEndpoint?: string;
  /** Custom user data directory for persistent browser sessions */
  private userDataDir?: string;
  /** Path to storage state file for session persistence */
  private storageStatePath?: string;
  /** Additional Playwright launch options */
  private options?: Record<string, any>;
  /** Active browser instance managed by this agent */
  protected browser: Browser | null = null;
  /** Browser context for managing cookies, local storage, and session isolation */
  private browser_context: BrowserContext | null = null;
  /** Currently active page for web interactions */
  private current_page: Page | null = null;
  /** Whether browser should run headless (no visible UI) */
  private headless: boolean = false;

  constructor(llms?: string[], ext_tools?: Tool[], mcpClient?: IMcpClient) {
    super(llms, ext_tools, mcpClient);

    // Add coordinate tools if enabled
    if (config.enableCoordinateTools) {
      const coordinateTools = this.buildCoordinateTools();
      coordinateTools.forEach(tool => this.tools.push(tool));
    }

    // Add keyboard tools (always enabled)
    const keyboardTools = this.buildKeyboardTools();
    keyboardTools.forEach(tool => this.tools.push(tool));

    // Add utility tools (save_screenshot, wait_for_element, wait_for_navigation)
    const utilityTools = this.buildUtilityTools();
    utilityTools.forEach(tool => this.tools.push(tool));
  }

  /**
   * Sets whether to run the browser in headless mode.
   * @param headless - Whether to run the browser in headless mode.
   */
  public setHeadless(headless: boolean) {
    this.headless = headless;
  }

  /**
   * Sets the CDP websocket endpoint to connect to.
   * @param cdpWsEndpoint - The CDP websocket endpoint.
   */
  public setCdpWsEndpoint(cdpWsEndpoint: string) {
    this.cdpWsEndpoint = cdpWsEndpoint;
  }

  /**
   * Initializes the user data directory for the browser.
   * @param userDataDir - The user data directory to use.
   * @returns The user data directory.
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
   * Sets the options for the browser.
   * @param options - The options to set.
   */
  public setOptions(options?: Record<string, any>) {
    this.options = options;
  }

  /**
   * Takes a JPEG screenshot of the current page and returns it as base64-encoded string.
   * @param agentContext - The current agent context containing execution state.
   * @returns A promise that resolves to an object containing the base64-encoded image and image type.
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

  /**
   * Navigates to a specified URL in the browser.
   * @param agentContext - The current agent context containing execution state.
   * @param url - The URL to navigate to.
   * @returns A promise that resolves to an object containing the final URL, page title, and optional tab ID.
   */
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

  /**
   * Retrieves a list of all open browser tabs with their metadata.
   * @param agentContext - The current agent context containing execution state.
   * @returns A promise that resolves to an array of tab objects containing tabId, URL, and title for each open tab.
   */
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

  /**
   * Switches the active browser tab to the specified tab ID.
   * @param agentContext - The current agent context containing execution state.
   * @param tabId - The numeric ID of the tab to switch to.
   * @returns A promise that resolves to an object containing the tab ID, URL, and title of the switched tab.
   * @throws Error if the specified tab ID does not exist.
   */
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

  /**
   * Inputs text into an element by index after clearing existing content.
   * @param agentContext - The current agent context containing execution state.
   * @param index - The numeric index of the element to interact with.
   * @param text - The text to input into the element.
   * @param enter - Whether to press Enter after inputting the text (default: false).
   * @returns A promise that resolves when the text has been input.
   */
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

  /**
   * Clicks on an element by index with optional modifiers and multiple clicks.
   * @param agentContext - The current agent context containing execution state.
   * @param index - The numeric index of the element to click.
   * @param num_clicks - The number of times to click (default: 1).
   * @param button - The mouse button to use: "left", "right", or "middle" (default: "left").
   * @param modifiers - Optional keyboard modifiers to press while clicking (e.g., ["Control", "Shift"]).
   * @returns A promise that resolves when the click has been performed.
   */
  protected async click_element(
    agentContext: AgentContext,
    index: number,
    num_clicks: number,
    button: "left" | "right" | "middle",
    modifiers: string[] = []
  ): Promise<any> {
    try {
      let elementHandle = await this.get_element(index, true);
      await elementHandle.click({
        button,
        clickCount: num_clicks,
        modifiers: modifiers as any,
        force: true,
      });
    } catch (e) {
      await super.click_element(agentContext, index, num_clicks, button, modifiers);
    }
  }

  /**
   * Hovers the mouse over an element by index.
   * @param agentContext - The current agent context containing execution state.
   * @param index - The numeric index of the element to hover over.
   * @returns A promise that resolves when the hover action has been completed.
   */
  protected async hover_to_element(
    agentContext: AgentContext,
    index: number
  ): Promise<void> {
    try {
      let elementHandle = await this.get_element(index, true);
      await elementHandle.hover({ force: true });
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
    clickCount: number = 1,
    modifiers: string[] = []
  ): Promise<void> {
    const page = await this.currentPage();
    await page.mouse.click(x, y, { button, clickCount, modifiers } as any);
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
    y2: number,
    modifiers: string[] = []
  ): Promise<void> {
    const page = await this.currentPage();
    const modifierKeys = modifiers as ("Alt" | "Control" | "Meta" | "Shift")[];

    for (const key of modifierKeys) {
      await page.keyboard.down(key);
    }

    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2);
    await page.mouse.up();

    for (const key of modifierKeys) {
      await page.keyboard.up(key);
    }
  }

  /**
   * Scrolls at specific coordinates using mouse wheel.
   */
  protected async scroll_at_coordinates(
    x: number,
    y: number,
    deltaX: number,
    deltaY: number,
    modifiers: string[] = []
  ): Promise<void> {
    const page = await this.currentPage();
    const modifierKeys = modifiers as ("Alt" | "Control" | "Meta" | "Shift")[];

    for (const key of modifierKeys) {
      await page.keyboard.down(key);
    }

    await page.mouse.move(x, y);
    await page.mouse.wheel(deltaX, deltaY);

    for (const key of modifierKeys) {
      await page.keyboard.up(key);
    }
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
   * Performs keyboard actions: press, down, up, type, insert.
   */
  protected async keyboard_action(
    action: "press" | "down" | "up" | "type" | "insert",
    key?: string,
    text?: string
  ): Promise<void> {
    const page = await this.currentPage();
    switch (action) {
      case "press":
        if (key) await page.keyboard.press(normalizeKey(key));
        break;
      case "down":
        if (key) await page.keyboard.down(normalizeKey(key));
        break;
      case "up":
        if (key) await page.keyboard.up(normalizeKey(key));
        break;
      case "type":
        if (text) await page.keyboard.type(text);
        break;
      case "insert":
        if (text) await page.keyboard.insertText(text);
        break;
    }
  }

  /**
   * Saves the current page screenshot to a file.
   * @param filename - The filename to save the screenshot as (optional, defaults to timestamp).
   * @param directory - The directory to save the screenshot in (optional, defaults to cwd).
   * @returns The full path to the saved screenshot.
   */
  protected async save_screenshot(
    filename?: string,
    directory?: string
  ): Promise<{ path: string; success: boolean }> {
    const page = await this.currentPage();
    const dir = directory || process.cwd();
    const fname = filename || `screenshot_${Date.now()}.png`;
    const fullPath = path.join(dir, fname);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await page.screenshot({
      path: fullPath,
      fullPage: false,
      type: "png",
    });

    return { path: fullPath, success: true };
  }

  /**
   * Waits for an element matching the selector to appear on the page.
   * @param selector - CSS selector to wait for.
   * @param timeout - Maximum time to wait in milliseconds (default: 10000).
   * @returns Success status and optional error message.
   */
  protected async wait_for_element(
    selector: string,
    timeout: number = 10000
  ): Promise<{ found: boolean; message: string }> {
    const page = await this.currentPage();
    try {
      await page.waitForSelector(selector, { timeout, state: "visible" });
      return { found: true, message: `Element '${selector}' found` };
    } catch (e) {
      return { found: false, message: `Element '${selector}' not found within ${timeout}ms` };
    }
  }

  /**
   * Waits for navigation to complete or for a specific URL pattern.
   * @param urlPattern - Optional regex pattern for URL to wait for.
   * @param timeout - Maximum time to wait in milliseconds (default: 30000).
   * @returns Success status with current URL.
   */
  protected async wait_for_navigation(
    urlPattern?: string,
    timeout: number = 30000
  ): Promise<{ success: boolean; url: string; message: string }> {
    const page = await this.currentPage();
    try {
      if (urlPattern) {
        await page.waitForURL(new RegExp(urlPattern), { timeout });
      } else {
        await page.waitForLoadState("networkidle", { timeout });
      }
      return {
        success: true,
        url: page.url(),
        message: "Navigation completed successfully"
      };
    } catch (e) {
      return {
        success: false,
        url: page.url(),
        message: `Navigation timeout after ${timeout}ms`
      };
    }
  }

  /**
   * Extracts structured data from multiple elements matching a selector.
   * @param selector - CSS selector for the container elements.
   * @param fields - Map of field names to CSS selectors within each container.
   * @param limit - Maximum number of elements to extract (optional).
   * @returns Array of extracted data objects.
   */
  protected async extract_elements(
    selector: string,
    fields: Record<string, string>,
    limit?: number
  ): Promise<{ data: Record<string, string | null>[]; count: number }> {
    const page = await this.currentPage();

    const data = await page.$$eval(
      selector,
      (elements, args) => {
        const { fields, limit } = args;
        const results: Record<string, string | null>[] = [];
        const maxItems = limit || elements.length;

        for (let i = 0; i < Math.min(elements.length, maxItems); i++) {
          const el = elements[i];
          const item: Record<string, string | null> = {};

          for (const [fieldName, fieldSelector] of Object.entries(fields)) {
            // Support @attr syntax for attributes (e.g., "a@href")
            // Uses lastIndexOf to handle selectors that might contain @ within attribute values
            const atIndex = (fieldSelector as string).lastIndexOf('@');
            let sel = fieldSelector as string;
            let attr: string | undefined;

            if (atIndex > 0) {
              sel = (fieldSelector as string).substring(0, atIndex);
              attr = (fieldSelector as string).substring(atIndex + 1);
            }

            const target = el.querySelector(sel);

            if (target) {
              if (attr) {
                item[fieldName] = target.getAttribute(attr);
              } else {
                item[fieldName] = target.textContent?.trim() || null;
              }
            } else {
              item[fieldName] = null;
            }
          }
          results.push(item);
        }
        return results;
      },
      { fields, limit }
    );

    const result = { data, count: data.length };
    if (result.count === 0) {
      console.warn(`extract_elements found 0 elements matching selector: ${selector}`);
    }
    return result;
  }

  /**
   * Counts elements matching a selector.
   * @param selector - CSS selector to count.
   * @returns The count of matching elements.
   */
  protected async count_elements(
    selector: string
  ): Promise<{ count: number; selector: string }> {
    const page = await this.currentPage();
    const count = await page.locator(selector).count();
    return { count, selector };
  }

  /**
   * Scrolls the page until a target element count is reached or max scrolls exceeded.
   * @param selector - CSS selector to count elements.
   * @param targetCount - Target number of elements to load.
   * @param maxScrolls - Maximum scroll attempts (default: 20).
   * @param scrollDelay - Delay between scrolls in ms (default: 1000).
   * @returns Final count and success status.
   */
  protected async scroll_until(
    selector: string,
    targetCount: number,
    maxScrolls: number = 20,
    scrollDelay: number = 1000
  ): Promise<{ count: number; success: boolean; scrolls: number }> {
    const page = await this.currentPage();
    let currentCount = 0;
    let scrolls = 0;
    let prevCount = 0;
    let stuckCount = 0;

    while (scrolls < maxScrolls) {
      currentCount = await page.locator(selector).count();

      // Check if target reached
      if (currentCount >= targetCount) {
        return { count: currentCount, success: true, scrolls };
      }

      // Detect stuck state (no new content loading)
      if (currentCount === prevCount) {
        stuckCount++;
        if (stuckCount >= 3) {
          // No new content for 3 consecutive scrolls, stop
          return { count: currentCount, success: false, scrolls };
        }
      } else {
        stuckCount = 0;
      }

      prevCount = currentCount;

      // Scroll down by viewport height
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await this.sleep(scrollDelay);
      scrolls++;
    }

    // Final count check
    currentCount = await page.locator(selector).count();
    return {
      count: currentCount,
      success: currentCount >= targetCount,
      scrolls
    };
  }

  /**
   * Saves data to a file (CSV or JSON format).
   * @param data - Array of objects to save.
   * @param filename - Output filename (supports {{date}} template).
   * @param format - Output format: 'csv' or 'json'.
   * @returns Path to saved file.
   */
  protected async save_to_file(
    data: Record<string, any>[],
    filename: string,
    format: 'csv' | 'json' = 'csv'
  ): Promise<{ path: string; success: boolean; rows: number }> {
    // Replace {{date}} with current date
    const dateStr = new Date().toISOString().split('T')[0];
    const finalFilename = filename.replace('{{date}}', dateStr);
    const fullPath = path.resolve(process.cwd(), finalFilename);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let content: string;

    if (format === 'csv') {
      if (data.length === 0) {
        content = '';  // Empty file for empty data
      } else {
        const headers = Object.keys(data[0]);
        const rows = data.map(row =>
          headers.map(h => {
            const val = row[h];
            // Escape quotes and wrap in quotes if contains comma, newline, or quotes
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(',')
        );
        content = [headers.join(','), ...rows].join('\n');
      }
    } else {
      content = JSON.stringify(data, null, 2);
    }

    fs.writeFileSync(fullPath, content, 'utf-8');

    return { path: fullPath, success: true, rows: data.length };
  }

  /**
   * Saves the current browser session (cookies, localStorage) to a file.
   * @param filename - Path to save the session state.
   * @returns Success status and path.
   */
  protected async save_session(
    filename: string
  ): Promise<{ path: string; success: boolean }> {
    if (!this.browser_context) {
      return { path: '', success: false };
    }
    const fullPath = path.resolve(process.cwd(), filename);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await this.browser_context.storageState({ path: fullPath });
    return { path: fullPath, success: true };
  }

  /**
   * Loads a previously saved browser session from a file.
   * IMPORTANT: This closes the current browser context and creates a new one.
   * All existing pages will be closed.
   * @param filename - Path to the session state file.
   * @returns Success status and path.
   */
  protected async load_session(
    filename: string
  ): Promise<{ path: string; success: boolean; message: string }> {
    const fullPath = path.resolve(process.cwd(), filename);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return {
        path: fullPath,
        success: false,
        message: `Session file not found: ${fullPath}`
      };
    }

    // Persistent context (userDataDir) is incompatible with storageState
    // The persistent context manages its own storage in userDataDir
    if (this.userDataDir) {
      return {
        path: fullPath,
        success: false,
        message: "Cannot load session when using persistent context (userDataDir). Session storage is managed by the browser automatically."
      };
    }

    // Store the path for new context creation
    this.storageStatePath = fullPath;

    // Close existing context if any
    if (this.browser_context) {
      await this.browser_context.close();
      this.browser_context = null;
      this.current_page = null;
    }

    // Immediately recreate context to avoid race conditions
    // This ensures the session is loaded before any subsequent browser actions
    try {
      await this.getBrowserContext();
      return {
        path: fullPath,
        success: true,
        message: "Session loaded successfully"
      };
    } catch (error) {
      // Reset state on failure
      this.storageStatePath = undefined;
      return {
        path: fullPath,
        success: false,
        message: `Failed to create context with session: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Gets information about the current page.
   * @returns URL, title, and domain of current page.
   */
  protected async get_page_info(): Promise<{ url: string; title: string; domain: string }> {
    const page = await this.currentPage();
    const url = page.url();
    const title = await page.title();
    const domain = new URL(url).hostname;
    return { url, title, domain };
  }

  /**
   * Builds the utility tools for screenshot and waiting operations.
   */
  private buildUtilityTools(): Tool[] {
    return [
      {
        name: "save_screenshot",
        description:
          "Save the current page screenshot to a file. Useful for documentation and debugging.",
        parameters: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "Filename for the screenshot (e.g., 'chart.png'). Defaults to timestamp.",
            },
            directory: {
              type: "string",
              description: "Directory to save screenshot in. Defaults to current working directory.",
            },
          },
          required: [],
        },
        execute: async (args, agentContext) => {
          return await this.callInnerTool(() =>
            this.save_screenshot(args.filename as string, args.directory as string)
          );
        },
      },
      {
        name: "wait_for_element",
        description:
          "Wait for a specific element to appear on the page. Use CSS selector syntax.",
        parameters: {
          type: "object",
          properties: {
            selector: {
              type: "string",
              description: "CSS selector of the element to wait for (e.g., '#chart', '.button')",
            },
            timeout: {
              type: "number",
              description: "Maximum time to wait in milliseconds (default: 10000)",
              default: 10000,
            },
          },
          required: ["selector"],
        },
        execute: async (args, agentContext) => {
          return await this.callInnerTool(() =>
            this.wait_for_element(
              args.selector as string,
              (args.timeout as number) || 10000
            )
          );
        },
      },
      {
        name: "wait_for_navigation",
        description:
          "Wait for page navigation to complete. Optionally wait for a specific URL pattern.",
        parameters: {
          type: "object",
          properties: {
            url_pattern: {
              type: "string",
              description: "Optional regex pattern for URL to wait for (e.g., '.*tradingview.*chart.*')",
            },
            timeout: {
              type: "number",
              description: "Maximum time to wait in milliseconds (default: 30000)",
              default: 30000,
            },
          },
          required: [],
        },
        execute: async (args, agentContext) => {
          return await this.callInnerTool(() =>
            this.wait_for_navigation(
              args.url_pattern as string,
              (args.timeout as number) || 30000
            )
          );
        },
      },
      {
        name: "extract_elements",
        description:
          "Extract structured data from multiple elements matching a selector. Useful for scraping lists of items like profiles, products, or search results.",
        parameters: {
          type: "object",
          properties: {
            selector: {
              type: "string",
              description: "CSS selector for container elements (e.g., '.profile-card', '.search-result')",
            },
            fields: {
              type: "object",
              description: "Map of field names to CSS selectors. Use @attr for attributes (e.g., {'url': 'a@href', 'name': '.title'}). Uses lastIndexOf('@') to handle complex selectors.",
              additionalProperties: { type: "string" },
            },
            limit: {
              type: "number",
              description: "Maximum number of elements to extract (optional)",
            },
          },
          required: ["selector", "fields"],
        },
        execute: async (args, agentContext) => {
          return await this.callInnerTool(() =>
            this.extract_elements(
              args.selector as string,
              args.fields as Record<string, string>,
              args.limit as number | undefined
            )
          );
        },
      },
      {
        name: "count_elements",
        description:
          "Count the number of elements matching a CSS selector on the page.",
        parameters: {
          type: "object",
          properties: {
            selector: {
              type: "string",
              description: "CSS selector to count (e.g., '.profile-card', '.search-result')",
            },
          },
          required: ["selector"],
        },
        execute: async (args, agentContext) => {
          return await this.callInnerTool(() =>
            this.count_elements(args.selector as string)
          );
        },
      },
      {
        name: "scroll_until",
        description:
          "Scroll the page until a target number of elements are loaded. Perfect for infinite scroll pages like LinkedIn, Twitter, etc.",
        parameters: {
          type: "object",
          properties: {
            selector: {
              type: "string",
              description: "CSS selector to count elements",
            },
            target_count: {
              type: "number",
              description: "Target number of elements to load",
            },
            max_scrolls: {
              type: "number",
              description: "Maximum scroll attempts (default: 20)",
              default: 20,
            },
            scroll_delay: {
              type: "number",
              description: "Delay between scrolls in milliseconds (default: 1000)",
              default: 1000,
            },
          },
          required: ["selector", "target_count"],
        },
        execute: async (args, agentContext) => {
          return await this.callInnerTool(() =>
            this.scroll_until(
              args.selector as string,
              args.target_count as number,
              (args.max_scrolls as number) || 20,
              (args.scroll_delay as number) || 1000
            )
          );
        },
      },
      {
        name: "save_to_file",
        description:
          "Save extracted data to a file in CSV or JSON format. Supports {{date}} template in filename.",
        parameters: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: { type: "object" },
              description: "Array of objects to save",
            },
            filename: {
              type: "string",
              description: "Output filename (e.g., 'leads_{{date}}.csv')",
            },
            format: {
              type: "string",
              enum: ["csv", "json"],
              description: "Output format (default: csv)",
              default: "csv",
            },
          },
          required: ["data", "filename"],
        },
        execute: async (args, agentContext) => {
          return await this.callInnerTool(() =>
            this.save_to_file(
              args.data as Record<string, any>[],
              args.filename as string,
              (args.format as 'csv' | 'json') || 'csv'
            )
          );
        },
      },
      {
        name: "save_session",
        description:
          "Save the current browser session (cookies, localStorage) to a file. Use for sites requiring login like LinkedIn.",
        parameters: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "Path to save session state (e.g., 'linkedin_session.json')",
            },
          },
          required: ["filename"],
        },
        execute: async (args, agentContext) => {
          return await this.callInnerTool(() =>
            this.save_session(args.filename as string)
          );
        },
      },
      {
        name: "load_session",
        description:
          "Load a previously saved browser session from a file. This will close the current context and create a new one with the saved session. Use this before navigating to LinkedIn or other auth-required sites.",
        parameters: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "Path to session state file (e.g., 'linkedin_session.json')",
            },
          },
          required: ["filename"],
        },
        execute: async (args, agentContext) => {
          return await this.callInnerTool(() =>
            this.load_session(args.filename as string)
          );
        },
      },
      {
        name: "get_page_info",
        description:
          "Get information about the current page including URL, title, and domain.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
        execute: async (args, agentContext) => {
          return await this.callInnerTool(() => this.get_page_info());
        },
      },
    ];
  }
  private buildCoordinateTools(): Tool[] {
    return [
      {
        name: "click_at_coordinates",
        description:
          "Click at specific X,Y coordinates in the browser viewport. Use when element labels are unavailable (canvas, SVG, video players, custom widgets).",
        parameters: {
          type: "object",
          properties: {
            x: { type: "number", description: "X coordinate from screenshot" },
            y: { type: "number", description: "Y coordinate from screenshot" },
            button: {
              type: "string",
              enum: ["left", "right", "middle"],
              default: "left",
            },
            clicks: { type: "number", minimum: 1, maximum: 3, default: 1 },
            modifiers: {
              type: "array",
              items: {
                type: "string",
                enum: ["Alt", "Control", "Meta", "Shift"],
              },
              description: "Modifier keys to hold during click",
            },
          },
          required: ["x", "y"],
        },
        execute: async (args, agentContext) => {
          const scaled = scaleCoordinates(
            args.x as number,
            args.y as number,
            this.lastScaleFactor
          );
          return await this.callInnerTool(() =>
            this.click_at_coordinates(
              scaled.x,
              scaled.y,
              (args.button as any) || "left",
              (args.clicks as number) || 1,
              (args.modifiers || []) as any
            )
          );
        },
      },
      {
        name: "hover_at_coordinates",
        description:
          "Move cursor to X,Y coordinates to trigger hover states and reveal dynamic content (tooltips, dropdowns, menus).",
        parameters: {
          type: "object",
          properties: {
            x: { type: "number", description: "X coordinate from screenshot" },
            y: { type: "number", description: "Y coordinate from screenshot" },
          },
          required: ["x", "y"],
        },
        execute: async (args, agentContext) => {
          const scaled = scaleCoordinates(
            args.x as number,
            args.y as number,
            this.lastScaleFactor
          );
          return await this.callInnerTool(() =>
            this.hover_at_coordinates(scaled.x, scaled.y)
          );
        },
      },
      {
        name: "drag_to_coordinates",
        description:
          "Drag from one position to another. Useful for sliders, resizing, reordering, drawing on canvas.",
        parameters: {
          type: "object",
          properties: {
            start_x: { type: "number", description: "Starting X coordinate" },
            start_y: { type: "number", description: "Starting Y coordinate" },
            end_x: { type: "number", description: "Ending X coordinate" },
            end_y: { type: "number", description: "Ending Y coordinate" },
            modifiers: {
              type: "array",
              items: {
                type: "string",
                enum: ["Alt", "Control", "Meta", "Shift"],
              },
              description: "Modifier keys to hold during drag",
            },
          },
          required: ["start_x", "start_y", "end_x", "end_y"],
        },
        execute: async (args, agentContext) => {
          const start = scaleCoordinates(
            args.start_x as number,
            args.start_y as number,
            this.lastScaleFactor
          );
          const end = scaleCoordinates(
            args.end_x as number,
            args.end_y as number,
            this.lastScaleFactor
          );
          return await this.callInnerTool(() =>
            this.drag_to_coordinates(
              start.x,
              start.y,
              end.x,
              end.y,
              (args.modifiers || []) as any
            )
          );
        },
      },
      {
        name: "scroll_at_coordinates",
        description:
          "Scroll at specific coordinates using mouse wheel. Useful for scrolling within specific containers.",
        parameters: {
          type: "object",
          properties: {
            x: {
              type: "number",
              description: "X coordinate to position cursor",
            },
            y: {
              type: "number",
              description: "Y coordinate to position cursor",
            },
            direction: {
              type: "string",
              enum: ["up", "down", "left", "right"],
            },
            amount: { type: "number", minimum: 1, maximum: 10, default: 3 },
            modifiers: {
              type: "array",
              items: {
                type: "string",
                enum: ["Alt", "Control", "Meta", "Shift"],
              },
              description: "Modifier keys to hold during scroll",
            },
          },
          required: ["x", "y", "direction"],
        },
        execute: async (args, agentContext) => {
          const scaled = scaleCoordinates(
            args.x as number,
            args.y as number,
            this.lastScaleFactor
          );
          const amount = ((args.amount as number) || 3) * 100;
          let deltaX = 0,
            deltaY = 0;
          switch (args.direction) {
            case "up":
              deltaY = -amount;
              break;
            case "down":
              deltaY = amount;
              break;
            case "left":
              deltaX = -amount;
              break;
            case "right":
              deltaX = amount;
              break;
          }
          return await this.callInnerTool(() =>
            this.scroll_at_coordinates(
              scaled.x,
              scaled.y,
              deltaX,
              deltaY,
              (args.modifiers || []) as any
            )
          );
        },
      },
      {
        name: "type_at_coordinates",
        description:
          "Click at coordinates and type text. Use for inputs not accessible via element labels.",
        parameters: {
          type: "object",
          properties: {
            x: { type: "number", description: "X coordinate to click" },
            y: { type: "number", description: "Y coordinate to click" },
            text: { type: "string", description: "Text to type" },
            clear_first: {
              type: "boolean",
              description: "Clear existing text before typing",
              default: true,
            },
          },
          required: ["x", "y", "text"],
        },
        execute: async (args, agentContext) => {
          const scaled = scaleCoordinates(
            args.x as number,
            args.y as number,
            this.lastScaleFactor
          );
          return await this.callInnerTool(() =>
            this.type_at_coordinates(
              scaled.x,
              scaled.y,
              args.text as string,
              args.clear_first !== false
            )
          );
        },
      },
    ];
  }

  private buildKeyboardTools(): Tool[] {
    return [
      {
        name: "keyboard_action",
        description:
          "Perform low-level keyboard operations. Use this for complex interactions like holding keys, shortcuts, or typing.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["press", "down", "up", "type", "insert"],
              description:
                "Action to perform. 'press' for single key/shortcut, 'down/up' for holding/releasing, 'type' for typing text, 'insert' for pasting text.",
            },
            key: {
              type: "string",
              description:
                "Key to operate on (for press/down/up). Supports common names like 'Enter', 'Control', 'Shift', 'a', etc.",
            },
            text: {
              type: "string",
              description: "Text to type or insert (for type/insert actions).",
            },
          },
          required: ["action"],
        },
        execute: async (args, agentContext) => {
          return await this.callInnerTool(() =>
            this.keyboard_action(
              args.action as any,
              args.key as string,
              args.text as string
            )
          );
        },
      },
      {
        name: "keyboard_combination",
        description:
          "Execute key combinations with modifier keys. Automatically detects modifiers (Shift, Control, Alt, Meta) and handles proper sequencing. Use this for shortcuts like Ctrl+C, Shift+A, etc.",
        parameters: {
          type: "object",
          properties: {
            keys: {
              type: "array",
              items: { type: "string" },
              description: "Array of keys where modifiers come first, then action keys (e.g., ['Control', 'c'] for Ctrl+C). Supports common key names.",
              minItems: 1,
            },
          },
          required: ["keys"],
        },
        execute: async (args, agentContext) => {
          return await this.callInnerTool(async () => {
            const page = await this.currentPage();
            await keyCombination(page, args.keys as string[]);
          });
        },
      },
      {
        name: "press_keys_sequence",
        description:
          "Press multiple keys in sequence, each pressed and released individually. Use this for typing multiple characters or keys one after another.",
        parameters: {
          type: "object",
          properties: {
            keys: {
              type: "array",
              items: { type: "string" },
              description: "Array of keys to press in sequence (e.g., ['a', 'b', 'c'] for typing 'abc'). Supports common key names.",
              minItems: 1,
            },
          },
          required: ["keys"],
        },
        execute: async (args, agentContext) => {
          return await this.callInnerTool(async () => {
            const page = await this.currentPage();
            await pressKeysInSequence(page, args.keys as string[]);
          });
        },
      },
      {
        name: "type_text_enhanced",
        description:
          "Type text with realistic human-like delays. Use this for more natural text input simulation.",
        parameters: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "Text to type into the focused element.",
            },
            delay: {
              type: "number",
              description: "Delay between keystrokes in milliseconds (default: 100 for human-like typing).",
              minimum: 0,
              default: 100,
            },
          },
          required: ["text"],
        },
        execute: async (args, agentContext) => {
          return await this.callInnerTool(async () => {
            const page = await this.currentPage();
            await typeText(page, args.text as string, args.delay as number || 100);
          });
        },
      },
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

  /**
   * Gets the currently active page instance, waiting for it to reach "domcontentloaded" state.
   * @returns A promise that resolves to the currently active Playwright Page object.
   * @throws Error if no page exists yet (navigate_to must be called first).
   */
  protected async currentPage(): Promise<Page> {
    if (this.current_page == null) {
      throw new Error("There is no page, please call navigate_to first");
    }
    let page = this.current_page as Page;
    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
    } catch (e) {
      // Log timeout but continue - page may still be usable
      console.warn(`Page load state timeout: ${e instanceof Error ? e.message : e}`);
    }
    return page;
  }

  /**
   * Retrieves a DOM element by its highlighted index from the page, optionally finding input elements within it.
   * @param index - The numeric index of the highlighted element.
   * @param findInput - If true, searches for input or textarea elements within the highlighted element.
   * @returns A promise that resolves to the ElementHandle of the requested element.
   */
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

  /**
   * Pauses execution for a specified duration in milliseconds.
   * @param time - The duration to pause in milliseconds.
   * @returns A promise that resolves after the specified time has elapsed.
   */
  private sleep(time: number): Promise<void> {
    return new Promise((resolve) => setTimeout(() => resolve(), time));
  }

  /**
   * Initializes and retrieves the browser context, creating a new one if necessary.
   * Sets up the browser based on configuration (CDP endpoint, persistent context, or standard launch).
   * Applies bot-detection evasion scripts to bypass anti-crawling mechanisms.
   * @returns A promise that resolves to the initialized BrowserContext.
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
        // Apply storageState if available
        const contextOptions: any = {};
        if (this.storageStatePath) {
          contextOptions.storageState = this.storageStatePath;
        }
        this.browser_context = await this.browser.newContext(contextOptions);
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
        // Apply storageState if available
        const contextOptions: any = {};
        if (this.storageStatePath) {
          contextOptions.storageState = this.storageStatePath;
        }
        this.browser_context = await this.browser.newContext(contextOptions);
      }
      // Anti-crawling detection website:
      // https://bot.sannysoft.com/
      let init_script = await this.initScript();
      this.browser_context.addInitScript(init_script);
    }
    return this.browser_context;
  }

  /**
   * Generates JavaScript code to evade bot detection and bypass anti-crawling mechanisms.
   * Spoofs navigator properties and adds Chrome runtime detection that mimics real user browsing.
   * @returns A promise that resolves to an object containing the evasion script content.
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

  /**
   * Closes and cleans up all browser resources.
   * This method should be called when the agent is no longer needed.
   * @returns A promise that resolves when cleanup is complete.
   */
  public async close(): Promise<void> {
    try {
      // Close all pages in the context
      if (this.browser_context) {
        const pages = this.browser_context.pages();
        await Promise.all(
          pages.map(page => page.close().catch(err => {
            // Log but don't fail on individual page close errors
            console.warn(`Failed to close page: ${err.message}`);
          }))
        );

        // Close the browser context
        await this.browser_context.close();
        this.browser_context = null;
      }

      // Close the browser instance (only if we own it, not CDP)
      if (this.browser && !this.cdpWsEndpoint) {
        await this.browser.close();
        this.browser = null;
      }

      // Reset state
      this.current_page = null;

      // Call parent close for mcpClient cleanup
      if (this.mcpClient) {
        await this.mcpClient.close();
      }
    } catch (error) {
      console.error('Error during BrowserAgent cleanup:', error);
      // Still reset state even on error
      this.browser_context = null;
      this.browser = null;
      this.current_page = null;
      // Re-throw to notify caller
      throw error;
    }
  }
}

export { BrowserAgent };
