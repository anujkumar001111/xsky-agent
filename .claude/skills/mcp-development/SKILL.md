---
name: MCP Development
description: This skill should be used when the user asks about "MCP", "Model Context Protocol", "MCP client", "SSE client", "STDIO client", "external tools", or needs to work with MCP integrations in XSky.
version: 1.0.0
---

# MCP Development in XSky

This skill provides knowledge for Model Context Protocol integrations.

## MCP Client Types

| Type | Package | Use Case |
|------|---------|----------|
| SSE | ai-agent-core | Web-based MCP servers |
| HTTP | ai-agent-core | REST API MCP servers |
| STDIO | ai-agent-nodejs | Local subprocess servers |

## Basic Usage

```typescript
import { SimpleSseMcpClient } from "@xsky/ai-agent-core";

const mcpClient = new SimpleSseMcpClient("http://localhost:3000/mcp");
await mcpClient.connect();

const xsky = new XSky({
  llms: { /* ... */ },
  defaultMcpClient: mcpClient
});

// MCP tools now available to all agents
```

## IMcpClient Interface

```typescript
interface IMcpClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<McpTool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
  isConnected(): boolean;
}
```

## Tool Result Format

```typescript
interface McpToolResult {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}
```

## STDIO Client (Node.js)

```typescript
import { SimpleStdioMcpClient } from "@xsky/ai-agent-nodejs";

const mcpClient = new SimpleStdioMcpClient("node", ["server.js"]);
await mcpClient.connect();

// Uses JSON-RPC over stdin/stdout
```

## Error Handling

```typescript
try {
  await mcpClient.connect();
} catch (error) {
  if (error.message.includes('timeout')) {
    // Handle connection timeout
  }
  // Handle other errors
}
```

## Tool Discovery

```typescript
const tools = await mcpClient.listTools();
// Returns: { name, description, inputSchema }[]

// Tools automatically converted to XSky format
// and registered with agents
```

## Key Source Files

| File | Purpose |
|------|---------|
| `packages/ai-agent-core/src/mcp/sse.ts` | SSE client |
| `packages/ai-agent-core/src/mcp/http.ts` | HTTP client |
| `packages/ai-agent-nodejs/src/mcp/stdio.ts` | STDIO client |
| `packages/ai-agent-core/src/types/mcp.types.ts` | MCP types |
