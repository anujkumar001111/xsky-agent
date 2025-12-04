# XSky AI Agent - Project Structure

> Steering document for AI assistants: Project organization, key files, and data flow

## Monorepo Organization

```
xsky/
├── packages/                      # NPM packages
│   ├── ai-agent-core/             # Core framework
│   ├── ai-agent-electron/         # Electron adapter
│   ├── ai-agent-nodejs/           # Node.js adapter
│   ├── ai-agent-web/              # Browser adapter
│   └── ai-agent-extension/        # Chrome extension adapter
│
├── example/                       # Example applications
│   ├── nodejs/                    # Node.js usage example
│   ├── web/                       # React web example
│   └── extension/                 # Browser extension example
│
├── .claude/                       # Claude Code configuration
│   ├── commands/                  # Slash commands
│   ├── skills/                    # Skill definitions
│   ├── steering/                  # These steering documents
│   └── system-prompts/            # System prompt templates
│
├── package.json                   # Monorepo root config
├── pnpm-workspace.yaml            # pnpm workspace definition
└── .mcp.json                      # MCP server configuration
```

## Core Package Structure (`packages/ai-agent-core/`)

```
ai-agent-core/
├── src/
│   ├── index.ts                   # Public API exports
│   │
│   ├── core/                      # Core runtime
│   │   ├── eko.ts                 # Main Eko orchestrator class
│   │   ├── plan.ts                # Planner for workflow generation
│   │   ├── chain.ts               # Execution chain tracking
│   │   ├── context.ts             # Task/Agent context management
│   │   ├── replan.ts              # Error recovery re-planning
│   │   ├── dialogue.ts            # LLM dialogue loop (EkoDialogue)
│   │   └── dialogue/              # Dialogue subsystem (stateful loop)
│   │       ├── variable_storage.ts# Variable store for dialogue
│   │       ├── task_planner.ts    # Dialogue task planning
│   │       └── execute_task.ts    # Dialogue task execution
│   │       # Flow: plan user task → execute nodes with tool calls → store/read variables between turns
│   │
│   ├── agent/                     # Agent implementations
│   │   ├── index.ts               # Agent exports
│   │   ├── base.ts                # Base Agent class
│   │   ├── file.ts                # BaseFileAgent
│   │   ├── shell.ts               # BaseShellAgent
│   │   ├── computer.ts            # BaseComputerAgent
│   │   ├── browser/               # Browser agent family
│   │   │   ├── index.ts           # Browser agent exports
│   │   │   ├── base.ts            # BaseBrowserAgent
│   │   │   ├── labels.ts          # BaseBrowserLabelsAgent
│   │   │   ├── screen.ts          # BaseBrowserScreenAgent
│   │   │   ├── browser_labels.ts  # Label rendering system
│   │   │   ├── dom_intelligence.ts # DOM element analysis
│   │   │   ├── utils.ts           # Browser utilities
│   │   │   └── extractors/        # DOM content extractors
│   │   └── a2a/                   # Agent-to-Agent protocol
│   │
│   ├── llm/                       # LLM provider layer
│   │   ├── index.ts               # LLM exports
│   │   ├── retry.ts               # RetryLanguageModel with fallback
│   │   └── providers/             # Provider implementations
│   │
│   ├── mcp/                       # MCP client implementations
│   │   ├── index.ts               # MCP exports
│   │   ├── sse.ts                 # SimpleSseMcpClient
│   │   └── http.ts                # SimpleHttpMcpClient
│   │
│   ├── memory/                    # Memory management
│   │   └── memory.ts              # EkoMemory with compression
│   │
│   ├── tools/                     # Built-in tools
│   │   ├── index.ts               # Tool exports
│   │   ├── human.ts               # HumanInteractTool
│   │   ├── status.ts              # TaskNodeStatusTool
│   │   ├── variable.ts            # VariableStorageTool
│   │   ├── foreach.ts             # ForeachTaskTool
│   │   └── watch.ts               # WatchTriggerTool
│   │
│   ├── prompt/                    # System prompts
│   │   └── plan.ts                # Planning prompt generators
│   │
│   ├── common/                    # Shared utilities
│   │   ├── log.ts                 # Logging utility
│   │   ├── utils.ts               # General utilities
│   │   ├── xml.ts                 # XML parsing for workflows
│   │   └── tree.ts                # Agent tree building
│   │
│   ├── config/                    # Configuration
│   │   └── index.ts               # Global config object
│   │
│   └── types/                     # Type definitions
│       ├── index.ts               # Type re-exports
│       ├── core.types.ts          # Core type definitions
│       ├── llm.types.ts           # LLM-related types
│       ├── mcp.types.ts           # MCP-related types
│       └── tools.types.ts         # Tool-related types
│
├── test/                          # Tests
│   ├── core/                      # Core tests
│   │   └── eko.test.ts            # Eko orchestrator tests
│   └── browser/                   # Browser tests
│       └── extractors/            # Extractor tests
│
├── package.json                   # Package manifest
├── rollup.config.js               # Rollup build config
├── tsconfig.json                  # TypeScript config
└── jest.config.js                 # Jest config
```

## Key Files Reference

### Entry Points
| File | Purpose |
|------|---------|
| `packages/ai-agent-core/src/index.ts` | Main public API |
| `packages/ai-agent-core/src/core/eko.ts` | Eko orchestrator class |
| `packages/ai-agent-*/src/index.ts` | Environment adapter exports |

### Public API Exports (from index.ts)
| Export | Type | Purpose |
|--------|------|---------|
| `Eko` | Class | Main orchestrator (default + named) |
| `EkoDialogue` | Class | Stateful LLM dialogue loop (dialogue.ts) |
| `EkoMemory` | Class | Conversation memory with compression |
| `Context` | Class | Task execution context |
| `AgentContext` | Class | Agent-specific context |
| `Planner` | Class | Workflow planning from prompts |
| `Chain`, `AgentChain` | Class | Execution history tracking |
| `Log` | Object | Logging utility |
| `config` | Object | Global configuration |
| `SimpleSseMcpClient` | Class | SSE-based MCP client |
| `SimpleHttpMcpClient` | Class | HTTP-based MCP client |
| `RetryLanguageModel` | Class | LLM with retry logic |
| `parseWorkflow` | Function | XML → Workflow parsing |
| `resetWorkflowXml` | Function | Reset workflow XML state |
| `buildSimpleAgentWorkflow` | Function | Build single-agent workflow |
| `buildAgentTree` | Function | Build agent dependency tree |
| `extract_page_content` | Function | DOM content extraction |
| `mergeTools`, `toImage`, `toFile` | Function | Utility functions |
| `convertToolSchema`, `uuidv4` | Function | Schema and ID utilities |

### Core Runtime Files
| File | Purpose |
|------|---------|
| `core/eko.ts` | Task orchestration, workflow execution |
| `core/plan.ts` | LLM-powered workflow planning |
| `core/chain.ts` | Execution history chain |
| `core/context.ts` | Task and agent state management |
| `core/replan.ts` | Error recovery re-planning |
| `core/dialogue.ts` | Agent-LLM dialogue loop |

### Agent Files
| File | Purpose |
|------|---------|
| `agent/base.ts` | Base Agent abstract class |
| `agent/browser/base.ts` | BaseBrowserAgent implementation |
| `agent/browser/labels.ts` | Element labeling for clicks |
| `agent/browser/dom_intelligence.ts` | DOM element analysis |

### Type Definition Files
| File | Key Types |
|------|-----------|
| `types/core.types.ts` | EkoConfig, Workflow, WorkflowAgent, EkoResult |
| `types/llm.types.ts` | LLMs, LLMRequest |
| `types/mcp.types.ts` | IMcpClient |
| `types/tools.types.ts` | Tool, ToolResult |

### Configuration Files
| File | Purpose |
|------|---------|
| `config/index.ts` | Global configuration (maxReactNum, etc.) |
| `pnpm-workspace.yaml` | Workspace package definitions |
| `.mcp.json` | MCP server configurations |

## Data Flow

### Task Execution Flow
```
User Input (taskPrompt)
        ↓
    Eko.run()
        ↓
    Eko.generate()
        ↓
    Planner.plan()
        ↓
LLM generates XML workflow
        ↓
    parseWorkflow()
        ↓
Workflow { agents, dependencies }
        ↓
    Eko.execute()
        ↓
    doRunWorkflow()
        ↓
buildAgentTree() → AgentNode tree
        ↓
┌─────────────────────────────┐
│ For each AgentNode:         │
│   ├─ runAgent()             │
│   ├─ Agent.run()            │
│   ├─ Dialogue loop          │
│   │   ├─ LLM call           │
│   │   ├─ Tool execution     │
│   │   └─ Result processing  │
│   └─ agentNode.result       │
└─────────────────────────────┘
        ↓
    EkoResult { success, result }
```

### Streaming Callback Flow
```
Execution Event
      ↓
StreamCallbackMessage created
      ↓
config.callback.onMessage(message)
      ↓
Await callback completion
      ↓
Continue execution
```

### Context Hierarchy
```
Eko
 └─ taskMap: Map<taskId, Context>
      │
      Context
      ├─ taskId: string
      ├─ config: EkoConfig
      ├─ agents: Agent[]
      ├─ chain: Chain
      ├─ workflow: Workflow
      ├─ variables: Map<string, any>
      └─ controller: AbortController
           │
           AgentContext
           ├─ context: Context (parent)
           ├─ agent: Agent
           ├─ agentChain: AgentChain
           ├─ variables: Map<string, any>
           └─ messages: LanguageModelV2Prompt
```

### Workflow XML Structure
```xml
<workflow name="Task Name">
  <thought>Planning reasoning...</thought>
  <agent id="1" name="Browser" dependsOn="">
    <task>Navigate to website</task>
    <node>
      <text>Click login button</text>
    </node>
  </agent>
  <agent id="2" name="Browser" dependsOn="1">
    <task>Fill form</task>
    <node>
      <text>Enter username</text>
    </node>
  </agent>
</workflow>
```

## Environment Adapter Mapping

| Package | Platform | Key Files |
|---------|----------|-----------|
| `ai-agent-nodejs` | Node.js + Playwright | `src/index.ts`, `src/mcp/stdio.ts` |
| `ai-agent-web` | Browser | `src/index.ts` |
| `ai-agent-extension` | Chrome Extension | `src/index.ts` |
| `ai-agent-electron` | Electron | `src/browser.ts`, `src/preload.ts` |

## Test Locations

| Package | Test Directory |
|---------|---------------|
| `ai-agent-core` | `packages/ai-agent-core/test/` |
| `ai-agent-nodejs` | `packages/ai-agent-nodejs/test/` |
| `ai-agent-electron` | `packages/ai-agent-electron/test/` |
| `ai-agent-web` | `packages/ai-agent-web/test/` |
| `ai-agent-extension` | `packages/ai-agent-extension/test/` |

## Build Outputs

Each package produces:
```
dist/
├── index.cjs.js      # CommonJS bundle
├── index.esm.js      # ES Module bundle
├── index.d.ts        # TypeScript declarations
└── *.d.ts            # Additional type declarations
```

## Configuration Locations

| Purpose | Location |
|---------|----------|
| Monorepo config | `package.json` (root) |
| Workspace definition | `pnpm-workspace.yaml` |
| TypeScript | `*/tsconfig.json` |
| Jest | `*/jest.config.js` |
| Rollup | `*/rollup.config.js` |
| MCP servers | `.mcp.json` |
| Claude Code | `.claude/` |
