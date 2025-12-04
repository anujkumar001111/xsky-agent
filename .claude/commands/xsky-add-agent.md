---
name: xsky-add-agent
description: Guided workflow to add a new agent type to XSky
allowed-tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash", "Task"]
---

# Add New Agent to XSky

You are guiding the user through adding a new agent type to the XSky AI Agent framework.

## Step 1: Understand Agent Purpose

Ask the user:
1. What should this agent specialize in?
2. What tools does it need access to?
3. Does it extend an existing agent or start fresh?

## Agent Types in XSky

| Base Class | Purpose | Example |
|------------|---------|---------|
| `Agent` | Generic agent | LLMAgent |
| `BaseBrowserAgent` | Basic browser control | - |
| `BaseBrowserLabelsAgent` | Browser with element labeling | BrowserAgent |
| `BaseBrowserScreenAgent` | Browser with screenshot approach | - |
| `BaseFileAgent` | File system operations | FileAgent |
| `BaseShellAgent` | Shell command execution | ShellAgent |
| `BaseComputerAgent` | Full computer control | ComputerAgent |

## Step 2: Design Agent Architecture

Use xsky-architect to design:

1. Which base class to extend
2. What abstract methods to implement
3. What custom tools to add
4. System prompt for the agent

## Step 3: Implement Agent

Location: `packages/ai-agent-core/src/agent/` or platform-specific package

### Agent Structure
```typescript
import { Agent, AgentContext, Tool } from "../types";

export class MyNewAgent extends Agent {
  readonly Name = "my_agent";
  readonly Description = "Description for planner";

  constructor(llms: string[], tools: Tool[] = [], mcpClient?: IMcpClient) {
    super(llms, tools, mcpClient);
  }

  // Override to add custom system prompt
  protected async extSysPrompt(ctx: AgentContext, tools: Tool[]): Promise<string> {
    return `You are a specialized agent for...`;
  }

  // Override to add custom tools
  protected getTools(ctx: AgentContext): Tool[] {
    return [
      ...super.getTools(ctx),
      myCustomTool1,
      myCustomTool2
    ];
  }
}
```

## Step 4: Export Agent

```typescript
// packages/ai-agent-core/src/agent/index.ts
export { MyNewAgent } from "./my-new-agent";
```

## Step 5: Register with Eko

```typescript
import { Eko } from "@xsky/ai-agent-core";
import { MyNewAgent } from "@xsky/ai-agent-core";

const myAgent = new MyNewAgent(['default'], []);

const eko = new Eko({
  llms: { /* ... */ },
  agents: [myAgent]
});
```

## Step 6: Test Agent

```typescript
describe('MyNewAgent', () => {
  it('should handle task appropriately', async () => {
    const agent = new MyNewAgent(['default']);
    // Test agent functionality
  });
});
```

## Step 7: Verify

```bash
pnpm build
pnpm test
```

---

Now, let's start by understanding what agent you want to create. What should this agent specialize in?
