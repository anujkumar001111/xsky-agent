# Structure Steering

This document defines the project organization, file naming patterns, and key file locations for the XSky AI Agent monorepo.

## Monorepo Layout

```
xsky/
├── packages/              # Reusable libraries and runtimes
│   ├── ai-agent-core/     # Core orchestrator, agents, tools, MCP
│   ├── ai-agent-nodejs/   # Node.js runtime (Playwright)
│   ├── ai-agent-web/      # Browser SPA runtime
│   ├── ai-agent-extension/# Chrome extension runtime
│   └── ai-agent-electron/ # Electron desktop runtime
├── example/               # Example applications
│   ├── nodejs/            # Node.js example
│   ├── web/               # Web example
│   ├── extension/         # Chrome extension example
│   └── electron/          # Electron example
├── docs/                  # Documentation
├── GUIDES/                # Implementation guides
├── benchmarks/            # Performance benchmarks
└── development/           # Development utilities
```

Avoid new top-level directories unless they serve cross-package concerns.

## Core Package Structure

`packages/ai-agent-core/src/`:

```
src/
├── core/                  # Orchestration layer
│   ├── xsky.ts             # Main XSky orchestrator
│   ├── context.ts         # Per-task state management
│   ├── plan.ts            # Workflow planning
│   ├── replan.ts          # Workflow modification
│   ├── dialogue.ts        # XSkyDialogue chat interface
│   └── chain.ts           # Execution tracking
├── agent/                 # Agent implementations
│   ├── base.ts            # Agent base class
│   ├── llm.ts             # LLM request building
│   └── browser/           # Browser-specific agents
│       ├── browser_base.ts
│       ├── browser_labels.ts
│       ├── browser_screen.ts
│       └── dom_intelligence.ts
├── tools/                 # Built-in tools
│   ├── index.ts           # Tool exports
│   ├── human_interact.ts
│   ├── variable_storage.ts
│   ├── foreach_task.ts
│   └── watch_trigger.ts
├── mcp/                   # MCP client implementations
│   ├── sse.ts             # SSE-based client
│   └── http.ts            # HTTP-based client
├── security/              # Security layer
│   ├── tool-execution-sandbox.ts
│   ├── default-permission-evaluator.ts
│   └── in-memory-audit-logger.ts
├── common/                # Shared utilities
│   ├── xml.ts             # XML workflow parsing
│   ├── tree.ts            # Workflow tree construction
│   ├── utils.ts           # General utilities
│   └── coordinate-scaling.ts
├── llm/                   # LLM integration
│   └── index.ts           # RetryLanguageModel
├── types/                 # Type definitions
│   ├── core.types.ts
│   ├── llm.types.ts
│   ├── tools.types.ts
│   ├── hooks.types.ts
│   └── security.types.ts
└── index.ts               # Public API exports
```

## Package Directory Pattern

Each `packages/<name>/` follows this structure:

```
packages/<name>/
├── src/                   # TypeScript source
├── test/                  # Jest tests (or __tests__/)
├── dist/                  # Build output (git-ignored)
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── rollup.config.js       # (or .mjs/.ts)
└── jest.config.js         # (or .ts)
```

## File Naming

- **kebab-case** for all files: `tool-execution-sandbox.ts`, `browser-agent.ts`
- Match nearby file conventions when ambiguous
- Use descriptive names: `default-permission-evaluator.ts` not `permissions.ts`

## Index Files

Use `index.ts` for public exports:

```typescript
// packages/ai-agent-core/src/index.ts
export { XSky } from './core/xsky';
export { LLMs, RetryLanguageModel } from './llm';
export * from './tools';
export * from './types/core.types';
```

## Import Rules

### Within Packages
Use relative paths:
```typescript
// In packages/ai-agent-core/src/core/xsky.ts
import { parseXml } from '../common/xml';
import type { AgentConfig } from '../types/core.types';
```

### From Consumers/Examples
Use package names:
```typescript
// In example/nodejs/src/index.ts
import { XSky, LLMs } from '@xsky/ai-agent-core';
import { BrowserAgent } from '@xsky/ai-agent-nodejs';
```

Never use relative paths like `../../packages/ai-agent-core/src/`.

## Agent Locations

| Agent Type | Location |
|------------|----------|
| Core base agents | `packages/ai-agent-core/src/agent/` |
| Node.js agents (Browser, File) | `packages/ai-agent-nodejs/src/` |
| Web agents | `packages/ai-agent-web/src/` |
| Extension agents | `packages/ai-agent-extension/src/` |
| Electron agents | `packages/ai-agent-electron/src/` |

## Tool Locations

Add new tools to `packages/ai-agent-core/src/tools/`:

1. Create file: `src/tools/my_new_tool.ts`
2. Export from: `src/tools/index.ts`
3. Re-export from: `src/index.ts` (if public API)

## Test Organization

Mirror source structure in tests:

| Source | Test |
|--------|------|
| `src/core/xsky.ts` | `test/core/xsky.test.ts` |
| `src/tools/human_interact.ts` | `test/tools/human_interact.test.ts` |

## Key Entry Points

| Purpose | File |
|---------|------|
| Core public API | `packages/ai-agent-core/src/index.ts` |
| Node.js runtime | `packages/ai-agent-nodejs/src/index.ts` |
| Web runtime | `packages/ai-agent-web/src/index.ts` |
| Extension runtime | `packages/ai-agent-extension/src/index.ts` |
| Electron runtime | `packages/ai-agent-electron/src/index.ts` |

## Example Entry Points

| Environment | Entry Point |
|-------------|-------------|
| Node.js | `example/nodejs/src/index.ts` |
| Web | `example/web/src/main.ts` |
| Extension | `example/extension/src/*` |
| Electron | `example/electron/src/*` |

## Anti-Patterns

### Avoid
- Mixing Node-only APIs (`fs`, `path`, `child_process`) into `ai-agent-core`
- Creating parallel tool systems outside `src/tools/`
- Deep relative imports across packages: `../../../packages/ai-agent-core/src/`
- Multiple index files with conflicting exports

### Prefer
- Keep runtime-specific code in environment packages
- Extend existing `src/tools/` system
- Use package names for cross-package imports
- Single authoritative `index.ts` per package
