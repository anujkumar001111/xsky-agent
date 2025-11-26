import { ToolResult } from "../types/tools.types";
import { LLMRequest } from "../types/llm.types";
import { WorkflowAgent } from "../types/core.types";
import { LanguageModelV2ToolCallPart } from "@ai-sdk/provider";

type ChainEvent = {
  type: "update";
  target: AgentChain | ToolChain;
};

interface Callback {
  (chain: Chain, event: ChainEvent): void;
}

/**
 * A chain of tool calls.
 */
export class ToolChain {
  readonly toolName: string;
  readonly toolCallId: string;
  readonly request: LLMRequest;
  params?: Record<string, unknown>;
  toolResult?: ToolResult;
  onUpdate?: () => void;

  /**
   * Creates an instance of the ToolChain.
   * @param toolUse - The tool use part of the language model response.
   * @param request - The language model request.
   */
  constructor(toolUse: LanguageModelV2ToolCallPart, request: LLMRequest) {
    this.toolName = toolUse.toolName;
    this.toolCallId = toolUse.toolCallId;
    this.request = JSON.parse(JSON.stringify(request));
  }

  /**
   * Updates the parameters of the tool call.
   * @param params - The new parameters.
   */
  updateParams(params: Record<string, unknown>): void {
    this.params = params;
    this.onUpdate && this.onUpdate();
  }

  /**
   * Updates the result of the tool call.
   * @param toolResult - The new tool result.
   */
  updateToolResult(toolResult: ToolResult): void {
    this.toolResult = toolResult;
    this.onUpdate && this.onUpdate();
  }
}

/**
 * A chain of agent actions.
 */
export class AgentChain {
  agent: WorkflowAgent;
  tools: ToolChain[] = [];
  agentRequest?: LLMRequest;
  agentResult?: string;
  onUpdate?: (event: ChainEvent) => void;

  /**
   * Creates an instance of the AgentChain.
   * @param agent - The agent for this chain.
   */
  constructor(agent: WorkflowAgent) {
    this.agent = agent;
  }

  /**
   * Pushes a tool chain to this agent chain.
   * @param tool - The tool chain to push.
   */
  push(tool: ToolChain): void {
    tool.onUpdate = () => {
      this.onUpdate &&
        this.onUpdate({
          type: "update",
          target: tool,
        });
    };
    this.tools.push(tool);
    this.onUpdate &&
      this.onUpdate({
        type: "update",
        target: this,
      });
  }
}

/**
 * The main chain of execution.
 */
export default class Chain {
  taskPrompt: string;
  planRequest?: LLMRequest;
  planResult?: string;
  agents: AgentChain[] = [];
  private listeners: Callback[] = [];

  /**
   * Creates an instance of the Chain.
   * @param taskPrompt - The initial task prompt.
   */
  constructor(taskPrompt: string) {
    this.taskPrompt = taskPrompt;
  }

  /**
   * Pushes an agent chain to this chain.
   * @param agent - The agent chain to push.
   */
  push(agent: AgentChain): void {
    agent.onUpdate = (event: ChainEvent) => {
      this.pub(event);
    };
    this.agents.push(agent);
    this.pub({
      type: "update",
      target: agent,
    });
  }

  private pub(event: ChainEvent): void {
    this.listeners.forEach((listener) => listener(this, event));
  }

  /**
   * Adds a listener to this chain.
   * @param callback - The callback to add.
   */
  public addListener(callback: Callback): void {
    this.listeners.push(callback);
  }

  /**
   * Removes a listener from this chain.
   * @param callback - The callback to remove.
   */
  public removeListener(callback: Callback): void {
    this.listeners = this.listeners.filter((listener) => listener !== callback);
  }
}
