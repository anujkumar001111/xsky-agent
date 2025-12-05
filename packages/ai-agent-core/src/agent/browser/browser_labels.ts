import config from "../../config";
import { AgentContext } from "../../core/context";
import { run_build_dom_tree } from "./build_dom_tree";
import { BaseBrowserAgent, AGENT_NAME } from "./browser_base";
import { DomIntelligenceAgent, DomElementIntelligence } from "./dom_intelligence";
import {
  LanguageModelV2Prompt,
  LanguageModelV2FilePart,
  LanguageModelV2ToolCallPart,
} from "@ai-sdk/provider";
import { Tool, ToolResult, IMcpClient } from "../../types";
import { mergeTools, sleep, toImage } from "../../common/utils";

/**
 * An agent that can interact with a web browser using labeled elements.
 */
export default abstract class BaseBrowserLabelsAgent extends BaseBrowserAgent {
  protected domIntelligence?: DomIntelligenceAgent;
  protected useDomIntelligence: boolean = false;

  /**
   * Creates an instance of the BaseBrowserLabelsAgent.
   * @param llms - A list of language models to use.
   * @param ext_tools - A list of external tools to add to the agent.
   * @param mcpClient - The MCP client to use.
   */
  constructor(llms?: string[], ext_tools?: Tool[], mcpClient?: IMcpClient) {
    let description = `<SYSTEM_CAPABILITY>
* You are a browser automation agent using labeled elements for interaction
* Screenshots show labeled elements with [index] markers for precise targeting
* You can click, type, scroll, and navigate using element indices
* DOM changes are tracked for adaptive waiting on dynamic content
* For your first visit, call either \`navigate_to\` or \`current_page\` tool
* After each action, you receive updated screenshots and structured element data
</SYSTEM_CAPABILITY>

<INTERACTION_RULES>
* Click elements by their [index] number shown in screenshot (e.g., "[33]:<button>Submit</button>")
* Only interact with elements visible in current viewport
* Use scroll to reveal elements outside visible area
* Wait for page loads to complete before interacting
* Elements marked with "[]:" are non-interactive (context only, e.g., "[]: Google")
* Use the latest element index - do not rely on historical outdated indexes
</INTERACTION_RULES>

<SCREENSHOT_GUIDANCE>
* Screenshots show labeled bounding boxes corresponding to element indexes
* Each bounding box and label share the same color, labels typically in top-right corner
* Labels may overlap - use extracted element list to verify correct targets
* Screenshots capture ONLY visible content - use 'extract_page_content' for full page
* If content hasn't loaded, use \`wait\` tool to allow loading time
</SCREENSHOT_GUIDANCE>

<CONSTRAINTS>
* Never click elements not visible in screenshot
* Handle popups and cookie banners before main task
* If element not found, scroll or navigate to find it
* Report failures clearly with what was attempted
* Only use indexes that exist in the provided element list
* Due to technical limitations, not all interactive elements may be identified - use coordinates for unlisted elements
</CONSTRAINTS>

<ERROR_HANDLING>
* If no suitable elements exist, use alternative functions to complete the task
* If stuck, try alternative approaches - don't refuse tasks
* Handle popups/cookies by accepting or closing them
* For login, verification codes, QR scanning, payments - request user assistance
</ERROR_HANDLING>

<IMPORTANT>
* Element indices reset after each screenshot
* Overlapping labels may require scrolling for clarity
* Dynamic content may change indices between screenshots
* Output user-friendly step information - do not output HTML element/index info to users
* Follow instructions completely - if asked to find 30 items, find all 30, not just 10
* When extracting content, prioritize extract_page_content; only scroll to load more content
</IMPORTANT>`;
    if (config.parallelToolCalls) {
      description += `

<PARALLELISM>
* Do not call navigate_to tool simultaneously with other operations
* Parallelism supported for: clicking and input operations on independent elements
* When filling forms, fill independent fields simultaneously
* Avoid parallel processing for: page loading, DOM changes, redirects, dependent operations, or operations affecting same elements
</PARALLELISM>`;
    }
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

    // Opt-in flag for DOM intelligence (Requirement 5.3)
    // Could come from config, defaulting to false for now to ensure backward compatibility
    this.useDomIntelligence = config.useDomIntelligence || false;
  }

  /**
   * Initialize DOM intelligence if enabled and not already initialized
   */
  protected ensureDomIntelligence(agentContext: AgentContext) {
      if (this.useDomIntelligence && !this.domIntelligence) {
          this.domIntelligence = new DomIntelligenceAgent(agentContext);
      }
  }

  /**
   * Inputs text into a labeled element.
   * @param agentContext - The context for the agent to run in.
   * @param index - The index of the element to input text into.
   * @param text - The text to input.
   * @param enter - Whether to press enter after inputting the text.
   */
  protected async input_text(
    agentContext: AgentContext,
    index: number,
    text: string,
    enter: boolean
  ): Promise<any> {
    await this.execute_script(agentContext, typing, [{ index, text, enter }]);
    if (enter) {
      await sleep(200);
    }
  }

  /**
   * Clicks a labeled element.
   * @param agentContext - The context for the agent to run in.
   * @param index - The index of the element to click.
   * @param num_clicks - The number of times to click the element.
   * @param button - The mouse button to use for the click.
   */
  protected async click_element(
    agentContext: AgentContext,
    index: number,
    num_clicks: number,
    button: "left" | "right" | "middle",
    modifiers: string[] = []
  ): Promise<any> {
    await this.execute_script(agentContext, do_click, [
      { index, num_clicks, button, modifiers },
    ]);
  }

  /**
   * Scrolls to a labeled element.
   * @param agentContext - The context for the agent to run in.
   * @param index - The index of the element to scroll to.
   */
  protected async scroll_to_element(
    agentContext: AgentContext,
    index: number
  ): Promise<void> {
    await this.execute_script(
      agentContext,
      (index) => {
        return (window as any)
          .get_highlight_element(index)
          .scrollIntoView({ behavior: "smooth" });
      },
      [index]
    );
    await sleep(200);
  }

  /**
   * Scrolls the mouse wheel.
   * @param agentContext - The context for the agent to run in.
   * @param amount - The amount to scroll.
   * @param extract_page_content - Whether to extract the page content after scrolling.
   */
  protected async scroll_mouse_wheel(
    agentContext: AgentContext,
    amount: number,
    extract_page_content: boolean
  ): Promise<any> {
    await this.execute_script(agentContext, scroll_by, [{ amount }]);
    await sleep(200);
    if (!extract_page_content) {
      const tools = this.toolUseNames(
        agentContext.agentChain.agentRequest?.messages
      );
      let scroll_count = 0;
      for (let i = tools.length - 1; i >= Math.max(tools.length - 8, 0); i--) {
        if (tools[i] == "scroll_mouse_wheel") {
          scroll_count++;
        }
      }
      if (scroll_count >= 3) {
        extract_page_content = true;
      }
    }
    if (extract_page_content) {
      let page_result = await this.extract_page_content(agentContext);
      return {
        result:
          "The current page content has been extracted, latest page content:\n" +
          "title: " +
          page_result.title +
          "\n" +
          "page_url: " +
          page_result.page_url +
          "\n" +
          "page_content: " +
          page_result.page_content,
      };
    }
  }

  /**
   * Hovers over a labeled element.
   * @param agentContext - The context for the agent to run in.
   * @param index - The index of the element to hover over.
   */
  protected async hover_to_element(
    agentContext: AgentContext,
    index: number
  ): Promise<void> {
    await this.execute_script(agentContext, hover_to, [{ index }]);
  }

  /**
   * Gets the options from a select element.
   * @param agentContext - The context for the agent to run in.
   * @param index - The index of the select element.
   * @returns A promise that resolves to the options of the select element.
   */
  protected async get_select_options(
    agentContext: AgentContext,
    index: number
  ): Promise<any> {
    return await this.execute_script(agentContext, get_select_options, [
      { index },
    ]);
  }

  /**
   * Selects an option from a select element.
   * @param agentContext - The context for the agent to run in.
   * @param index - The index of the select element.
   * @param option - The option to select.
   * @returns A promise that resolves when the option has been selected.
   */
  protected async select_option(
    agentContext: AgentContext,
    index: number,
    option: string
  ): Promise<any> {
    return await this.execute_script(agentContext, select_option, [
      { index, option },
    ]);
  }

  /**
   * Takes a screenshot of the current page and returns the screenshot and the pseudo HTML of the page.
   * @param agentContext - The context for the agent to run in.
   * @returns A promise that resolves to the screenshot and the pseudo HTML of the page.
   */
  protected async screenshot_and_html(agentContext: AgentContext): Promise<{
    imageBase64: string;
    imageType: "image/jpeg" | "image/png";
    pseudoHtml: string;
  }> {
    try {
      // Initialize DOM intelligence if enabled
      this.ensureDomIntelligence(agentContext);

      // Inject and setup mutation observer if enabled
      if (this.useDomIntelligence && this.domIntelligence) {
          try {
             // We need to inject the observer script
             // This assumes runExtractorsParallel can be reused or we use execute_script directly
             const executor = async (script: Function) => {
                  return await this.execute_script(agentContext, script as any, []);
             };
             // Just run the setup_mutation_observer.js using the agent's loading mechanism
             // We can do this by asking DomIntelligenceAgent to run it
             await this.domIntelligence.runExtractorsParallel(executor, ['setup_mutation_observer.js']);

             // Now fetch signals
             const signals = await this.execute_script(agentContext, () => {
                 return (window as any).getDomSignals ? (window as any).getDomSignals() : [];
             }, []) as any[];

             if (Array.isArray(signals)) {
                 signals.forEach(s => agentContext.addAdaptiveWaitSignal(s));
             }

          } catch(e) {
              console.warn("Failed to setup/read DOM mutation observer:", e);
          }
      }

      // Adaptive wait (Requirement 2.3)
      if (this.useDomIntelligence && agentContext.domIntelligenceCache) {
          // Check for recent mutations to decide if we need to wait
          const latestSignal = agentContext.getLatestSignal('mutation');
          if (latestSignal && (Date.now() - latestSignal.timestamp < 1000)) {
              await sleep(500); // Dynamic wait
          } else {
              // Minimal wait if stable
              await sleep(100);
          }
      } else {
          // Legacy wait
          await sleep(200);
      }

      let element_result = null;
      for (let i = 0; i < 5; i++) {
        // Run build_dom_tree as before
        await this.execute_script(agentContext, run_build_dom_tree, []);
        await sleep(50);

        element_result = (await this.execute_script(
          agentContext,
          () => {
            return (window as any).get_clickable_elements(true);
          },
          []
        )) as any;

        if (element_result) {
          break;
        }
        await sleep(200);
      }

      // If DOM Intelligence is enabled, try to fetch it parallel to other ops or here
      if (this.useDomIntelligence && this.domIntelligence) {
          try {
              // We need to execute the script in the browser context
              // define executor using agent's execute_script
              const executor = async (script: Function) => {
                  // We need to pass the script content.
                  // BaseBrowserAgent.execute_script usually takes a function or string.
                  // If string, it evaluates it.
                  return await this.execute_script(agentContext, script as any, []);
              };

              const intelligence = await this.domIntelligence.getIntelligence(executor);
              agentContext.domIntelligenceCache = intelligence;

              // Here we could potentially merge DOM intelligence into pseudoHtml or selector_map
              // For now, we just cache it as per requirements, to be used for targeting
          } catch (e) {
              console.error("DOM Intelligence extraction failed, falling back to vision only:", e);
          }
      }

      await sleep(100);
      let screenshot = await this.screenshot(agentContext);
      // agentContext.variables.set("selector_map", element_result.selector_map);
      let pseudoHtml = element_result?.element_str || "";
      return {
        imageBase64: screenshot.imageBase64,
        imageType: screenshot.imageType,
        pseudoHtml: pseudoHtml,
      };
    } finally {
      try {
        await this.execute_script(
          agentContext,
          () => {
            return (window as any).remove_highlight();
          },
          []
        );
      } catch (e) {}
    }
  }

  /**
   * Gets the script to get a labeled element.
   * @param index - The index of the element.
   * @returns The script to get the element.
   */
  protected get_element_script(index: number): string {
    return `window.get_highlight_element(${index});`;
  }

  /**
   * Determines whether the agent can handle parallel tool calls.
   * @param toolCalls - The tool calls to check.
   * @returns Whether the agent can handle parallel tool calls.
   */
  public canParallelToolCalls(toolCalls?: LanguageModelV2ToolCallPart[]): boolean {
    if (toolCalls) {
      for (let i = 0; i < toolCalls.length; i++) {
        const toolCall = toolCalls[i];
        if (
          toolCall.toolName == "wait" ||
          toolCall.toolName == "navigate_to" ||
          toolCall.toolName == "switch_tab" ||
          toolCall.toolName == "scroll_mouse_wheel"
        ) {
          return false;
        }
      }
    }
    return super.canParallelToolCalls(toolCalls);
  }

  /**
   * Builds the initial set of tools for the agent.
   * @returns A list of tools.
   */
  private buildInitTools(): Tool[] {
    return [
      {
        name: "navigate_to",
        description: "Navigate to a specific URL in the browser. Use this tool when you need to visit a webpage or change the current page location.",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The complete URL to navigate to",
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
        description: "Get the currently active webpage information, return tabId, URL and title",
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
        description: "Go back to the previous page in browser history",
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
        name: "input_text",
        description: "Inputs text into a element by first clicking to focus the element, then clearing any existing text and typing the new text. Optionally presses Enter after input completion.",
        parameters: {
          type: "object",
          properties: {
            index: {
              type: "number",
              description: "The index of the element to input text into",
            },
            text: {
              type: "string",
              description: "The text to input",
            },
            enter: {
              type: "boolean",
              description:
                "When text input is completed, press Enter (applicable to search boxes)",
              default: false,
            },
          },
          required: ["index", "text"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.input_text(
              agentContext,
              args.index as number,
              args.text as string,
              args.enter as boolean
            )
          );
        },
      },
      {
        name: "click_element",
        description: "Click on an element by index",
        parameters: {
          type: "object",
          properties: {
            index: {
              type: "number",
              description: "The index of the element to click",
            },
            num_clicks: {
              type: "number",
              description: "number of times to click the element, default 1",
            },
            button: {
              type: "string",
              description: "Mouse button type, default left",
              enum: ["left", "right", "middle"],
            },
            modifiers: {
              type: "array",
              items: {
                type: "string",
                enum: ["Alt", "Control", "Meta", "Shift"],
              },
              description: "Modifier keys to hold during click",
            },
          },
          required: ["index"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.click_element(
              agentContext,
              args.index as number,
              (args.num_clicks || 1) as number,
              (args.button || "left") as any,
              (args.modifiers || []) as any
            )
          );
        },
      },
      {
        name: "scroll_mouse_wheel",
        description:
          "Scroll the mouse wheel at current position, only scroll when you need to load more content",
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
            extract_page_content: {
              type: "boolean",
              default: false,
              description:
                "After scrolling is completed, whether to extract the current latest page content",
            },
          },
          required: ["amount", "direction", "extract_page_content"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(async () => {
            let amount = args.amount as number;
            await this.scroll_mouse_wheel(
              agentContext,
              args.direction == "up" ? -amount : amount,
              args.extract_page_content == true
            );
          });
        },
      },
      {
        name: "hover_to_element",
        description: "Hover the mouse over an element, use it when you need to hover to display more interactive information",
        parameters: {
          type: "object",
          properties: {
            index: {
              type: "number",
              description: "The index of the element to input text into",
            },
          },
          required: ["index"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.hover_to_element(agentContext, args.index as number)
          );
        },
      },
      {
        name: "extract_page_content",
        description:
          "Extracts all content from the current webpage, including text and image links. Please use this tool when you need to retrieve webpage content.",
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
        name: "get_select_options",
        description:
          "Get all options from a native dropdown element (<select>).",
        parameters: {
          type: "object",
          properties: {
            index: {
              type: "number",
              description: "The index of the element to select",
            },
          },
          required: ["index"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.get_select_options(agentContext, args.index as number)
          );
        },
      },
      {
        name: "select_option",
        description:
          "Select the native dropdown option, Use this after get_select_options and when you need to select an option from a dropdown.",
        parameters: {
          type: "object",
          properties: {
            index: {
              type: "number",
              description: "The index of the element to select",
            },
            option: {
              type: "string",
              description: "Text option",
            },
          },
          required: ["index", "option"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.select_option(
              agentContext,
              args.index as number,
              args.option as string
            )
          );
        },
      },
      {
        name: "get_all_tabs",
        description: "Get all tabs of the current browser, returns the tabId, URL, and title of all tab pages",
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
        description: "Switch to the specified tab (based on tabId)",
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
        description: "Wait/pause execution for a specified duration. Use this tool when you need to wait for data loading, page rendering, or introduce delays between operations.",
        parameters: {
          type: "object",
          properties: {
            duration: {
              type: "number",
              description: "Wait duration in milliseconds",
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
   * Determines whether to take two screenshots.
   * @param agentContext - The context for the agent to run in.
   * @param messages - The messages in the current conversation.
   * @param tools - The available tools.
   * @returns A promise that resolves to whether to take two screenshots.
   */
  protected async double_screenshots(
    agentContext: AgentContext,
    messages: LanguageModelV2Prompt,
    tools: Tool[]
  ): Promise<boolean> {
    return true;
  }

  /**
   * Handles messages in the agent's context, including taking screenshots and extracting pseudo HTML.
   * @param agentContext - The context for the agent to run in.
   * @param messages - The history of messages.
   * @param tools - The tools available to the agent.
   */
  protected async handleMessages(
    agentContext: AgentContext,
    messages: LanguageModelV2Prompt,
    tools: Tool[]
  ): Promise<void> {
    const pseudoHtmlDescription =
      "This is the environmental information after the operation, including the latest browser screenshot and page elements. Please perform the next operation based on the environmental information. Do not output the following elements and index information in your response.\n\nIndex and elements:\n";
    let lastTool = this.lastToolResult(messages);
    if (
      lastTool &&
      lastTool.toolName !== "extract_page_content" &&
      lastTool.toolName !== "get_all_tabs" &&
      lastTool.toolName !== "variable_storage"
    ) {
      await sleep(300);
      let image_contents: LanguageModelV2FilePart[] = [];
      if (await this.double_screenshots(agentContext, messages, tools)) {
        let imageResult = await this.screenshot(agentContext);
        let image = toImage(imageResult.imageBase64);
        image_contents.push({
          type: "file",
          data: image,
          mediaType: imageResult.imageType,
        });
      }
      let result = await this.screenshot_and_html(agentContext);
      let image = toImage(result.imageBase64);
      image_contents.push({
        type: "file",
        data: image,
        mediaType: result.imageType,
      });
      messages.push({
        role: "user",
        content: [
          // ...image_contents,
          {
            type: "text",
            text: pseudoHtmlDescription + "```html\n" + result.pseudoHtml + "\n```",
          },
        ],
      });
    }
    super.handleMessages(agentContext, messages, tools);
    this.handlePseudoHtmlText(messages, pseudoHtmlDescription);
  }

  /**
   * Handles the pseudo HTML text in the messages.
   * @param messages - The messages to handle.
   * @param pseudoHtmlDescription - The description of the pseudo HTML.
   */
  private handlePseudoHtmlText(
    messages: LanguageModelV2Prompt,
    pseudoHtmlDescription: string
  ) {
    for (let i = 0; i < messages.length; i++) {
      let message = messages[i];
      if (message.role !== "user" || message.content.length <= 1) {
        continue;
      }
      let content = message.content;
      for (let j = 0; j < content.length; j++) {
        let _content = content[j];
        if (
          _content.type == "text" &&
          _content.text.startsWith(pseudoHtmlDescription)
        ) {
          if (i >= 2 && i < messages.length - 3) {
            _content.text = this.removePseudoHtmlAttr(_content.text, [
              "class",
              "src",
              "href",
            ]);
          }
        }
      }
      if (
        (content[0] as any).text == "[image]" &&
        (content[1] as any).text == "[image]"
      ) {
        content.splice(0, 1);
      }
    }
  }

  /**
   * Removes attributes from the pseudo HTML.
   * @param pseudoHtml - The pseudo HTML to remove attributes from.
   * @param remove_attrs - The attributes to remove.
   * @returns The pseudo HTML with the attributes removed.
   */
  private removePseudoHtmlAttr(
    pseudoHtml: string,
    remove_attrs: string[]
  ): string {
    return pseudoHtml
      .split("\n")
      .map((line) => {
        if (!line.startsWith("[") || line.indexOf("]:<") == -1) {
          return line;
        }
        line = line.substring(line.indexOf("]:<") + 2);
        for (let i = 0; i < remove_attrs.length; i++) {
          let sIdx = line.indexOf(remove_attrs[i] + '="');
          if (sIdx == -1) {
            continue;
          }
          let eIdx = line.indexOf('"', sIdx + remove_attrs[i].length + 3);
          if (eIdx == -1) {
            continue;
          }
          line = line.substring(0, sIdx) + line.substring(eIdx + 1).trim();
        }
        return line.replace('" >', '">').replace(" >", ">");
      })
      .join("\n");
  }
}

function typing(params: {
  index: number;
  text: string;
  enter: boolean;
}): boolean {
  let { index, text, enter } = params;
  let element = (window as any).get_highlight_element(index);
  if (!element) {
    return false;
  }
  let input: any;
  if (element.tagName == "IFRAME") {
    let iframeDoc = element.contentDocument || element.contentWindow.document;
    input =
      iframeDoc.querySelector("textarea") ||
      iframeDoc.querySelector('*[contenteditable="true"]') ||
      iframeDoc.querySelector("input");
  } else if (
    element.tagName == "INPUT" ||
    element.tagName == "TEXTAREA" ||
    element.childElementCount == 0
  ) {
    input = element;
  } else {
    input = element.querySelector("input") || element.querySelector("textarea");
    if (!input) {
      input = element.querySelector('*[contenteditable="true"]') || element;
      if (input.tagName == "DIV") {
        input =
          input.querySelector("span") || input.querySelector("div") || input;
      }
    }
  }
  input.focus && input.focus();
  if (!text && enter) {
    ["keydown", "keypress", "keyup"].forEach((eventType) => {
      const event = new KeyboardEvent(eventType, {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(event);
    });
    return true;
  }
  if (input.value == undefined) {
    input.textContent = text;
  } else {
    input.value = text;
    if (input.__proto__) {
      let value_setter = Object.getOwnPropertyDescriptor(
        input.__proto__ as any,
        "value"
      )?.set;
      value_setter && value_setter.call(input, text);
    }
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  if (enter) {
    ["keydown", "keypress", "keyup"].forEach((eventType) => {
      const event = new KeyboardEvent(eventType, {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(event);
    });
  }
  return true;
}

function do_click(params: {
  index: number;
  button: "left" | "right" | "middle";
  num_clicks: number;
  modifiers?: string[];
}): boolean {
  let { index, button, num_clicks, modifiers } = params;
  const modifierOptions = {
    ctrlKey: modifiers?.includes("Control") || false,
    shiftKey: modifiers?.includes("Shift") || false,
    altKey: modifiers?.includes("Alt") || false,
    metaKey: modifiers?.includes("Meta") || false,
  };
  function simulateMouseEvent(
    eventTypes: Array<string>,
    button: 0 | 1 | 2
  ): boolean {
    let element = (window as any).get_highlight_element(index);
    if (!element) {
      return false;
    }
    for (let n = 0; n < num_clicks; n++) {
      for (let i = 0; i < eventTypes.length; i++) {
        const eventType = eventTypes[i];

        const event = new MouseEvent(eventType, {
          view: window,
          bubbles: true,
          cancelable: true,
          button, // 0 left; 1 middle; 2 right
          ...modifierOptions,
        });

        element.dispatchEvent(event);

        element.focus?.();
      }
    }
    return true;
  }
  if (button == "right") {
    return simulateMouseEvent(["mousedown", "mouseup", "contextmenu"], 2);
  } else if (button == "middle") {
    return simulateMouseEvent(["mousedown", "mouseup", "click"], 1);
  } else {
    return simulateMouseEvent(["mousedown", "mouseup", "click"], 0);
  }
}

function hover_to(params: { index: number }): boolean {
  let element = (window as any).get_highlight_element(params.index);
  if (!element) {
    return false;
  }
  const event = new MouseEvent("mouseenter", {
    bubbles: true,
    cancelable: true,
    view: window,
  });
  element.dispatchEvent(event);
  return true;
}

function get_select_options(params: { index: number }) {
  let element = (window as any).get_highlight_element(params.index);
  if (!element || element.tagName.toUpperCase() !== "SELECT") {
    return "Error: Not a select element";
  }
  return {
    options: Array.from(element.options).map((opt: any) => ({
      index: opt.index,
      text: opt.text.trim(),
      value: opt.value,
    })),
    name: element.name,
  };
}

function select_option(params: { index: number; option: string }) {
  let element = (window as any).get_highlight_element(params.index);
  if (!element || element.tagName.toUpperCase() !== "SELECT") {
    return "Error: Not a select element";
  }
  let text = params.option.trim();
  let option = Array.from(element.options).find(
    (opt: any) => opt.text.trim() === text
  ) as any;
  if (!option) {
    option = Array.from(element.options).find(
      (opt: any) => opt.value.trim() === text
    ) as any;
  }
  if (!option) {
    return {
      success: false,
      error: "Select Option not found",
      availableOptions: Array.from(element.options).map((o: any) =>
        o.text.trim()
      ),
    };
  }
  element.value = option.value;
  element.dispatchEvent(new Event("change"));
  return {
    success: true,
    selectedValue: option.value,
    selectedText: option.text.trim(),
  };
}

function scroll_by(params: { amount: number }) {
  const amount = params.amount;
  const documentElement = document.documentElement || document.body;
  if (documentElement.scrollHeight > window.innerHeight * 1.2) {
    const y = Math.max(
      20,
      Math.min((window.innerHeight || documentElement.clientHeight) / 10, 200)
    );
    window.scrollBy(0, y * amount);
    return;
  }

  function findNodes(element = document, nodes: any = []): Element[] {
    for (const node of Array.from(element.querySelectorAll("*"))) {
      if (node.tagName === "IFRAME" && (node as any).contentDocument) {
        findNodes((node as any).contentDocument, nodes);
      } else {
        nodes.push(node);
      }
    }
    return nodes;
  }

  function findScrollableElements(): Element[] {
    const allElements = findNodes();
    let elements = allElements.filter((el) => {
      const style = window.getComputedStyle(el);
      const overflowY = style.getPropertyValue("overflow-y");
      return (
        (overflowY === "auto" || overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight
      );
    });
    if (elements.length == 0) {
      elements = allElements.filter((el) => {
        const style = window.getComputedStyle(el);
        const overflowY = style.getPropertyValue("overflow-y");
        return (
          overflowY === "auto" ||
          overflowY === "scroll" ||
          el.scrollHeight > el.clientHeight
        );
      });
    }
    return elements;
  }

  function getVisibleArea(element: Element) {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || documentElement.clientHeight;
    const viewportWidth = window.innerWidth || documentElement.clientWidth;
    const visibleLeft = Math.max(0, Math.min(rect.left, viewportWidth));
    const visibleRight = Math.max(0, Math.min(rect.right, viewportWidth));
    const visibleTop = Math.max(0, Math.min(rect.top, viewportHeight));
    const visibleBottom = Math.max(0, Math.min(rect.bottom, viewportHeight));
    const visibleWidth = visibleRight - visibleLeft;
    const visibleHeight = visibleBottom - visibleTop;
    return visibleWidth * visibleHeight;
  }

  function getComputedZIndex(element: Element | null) {
    while (
      element &&
      element !== document.body &&
      element !== document.body.parentElement
    ) {
      const style = window.getComputedStyle(element);
      let zIndex = style.zIndex === "auto" ? 0 : parseInt(style.zIndex) || 0;
      if (zIndex > 0) {
        return zIndex;
      }
      element = element.parentElement;
    }
    return 0;
  }

  const scrollableElements = findScrollableElements();
  if (scrollableElements.length === 0) {
    const y = Math.max(
      20,
      Math.min((window.innerHeight || documentElement.clientHeight) / 10, 200)
    );
    window.scrollBy(0, y * amount);
    return false;
  }
  const sortedElements = scrollableElements.sort((a, b) => {
    let z = getComputedZIndex(b) - getComputedZIndex(a);
    if (z > 0) {
      return 1;
    } else if (z < 0) {
      return -1;
    }
    let v = getVisibleArea(b) - getVisibleArea(a);
    if (v > 0) {
      return 1;
    } else if (v < 0) {
      return -1;
    }
    return 0;
  });
  const largestElement = sortedElements[0];
  const viewportHeight = largestElement.clientHeight;
  const y = Math.max(20, Math.min(viewportHeight / 10, 200));
  largestElement.scrollBy(0, y * amount);
  const maxHeightElement = sortedElements.sort(
    (a, b) =>
      b.getBoundingClientRect().height - a.getBoundingClientRect().height
  )[0];
  if (maxHeightElement != largestElement) {
    const viewportHeight = maxHeightElement.clientHeight;
    const y = Math.max(20, Math.min(viewportHeight / 10, 200));
    maxHeightElement.scrollBy(0, y * amount);
  }
  return true;
}

export { BaseBrowserLabelsAgent };
