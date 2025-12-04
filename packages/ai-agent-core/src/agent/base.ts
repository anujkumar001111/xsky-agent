import config from "../config";
import Log from "../common/log";
import * as memory from "../memory";
import { RetryLanguageModel } from "../llm";
import { mergeTools } from "../common/utils";
import { ToolWrapper } from "../tools/wrapper";
import { AgentChain, ToolChain } from "../core/chain";
import Context, { AgentContext } from "../core/context";
import {
  McpTool,
  ForeachTaskTool,
  WatchTriggerTool,
  VariableStorageTool,
  HumanInteractTool,
} from "../tools";
import {
  Tool,
  IMcpClient,
  LLMRequest,
  ToolResult,
  ToolSchema,
  ToolExecuter,
  WorkflowAgent,
  HumanCallback,
  StreamCallback,
  ToolHookResult,
} from "../types";
import type { ApprovalRequest } from "../types/hooks.types";
import {
  LanguageModelV2Prompt,
  LanguageModelV2FilePart,
  LanguageModelV2TextPart,
  LanguageModelV2ToolCallPart,
  LanguageModelV2ToolResultPart,
} from "@ai-sdk/provider";
import {
  getTool,
  convertTools,
  callAgentLLM,
  convertToolResult,
  defaultMessageProviderOptions,
} from "./llm";
import { doTaskResultCheck } from "../tools/task_result_check";
import { doTodoListManager } from "../tools/todo_list_manager";
import { getAgentSystemPrompt, getAgentUserPrompt } from "../prompt/agent";

export type AgentParams = {
  name: string;
  description: string;
  tools: Tool[];
  llms?: string[];
  mcpClient?: IMcpClient;
  planDescription?: string;
  requestHandler?: (request: LLMRequest) => void;
};

/**
 * Represents an AI agent that can run tasks, interact with tools, and communicate with language models.
 */
export class Agent {
  protected name: string;
  protected description: string;
  protected tools: Tool[] = [];
  protected llms?: string[];
  protected mcpClient?: IMcpClient;
  protected planDescription?: string;
  protected requestHandler?: (request: LLMRequest) => void;
  protected callback?: StreamCallback & HumanCallback;
  protected agentContext?: AgentContext;

  /**
   * Creates an instance of the Agent.
   * @param params - The parameters for creating the agent.
   */
  constructor(params: AgentParams) {
    this.name = params.name;
    this.description = params.description;
    this.tools = params.tools;
    this.llms = params.llms;
    this.mcpClient = params.mcpClient;
    this.planDescription = params.planDescription;
    this.requestHandler = params.requestHandler;
  }

  /**
   * Runs the agent with the given context and agent chain.
   * @param context - The context for the agent to run in.
   * @param agentChain - The agent chain to run.
   * @returns A promise that resolves to the result of the agent's run.
   */
  public async run(context: Context, agentChain: AgentChain): Promise<string> {
    const mcpClient = this.mcpClient || context.config.defaultMcpClient;
    const agentContext = new AgentContext(context, this, agentChain);
    const hooks = context.config.hooks;

    try {
      this.agentContext = agentContext;

      // ============ BEFORE AGENT START HOOK ============
      // Called here because AgentContext is now available
      if (hooks?.beforeAgentStart) {
        try {
          const hookResult = await hooks.beforeAgentStart(agentContext);
          if (hookResult?.block) {
            const reason = hookResult.reason || "Agent blocked by beforeAgentStart hook";
            Log.warn(`Agent ${this.name} blocked: ${reason}`);
            throw new Error(reason);
          }
        } catch (hookError: any) {
          if (hookError.message?.includes("blocked by")) {
            throw hookError;
          }
          Log.error("beforeAgentStart hook error:", hookError);
          // Continue if hook fails (non-blocking)
        }
      }

      mcpClient &&
        !mcpClient.isConnected() &&
        (await mcpClient.connect(context.controller.signal));
      return await this.runWithContext(
        agentContext,
        mcpClient,
        config.maxReactNum
      );
    } finally {
      mcpClient && (await mcpClient.close());
    }
  }

  /**
   * Runs the agent with the given context and optional MCP client.
   * @param agentContext - The context for the agent to run in.
   * @param mcpClient - The MCP client to use.
   * @param maxReactNum - The maximum number of reactions to perform.
   * @param historyMessages - The history of messages to start with.
   * @returns A promise that resolves to the result of the agent's run.
   */
  public async runWithContext(
    agentContext: AgentContext,
    mcpClient?: IMcpClient,
    maxReactNum: number = 100,
    historyMessages: LanguageModelV2Prompt = []
  ): Promise<string> {
    let loopNum = 0;
    let checkNum = 0;
    this.agentContext = agentContext;
    const context = agentContext.context;
    const agentNode = agentContext.agentChain.agent;
    const tools = [...this.tools, ...this.system_auto_tools(agentNode)];
    const systemPrompt = await this.buildSystemPrompt(agentContext, tools);
    const userPrompt = await this.buildUserPrompt(agentContext, tools);
    const messages: LanguageModelV2Prompt = [
      {
        role: "system",
        content: systemPrompt,
        providerOptions: defaultMessageProviderOptions(),
      },
      ...historyMessages,
      {
        role: "user",
        content: userPrompt,
        providerOptions: defaultMessageProviderOptions(),
      },
    ];
    agentContext.messages = messages;
    const rlm = new RetryLanguageModel(context.config.llms, this.llms);
    rlm.setContext(agentContext);
    let agentTools = tools;
    while (loopNum < maxReactNum) {
      await context.checkAborted();
      if (mcpClient) {
        const controlMcp = await this.controlMcpTools(
          agentContext,
          messages,
          loopNum
        );
        if (controlMcp.mcpTools) {
          const mcpTools = await this.listTools(
            context,
            mcpClient,
            agentNode,
            controlMcp.mcpParams
          );
          const usedTools = memory.extractUsedTool(messages, agentTools);
          const _agentTools = mergeTools(tools, usedTools);
          agentTools = mergeTools(_agentTools, mcpTools);
        }
      }
      await this.handleMessages(agentContext, messages, tools);
      const llm_tools = convertTools(agentTools);
      const results = await callAgentLLM(
        agentContext,
        rlm,
        messages,
        llm_tools,
        false,
        undefined,
        0,
        this.callback,
        this.requestHandler
      );
      const forceStop = agentContext.variables.get("forceStop");
      if (forceStop) {
        return forceStop;
      }
      const finalResult = await this.handleCallResult(
        agentContext,
        messages,
        agentTools,
        results
      );
      loopNum++;
      if (!finalResult) {
        if (config.expertMode && loopNum % config.expertModeTodoLoopNum == 0) {
          await doTodoListManager(agentContext, rlm, messages, llm_tools);
        }
        continue;
      }
      if (config.expertMode && checkNum == 0) {
        checkNum++;
        const { completionStatus } = await doTaskResultCheck(
          agentContext,
          rlm,
          messages,
          llm_tools
        );
        if (completionStatus == "incomplete") {
          continue;
        }
      }
      return finalResult;
    }
    return "Unfinished";
  }

  /**
   * Handles the result of a language model call, processing tool calls and text responses.
   * @param agentContext - The context for the agent to run in.
   * @param messages - The history of messages.
   * @param agentTools - The tools available to the agent.
   * @param results - The results from the language model call.
   * @returns A promise that resolves to the final result of the agent's run, or null if the run should continue.
   */
  protected async handleCallResult(
    agentContext: AgentContext,
    messages: LanguageModelV2Prompt,
    agentTools: Tool[],
    results: Array<LanguageModelV2TextPart | LanguageModelV2ToolCallPart>
  ): Promise<string | null> {
    const user_messages: LanguageModelV2Prompt = [];
    const toolResults: LanguageModelV2ToolResultPart[] = [];
    // results = memory.removeDuplicateToolUse(results);
    messages.push({
      role: "assistant",
      content: results,
    });
    if (results.length == 0) {
      return null;
    }
    if (results.every((s) => s.type == "text")) {
      return results.map((s) => s.text).join("\n\n");
    }
    const toolCalls = results.filter((s) => s.type == "tool-call");
    if (
      toolCalls.length > 1 &&
      this.canParallelToolCalls(toolCalls) &&
      toolCalls.every(
        (s) => agentTools.find((t) => t.name == s.toolName)?.supportParallelCalls
      )
    ) {
      const results = await Promise.all(
        toolCalls.map((toolCall) =>
          this.callToolCall(agentContext, agentTools, toolCall, user_messages)
        )
      );
      for (let i = 0; i < results.length; i++) {
        toolResults.push(results[i]);
      }
    } else {
      for (let i = 0; i < toolCalls.length; i++) {
        const toolCall = toolCalls[i];
        const toolResult = await this.callToolCall(
          agentContext,
          agentTools,
          toolCall,
          user_messages
        );
        toolResults.push(toolResult);
      }
    }
    if (toolResults.length > 0) {
      messages.push({
        role: "tool",
        content: toolResults,
      });
      user_messages.forEach((message) => messages.push(message));
      return null;
    } else {
      return results
        .filter((s) => s.type == "text")
        .map((s) => s.text)
        .join("\n\n");
    }
  }

  /**
   * Calls a tool with the given arguments and context.
   * Supports beforeToolCall and afterToolCall hooks for production-ready control.
   * @param agentContext - The context for the agent to run in.
   * @param agentTools - The tools available to the agent.
   * @param result - The tool call to execute.
   * @param user_messages - The user messages to append to.
   * @param retryCount - Internal retry counter to prevent infinite loops.
   * @returns A promise that resolves to the result of the tool call.
   */
  protected async callToolCall(
    agentContext: AgentContext,
    agentTools: Tool[],
    result: LanguageModelV2ToolCallPart,
    user_messages: LanguageModelV2Prompt = [],
    retryCount: number = 0
  ): Promise<LanguageModelV2ToolResultPart> {
    const MAX_TOOL_RETRIES = 3;
    const context = agentContext.context;
    const hooks = context.config.hooks;
    const toolChain = new ToolChain(
      result,
      agentContext.agentChain.agentRequest as LLMRequest
    );
    agentContext.agentChain.push(toolChain);

    let args =
      typeof result.input == "string"
        ? JSON.parse(result.input || "{}")
        : result.input || {};
    toolChain.params = args;

    // ============ BEFORE TOOL CALL HOOK ============
    if (hooks?.beforeToolCall) {
      try {
        const hookResult: ToolHookResult = await hooks.beforeToolCall(
          agentContext,
          result.toolName,
          args
        );

        // Handle hook result
        if (!hookResult.allow) {
          // Tool call blocked by hook
          const blockReason = hookResult.reason || "Tool call blocked by beforeToolCall hook";
          Log.warn(`Tool ${result.toolName} blocked: ${blockReason}`);

          if (hookResult.escalate) {
            // ============ ON APPROVAL REQUIRED HOOK ============
            if (hooks?.onApprovalRequired) {
              try {
                const approvalRequest: ApprovalRequest = {
                  type: "tool_execution",
                  description: `Approve execution of tool "${result.toolName}"?`,
                  context: {
                    toolName: result.toolName,
                    args,
                    reason: blockReason,
                  },
                };

                const approval = await hooks.onApprovalRequired(agentContext, approvalRequest);

                if (approval.approved) {
                  // Approval granted - continue with tool execution
                  Log.info(`Tool ${result.toolName} approved by ${approval.approver || "user"}`);
                  // Fall through to execute the tool
                } else {
                  // Approval denied
                  const deniedResult: ToolResult = {
                    content: [
                      {
                        type: "text",
                        text: `Action rejected: ${approval.feedback || blockReason}`,
                      },
                    ],
                    isError: false,
                  };
                  toolChain.updateToolResult(deniedResult);
                  return convertToolResult(result, deniedResult, user_messages);
                }
              } catch (approvalError) {
                Log.error("onApprovalRequired hook error:", approvalError);
                // Fall through to default escalate behavior
              }
            } else {
              // No approval hook - use default escalate behavior
              const escalateResult: ToolResult = {
                content: [
                  {
                    type: "text",
                    text: `Action requires human approval: ${blockReason}. Please request human assistance.`,
                  },
                ],
                isError: false,
              };
              toolChain.updateToolResult(escalateResult);
              return convertToolResult(result, escalateResult, user_messages);
            }
          } else if (hookResult.skip) {
            // Skip without error (for batch/scraping scenarios)
            const skipResult: ToolResult = {
              content: [
                {
                  type: "text",
                  text: `Skipped: ${blockReason}`,
                },
              ],
              isError: false,
            };
            toolChain.updateToolResult(skipResult);
            return convertToolResult(result, skipResult, user_messages);
          }

          // Return as error to LLM
          const blockedResult: ToolResult = {
            content: [
              {
                type: "text",
                text: `Blocked: ${blockReason}`,
              },
            ],
            isError: true,
          };
          toolChain.updateToolResult(blockedResult);
          return convertToolResult(result, blockedResult, user_messages);
        }

        // Apply modified args if provided
        if (hookResult.modifiedArgs) {
          args = hookResult.modifiedArgs;
          toolChain.params = args;
        }
      } catch (hookError) {
        Log.error("beforeToolCall hook error:", hookError);
        // Continue with original args if hook fails
      }
    }

    let toolResult: ToolResult;
    try {
      let tool = getTool(agentTools, result.toolName);
      if (!tool) {
        throw new Error(result.toolName + " tool does not exist");
      }
      toolResult = await tool.execute(args, agentContext, result);
      toolChain.updateToolResult(toolResult);
      agentContext.consecutiveErrorNum = 0;

      // ============ AFTER TOOL CALL HOOK (SUCCESS) ============
      if (hooks?.afterToolCall) {
        try {
          await hooks.afterToolCall(agentContext, result.toolName, args, toolResult);
        } catch (afterHookError) {
          Log.error("afterToolCall hook error:", afterHookError);
          // Don't fail the tool call if hook fails
        }
      }
    } catch (e: any) {
      Log.error("tool call error: ", result.toolName, result.input, e);

      // ============ ON TOOL ERROR HOOK ============
      if (hooks?.onToolError) {
        try {
          const errorAction = await hooks.onToolError(
            agentContext,
            result.toolName,
            e,
            args
          );

          switch (errorAction) {
            case "retry":
              // Retry the tool call with retry limit
              if (retryCount < MAX_TOOL_RETRIES) {
                Log.info(`Retrying tool ${result.toolName} after error (attempt ${retryCount + 1}/${MAX_TOOL_RETRIES})`);
                return this.callToolCall(agentContext, agentTools, result, user_messages, retryCount + 1);
              } else {
                Log.warn(`Max retries (${MAX_TOOL_RETRIES}) reached for tool ${result.toolName}, falling through to error`);
                // Fall through to default error handling
                toolResult = {
                  content: [
                    {
                      type: "text",
                      text: `Error after ${MAX_TOOL_RETRIES} retries: ${e.message}`,
                    },
                  ],
                  isError: true,
                };
                toolChain.updateToolResult(toolResult);
              }
              break;

            case "skip":
              // Skip without error
              toolResult = {
                content: [
                  {
                    type: "text",
                    text: `Skipped due to error: ${e.message}`,
                  },
                ],
                isError: false,
              };
              toolChain.updateToolResult(toolResult);
              break;

            case "abort":
              // Re-throw to abort the task
              throw e;

            case "escalate":
              // Escalate to human
              toolResult = {
                content: [
                  {
                    type: "text",
                    text: `Error requires human assistance: ${e.message}. Please use human_interact tool to request help.`,
                  },
                ],
                isError: true,
              };
              toolChain.updateToolResult(toolResult);
              break;

            case "continue":
            default:
              // Standard error handling
              toolResult = {
                content: [
                  {
                    type: "text",
                    text: e + "",
                  },
                ],
                isError: true,
              };
              toolChain.updateToolResult(toolResult);
              break;
          }
        } catch (errorHookError) {
          Log.error("onToolError hook failed:", errorHookError);
          // Fall back to standard error handling
          toolResult = {
            content: [
              {
                type: "text",
                text: e + "",
              },
            ],
            isError: true,
          };
          toolChain.updateToolResult(toolResult);
        }
      } else {
        // No error hook, standard error handling
        toolResult = {
          content: [
            {
              type: "text",
              text: e + "",
            },
          ],
          isError: true,
        };
        toolChain.updateToolResult(toolResult);
      }

      if (++agentContext.consecutiveErrorNum >= 10) {
        throw e;
      }
    }

    const callback = this.callback || context.config.callback;
    if (callback) {
      await callback.onMessage(
        {
          taskId: context.taskId,
          agentName: agentContext.agent.Name,
          nodeId: agentContext.agentChain.agent.id,
          type: "tool_result",
          toolId: result.toolCallId,
          toolName: result.toolName,
          params: result.input || {},
          toolResult: toolResult,
        },
        agentContext
      );
    }
    return convertToolResult(result, toolResult, user_messages);
  }

  /**
   * Returns a list of system tools that are automatically added to the agent.
   * @param agentNode - The workflow agent node.
   * @returns A list of system tools.
   */
  protected system_auto_tools(agentNode: WorkflowAgent): Tool[] {
    let tools: Tool[] = [];
    let agentNodeXml = agentNode.xml;
    let hasVariable =
      agentNodeXml.indexOf("input=") > -1 ||
      agentNodeXml.indexOf("output=") > -1;
    if (hasVariable) {
      tools.push(new VariableStorageTool());
    }
    let hasForeach = agentNodeXml.indexOf("</forEach>") > -1;
    if (hasForeach) {
      tools.push(new ForeachTaskTool());
    }
    let hasWatch = agentNodeXml.indexOf("</watch>") > -1;
    if (hasWatch) {
      tools.push(new WatchTriggerTool());
    }
    tools.push(new HumanInteractTool());
    let toolNames = this.tools.map((tool) => tool.name);
    return tools.filter((tool) => toolNames.indexOf(tool.name) == -1);
  }

  /**
   * Builds the system prompt for the agent.
   * @param agentContext - The context for the agent to run in.
   * @param tools - The tools available to the agent.
   * @returns A promise that resolves to the system prompt.
   */
  protected async buildSystemPrompt(
    agentContext: AgentContext,
    tools: Tool[]
  ): Promise<string> {
    return getAgentSystemPrompt(
      this,
      agentContext.agentChain.agent,
      agentContext.context,
      tools,
      await this.extSysPrompt(agentContext, tools)
    );
  }

  /**
   * Builds the user prompt for the agent.
   * @param agentContext - The context for the agent to run in.
   * @param tools - The tools available to the agent.
   * @returns A promise that resolves to the user prompt.
   */
  protected async buildUserPrompt(
    agentContext: AgentContext,
    tools: Tool[]
  ): Promise<Array<LanguageModelV2TextPart | LanguageModelV2FilePart>> {
    return [
      {
        type: "text",
        text: getAgentUserPrompt(
          this,
          agentContext.agentChain.agent,
          agentContext.context,
          tools
        ),
      },
    ];
  }

  /**
   * Returns an extended system prompt for the agent.
   * @param agentContext - The context for the agent to run in.
   * @param tools - The tools available to the agent.
   * @returns A promise that resolves to the extended system prompt.
   */
  protected async extSysPrompt(
    agentContext: AgentContext,
    tools: Tool[]
  ): Promise<string> {
    return "";
  }

  private async listTools(
    context: Context,
    mcpClient: IMcpClient,
    agentNode?: WorkflowAgent,
    mcpParams?: Record<string, unknown>
  ): Promise<Tool[]> {
    try {
      if (!mcpClient.isConnected()) {
        await mcpClient.connect(context.controller.signal);
      }
      let list = await mcpClient.listTools(
        {
          taskId: context.taskId,
          nodeId: agentNode?.id,
          environment: config.platform,
          agent_name: agentNode?.name || this.name,
          params: {},
          prompt: agentNode?.task || context.chain.taskPrompt,
          ...(mcpParams || {}),
        },
        context.controller.signal
      );
      let mcpTools: Tool[] = [];
      for (let i = 0; i < list.length; i++) {
        let toolSchema: ToolSchema = list[i];
        let execute = this.toolExecuter(mcpClient, toolSchema.name);
        let toolWrapper = new ToolWrapper(toolSchema, execute);
        mcpTools.push(new McpTool(toolWrapper));
      }
      return mcpTools;
    } catch (e) {
      Log.error("Mcp listTools error", e);
      return [];
    }
  }

  /**
   * Controls the MCP tools.
   * @param agentContext - The context for the agent to run in.
   * @param messages - The history of messages.
   * @param loopNum - The current loop number.
   * @returns A promise that resolves to an object indicating whether to use MCP tools and any additional parameters.
   */
  protected async controlMcpTools(
    agentContext: AgentContext,
    messages: LanguageModelV2Prompt,
    loopNum: number
  ): Promise<{
    mcpTools: boolean;
    mcpParams?: Record<string, unknown>;
  }> {
    return {
      mcpTools: loopNum == 0,
    };
  }

  /**
   * Returns a tool executer for the given MCP client and tool name.
   * @param mcpClient - The MCP client to use.
   * @param name - The name of the tool.
   * @returns A tool executer.
   */
  protected toolExecuter(mcpClient: IMcpClient, name: string): ToolExecuter {
    return {
      execute: async function (args, agentContext): Promise<ToolResult> {
        return await mcpClient.callTool(
          {
            name: name,
            arguments: args,
            extInfo: {
              taskId: agentContext.context.taskId,
              nodeId: agentContext.agentChain.agent.id,
              environment: config.platform,
              agent_name: agentContext.agent.Name,
            },
          },
          agentContext.context.controller.signal
        );
      },
    };
  }

  /**
   * Handles the messages in the agent's context, including memory management.
   * @param agentContext - The context for the agent to run in.
   * @param messages - The history of messages.
   * @param tools - The tools available to the agent.
   */
  protected async handleMessages(
    agentContext: AgentContext,
    messages: LanguageModelV2Prompt,
    tools: Tool[]
  ): Promise<void> {
    // Only keep the last image / file, large tool-text-result
    memory.handleLargeContextMessages(messages);
  }

  /**
   * Calls an inner tool and returns the result as a ToolResult.
   * @param fun - The function to call.
   * @returns A promise that resolves to the tool result.
   */
  protected async callInnerTool(fun: () => Promise<any>): Promise<ToolResult> {
    let result = await fun();
    return {
      content: [
        {
          type: "text",
          text: result
            ? typeof result == "string"
              ? result
              : JSON.stringify(result)
            : "Successful",
        },
      ],
    };
  }

  /**
   * Loads the tools for the agent.
   * @param context - The context for the agent to run in.
   * @returns A promise that resolves to a list of tools.
   */
  public async loadTools(context: Context): Promise<Tool[]> {
    if (this.mcpClient) {
      let mcpTools = await this.listTools(context, this.mcpClient);
      if (mcpTools && mcpTools.length > 0) {
        return mergeTools(this.tools, mcpTools);
      }
    }
    return this.tools;
  }

  /**
   * Adds a tool to the agent.
   * @param tool - The tool to add.
   */
  public addTool(tool: Tool) {
    this.tools.push(tool);
  }

  /**
   * Handles the task status changes.
   * @param status - The new status of the task.
   * @param reason - The reason for the status change.
   */
  protected async onTaskStatus(
    status: "pause" | "abort" | "resume-pause",
    reason?: string
  ) {
    if (status == "abort" && this.agentContext) {
      this.agentContext?.variables.clear();
    }
  }

  /**
   * Returns whether the agent can handle parallel tool calls.
   * @param toolCalls - The tool calls to check.
   * @returns Whether the agent can handle parallel tool calls.
   */
  public canParallelToolCalls(
    toolCalls?: LanguageModelV2ToolCallPart[]
  ): boolean {
    return config.parallelToolCalls;
  }

  /**
   * The language models used by the agent.
   */
  get Llms(): string[] | undefined {
    return this.llms;
  }

  /**
   * The name of the agent.
   */
  get Name(): string {
    return this.name;
  }

  /**
   * The description of the agent.
   */
  get Description(): string {
    return this.description;
  }

  /**
   * The tools used by the agent.
   */
  get Tools(): Tool[] {
    return this.tools;
  }

  /**
   * The description of the agent's plan.
   */
  get PlanDescription() {
    return this.planDescription;
  }

  /**
   * The MCP client used by the agent.
   */
  get McpClient() {
    return this.mcpClient;
  }

  /**
   * The context of the agent.
   */
  get AgentContext(): AgentContext | undefined {
    return this.agentContext;
  }
}
