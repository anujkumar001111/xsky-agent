# Architecture: Agents & Tools

Agents are the "doers" in XSky. They execute the high-level tasks defined in the workflow.

## The Agent Loop (`src/agent/base.ts`)

Every agent follows a React-like "Render Loop":

1. **Context Preparation**: Gather conversation history, current state, and available tools.
2. **LLM Call**: Send prompt + tools to the LLM.
3. **Tool Execution**: If LLM calls a tool, execute it.
4. **Observation**: Add tool result to history.
5. **Repeat**: Loop until LLM produces a final answer or task completion.

### Base Class: `Agent`

To create a new agent, extend the `Agent` class:

```typescript
export class MyAgent extends Agent {
  name = "my_agent";
  description = "Does specialized things";

  // Optional: Dynamic system prompt
  async getAgentSystemPrompt(context: Context): Promise<string> {
    return "You are a specialized agent...";
  }

  // Optional: Add custom tools
  getTools(): Tool[] {
    return [myCustomTool];
  }
}
```

## Specialized Agents

### BrowserAgent
The most complex agent type. It abstracts browser interactions.

- **`BaseBrowserAgent`** (`core`): Defines the interface (navigate, click, screenshot).
- **Implementations**:
  - `PlaywrightBrowserAgent` (`nodejs`): Uses Playwright.
  - `WebBrowserAgent` (`web`): Uses DOM APIs.
  - `ExtensionBrowserAgent` (`extension`): Uses Chrome APIs.

### FileAgent
Handles file system access. Only available in Node/Electron runtimes for security.

## Tools

Tools are typed functions that the LLM can invoke.

### Structure
Defined using Zod schemas for runtime validation:

```typescript
import { z } from 'zod';

export const myTool = {
  name: 'my_tool',
  description: 'Does something cool',
  parameters: z.object({
    arg1: z.string(),
  }),
  execute: async ({ arg1 }) => {
    return `Result: ${arg1}`;
  }
};
```

### Tool Injection
Agents automatically get tools from three sources:
1. **Agent Tools**: Defined in `getTools()`.
2. **System Tools**: Injected by Eko (e.g., `variable_storage`, `human_interact`).
3. **MCP Tools**: Injected dynamically from connected MCP servers.

## Model Context Protocol (MCP)

XSky supports MCP to extend agents at runtime.

- **Clients**: `SimpleSseMcpClient` (SSE), `SimpleHttpMcpClient` (HTTP).
- **Integration**: Eko fetches tools from connected MCP servers and registers them with the active agent.
