import { LanguageModelV2FinishReason } from "@ai-sdk/provider";
import { Agent } from "../agent";
import { LLMs } from "./llm.types";
import { IA2aClient } from "../agent/a2a";
import { IMcpClient } from "./mcp.types";
import { ToolResult } from "./tools.types";
import { AgentContext } from "../core/context";
import type {
  AgentHooks,
  StateConfig,
  ApprovalConfig,
  RateLimitConfig,
} from "./hooks.types";

/**
 * Configuration options for initializing an Eko instance.
 * @property llms - Language model configurations including default and named models.
 * @property agents - Optional array of custom agents to register with the Eko instance.
 * @property planLlms - Optional array of LLM names to use for workflow planning.
 * @property compressLlms - Optional array of LLM names to use for context compression.
 * @property callback - Optional callbacks for streaming messages and human interaction.
 * @property defaultMcpClient - Optional default MCP client for tool discovery and execution.
 * @property a2aClient - Optional Agent-to-Agent communication client.
 * @property hooks - Optional lifecycle hooks for agent and tool execution (production-ready control).
 * @property stateConfig - Optional configuration for state persistence.
 * @property approvalConfig - Optional configuration for approval workflows.
 * @property rateLimits - Optional rate limiting configuration.
 */
export type EkoConfig = {
  llms: LLMs;
  agents?: Agent[];
  planLlms?: string[];
  compressLlms?: string[];
  callback?: StreamCallback & HumanCallback;
  defaultMcpClient?: IMcpClient;
  a2aClient?: IA2aClient;
  /** Production-ready lifecycle hooks for fine-grained control */
  hooks?: AgentHooks;
  /** State persistence configuration for pause/resume capability */
  stateConfig?: StateConfig;
  /** Approval workflow configuration for human-in-the-loop */
  approvalConfig?: ApprovalConfig;
  /** Rate limiting configuration for tools/actions */
  rateLimits?: RateLimitConfig;
};

/**
 * Message types emitted during workflow execution for streaming callbacks.
 * Contains task identification and various payload types based on execution events.
 * @property taskId - Unique identifier for the current task.
 * @property agentName - Name of the agent processing the message.
 * @property nodeId - Optional node identifier within the agent workflow.
 */
export type StreamCallbackMessage = {
  taskId: string;
  agentName: string;
  nodeId?: string | null; // agent nodeId
} & (
  | {
      type: "workflow";
      streamDone: boolean;
      workflow: Workflow;
    }
  | {
      type: "agent_start";
      agentNode: WorkflowAgent;
    }
  | {
      type: "text" | "thinking";
      streamId: string;
      streamDone: boolean;
      text: string;
    }
  | {
      type: "file";
      mimeType: string;
      data: string;
    }
  | {
      type: "tool_streaming";
      toolName: string;
      toolId: string;
      paramsText: string;
    }
  | {
      type: "tool_use";
      toolName: string;
      toolId: string;
      params: Record<string, any>;
    }
  | {
      type: "tool_running";
      toolName: string;
      toolId: string;
      text: string;
      streamId: string;
      streamDone: boolean;
    }
  | {
      type: "tool_result";
      toolName: string;
      toolId: string;
      params: Record<string, any>;
      toolResult: ToolResult;
    }
  | {
      type: "agent_result";
      agentNode: WorkflowAgent;
      error?: any;
      result?: string;
    }
  | {
      type: "error";
      error: unknown;
    }
  | {
      type: "finish";
      finishReason: LanguageModelV2FinishReason;
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    }
);

/**
 * Callback interface for receiving streaming messages during workflow execution.
 */
export interface StreamCallback {
  /**
   * Called when a streaming message is received during execution.
   * @param message - The streaming callback message containing event data.
   * @param agentContext - Optional context of the agent that generated the message.
   * @returns A promise that resolves when the message has been processed.
   */
  onMessage: (
    message: StreamCallbackMessage,
    agentContext?: AgentContext
  ) => Promise<void>;
}

/**
 * A simple text-based workflow node representing a single task step.
 * @property type - Always "normal" for text nodes.
 * @property text - The task description or instruction text.
 * @property input - Optional input variable name to read from context.
 * @property output - Optional output variable name to store results.
 */
export type WorkflowTextNode = {
  type: "normal";
  text: string;
  input?: string | null;
  output?: string | null;
};

/**
 * A workflow node that iterates over a collection and executes child nodes for each item.
 * @property type - Always "forEach" for iteration nodes.
 * @property items - The variable name containing the list to iterate over.
 * @property nodes - Array of child workflow nodes to execute for each item.
 */
export type WorkflowForEachNode = {
  type: "forEach";
  items: string; // list or variable name
  nodes: WorkflowNode[];
};

/**
 * A workflow node that watches for events and triggers child nodes when events occur.
 * @property type - Always "watch" for event-watching nodes.
 * @property event - The type of event to watch: "dom" for DOM changes, "gui" for UI events, "file" for filesystem events.
 * @property loop - Whether to continue watching after the first trigger (true) or stop (false).
 * @property description - Human-readable description of what event is being watched.
 * @property triggerNodes - Array of nodes to execute when the watched event occurs.
 */
export type WorkflowWatchNode = {
  type: "watch";
  event: "dom" | "gui" | "file";
  loop: boolean;
  description: string;
  triggerNodes: (WorkflowTextNode | WorkflowForEachNode)[];
};

/**
 * Union type representing all possible workflow node types.
 * A workflow node can be a simple text node, a forEach iteration node, or a watch event node.
 */
export type WorkflowNode =
  | WorkflowTextNode
  | WorkflowForEachNode
  | WorkflowWatchNode;

/**
 * Represents an agent within a workflow, including its task definition and execution state.
 * @property id - Unique identifier for this agent instance within the workflow.
 * @property name - The registered name of the agent type (e.g., "Browser", "File", "Shell").
 * @property task - Description of the task this agent should accomplish.
 * @property dependsOn - Array of agent IDs that must complete before this agent runs.
 * @property nodes - Array of workflow nodes defining the execution steps.
 * @property parallel - Whether this agent can run in parallel with others.
 * @property status - Current execution status: "init", "running", "done", or "error".
 * @property xml - XML representation of this agent configuration.
 */
export type WorkflowAgent = {
  id: string;
  name: string;
  task: string;
  dependsOn: string[];
  nodes: WorkflowNode[];
  parallel?: boolean;
  status: "init" | "running" | "done" | "error";
  xml: string; // <agent name="xxx">...</agent>
};

/**
 * Represents a complete workflow containing multiple agents and their execution plan.
 * @property taskId - Unique identifier for this workflow execution.
 * @property name - Human-readable name for the workflow.
 * @property thought - The AI's reasoning/planning process for creating this workflow.
 * @property agents - Array of agents that make up this workflow.
 * @property xml - Complete XML representation of the workflow.
 * @property modified - Whether the workflow has been modified from its original plan.
 * @property taskPrompt - The original user prompt that initiated this workflow.
 */
export type Workflow = {
  taskId: string;
  name: string;
  thought: string;
  agents: WorkflowAgent[];
  xml: string;
  modified?: boolean;
  taskPrompt?: string;
};

/**
 * Callback interface for human-in-the-loop interactions during workflow execution.
 * Allows agents to request human input, confirmation, or assistance.
 */
export interface HumanCallback {
  /**
   * Called when an agent needs human confirmation to proceed.
   * @param agentContext - The context of the requesting agent.
   * @param prompt - The confirmation message to display to the user.
   * @param extInfo - Optional additional information for context.
   * @returns A promise resolving to true if confirmed, false otherwise.
   */
  onHumanConfirm?: (
    agentContext: AgentContext,
    prompt: string,
    extInfo?: any
  ) => Promise<boolean>;
  /**
   * Called when an agent needs free-form text input from a human.
   * @param agentContext - The context of the requesting agent.
   * @param prompt - The input prompt to display to the user.
   * @param extInfo - Optional additional information for context.
   * @returns A promise resolving to the user's text input.
   */
  onHumanInput?: (
    agentContext: AgentContext,
    prompt: string,
    extInfo?: any
  ) => Promise<string>;
  /**
   * Called when an agent needs the user to select from predefined options.
   * @param agentContext - The context of the requesting agent.
   * @param prompt - The selection prompt to display to the user.
   * @param options - Array of available options to choose from.
   * @param multiple - Whether multiple selections are allowed.
   * @param extInfo - Optional additional information for context.
   * @returns A promise resolving to an array of selected option strings.
   */
  onHumanSelect?: (
    agentContext: AgentContext,
    prompt: string,
    options: string[],
    multiple?: boolean,
    extInfo?: any
  ) => Promise<string[]>;
  /**
   * Called when an agent needs human assistance for tasks it cannot automate.
   * @param agentContext - The context of the requesting agent.
   * @param helpType - Type of help needed: "request_login" for authentication or "request_assistance" for general help.
   * @param prompt - Description of the help needed.
   * @param extInfo - Optional additional information for context.
   * @returns A promise resolving to true when help has been provided.
   */
  onHumanHelp?: (
    agentContext: AgentContext,
    helpType: "request_login" | "request_assistance",
    prompt: string,
    extInfo?: any
  ) => Promise<boolean>;
}

/**
 * The result returned after a workflow execution completes.
 * @property taskId - Unique identifier of the completed task.
 * @property success - Whether the task completed successfully.
 * @property stopReason - Why execution stopped: "abort" if cancelled, "error" if failed, "done" if completed successfully.
 * @property result - The final result or output of the task execution.
 * @property error - The error object if stopReason is "error".
 */
export type EkoResult = {
  taskId: string;
  success: boolean;
  stopReason: "abort" | "error" | "done";
  result: string;
  error?: unknown;
};

/**
 * A node in the agent execution tree representing a single agent to execute.
 * @property type - Always "normal" for single-agent nodes.
 * @property agent - The workflow agent to execute at this node.
 * @property nextAgent - The next agent node to execute after this one completes.
 * @property result - The result produced by this agent after execution.
 */
export type NormalAgentNode = {
  type: "normal";
  agent: WorkflowAgent;
  nextAgent?: AgentNode;
  result?: string;
};

/**
 * A node in the agent execution tree representing multiple agents to execute in parallel.
 * @property type - Always "parallel" for parallel execution nodes.
 * @property agents - Array of normal agent nodes to execute concurrently.
 * @property nextAgent - The next agent node to execute after all parallel agents complete.
 * @property result - The combined result from all parallel agents.
 */
export type ParallelAgentNode = {
  type: "parallel";
  agents: NormalAgentNode[];
  nextAgent?: AgentNode;
  result?: string;
};

/**
 * Union type representing a node in the agent execution tree.
 * Can be either a single agent node or a parallel execution node.
 */
export type AgentNode = NormalAgentNode | ParallelAgentNode;
