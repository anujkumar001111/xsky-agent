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

/**
 * @file base.ts
 * @description Defines the foundational Agent class for the Eko framework.
 * This class implements the core React-like loop (Thought -> Action -> Observation)
 * and manages interactions with LLMs, Tools, and the Model Context Protocol (MCP).
 *
 * Core Responsibilities:
 * - Executing the agent loop (runWithContext).
 * - Managing tool execution and results (including MCP tools).
 * - Constructing prompts (System, User, History).
 * - Handling lifecycle hooks for production controls (blocks, approvals, retries).
 * - Managing context window optimization (memory).
 */

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
 * The base Agent class. All specialized agents (Browser, Shell, etc.) should inherit from this
 * or be instantiated as generic agents with specific toolsets.
 *
 * It encapsulates the "brain" of an autonomous entity, managing its own state,
 * decisions, and external interactions.
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

  // Static instances of core system tools to avoid repeated instantiation overhead
  private static variableStorageTool = new VariableStorageTool();
  private static foreachTaskTool = new ForeachTaskTool();
  private static watchTriggerTool = new WatchTriggerTool();
  private static humanInteractTool = new HumanInteractTool();

  /**
   * Initializes a new Agent instance.
   * @param params - Configuration parameters including name, tools, and optional MCP client.
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
   * Entry point for agent execution.
   * Sets up the execution context, connects to MCP (if needed), and triggers the main run loop.
   *
   * @param context - The global execution context from the orchestrator.
   * @param agentChain - The history tracking chain for this specific agent execution.
   * @returns A promise resolving to the final text result of the agent's task.
   * @throws Errors if blocked by hooks or if critical failures occur.
   */
  public async run(context: Context, agentChain: AgentChain): Promise<string> {
    const mcpClient = this.mcpClient || context.config.defaultMcpClient;
    const agentContext = new AgentContext(context, this, agentChain);
    const hooks = context.config.hooks;

    try {
      this.agentContext = agentContext;

      // ============ BEFORE AGENT START HOOK ============
      // Allows for validation, preparation, or blocking of agent execution based on policy
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
          // Non-critical hook errors should not stop execution unless explicitly blocking
        }
      }

      // Ensure MCP connection is active before starting
      mcpClient &&
        !mcpClient.isConnected() &&
        (await mcpClient.connect(context.controller.signal));

      // Enter the main execution loop
      return await this.runWithContext(
        agentContext,
        mcpClient,
        config.maxReactNum
      );
    } finally {
      // Cleanup: Always close MCP connection to prevent resource leaks
      mcpClient && (await mcpClient.close());
    }
  }

  /**
   * The core "React" loop (Reasoning + Acting) of the agent.
   * Iteratively:
   * 1. Constructs context (messages + tools).
   * 2. Calls LLM to generate thought/action.
   * 3. Executes tools.
   * 4. Observes results.
   * 5. Repeats until completion or max loops.
   *
   * @param agentContext - Local context for this run.
   * @param mcpClient - Optional Model Context Protocol client for dynamic tools.
   * @param maxReactNum - Maximum allowed iterations (prevent infinite loops).
   * @param historyMessages - Initial conversation history.
   * @returns The final result string.
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

    // Merge static tools with system-injected automatic tools (variables, loops, human help)
    const tools = [...this.tools, ...this.system_auto_tools(agentNode)];

    // Construct initial prompts
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

    // --- MAIN LOOP ---
    while (loopNum < maxReactNum) {
      // Check for cancellation signals
      await context.checkAborted();

      // Dynamic Tool Discovery via MCP
      if (mcpClient) {
        const controlMcp = await this.controlMcpTools(
          agentContext,
          messages,
          loopNum
        );
        if (controlMcp.mcpTools) {
          // Fetch relevant tools from external MCP servers
          const mcpTools = await this.listTools(
            context,
            mcpClient,
            agentNode,
            controlMcp.mcpParams
          );
          // Optimize context window: only keep tools that are actually used or relevant
          const usedTools = memory.extractUsedTool(messages, agentTools);
          const _agentTools = mergeTools(tools, usedTools);
          agentTools = mergeTools(_agentTools, mcpTools);
        }
      }

      // Memory Management: Compress or truncate large history
      await this.handleMessages(agentContext, messages, tools);

      const llm_tools = convertTools(agentTools);

      // LLM Call: Generate next step (Thought + Action)
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

      // Check for immediate stop signal from context variables
      const forceStop = agentContext.variables.get("forceStop");
      if (forceStop) {
        return forceStop;
      }

      // Execute Tools and Process Results (Observation)
      const finalResult = await this.handleCallResult(
        agentContext,
        messages,
        agentTools,
        results
      );

      loopNum++;

      // If no final result (task continuing), handle expert mode checks
      if (!finalResult) {
        if (config.expertMode && loopNum % config.expertModeTodoLoopNum == 0) {
          // Periodically re-evaluate todo list in expert mode
          await doTodoListManager(agentContext, rlm, messages, llm_tools);
        }
        continue;
      }

      // If result found, perform verification in expert mode
      if (config.expertMode && checkNum == 0) {
        checkNum++;
        const { completionStatus } = await doTaskResultCheck(
          agentContext,
          rlm,
          messages,
          llm_tools
        );
        // If check fails, continue loop
        if (completionStatus == "incomplete") {
          continue;
        }
      }

      return finalResult;
    }
    return "Unfinished";
  }

  /**
   * Processes the LLM's response.
   * If tools are called, executes them and appends results to history.
   * If text is returned, treats it as the final answer or thought.
   *
   * @param agentContext - Current execution context.
   * @param messages - Conversation history.
   * @param agentTools - Available tools.
   * @param results - Raw output content from LLM.
   * @returns The final answer string if task is done, or null if loop should continue.
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

    // Append assistant's response to history
    messages.push({
      role: "assistant",
      content: results,
    });

    if (results.length == 0) {
      return null;
    }

    // If only text, return it (end of turn)
    if (results.every((s) => s.type == "text")) {
      return results.map((s) => s.text).join("\n\n");
    }

    // Handle tool calls
    const toolCalls = results.filter((s) => s.type == "tool-call");

    // Parallel Execution Logic
    if (
      toolCalls.length > 1 &&
      this.canParallelToolCalls(toolCalls) &&
      toolCalls.every(
        (s) => agentTools.find((t) => t.name == s.toolName)?.supportParallelCalls
      )
    ) {
      // Execute all compatible tools in parallel
      const results = await Promise.all(
        toolCalls.map((toolCall) =>
          this.callToolCall(agentContext, agentTools, toolCall, user_messages)
        )
      );
      for (let i = 0; i < results.length; i++) {
        toolResults.push(results[i]);
      }
    } else {
      // Sequential Execution
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

    // If tools were executed, update history and return null to continue loop
    if (toolResults.length > 0) {
      messages.push({
        role: "tool",
        content: toolResults,
      });
      user_messages.forEach((message) => messages.push(message));
      return null;
    } else {
      // Fallback: extract text if no tools ran (should rarely happen here)
      return results
        .filter((s) => s.type == "text")
        .map((s) => s.text)
        .join("\n\n");
    }
  }

  /**
   * Executes a single tool call with comprehensive hook support.
   * Checks `beforeToolCall` for blocks/modifications, and `onApprovalRequired` for human-in-the-loop.
   * Handles errors via `onToolError` hook (retry, skip, escalate).
   *
   * @param agentContext - Execution context.
   * @param agentTools - List of available tools.
   * @param result - The specific tool call request.
   * @param user_messages - Accumulator for side-channel user messages.
   * @param retryCount - Recursion depth for retries.
   * @returns The structured tool result for the LLM.
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

    // Initialize tool chain tracking
    const toolChain = new ToolChain(
      result,
      agentContext.agentChain.agentRequest as LLMRequest
    );
    agentContext.agentChain.push(toolChain);

    // Parse arguments safely
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

        if (!hookResult.allow) {
          // Handle Blocked Execution
          const blockReason = hookResult.reason || "Tool call blocked by beforeToolCall hook";
          Log.warn(`Tool ${result.toolName} blocked: ${blockReason}`);

          if (hookResult.escalate) {
            // ============ ON APPROVAL REQUIRED HOOK (Escalation) ============
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
                  Log.info(`Tool ${result.toolName} approved by ${approval.approver || "user"}`);
                  // Proceed with execution
                } else {
                  // Approval Denied
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
              }
            } else {
              // Default Escalation (User Info)
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
            // Silent Skip
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

          // Blocking Error
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

        // Apply parameter modifications from hook
        if (hookResult.modifiedArgs) {
          args = hookResult.modifiedArgs;
          toolChain.params = args;
        }
      } catch (hookError) {
        Log.error("beforeToolCall hook error:", hookError);
      }
    }

    let toolResult: ToolResult;
    try {
      let tool = getTool(agentTools, result.toolName);
      if (!tool) {
        throw new Error(result.toolName + " tool does not exist");
      }

      // Execute the tool implementation
      toolResult = await tool.execute(args, agentContext, result);
      toolChain.updateToolResult(toolResult);
      agentContext.consecutiveErrorNum = 0; // Reset error counter on success

      // ============ AFTER TOOL CALL HOOK (SUCCESS) ============
      if (hooks?.afterToolCall) {
        try {
          await hooks.afterToolCall(agentContext, result.toolName, args, toolResult);
        } catch (afterHookError) {
          Log.error("afterToolCall hook error:", afterHookError);
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
              if (retryCount < MAX_TOOL_RETRIES) {
                Log.info(`Retrying tool ${result.toolName} after error (attempt ${retryCount + 1}/${MAX_TOOL_RETRIES})`);
                return this.callToolCall(agentContext, agentTools, result, user_messages, retryCount + 1);
              } else {
                Log.warn(`Max retries (${MAX_TOOL_RETRIES}) reached for tool ${result.toolName}, falling through to error`);
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
              toolResult = {
                content: [{ type: "text", text: `Skipped due to error: ${e.message}` }],
                isError: false,
              };
              toolChain.updateToolResult(toolResult);
              break;

            case "abort":
              throw e; // Critical failure

            case "escalate":
              toolResult = {
                content: [{ type: "text", text: `Error requires human assistance: ${e.message}.` }],
                isError: true,
              };
              toolChain.updateToolResult(toolResult);
              break;

            case "continue":
            default:
              toolResult = {
                content: [{ type: "text", text: e + "" }],
                isError: true,
              };
              toolChain.updateToolResult(toolResult);
              break;
          }
        } catch (errorHookError) {
          Log.error("onToolError hook failed:", errorHookError);
          toolResult = { content: [{ type: "text", text: e + "" }], isError: true };
          toolChain.updateToolResult(toolResult);
        }
      } else {
        // Standard error handling (no hook)
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

      // Circuit Breaker: Prevent infinite error loops
      if (++agentContext.consecutiveErrorNum >= 10) {
        throw e;
      }
    }

    // Stream result to client
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
   * Injects automatic system tools based on agent configuration.
   * - VariableStorage: If agent handles input/output.
   * - Foreach: If workflow has loop nodes.
   * - Watch: If workflow has triggers.
   * - HumanInteract: Always included for fallback.
   *
   * @param agentNode - The workflow definition for this agent.
   * @returns Array of system tools to append.
   */
  protected system_auto_tools(agentNode: WorkflowAgent): Tool[] {
    let tools: Tool[] = [];
    let agentNodeXml = agentNode.xml;
    let hasVariable =
      agentNodeXml.indexOf("input=") > -1 ||
      agentNodeXml.indexOf("output=") > -1;
    if (hasVariable) {
      tools.push(Agent.variableStorageTool);
    }
    let hasForeach = agentNodeXml.indexOf("</forEach>") > -1;
    if (hasForeach) {
      tools.push(Agent.foreachTaskTool);
    }
    let hasWatch = agentNodeXml.indexOf("</watch>") > -1;
    if (hasWatch) {
      tools.push(Agent.watchTriggerTool);
    }
    tools.push(Agent.humanInteractTool);

    // Deduplicate: Don't add if already present in custom tools
    let toolNames = this.tools.map((tool) => tool.name);
    return tools.filter((tool) => toolNames.indexOf(tool.name) == -1);
  }

  /**
   * Constructs the System Prompt based on agent identity and capabilities.
   * @param agentContext - Execution context.
   * @param tools - Available tools (used to describe capabilities).
   * @returns The formatted system prompt string.
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
   * Constructs the initial User Prompt defining the specific task.
   * @param agentContext - Execution context.
   * @param tools - Available tools.
   * @returns The prompt parts.
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
   * Extension point for subclasses to inject custom system prompt instructions.
   */
  protected async extSysPrompt(
    agentContext: AgentContext,
    tools: Tool[]
  ): Promise<string> {
    return "";
  }

  /**
   * Discovers tools from the connected MCP server.
   * @param context - Global context.
   * @param mcpClient - Connected MCP client.
   * @param agentNode - Current agent node info (for filtering/context).
   * @param mcpParams - Additional parameters for tool filtering.
   * @returns Array of wrapped MCP tools.
   */
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
   * Determines if MCP tools should be refreshed/loaded for the current step.
   * By default, only loads on the first loop iteration (0).
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
   * Creates an execution closure for an MCP tool.
   * @param mcpClient - The client to execute the call.
   * @param name - Tool name.
   * @returns An object conforming to the ToolExecuter interface.
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
   * Manages context window by trimming or compressing message history.
   * Delegates to memory module.
   */
  protected async handleMessages(
    agentContext: AgentContext,
    messages: LanguageModelV2Prompt,
    tools: Tool[]
  ): Promise<void> {
    // Strategy: retain system prompts, recent context, and relevant tool outputs.
    // Truncate older messages or large file/image payloads.
    memory.handleLargeContextMessages(messages);
  }

  /**
   * Helper to execute a function as a tool result.
   * Useful for internal pseudo-tools.
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
   * Public API to explicitly load tools (e.g. for inspection).
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
   * Registers a new tool with the agent instance.
   */
  public addTool(tool: Tool) {
    this.tools.push(tool);
  }

  /**
   * Lifecycle handler for task status changes (pause/abort).
   * Cleans up local state if task is aborted.
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
   * Configuration check for parallel execution support.
   */
  public canParallelToolCalls(
    toolCalls?: LanguageModelV2ToolCallPart[]
  ): boolean {
    return config.parallelToolCalls;
  }

  // --- GETTERS ---

  get Llms(): string[] | undefined {
    return this.llms;
  }

  get Name(): string {
    return this.name;
  }

  get Description(): string {
    return this.description;
  }

  get Tools(): Tool[] {
    return this.tools;
  }

  get PlanDescription() {
    return this.planDescription;
  }

  get McpClient() {
    return this.mcpClient;
  }

  get AgentContext(): AgentContext | undefined {
    return this.agentContext;
  }
}
