# Project Structure

## Documentation

> **Detailed architecture documentation is available in the `docs/` directory.**
> - [Monorepo Structure](../docs/architecture/monorepo-structure.md)
> - [Core Engine Internals](../docs/architecture/core-engine.md)
> - [Agents & Tools](../docs/architecture/agents-and-tools.md)

## Monorepo Layout

```
xsky/
├── packages/
│   ├── ai-agent-core/      # Core Eko engine (use this for agent/tool/hook patterns)
│   ├── ai-agent-nodejs/    # Node.js runtime (Playwright-based BrowserAgent)
│   ├── ai-agent-web/       # Browser SPA runtime
│   ├── ai-agent-extension/ # Chrome extension runtime
│   └── ai-agent-electron/  # Electron runtime
├── example/
│   ├── nodejs/             # Node.js usage example
│   ├── electron/           # Electron app example
│   ├── web/                # Web SPA example
│   └── extension/          # Browser extension example
└── pnpm-workspace.yaml     # Workspace config
```

## Core Package Structure (ai-agent-core)

```
packages/ai-agent-core/
├── src/
│   ├── index.ts            # Public API entry point
│   ├── core/
│   │   ├── eko.ts          # Eko orchestrator (generate, execute, run)
│   │   ├── context.ts      # Per-task state, checkpointing
│   │   ├── chain.ts        # Chain/AgentChain/ToolChain execution tracking
│   │   ├── plan.ts         # Workflow planning from prompts
│   │   ├── replan.ts       # Dynamic workflow modification
│   │   └── dialogue.ts     # EkoDialogue conversational interface
│   ├── agent/
│   │   ├── base.ts         # Agent base class (extend this for new agents)
│   │   ├── llm.ts          # LLM request building, tool conversion
│   │   └── browser/        # Browser-specific agents
│   │       ├── browser_base.ts    # BaseBrowserAgent abstract class
│   │       ├── browser_labels.ts  # Label-based DOM interaction
│   │       ├── browser_screen.ts  # Screen-based interaction
│   │       └── dom_intelligence.ts # DOM analysis utilities
│   ├── tools/
│   │   ├── index.ts        # Tool exports
│   │   ├── human_interact.ts
│   │   ├── variable_storage.ts
│   │   ├── task_node_status.ts
│   │   ├── foreach_task.ts
│   │   └── watch_trigger.ts
│   ├── mcp/
│   │   ├── sse.ts          # SimpleSseMcpClient
│   │   └── http.ts         # SimpleHttpMcpClient
│   ├── llm/
│   │   └── index.ts        # RetryLanguageModel
│   ├── common/
│   │   ├── xml.ts          # Workflow XML parsing
│   │   ├── tree.ts         # Agent tree construction
│   │   ├── utils.ts        # Shared utilities
│   │   └── coordinate-scaling.ts
│   └── types/
│       ├── core.types.ts
│       ├── llm.types.ts
│       ├── tools.types.ts
│       └── hooks.types.ts
└── test/                   # Test files
```

## Key File Locations

| To Add/Modify | Location |
|---------------|----------|
| New agent | `packages/ai-agent-core/src/agent/` (extend `Agent` or `BaseBrowserAgent`) |
| New tool | `packages/ai-agent-core/src/tools/` (export from index.ts) |
| New hook type | `packages/ai-agent-core/src/types/hooks.types.ts` |
| MCP client | `packages/ai-agent-core/src/mcp/` |
| LLM provider | `packages/ai-agent-core/src/llm/index.ts` |
| Workflow XML parsing | `packages/ai-agent-core/src/common/xml.ts` |

## File Naming Patterns

- Source files: `snake_case.ts` (e.g., `browser_base.ts`, `variable_storage.ts`)
- Type files: `*.types.ts` in `src/types/`
- Test files: `*.test.ts` alongside source or in `test/`
- Config files: Standard names (`jest.config.js`, `rollup.config.js`, `tsconfig.json`)
