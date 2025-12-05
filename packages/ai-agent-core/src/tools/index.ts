// Tool framework imports - core tool system components
import { JSONSchema7 } from "json-schema";                    // JSON schema type definitions
import { ToolWrapper } from "./wrapper";                     // Wrapper for external tool integration
import { AgentContext } from "../core/context";              // Agent execution context
import ForeachTaskTool from "./foreach_task";                // Tool for iterative task execution
import HumanInteractTool from "./human_interact";            // Tool for human-in-the-loop interactions
import TaskNodeStatusTool from "./task_node_status";          // Tool for managing task node status
import VariableStorageTool from "./variable_storage";          // Tool for persistent variable storage
import WatchTriggerTool from "./watch_trigger";              // Tool for event-driven triggers
import { Tool, ToolResult } from "../types/tools.types";     // Tool interface and result types
import { LanguageModelV2ToolCallPart } from "@ai-sdk/provider"; // LLM tool call interface

/**
 * Model Context Protocol (MCP) tool wrapper.
 * 
 * This class bridges external MCP tools with the internal tool system,
 * allowing dynamic discovery and execution of tools from MCP servers.
 * It provides a standardized interface for LLMs to call external tools
 * while maintaining the framework's security and execution model.
 */
export class McpTool implements Tool {
  /** Unique identifier for this tool */
  readonly name: string;
  /** Human-readable description of what this tool does */
  readonly description?: string;
  /** JSON schema defining the parameters this tool accepts */
  readonly parameters: JSONSchema7;
  /** Internal wrapper that handles the actual tool execution logic */
  private toolWrapper: ToolWrapper;

  /**
   * Creates an MCP tool instance from a tool wrapper.
   * @param toolWrapper - The wrapper containing tool metadata and execution logic
   */
  constructor(toolWrapper: ToolWrapper) {
    this.toolWrapper = toolWrapper;
    this.name = toolWrapper.name;
    this.description = toolWrapper.getTool().description;
    this.parameters = toolWrapper.getTool().inputSchema;
  }

  /**
   * Executes the MCP tool with given arguments.
   * Delegates to the underlying tool wrapper for actual execution.
   * @param args - Tool execution arguments
   * @param agentContext - Current agent execution context
   * @param toolCall - The LLM tool call that triggered this execution
   * @returns Promise resolving to the tool execution result
   */
  async execute(
    args: Record<string, unknown>,
    agentContext: AgentContext,
    toolCall: LanguageModelV2ToolCallPart
  ): Promise<ToolResult> {
    return this.toolWrapper.callTool(args, agentContext, toolCall);
  }
}

// Export built-in system tools that are automatically available to all agents
export {
  ForeachTaskTool,        // Iterative task execution tool
  HumanInteractTool,      // Human interaction tool
  TaskNodeStatusTool,     // Task status management tool
  VariableStorageTool,     // Variable persistence tool
  WatchTriggerTool,       // Event trigger tool
}