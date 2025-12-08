# Project Organization

## Monorepo Layout

```
xsky/
├── packages/                    # Publishable libraries
│   ├── ai-agent-core/           # Core engine (platform-agnostic)
│   ├── ai-agent-nodejs/         # Node.js runtime (Playwright)
│   ├── ai-agent-web/            # Browser SPA runtime
│   ├── ai-agent-extension/      # Chrome extension runtime
│   └── ai-agent-electron/       # Electron desktop runtime
├── example/                     # Example applications
│   ├── nodejs/                  # Node.js usage example
│   ├── web/                     # Browser SPA example
│   ├── extension/               # Chrome extension example
│   └── electron/                # Electron app example
├── GUIDES/                      # Reference documentation
├── benchmarks/                  # Performance benchmarks
├── development/                 # Development utilities
├── .claude/                     # AI agent configuration
│   ├── steering/                # Steering documents
│   ├── skills/                  # Skill definitions
│   ├── agents/                  # Agent configurations
│   └── specs/                   # Feature specifications
├── CLAUDE.md                    # Central AI guidance
├── AGENTS.md                    # Jules implementation guide
└── package.json                 # Root workspace config
```

## Core Package Structure

`packages/ai-agent-core/src/`:

```
src/
├── index.ts                     # Public API exports
├── core/                        # Orchestration layer
│   ├── xsky.ts                  # Main XSky orchestrator
│   ├── context.ts               # Per-task state management
│   ├── chain.ts                 # Execution tracking
│   ├── plan.ts                  # Workflow planning
│   ├── replan.ts                # Workflow modification
│   └── dialogue.ts              # Chat interface
├── agent/                       # Agent implementations
│   ├── base.ts                  # Agent base class
│   ├── llm.ts                   # LLM request building
│   └── browser/                 # Browser agent bases
│       ├── browser_base.ts      # Abstract browser contract
│       ├── browser_labels.ts    # Label-based interaction
│       ├── browser_screen.ts    # Coordinate-based interaction
│       └── dom_intelligence.ts  # DOM analysis
├── tools/                       # Built-in tools
│   ├── index.ts                 # Tool exports
│   ├── human_interact.ts        # Human-in-the-loop
│   ├── variable_storage.ts      # Workflow variables
│   ├── foreach_task.ts          # ForEach iteration
│   ├── watch_trigger.ts         # DOM change detection
│   └── task_node_status.ts      # Workflow status
├── mcp/                         # MCP clients
│   ├── sse.ts                   # SSE transport
│   └── http.ts                  # HTTP transport
├── security/                    # Security layer
│   ├── tool-sandbox.ts          # Execution sandbox
│   ├── permission-evaluator.ts  # Permission rules
│   └── audit-logger.ts          # Audit logging
├── llm/                         # LLM integration
│   ├── index.ts                 # RetryLanguageModel
│   ├── provider-options.ts      # Provider defaults
│   └── circuit-breaker.ts       # Failure handling
├── memory/                      # Context management
│   └── memory.ts                # Compression, filtering
├── common/                      # Shared utilities
│   ├── xml.ts                   # Workflow XML parsing
│   ├── tree.ts                  # Agent tree construction
│   ├── utils.ts                 # General utilities
│   ├── log.ts                   # Logging
│   └── coordinate-scaling.ts    # Screenshot coordinates
└── types/                       # Type definitions
    ├── core.types.ts            # XSky, Workflow, Context
    ├── llm.types.ts             # LLM config, requests
    ├── tools.types.ts           # Tool definitions
    ├── hooks.types.ts           # Lifecycle hooks
    ├── security.types.ts        # Permission, audit
    └── mcp.types.ts             # MCP protocol
```

## Runtime Package Pattern

Each runtime follows this structure:

```
packages/ai-agent-{runtime}/
├── src/
│   ├── index.ts                 # Public exports
│   ├── browser.ts               # BrowserAgent implementation
│   ├── file.ts                  # FileAgent (nodejs/electron only)
│   ├── mcp/
│   │   └── stdio.ts             # Stdio MCP client (nodejs/electron)
│   └── preload.ts               # Preload script (electron only)
├── test/
│   ├── browser.test.ts
│   └── setup.ts
├── package.json
├── tsconfig.json
├── rollup.config.js
└── jest.config.js
```

## Key File Locations

### Configuration
| File | Purpose |
|------|---------|
| `package.json` (root) | Workspace configuration, scripts |
| `packages/*/package.json` | Package dependencies, scripts |
| `packages/*/tsconfig.json` | TypeScript configuration |
| `packages/*/rollup.config.js` | Build configuration |
| `packages/*/jest.config.js` | Test configuration |
| `.mcp.json` | MCP server configuration |

### Entry Points
| Package | Entry |
|---------|-------|
| `@xsky/ai-agent-core` | `packages/ai-agent-core/src/index.ts` |
| `@xsky/ai-agent-nodejs` | `packages/ai-agent-nodejs/src/index.ts` |
| `@xsky/ai-agent-web` | `packages/ai-agent-web/src/index.ts` |
| `@xsky/ai-agent-extension` | `packages/ai-agent-extension/src/index.ts` |
| `@xsky/ai-agent-electron` | `packages/ai-agent-electron/src/index.ts` |

### Test Locations
| Package | Test Directory |
|---------|----------------|
| ai-agent-core | `packages/ai-agent-core/test/` |
| ai-agent-nodejs | `packages/ai-agent-nodejs/test/` |
| Others | `packages/ai-agent-*/test/` |

## Module Dependencies

```
                    ┌─────────────────────┐
                    │   ai-agent-core     │
                    │  (platform-agnostic)│
                    └─────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ ai-agent-nodejs │  │  ai-agent-web   │  │ai-agent-electron│
│   (Playwright)  │  │  (html2canvas)  │  │    (Electron)   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ ai-agent-extension  │
                    │   (Chrome APIs)     │
                    └─────────────────────┘
```

**Build Order**: Core must build before any runtime package.

## Adding New Components

### New Tool
1. Create `packages/ai-agent-core/src/tools/my_tool.ts`
2. Export from `packages/ai-agent-core/src/tools/index.ts`
3. Re-export from `packages/ai-agent-core/src/index.ts` (if public)
4. Add test in `packages/ai-agent-core/test/tools/my_tool.test.ts`

### New Agent
1. For core (abstract): Add to `packages/ai-agent-core/src/agent/`
2. For runtime: Add to `packages/ai-agent-{runtime}/src/`
3. Export from package `index.ts`
4. Add test in respective `test/` directory

### New MCP Client
1. Add to `packages/ai-agent-core/src/mcp/` or runtime-specific
2. Implement `IMcpClient` interface
3. Export from `packages/ai-agent-core/src/mcp/index.ts`

## Import Rules

### Within Packages
Use relative paths:
```typescript
// In packages/ai-agent-core/src/core/xsky.ts
import { parseXml } from '../common/xml';
import type { AgentConfig } from '../types/core.types';
```

### From Consumer Code
Use package names:
```typescript
// In example/nodejs/src/index.ts
import XSky, { LLMs } from '@xsky/ai-agent-core';
import { BrowserAgent } from '@xsky/ai-agent-nodejs';
```

### Anti-Patterns
- ❌ `../../../packages/ai-agent-core/src/` - Never cross-package relative
- ❌ Node APIs in `ai-agent-core` - Keep core platform-agnostic
- ❌ Direct file system in tools - Use agent abstractions
