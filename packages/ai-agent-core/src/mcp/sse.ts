import Log from "../common/log";
import { uuidv4 } from "../common/utils";
import {
  ToolResult,
  IMcpClient,
  McpCallToolParam,
  McpListToolParam,
  McpListToolResult,
} from "../types";

/**
 * @file sse.ts
 * @description Implements a Model Context Protocol (MCP) client using Server-Sent Events (SSE).
 * The MCP protocol allows agents to discover and execute tools hosted on external servers.
 *
 * Protocol Overview:
 * 1. Connect to SSE endpoint to receive events (server -> client).
 * 2. Receive 'endpoint' event containing the POST URL for requests (client -> server).
 * 3. Send JSON-RPC 2.0 requests via POST (Initialize -> ListTools -> CallTool).
 * 4. Receive JSON-RPC responses via SSE 'message' events.
 */

type SseEventData = {
  id?: string;
  event?: string;
  data?: string;
  [key: string]: unknown;
};

type SseHandler = {
  onopen: () => void;
  onmessage: (data: SseEventData) => void;
  onerror: (e: unknown) => void;
  readyState?: 0 | 1 | 2; // 0 init; 1 connected; 2 closed
  close?: Function;
};

/**
 * Client implementation for MCP over SSE (Server-Sent Events).
 * Manages the full lifecycle of the connection: handshake, initialization, heartbeats, and request routing.
 */
export class SimpleSseMcpClient implements IMcpClient {
  private sseUrl: string;
  private clientName: string;
  private sseHandler?: SseHandler;
  private msgUrl?: string;
  private pingTimer?: any;
  private reconnectTimer?: any;
  private headers: Record<string, string>;
  private protocolVersion: string = "2024-11-05";
  private requestMap: Map<string, (messageData: any) => void>;

  /**
   * Initializes the MCP client.
   * @param sseServerUrl - The URL of the SSE endpoint.
   * @param clientName - Name identifier for this client.
   * @param headers - Optional HTTP headers for the connection.
   */
  constructor(
    sseServerUrl: string,
    clientName: string = "EkoMcpClient",
    headers: Record<string, string> = {}
  ) {
    this.sseUrl = sseServerUrl;
    this.clientName = clientName;
    this.headers = headers;
    this.requestMap = new Map();
  }

  /**
   * Establishes the SSE connection and handles the handshake.
   * @param signal - Optional abort signal.
   */
  async connect(signal?: AbortSignal): Promise<void> {
    Log.info("MCP Client, connecting...", this.sseUrl);

    // Cleanup existing connection
    if (this.sseHandler && this.sseHandler.readyState == 1) {
      this.sseHandler.close && this.sseHandler.close();
      this.sseHandler = undefined;
    }
    this.pingTimer && clearInterval(this.pingTimer);
    this.reconnectTimer && clearTimeout(this.reconnectTimer);

    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 15000); // Connection timeout

      this.sseHandler = {
        onopen: () => {
          Log.info("MCP Client, connection successful", this.sseUrl);
          clearTimeout(timer);
          setTimeout(resolve, 200);
        },
        onmessage: (data) => this.onmessage(data),
        onerror: (e) => {
          Log.error("MCP Client, error: ", e);
          clearTimeout(timer);
          // Auto-reconnect logic
          if (this.sseHandler?.readyState === 2) {
            this.pingTimer && clearInterval(this.pingTimer);
            this.reconnectTimer = setTimeout(() => {
              this.connect();
            }, 500);
          }
          resolve();
        },
      };
      connectSse(this.sseUrl, this.sseHandler, this.headers, signal);
    });

    // Start heartbeat
    this.pingTimer = setInterval(() => this.ping(), 10000);
  }

  /**
   * Handles incoming SSE events.
   * Routes 'message' events to pending requests and processes 'endpoint' discovery.
   */
  onmessage(data: SseEventData) {
    Log.debug("MCP Client, onmessage", this.sseUrl, data);

    if (data.event == "endpoint") {
      // Discovery phase: Server sends the POST endpoint for requests
      let uri = data.data as string;
      let msgUrl: string;
      let idx = this.sseUrl.indexOf("/", 10);
      if (idx > -1) {
        msgUrl = this.sseUrl.substring(0, idx) + uri;
      } else {
        msgUrl = this.sseUrl + uri;
      }
      this.msgUrl = msgUrl;
      this.initialize(); // Proceed to protocol initialization
    } else if (data.event == "message") {
      // JSON-RPC response
      let message = JSON.parse(data.data as string);
      let _resolve = this.requestMap.get(message.id);
      _resolve && _resolve(message);
    }
  }

  /**
   * Performs the MCP initialization handshake.
   * Negotiates capabilities and protocol version.
   */
  private async initialize() {
    await this.request("initialize", {
      protocolVersion: this.protocolVersion,
      capabilities: {
        tools: {
          listChanged: true,
        },
        sampling: {},
      },
      clientInfo: {
        name: this.clientName,
        version: "1.0.0",
      },
    });
    try {
      await this.request("notifications/initialized", {});
    } catch(ignored) {}
  }

  /**
   * Sends a ping request to keep the connection alive.
   */
  private ping() {
    this.request("ping", {});
  }

  /**
   * Lists available tools from the MCP server.
   */
  async listTools(
    param: McpListToolParam,
    signal?: AbortSignal
  ): Promise<McpListToolResult> {
    const message = await this.request(
      "tools/list",
      {
        ...param,
      },
      signal
    );
    return message.result.tools || [];
  }

  /**
   * Executes a specific tool on the MCP server.
   */
  async callTool(
    param: McpCallToolParam,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    const message = await this.request(
      "tools/call",
      {
        ...param,
      },
      signal
    );
    return message.result;
  }

  /**
   * Low-level JSON-RPC request handler.
   * Sends request via POST and waits for response via SSE (using ID correlation).
   */
  private async request(
    method: string,
    params: Record<string, any>,
    signal?: AbortSignal
  ): Promise<any> {
    // Notifications don't need IDs
    const id = method.startsWith("notifications/") ? undefined : uuidv4();

    try {
      // Create promise to await response via SSE
      const callback = new Promise<any>((resolve, reject) => {
        if (signal) {
          signal.addEventListener("abort", () => {
            const error = new Error("Operation was interrupted");
            error.name = "AbortError";
            reject(error);
          });
        }
        id && this.requestMap.set(id, resolve);
      });

      Log.debug(`MCP Client, ${method}`, id, params);

      const response = await fetch(this.msgUrl as string, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: id,
          method: method,
          params: {
            ...params,
          },
        }),
        signal: signal,
      });

      const body = await response.text();

      // MCP Standard: Server returns "Accepted" for valid requests
      if (body == "Accepted") {
        const message = await callback;
        if (message.error) {
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
            throw new Error(
              `MCP ${method} error: ` + JSON.stringify(message.result)
            );
          }
        }
        return message;
      } else {
        throw new Error(`MCP ${method} error:` + body);
      }
    } finally {
      id && this.requestMap.delete(id);
    }
  }

  isConnected(): boolean {
    if (this.sseHandler && this.sseHandler.readyState == 1) {
      return true;
    }
    return false;
  }

  async close(): Promise<void> {
    try {
      await this.request("notifications/cancelled", {
        requestId: uuidv4(),
        reason: "User requested cancellation",
      });
    } catch (ignored) {}
    this.pingTimer && clearInterval(this.pingTimer);
    this.reconnectTimer && clearTimeout(this.reconnectTimer);
    this.sseHandler && this.sseHandler.close && this.sseHandler.close();
    this.pingTimer = undefined;
    this.sseHandler = undefined;
    this.reconnectTimer = undefined;
  }
}

/**
 * Internal helper to handle SSE stream reading and parsing.
 * Uses native fetch and ReadableStream.
 */
async function connectSse(
  sseUrl: string,
  hander: SseHandler,
  headers: Record<string, string> = {},
  _signal?: AbortSignal
) {
  try {
    hander.readyState = 0;
    const controller = new AbortController();
    const signal = _signal
      ? AbortSignal.any([controller.signal, _signal])
      : controller.signal;

    const response = await fetch(sseUrl, {
      method: "GET",
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        ...headers,
      },
      body: null,
      keepalive: true,
      signal: signal,
    });

    const reader = response.body?.getReader() as ReadableStreamDefaultReader;

    hander.close = () => {
      controller.abort();
      hander.readyState = 2;
      Log.debug("McpClient close abort.", sseUrl);
    };

    let str = "";
    const decoder = new TextDecoder();
    hander.readyState = 1;
    hander.onopen();

    // Stream reading loop
    while (hander.readyState == 1) {
      const { value, done } = await reader?.read();
      if (done) {
        break;
      }
      const text = decoder.decode(value);
      str += text;

      // Process complete events delimited by double newline
      if (str.indexOf("\n\n") > -1) {
        const chunks = str.split("\n\n");
        for (let i = 0; i < chunks.length - 1; i++) {
          const chunk = chunks[i];
          const chunkData = parseChunk(chunk);
          hander.onmessage(chunkData);
        }
        str = chunks[chunks.length - 1]; // Keep partial chunk for next iteration
      }
    }
  } catch (e: any) {
    if (e?.name !== "AbortError") {
      Log.error("MCP Client, connectSse error:", e);
      hander.onerror(e);
    }
  } finally {
    hander.readyState = 2;
  }
}

/**
 * Parses a raw SSE text chunk into structured data.
 * Handles 'id', 'event', and 'data' fields.
 */
function parseChunk(chunk: string): SseEventData {
  const lines = chunk.split("\n");
  const chunk_obj: SseEventData = {};
  for (let j = 0; j < lines.length; j++) {
    const line = lines[j];
    if (line.startsWith("id:")) {
      chunk_obj["id"] = line.substring(3).trim();
    } else if (line.startsWith("event:")) {
      chunk_obj["event"] = line.substring(6).trim();
    } else if (line.startsWith("data:")) {
      chunk_obj["data"] = line.substring(5).trim();
    } else {
      const idx = line.indexOf(":");
      if (idx > -1) {
        chunk_obj[line.substring(0, idx)] = line.substring(idx + 1).trim();
      }
    }
  }
  return chunk_obj;
}
