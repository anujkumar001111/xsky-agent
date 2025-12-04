import { JSONSchema7 } from "json-schema";
import { ToolResult } from "./tools.types";

/**
 * Parameters for listing available tools from an MCP server.
 * @property environment - The execution environment context (browser or OS type).
 * @property agent_name - Name of the agent requesting tools.
 * @property prompt - The current task prompt for contextual tool filtering.
 * @property taskId - Optional unique identifier for the current task.
 * @property nodeId - Optional identifier for the current workflow node.
 * @property browser_url - Optional current browser URL for web-context tools.
 * @property params - Optional additional parameters for tool discovery.
 */
export type McpListToolParam = {
  environment: "browser" | "windows" | "mac" | "linux";
  agent_name: string;
  prompt: string;
  taskId?: string;
  nodeId?: string;
  browser_url?: string | null;
  params?: Record<string, unknown> | undefined;
};

/**
 * Parameters for calling a specific tool on an MCP server.
 * @property name - The name of the tool to call.
 * @property arguments - Optional key-value arguments to pass to the tool.
 * @property extInfo - Optional extended information about the execution context.
 */
export type McpCallToolParam = {
  name: string;
  arguments?: Record<string, unknown> | undefined;
  extInfo?: {
    /** Unique identifier for the current task */
    taskId: string;
    /** Identifier for the current workflow node */
    nodeId: string;
    /** The execution environment context */
    environment: "browser" | "windows" | "mac" | "linux";
    /** Name of the agent making the call */
    agent_name: string;
    /** Optional current browser URL for web-context tools */
    browser_url?: string | null;
  };
};

/**
 * Result from listing tools, containing available tool definitions.
 */
export type McpListToolResult = Array<{
  /** Tool name identifier */
  name: string;
  /** Optional human-readable description of the tool */
  description?: string;
  /** JSON Schema defining the tool's input parameters */
  inputSchema: JSONSchema7;
}>;

/**
 * Interface for Model Context Protocol (MCP) client implementations.
 * MCP provides a standardized way to discover and invoke tools from external servers.
 */
export interface IMcpClient {
  /**
   * Establishes a connection to the MCP server.
   * @param signal - Optional AbortSignal to cancel the connection attempt.
   * @returns A promise that resolves when connected.
   */
  connect(signal?: AbortSignal): Promise<void>;

  /**
   * Lists available tools from the MCP server.
   * @param param - Parameters for filtering and contextualizing the tool list.
   * @param signal - Optional AbortSignal to cancel the request.
   * @returns A promise resolving to an array of tool definitions.
   */
  listTools(param: McpListToolParam, signal?: AbortSignal): Promise<McpListToolResult>;

  /**
   * Calls a specific tool on the MCP server.
   * @param param - Parameters including tool name and arguments.
   * @param signal - Optional AbortSignal to cancel the request.
   * @returns A promise resolving to the tool's result.
   */
  callTool(param: McpCallToolParam, signal?: AbortSignal): Promise<ToolResult>;

  /**
   * Checks if the client is currently connected to the MCP server.
   * @returns True if connected, false otherwise.
   */
  isConnected(): boolean;

  /**
   * Closes the connection to the MCP server.
   * @returns A promise that resolves when the connection is closed.
   */
  close(): Promise<void>;
}
