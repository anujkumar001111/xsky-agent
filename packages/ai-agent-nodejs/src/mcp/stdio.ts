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
 * A simple MCP (Model Context Protocol) client that communicates with an MCP server via stdio.
 * Spawns a child process and uses JSON-RPC 2.0 over stdin/stdout for communication.
 */
export class SimpleStdioMcpClient implements IMcpClient {
  /** Command to execute for the MCP server */
  private command: string;
  /** Arguments to pass to the command */
  private args?: string[];
  /** Spawn options for the child process */
  private options?: SpawnOptionsWithoutStdio;
  /** The spawned child process */
  private process: ChildProcessWithoutNullStreams | null = null;
  /** Map of request IDs to their response callbacks */
  private requestMap: Map<string, (messageData: any) => void>;

  /**
   * Creates a new SimpleStdioMcpClient.
   * @param command - The command to execute (e.g., "node", "python").
   * @param args - Optional array of arguments to pass to the command.
   * @param options - Optional spawn options for the child process.
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
   * If already connected, kills the existing process and reconnects.
   * @param signal - Optional AbortSignal to cancel the connection.
   * @returns A promise that resolves when connected.
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
   * Lists available tools from the MCP server.
   * @param param - Parameters for the list tools request.
   * @param signal - Optional AbortSignal to cancel the request.
   * @returns A promise resolving to an array of available tools.
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
    return message.result.tools || [];
  }

  /**
   * Calls a tool on the MCP server.
   * @param param - Parameters including tool name and arguments.
   * @param signal - Optional AbortSignal to cancel the request.
   * @returns A promise resolving to the tool's result.
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
    return message.result;
  }

  /**
   * Sends a JSON-RPC 2.0 message to the MCP server and waits for a response.
   * @param method - The JSON-RPC method to call.
   * @param params - Parameters to pass with the method call.
   * @param signal - Optional AbortSignal to cancel the request.
   * @returns A promise resolving to the response message data.
   * @throws Error if connection fails or response contains an error.
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
      const messageData = await callback;
      this.handleError(method, messageData);
      return messageData;
    } finally {
      this.requestMap.delete(id);
    }
  }

  /**
   * Handles errors in MCP responses.
   * @param method - The method that was called.
   * @param message - The response message to check for errors.
   * @throws Error if the response contains an error.
   */
  private handleError(method: string, message: any) {
    if (!message) {
      throw new Error(`MCP ${method} error: no response`);
    }
    if (message?.error) {
      Log.error(`MCP ${method} error: ` + message.error);
      throw new Error(
        `MCP ${method} error: ` +
          (typeof message.error === "string"
            ? message.error
            : message.error.message)
      );
    }
    if (message.result?.isError == true) {
      if (message.result.content) {
        throw new Error(
          `MCP ${method} error: ` +
            (typeof message.result.content === "string"
              ? message.result.content
              : message.result.content[0].text)
        );
      } else {
        throw new Error(`MCP ${method} error: ` + JSON.stringify(message.result));
      }
    }
  }

  /**
   * Checks if the client is currently connected to the MCP server.
   * @returns True if the process is running and not killed, false otherwise.
   */
  isConnected(): boolean {
    return (
      this.process != null && !this.process.killed && !this.process.exitCode
    );
  }

  /**
   * Closes the connection by killing the child process.
   * @returns A promise that resolves when the process is killed.
   */
  async close(): Promise<void> {
    this.process && this.process.kill();
  }
}
