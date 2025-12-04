import { BaseBrowserAgent, AGENT_NAME } from "./browser_base";
import { AgentContext } from "../../core/context";
import { LanguageModelV2Prompt } from "@ai-sdk/provider";
import { Tool, ToolResult, IMcpClient } from "../../types";
import { mergeTools, sleep, toImage } from "../../common/utils";
import { scaleCoordinates } from "../../common/coordinate-scaling";

/**
 * An agent that can interact with a web browser using screen coordinates.
 */
export default abstract class BaseBrowserScreenAgent extends BaseBrowserAgent {
  /**
   * Creates an instance of the BaseBrowserScreenAgent.
   * @param llms - A list of language models to use.
   * @param ext_tools - A list of external tools to add to the agent.
   * @param mcpClient - The MCP client to use.
   */
  constructor(llms?: string[], ext_tools?: Tool[], mcpClient?: IMcpClient) {
    const description = `<SYSTEM_CAPABILITY>
* You are a browser automation agent using mouse and keyboard for interaction
* You observe webpages through screenshots and specify action sequences to complete tasks
* You can navigate, click at coordinates, type, scroll, and interact with any page element
* For your first visit, call either \`navigate_to\` or \`current_page\` tool
* After each action, you receive an updated screenshot of the page
</SYSTEM_CAPABILITY>

<INTERACTION_RULES>
* Click elements by specifying X,Y coordinates from the screenshot
* Type text after clicking to focus the target input field
* Use scroll to reveal content outside visible area
* Wait for page loads to complete before interacting
* Use drag_and_drop for moving elements between positions
</INTERACTION_RULES>

<BROWSER_OPERATIONS>
* Navigate to URLs and manage browser history
* Fill forms and submit data
* Click elements and interact with pages
* Extract text and HTML content
* Wait for elements to load
* Scroll pages and handle infinite scroll
* YOU CAN DO ANYTHING ON THE BROWSER - clicking, filling forms, submitting data, etc.
</BROWSER_OPERATIONS>

<CONSTRAINTS>
* Only interact with elements visible in the current screenshot
* Coordinates must be within the visible viewport
* Handle popups and cookie banners before main task
* Report failures clearly with what was attempted
</CONSTRAINTS>

<IMPORTANT>
* Screenshots show the current page state - use them to determine coordinates
* Dynamic content may change between screenshots
* If an element is not visible, scroll to find it first
</IMPORTANT>`;
    const _tools_ = [] as Tool[];
    super({
      name: AGENT_NAME,
      description: description,
      tools: _tools_,
      llms: llms,
      mcpClient: mcpClient,
      planDescription:
        "Browser operation agent, interact with the browser using the mouse and keyboard.",
    });
    let init_tools = this.buildInitTools();
    if (ext_tools && ext_tools.length > 0) {
      init_tools = mergeTools(init_tools, ext_tools);
    }
    init_tools.forEach((tool) => _tools_.push(tool));
  }

  /**
   * Types text into the browser.
   * @param agentContext - The context for the agent to run in.
   * @param text - The text to type.
   */
  protected abstract typing(
    agentContext: AgentContext,
    text: string
  ): Promise<void>;

  /**
   * Clicks at a specific position in the browser.
   * @param agentContext - The context for the agent to run in.
   * @param x - The x-coordinate to click at.
   * @param y - The y-coordinate to click at.
   * @param num_clicks - The number of times to click.
   * @param button_type - The mouse button to use for the click.
   */
  protected abstract click(
    agentContext: AgentContext,
    x: number,
    y: number,
    num_clicks: number,
    button_type: "left" | "right" | "middle"
  ): Promise<void>;

  /**
   * Scrolls the mouse wheel.
   * @param agentContext - The context for the agent to run in.
   * @param amount - The amount to scroll.
   */
  protected abstract scroll(
    agentContext: AgentContext,
    amount: number
  ): Promise<void>;

  /**
   * Moves the mouse to a specific position.
   * @param agentContext - The context for the agent to run in.
   * @param x - The x-coordinate to move to.
   * @param y - The y-coordinate to move to.
   */
  protected abstract move_to(
    agentContext: AgentContext,
    x: number,
    y: number
  ): Promise<void>;

  /**
   * Presses a key.
   * @param agentContext - The context for the agent to run in.
   * @param key - The key to press.
   */
  protected abstract press(
    agentContext: AgentContext,
    key: "enter" | "tab" | "space" | "backspace" | "delete"
  ): Promise<void>;

  /**
   * Drags and drops an element from one position to another.
   * @param agentContext - The context for the agent to run in.
   * @param x1 - The starting x-coordinate.
   */
  protected abstract drag_and_drop(
    agentContext: AgentContext,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): Promise<void>;

  /**
   * Builds the initial set of tools for the agent.
   * @returns A list of tools.
   */
  private buildInitTools(): Tool[] {
    return [
      {
        name: "navigate_to",
        description: "Navigate to a specific url",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The url to navigate to",
            },
          },
          required: ["url"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.navigate_to(agentContext, args.url as string)
          );
        },
      },
      {
        name: "current_page",
        description: "Get the information of the current webpage (url, title)",
        parameters: {
          type: "object",
          properties: {},
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.get_current_page(agentContext)
          );
        },
      },
      {
        name: "go_back",
        description: "Navigate back in browser history",
        parameters: {
          type: "object",
          properties: {},
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() => this.go_back(agentContext));
        },
      },
      {
        name: "typing",
        description: "Type specified text",
        parameters: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "Text to type",
            },
          },
          required: ["text"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.typing(agentContext, args.text as string)
          );
        },
      },
      {
        name: "click",
        description: "Click at current or specified position",
        parameters: {
          type: "object",
          properties: {
            x: {
              type: "number",
              description: "X coordinate",
            },
            y: {
              type: "number",
              description: "Y coordinate",
            },
            num_clicks: {
              type: "number",
              description: "Number of clicks",
              enum: [1, 2, 3],
              default: 1,
            },
            button: {
              type: "string",
              description: "Mouse button to click",
              enum: ["left", "right", "middle"],
              default: "left",
            },
          },
          required: ["x", "y"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          // Scale coordinates from screenshot space to viewport space
          const scaled = scaleCoordinates(
            args.x as number,
            args.y as number,
            this.lastScaleFactor
          );
          return await this.callInnerTool(() =>
            this.click(
              agentContext,
              scaled.x,
              scaled.y,
              (args.num_clicks || 1) as number,
              (args.button || "left") as any
            )
          );
        },
      },
      {
        name: "move_to",
        description: "Move cursor to specified position",
        parameters: {
          type: "object",
          properties: {
            x: {
              type: "number",
              description: "X coordinate",
            },
            y: {
              type: "number",
              description: "Y coordinate",
            },
          },
          required: ["x", "y"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          // Scale coordinates from screenshot space to viewport space
          const scaled = scaleCoordinates(
            args.x as number,
            args.y as number,
            this.lastScaleFactor
          );
          return await this.callInnerTool(() =>
            this.move_to(agentContext, scaled.x, scaled.y)
          );
        },
      },
      {
        name: "scroll",
        description: "Scroll the mouse wheel at current position",
        parameters: {
          type: "object",
          properties: {
            amount: {
              type: "number",
              description: "Scroll amount (up / down)",
              minimum: 1,
              maximum: 10,
            },
            direction: {
              type: "string",
              enum: ["up", "down"],
            },
          },
          required: ["amount", "direction"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(async () => {
            let amount = args.amount as number;
            await this.scroll(
              agentContext,
              args.direction == "up" ? -amount : amount
            );
          });
        },
      },
      {
        name: "extract_page_content",
        description:
          "Extract the text content and image links of the current webpage, please use this tool to obtain webpage data.",
        parameters: {
          type: "object",
          properties: {},
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.extract_page_content(agentContext)
          );
        },
      },
      {
        name: "press",
        description:
          "Press and release a key, supports Enter, Delete, Backspace, Tab, Space",
        parameters: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "Key to press",
              enum: ["enter", "tab", "space", "backspace", "delete"],
            },
          },
          required: ["key"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.press(agentContext, args.key as any)
          );
        },
      },
      {
        name: "drag_and_drop",
        description: "Drag and drop operation",
        parameters: {
          type: "object",
          properties: {
            x1: {
              type: "number",
              description: "From X coordinate",
            },
            y1: {
              type: "number",
              description: "From Y coordinate",
            },
            x2: {
              type: "number",
              description: "Target X coordinate",
            },
            y2: {
              type: "number",
              description: "Target Y coordinate",
            },
          },
          required: ["x1", "y1", "x2", "y2"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          // Scale all coordinates from screenshot space to viewport space
          const scaledStart = scaleCoordinates(
            args.x1 as number,
            args.y1 as number,
            this.lastScaleFactor
          );
          const scaledEnd = scaleCoordinates(
            args.x2 as number,
            args.y2 as number,
            this.lastScaleFactor
          );
          return await this.callInnerTool(() =>
            this.drag_and_drop(
              agentContext,
              scaledStart.x,
              scaledStart.y,
              scaledEnd.x,
              scaledEnd.y
            )
          );
        },
      },
      {
        name: "get_all_tabs",
        description: "Get all tabs of the current browser",
        parameters: {
          type: "object",
          properties: {},
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.get_all_tabs(agentContext)
          );
        },
      },
      {
        name: "switch_tab",
        description: "Switch to the specified tab page",
        parameters: {
          type: "object",
          properties: {
            tabId: {
              type: "number",
              description: "Tab ID, obtained through get_all_tabs",
            },
          },
          required: ["tabId"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.switch_tab(agentContext, args.tabId as number)
          );
        },
      },
      {
        name: "wait",
        noPlan: true,
        description: "Wait for specified duration",
        parameters: {
          type: "object",
          properties: {
            duration: {
              type: "number",
              description: "Duration in millisecond",
              default: 500,
              minimum: 200,
              maximum: 10000,
            },
          },
          required: ["duration"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            sleep((args.duration || 200) as number)
          );
        },
      },
    ];
  }

  /**
   * Handles messages in the agent's context, including taking screenshots after tool calls.
   * @param agentContext - The context for the agent to run in.
   * @param messages - The history of messages.
   * @param tools - The tools available to the agent.
   */
  protected async handleMessages(
    agentContext: AgentContext,
    messages: LanguageModelV2Prompt,
    tools: Tool[]
  ): Promise<void> {
    let lastTool = this.lastToolResult(messages);
    if (
      lastTool &&
      lastTool.toolName !== "extract_page_content" &&
      lastTool.toolName !== "get_all_tabs" &&
      lastTool.toolName !== "variable_storage"
    ) {
      await sleep(300);
      let result = await this.screenshot(agentContext);
      let image = toImage(result.imageBase64);
      messages.push({
        role: "user",
        content: [
          {
            type: "file",
            data: image,
            mediaType: result.imageType,
          },
          {
            type: "text",
            text: "This is the latest screenshot",
          },
        ],
      });
    }
    super.handleMessages(agentContext, messages, tools);
  }
}

export { BaseBrowserScreenAgent };