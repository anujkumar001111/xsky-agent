# MCP Reference

## Clients

### `SimpleSseMcpClient`
Connects to an MCP server via Server-Sent Events (SSE).

```typescript
import { SimpleSseMcpClient } from '@xsky/ai-agent-core/mcp/sse';

const client = new SimpleSseMcpClient({
  url: 'http://localhost:3000/sse',
});
await client.connect();
```

### `SimpleHttpMcpClient`
Connects via standard HTTP (for stateless tools).

## Using MCP with Agents

Agents can ingest tools from MCP clients.

```typescript
// Register client with agent
browserAgent.addMcpClient(client);

// Tools are now available to the LLM
```

## Supported Features
- **Resources**: Reading external data resources.
- **Prompts**: Using prompt templates from servers.
- **Tools**: Executing functions on servers.
- **Sampling**: (Not yet supported).
