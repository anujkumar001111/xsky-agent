import { Log, uuidv4 } from "@xsky/ai-agent-core";
import {
  IMcpClient,
  McpCallToolParam,
  McpListToolParam,
  McpListToolResult,
  ToolResult,
} from "@xsky/ai-agent-core/types";
import {
  spawn,
  SpawnOptionsWithoutStdio,
  ChildProcessWithoutNullStreams,
} from "child_process";

/**
 * A simple MCP (Model Context Protocol) client that communicates via standard I/O (stdio).
 * Spawns a child process and communicates using JSON-RPC 2.0 over stdin/stdout.
 */
export class SimpleStdioMcpClient implements IMcpClient {
  private command: string;
  private args?: string[];
  private options?: SpawnOptionsWithoutStdio;
  private process: ChildProcessWithoutNullStreams | null = null;
  private requestMap: Map<string, (messageData: any) => void>;

  /**
   * Creates a new SimpleStdioMcpClient instance.
   * @param command - The command to spawn (e.g., 'node', 'python').
   * @param args - Arguments to pass to the command.
   * @param options - Spawn options for the child process.
   */
  constructor(
    command: string,
    args?: string[],
    options?: SpawnOptionsWithoutStdio
  ) {
    this.command = command;
    this.args = args || [];
    this.options = options || {
      stdio: ["pipe", "pipe", "pipe"],
    };
    this.requestMap = new Map();
  }

  /**
   * Connects to the MCP server by spawning the child process.
   * Sets up event listeners for stdout (messages) and error handling.
   * @param signal - Optional AbortSignal to cancel the connection attempt.
   * @returns A promise that resolves when the connection is established.
   */
  async connect(signal?: AbortSignal): Promise<void> {
    if (this.process) {
      try {
        this.process.kill();
      } catch (e) {}
    }
    this.process = spawn(this.command, this.args, this.options);
    this.process.stdout.on("data", (data) => {
      const response = data.toString().trim();
      Log.debug("MCP Client, onmessage", this.command, this.args, response);
      if (!response.startsWith("{")) {
        return;
      }
      const message = JSON.parse(response);
      if (message.id) {
        const callback = this.requestMap.get(message.id);
        if (callback) {
          callback(message);
        }
      }
    });
    this.process.on("error", (error) => {
      Log.error("MCP process error:", this.command, this.args, error);
    });
    Log.info("MCP Client, connection successful:", this.command, this.args);
  }

  /**
   * Sends a JSON-RPC request to the MCP server.
   * @param method - The MCP method name to call.
   * @param params - Parameters for the method call.
   * @param signal - Optional AbortSignal to cancel the request.
   * @returns A promise that resolves with the response from the server.
   * @throws Error if connection fails or request is aborted.
   */
  async sendMessage(
    method: string,
    params: Record<string, any> = {},
    signal?: AbortSignal
  ) {
    if (!this.process) {
      await this.connect();
      if (!this.process) {
        throw new Error("Failed to connect to MCP server");
      }
    }
    const id = uuidv4();
    try {
      const callback = new Promise<any>((resolve, reject) => {
        if (signal) {
          signal.addEventListener("abort", () => {
            const error = new Error("Operation was interrupted");
            error.name = "AbortError";
            reject(error);
          });
        }
        this.requestMap.set(id, resolve);
      });
      const message = JSON.stringify({
        jsonrpc: "2.0",
        id: id,
        method: method,
        params: {
          ...params,
        },
      });
      Log.debug(`MCP Client, ${method}`, id, params);
      const suc = this.process.stdin.write(message + "\n", "utf-8");
      if (!suc) {
        throw new Error("SseClient Response Exception: " + message);
      }
      return await callback;
    } finally {
      this.requestMap.delete(id);
    }
  }

  /**
   * Lists available tools from the MCP server.
   * @param param - Parameters for listing tools (e.g., cursor, limit).
   * @param signal - Optional AbortSignal to cancel the request.
   * @returns A promise that resolves to the list of available tools.
   * @throws Error if the tool list request fails.
   */
  async listTools(
    param: McpListToolParam,
    signal?: AbortSignal
  ): Promise<McpListToolResult> {
    const message = await this.sendMessage(
      "tools/list",
      {
        ...param,
      },
      signal
    );
    if (message.error) {
      Log.error("McpClient listTools error: ", param, message);
      throw new Error("listTools Exception");
    }
    return message.result.tools || [];
  }

  /**
   * Calls a specific tool on the MCP server.
   * @param param - Parameters including tool name and arguments.
   * @param signal - Optional AbortSignal to cancel the execution.
   * @returns A promise that resolves to the tool execution result.
   * @throws Error if the tool execution fails.
   */
  async callTool(
    param: McpCallToolParam,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    const message = await this.sendMessage(
      "tools/call",
      {
        ...param,
      },
      signal
    );
    if (message.error) {
      Log.error("McpClient callTool error: ", param, message);
      throw new Error("callTool Exception");
    }
    return message.result;
  }

  /**
   * Checks if the MCP client is currently connected and the process is running.
   * @returns True if connected and process is active, false otherwise.
   */
  isConnected(): boolean {
    return (
      this.process != null && !this.process.killed && !this.process.exitCode
    );
  }

  /**
   * Closes the connection and terminates the child process.
   * @returns A promise that resolves when the process is killed.
   */
  async close(): Promise<void> {
    this.process && this.process.kill();
  }
}
