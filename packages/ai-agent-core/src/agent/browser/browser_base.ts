import {
  LanguageModelV2Prompt,
  LanguageModelV2ToolCallPart,
} from "@ai-sdk/provider";
import { Agent } from "../base";
import { sleep } from "../../common/utils";
import { AgentContext } from "../../core/context";
import { ToolExecuter, ToolResult, IMcpClient } from "../../types";
import * as utils from "./utils";

export const AGENT_NAME = "Browser";

/**
 * An agent that can interact with a web browser.
 */
export default abstract class BaseBrowserAgent extends Agent {
  /**
   * Takes a screenshot of the current browser window.
   * @param agentContext - The context for the agent to run in.
   * @returns A promise that resolves to the screenshot image.
   */
  protected abstract screenshot(agentContext: AgentContext): Promise<{
    imageBase64: string;
    imageType: "image/jpeg" | "image/png";
  }>;

  /**
   * Navigates to a new URL.
   * @param agentContext - The context for the agent to run in.
   * @param url - The URL to navigate to.
   * @returns A promise that resolves to the new URL and title.
   */
  protected abstract navigate_to(
    agentContext: AgentContext,
    url: string
  ): Promise<{
    url: string;
    title?: string;
  }>;

  /**
   * Gets a list of all open tabs.
   * @param agentContext - The context for the agent to run in.
   * @returns A promise that resolves to a list of tabs.
   */
  protected abstract get_all_tabs(agentContext: AgentContext): Promise<
    Array<{
      tabId: number;
      url: string;
      title: string;
    }>
  >;

  /**
   * Switches to a specific tab.
   * @param agentContext - The context for the agent to run in.
   * @param tabId - The ID of the tab to switch to.
   * @returns A promise that resolves to the new tab information.
   */
  protected abstract switch_tab(
    agentContext: AgentContext,
    tabId: number
  ): Promise<{
    tabId: number;
    url: string;
    title: string;
  }>;

  /**
   * Navigates to the previous page in the browser's history.
   * @param agentContext - The context for the agent to run in.
   */
  protected async go_back(agentContext: AgentContext): Promise<void> {
    try {
      await this.execute_script(
        agentContext,
        () => {
          (window as any).navigation.back();
        },
        []
      );
      await sleep(100);
    } catch (e) {}
  }

  /**
   * Extracts the content of the current page.
   * @param agentContext - The context for the agent to run in.
   * @param variable_name - The name of the variable to store the page content in.
   * @returns A promise that resolves to the page content.
   */
  protected async extract_page_content(
    agentContext: AgentContext,
    variable_name?: string
  ): Promise<{
    title: string;
    page_url: string;
    page_content: string;
  }> {
    let content = await this.execute_script(
      agentContext,
      utils.extract_page_content,
      []
    );
    let pageInfo = await this.get_current_page(agentContext);
    let result = `title: ${pageInfo.title}\npage_url: ${pageInfo.url}\npage_content: \n${content}`;
    if (variable_name) {
      agentContext.context.variables.set(variable_name, result);
    }
    return {
      title: pageInfo.title || "",
      page_url: pageInfo.url,
      page_content: content,
    };
  }

  /**
   * Controls the MCP tools for the browser agent.
   * @param agentContext - The context for the agent to run in.
   * @param messages - The messages in the current conversation.
   * @param loopNum - The current loop number.
   * @returns A promise that resolves to the MCP tool control result.
   */
  protected async controlMcpTools(
    agentContext: AgentContext,
    messages: LanguageModelV2Prompt,
    loopNum: number
  ): Promise<{ mcpTools: boolean; mcpParams?: Record<string, unknown> }> {
    if (loopNum > 0) {
      let url = null;
      try {
        url = (await this.get_current_page(agentContext)).url;
      } catch (e) {}
      let lastUrl = agentContext.variables.get("lastUrl");
      agentContext.variables.set("lastUrl", url);
      return {
        mcpTools: loopNum == 0 || url != lastUrl,
        mcpParams: {
          environment: "browser",
          browser_url: url,
        },
      };
    } else {
      return {
        mcpTools: true,
        mcpParams: {
          environment: "browser",
        },
      };
    }
  }

  /**
   * Creates a tool executer for the MCP client.
   * @param mcpClient - The MCP client to use.
   * @param name - The name of the tool.
   * @returns The tool executer.
   */
  protected toolExecuter(mcpClient: IMcpClient, name: string): ToolExecuter {
    return {
      execute: async (args, agentContext): Promise<ToolResult> => {
        let result = await mcpClient.callTool({
          name: name,
          arguments: args,
          extInfo: {
            taskId: agentContext.context.taskId,
            nodeId: agentContext.agentChain.agent.id,
            environment: "browser",
            agent_name: agentContext.agent.Name,
            browser_url: agentContext.variables.get("lastUrl"),
          },
        }, agentContext.context.controller.signal);
        if (
          result.extInfo &&
          result.extInfo["javascript"] &&
          result.content[0].type == "text"
        ) {
          let script = result.content[0].text;
          let params = JSON.stringify(args);
          let runScript = `${script};execute(${params})`;
          let scriptResult = await this.execute_mcp_script(
            agentContext,
            runScript
          );
          let resultText;
          if (
            typeof scriptResult == "string" ||
            typeof scriptResult == "number"
          ) {
            resultText = scriptResult + "";
          } else {
            resultText = scriptResult
              ? JSON.stringify(scriptResult)
              : "Successful";
          }
          return {
            content: [
              {
                type: "text",
                text: resultText,
              },
            ],
          };
        }
        return result;
      },
    };
  }

  /**
   * Gets the current page URL, title, and tab ID.
   * @param agentContext - The context for the agent to run in.
   * @returns A promise that resolves to the current page information.
   */
  protected async get_current_page(agentContext: AgentContext): Promise<{
    url: string;
    title?: string;
    tabId?: number;
  }> {
    return await this.execute_script(
      agentContext,
      () => {
        return {
          url: (window as any).location.href,
          title: (window as any).document.title,
        };
      },
      []
    );
  }

  /**
   * Gets the result of the last tool call.
   * @param messages - The messages in the current conversation.
   * @returns The result of the last tool call, or null if there was no last tool call.
   */
  protected lastToolResult(messages: LanguageModelV2Prompt): {
    id: string;
    toolName: string;
    args: unknown;
    result: unknown;
  } | null {
    let lastMessage = messages[messages.length - 1];
    if (lastMessage.role != "tool") {
      return null;
    }
    let toolResult = lastMessage.content.filter(
      (t) => t.type == "tool-result"
    )[0];
    if (!toolResult) {
      return null;
    }
    let result = toolResult.output.value;
    for (let i = messages.length - 2; i > 0; i--) {
      if (
        messages[i].role !== "assistant" ||
        typeof messages[i].content == "string"
      ) {
        continue;
      }
      for (let j = 0; j < messages[i].content.length; j++) {
        let content = messages[i].content[j];
        if (typeof content !== "string" && content.type !== "tool-call") {
          continue;
        }
        let toolUse = content as LanguageModelV2ToolCallPart;
        if (toolResult.toolCallId != toolUse.toolCallId) {
          continue;
        }
        return {
          id: toolResult.toolCallId,
          toolName: toolUse.toolName,
          args: toolUse.input,
          result,
        };
      }
    }
    return null;
  }

  /**
   * Gets the names of the tools used in the conversation.
   * @param messages - The messages in the current conversation.
   * @returns A list of the names of the tools used.
   */
  protected toolUseNames(messages?: LanguageModelV2Prompt): string[] {
    let toolNames: string[] = [];
    if (!messages) {
      return toolNames;
    }
    for (let i = 0; i < messages.length; i++) {
      let message = messages[i];
      if (message.role == "tool") {
        toolNames.push(message.content[0].toolName);
      }
    }
    return toolNames;
  }

  /**
   * Executes a script in the browser.
   * @param agentContext - The context for the agent to run in.
   * @param func - The function to execute.
   * @param args - The arguments to pass to the function.
   * @returns A promise that resolves to the result of the script.
   */
  protected abstract execute_script(
    agentContext: AgentContext,
    func: (...args: any[]) => void,
    args: any[]
  ): Promise<any>;

  /**
   * Executes an MCP script in the browser.
   * @param agentContext - The context for the agent to run in.
   * @param script - The script to execute.
   * @returns A promise that resolves to the result of the script.
   */
  protected async execute_mcp_script(
    agentContext: AgentContext,
    script: string
  ): Promise<string | number | Record<string, any> | undefined> {
    return;
  }
}

export { BaseBrowserAgent };
