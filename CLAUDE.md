# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before Starting

1. Read steering docs in `.claude/steering/` for detailed context:
   - `product.md` - Features, business rules
   - `tech.md` - Tech stack, commands, conventions
   - `structure.md` - Project layout, data flow

2. Understand the workflow: `/steering` → `/spec` → `/jules` → `/reviewer`

## Project Map

XSky is an AI agent framework. Core logic in `ai-agent-core`, platform adapters for different environments.

```
packages/
├── ai-agent-core/           # Core framework
│   ├── src/core/            # Eko, Planner, Context, Chain, Dialogue
│   ├── src/agent/           # Agent base + browser/file/shell agents
│   ├── src/tools/           # Built-in tools
│   ├── src/mcp/             # MCP clients (SSE, HTTP)
│   ├── src/memory/          # Conversation compression
│   └── src/types/           # Type definitions (*.types.ts)
├── ai-agent-nodejs/         # Node.js + Playwright + stdio MCP
├── ai-agent-web/            # Browser environment
├── ai-agent-extension/      # Chrome extension
└── ai-agent-electron/       # Electron (preload bridge)
```

**Execution:** `Eko.run()` → `Planner.plan()` (NL→XML) → `parseWorkflow()` → `buildAgentTree()` → `Agent.run()` loop → `EkoResult`

## Commands

```bash
pnpm install                                     # Install all
pnpm build                                       # Build all packages
pnpm test                                        # Run all tests
pnpm clean                                       # Remove node_modules & dist
pnpm --filter @xsky/ai-agent-core test           # Test one package
pnpm --filter @xsky/ai-agent-core test -- test/core/eko.test.ts  # Single test

# Run examples
cd example/nodejs && pnpm install && pnpm start
```

## Workflow

1. **Explore** - Read relevant files to understand existing patterns
2. **Plan** - For multi-file changes, outline approach first
3. **Implement** - Follow conventions below
4. **Test** - Run `pnpm test` in affected package

## Key Conventions

**Class naming:** `Base*` = abstract, `Simple*` = basic implementation
**Exports:** Named exports preferred; default only for `Eko`
**Types:** Separate `*.types.ts` files
**Tests:** `test/` directory with `*.test.ts` extension
**Errors:** Cancellation errors MUST use `error.name = "AbortError"`
**Build:** Rollup → `dist/index.cjs.js` + `dist/index.esm.js`

## Non-Obvious Patterns

- **AgentContext** created inside `Agent.run()`, not before - hooks receive it after creation
- **Tool results** return text, image, or text+image via `ToolResult.content[]` array
- **Variable storage** uses `VariableStorageTool` - maps to XML `input`/`output` attributes
- **Message compression** triggers at 80 messages OR 80,000 tokens
- **Consecutive tool errors** limit: 10 failures = agent abort (resets on success)
- **Parallel agents** OFF by default (`config.agentParallel = false`)
- **Expert mode** enables todo list management + result validation every 10 loops

## Adding Components

**New Agent** - Extend `Agent` inside `packages/ai-agent-core/src/agent/my_agent.ts` and register with `eko.addAgent()`:
```typescript
import { Agent, type AgentParams } from "./base";

export class MyAgent extends Agent {
  constructor(params: AgentParams) {
    super({
      ...params,
      name: "MyAgent",
    });
  }
}
```

**New Tool** - Export `Tool` object with JSON Schema parameters inside `packages/ai-agent-core/src/tools/my_tool.ts`:
```typescript
import type { Tool, ToolResult } from "../types/tools.types";

export const MyTool: Tool = {
  name: "my_tool",
  description: "...",
  parameters: { type: "object", properties: { /* schema */ } },
  async execute(args, agentContext): Promise<ToolResult> {
    return { content: [{ type: "text", text: "result" }] };
  }
};
```

**Override points:** `buildSystemPrompt()`, `buildUserPrompt()`, `extSysPrompt()`, `controlMcpTools()`

## Key Files

| Purpose | File |
|---------|------|
| Main orchestrator | `core/eko.ts` |
| Agent base + React loop | `agent/base.ts` |
| State management | `core/context.ts` |
| NL → XML planning | `core/plan.ts` |
| Production hooks | `types/hooks.types.ts` |
| Hook utilities | `src/utils/` (RateLimiter, createBlocklistHook, etc.) |

## Environment

At least one LLM provider key required:
```bash
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
OPENROUTER_API_KEY=
DEEPSEEK_API_KEY=
```

## Slash Commands

- `/xsky-dev` - Start development workflow
- `/xsky-add-agent` - Guided agent creation
- `/xsky-add-tool` - Guided tool creation
- `/spec <feature>` - Plan features
- `/reviewer` - Review code/PRs

## Getting Help

- Advanced patterns: `GUIDES/hooks-and-control.md`
- Workflow XML parsing: `src/common/xml.ts`
- Full type reference: `src/types/index.ts`
- Debug logging: `Log.setLevel(0)` for verbose output

<reflection_protocol> 
After completing each major task: 1. Self-Review: - Did I fully address the requirements? - Are there edge cases I missed? - Is the code maintainable by other developers? 2. Alternative Approaches: - What other solutions did I consider? - Why did I choose this approach? - Under what conditions would alternatives be better? 3. Risk Assessment: - What could go wrong in production? - What monitoring/alerts should be added? - What's the rollback procedure? 4. Learning: - What patterns worked well? - What would I do differently next time? Document your reflection and update approach accordingly.
</reflection_protocol>

<default_to_action>
By default, implement changes rather than only suggesting them. If the user's intent is unclear, infer the most useful likely action and proceed, using tools to discover any missing details instead of guessing. Try to infer the user's intent about whether a tool call (e.g., file edit or read) is intended or not, and act accordingly.
</default_to_action>

<investigate_before_answering>
ALWAYS read and understand relevant files before proposing code edits. Do not speculate about code you have not inspected. If the user references a specific file/path, you MUST open and inspect it before explaining or proposing fixes. Be rigorous and persistent in searching code for key facts. Thoroughly review the style, conventions, and abstractions of the codebase before implementing new features or abstractions.
</investigate_before_answering>

<autonomous_execution>
Your context window will be automatically compacted as it approaches its limit, allowing you to continue working indefinitely from where you left off. Therefore, do not stop tasks early due to token budget concerns. As you approach your token budget limit, save your current progress and state to memory before the context window refreshes. Always be as persistent and autonomous as possible and complete tasks fully, even if the end of your budget is approaching.
<autonomous_execution>

<use_parallel_tool_calls>
If you intend to call multiple tools and there are no dependencies between the tool calls, make all of the independent tool calls in parallel. Prioritize calling tools simultaneously whenever the actions can be done in parallel rather than sequentially. For example, when reading 3 files, run 3 tool calls in parallel to read all 3 files into context at the same time. Maximize use of parallel tool calls where possible to increase speed and efficiency. However, if some tool calls depend on previous calls to inform dependent values like the parameters, do NOT call these tools in parallel and instead call them sequentially. Never use placeholders or guess missing parameters in tool calls. choose models ( opus,sonnet,haiku ) based on the task complexity and requirements.
</use_parallel_tool_calls>

