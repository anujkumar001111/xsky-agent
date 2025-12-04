---
name: xsky-add-tool
description: Guided workflow to add a new browser tool to XSky
allowed-tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash", "Task"]
---

# Add New Browser Tool to XSky

You are guiding the user through adding a new browser tool to the XSky AI Agent framework.

## Step 1: Gather Tool Requirements

Ask the user:
1. What should this tool do?
2. What parameters does it need?
3. Which platforms should support it? (Electron, Web, Extension, Node.js)

## Step 2: Design the Tool

Based on requirements, design:

```typescript
export const myNewTool: Tool = {
  name: "tool_name",           // snake_case naming
  description: "...",           // Clear description for LLM
  parameters: {
    type: "object",
    properties: {
      param1: { type: "string", description: "..." }
    },
    required: ["param1"]
  },
  async execute(args, agentContext): Promise<ToolResult> {
    // Implementation
  }
};
```

## Step 3: Determine Implementation Location

Based on platform requirements:

- **All platforms** → Add to `packages/ai-agent-core/src/agent/browser/tools/`
- **Electron only** → Add to `packages/ai-agent-electron/src/tools/`
- **Node.js only** → Add to `packages/ai-agent-nodejs/src/tools/`
- **Web only** → Add to `packages/ai-agent-web/src/tools/`
- **Extension only** → Add to `packages/ai-agent-extension/src/tools/`

## Step 4: Implement the Tool

Use the browser-tools-specialist agent to implement:

1. Create the tool file
2. Add proper TypeScript types
3. Handle errors gracefully
4. Support both secure (contextIsolation) and legacy modes for Electron

## Step 5: Register the Tool

Export from the appropriate index.ts:

```typescript
// In the relevant package's index.ts or tools/index.ts
export { myNewTool } from "./my-new-tool";
```

## Step 6: Write Tests

Use xsky-test-engineer to write tests:

```typescript
describe('myNewTool', () => {
  it('should ...', async () => {
    // Test implementation
  });
});
```

## Step 7: Verify

```bash
pnpm build
pnpm test
```

## Step 8: Document

Add JSDoc comments and update relevant documentation.

---

Now, let's start by understanding what tool you want to add. What should this tool do?
