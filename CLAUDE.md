# CLAUDE.md

<autonomous_execution>
Your context window auto-compacts near limits, allowing indefinite work continuation. Never stop tasks early due to token concerns. Save progress/state to memory before context refresh. Always complete tasks fully and autonomously.
</autonomous_execution>

<use_parallel_tool_calls>
Call multiple independent tools simultaneously—never sequentially when no dependencies exist. Example: read 3 files with 3 parallel calls. Only use sequential calls when parameters depend on previous results. Never use placeholders or guess parameters. Select model (opus/sonnet/haiku) based on task complexity.
</use_parallel_tool_calls>

<sub_agent_coordination>
Use sub-agents for: complex investigations, parallel workstreams, specialized tasks, or preserving main context during long tasks.
Dispatch with: clear self-contained instructions, expected output format, success criteria, and request for status updates.
Sub-agents work independently and report condensed findings.
</sub_agent_coordination>

## Steering Documents

Before starting any task, read these steering documents in `.claude/steering/`:

| Document | Purpose |
|----------|---------|
| `product.md` | Product purpose, core features, user value, business logic rules |
| `tech.md` | Tech stack, dependencies, common commands, conventions |
| `structure.md` | Monorepo layout, package structure, key file locations |

## Monorepo Overview

This is the XSky AI Agent monorepo (`@xsky/ai-agent-monorepo`). It contains a core agent framework plus environment-specific runtimes:

- `packages/ai-agent-core`: Core XSky agent engine (planning, dialogue, tools, MCP, hooks)
- `packages/ai-agent-nodejs`: Node.js/Playwright runtime (`BrowserAgent`, `FileAgent`)
- `packages/ai-agent-web`: Browser runtime for in-page automation
- `packages/ai-agent-extension`: Browser extension runtime
- `packages/ai-agent-electron`: Electron desktop/runtime integration
- `example/`: Example apps for Node.js, Electron, browser extension, and web

Top-level package manager: **pnpm**.

## Top-Level Commands

Run from repo root:

- `pnpm install` – Install all workspace dependencies
- `pnpm build` – Build all packages (`pnpm -r --sequential build`)
- `pnpm test` – Run all package test suites (`pnpm -r --sequential test`)
- `pnpm clean` – Remove `node_modules` and `dist` in all workspaces

Package-specific (run inside each package directory):

- `pnpm build` – Build that package via Rollup
- `pnpm test` – Run Jest tests for that package

Core package Jest config: `packages/ai-agent-core/jest.config.js`.

## Core Architecture (ai-agent-core)

Main public entry: `packages/ai-agent-core/src/index.ts`.

Key building blocks:

- **XSky Orchestrator** (`src/core/eko.ts`)
  - `XSky.generate(...)` – Plan workflow for a task prompt
  - `XSky.execute(taskId)` – Execute an existing workflow
  - `XSky.run(taskPrompt, taskId?, contextParams?)` – Generate + execute in one call
  - Manages `taskMap`, pause/resume/abort, and integrates hooks

- **Workflow & Chain**
  - `Context` (`src/core/context.ts`) – Per-task state (agents, variables, AbortController, checkpointing, state-change hooks)
  - `Chain`/`AgentChain`/`ToolChain` (`src/core/chain.ts`) – Tracks LLM requests, tool calls, and agent execution timeline
  - `Planner`/`replan` (`src/core/plan.ts`, `src/core/replan.ts`) – Builds and modifies XML-based workflows

- **Agents**
  - `Agent` base class (`src/agent/base.ts`) – Core “React-style” loop around LLM + tools
    - `run(context, agentChain)` → `runWithContext(...)`
    - Builds system/user prompts via `getAgentSystemPrompt`/`getAgentUserPrompt`
    - Handles MCP tools (dynamic tools from external servers)
    - Manages tool execution, error handling, and callbacks
  - Browser-specific agents under `src/agent/browser/`:
    - `BaseBrowserAgent` (`browser_base.ts`) – Abstract browser contract (screenshot, navigate, tabs, go_back, DOM extraction helpers)
    - `browser_labels.ts`, `browser_screen.ts`, `dom_intelligence.ts` – Higher-level browser control/introspection

- **Dialogue Layer**
  - `XSkyDialogue` (`src/core/dialogue.ts`) – Chat-style interface over `XSky`
    - Uses `RetryLanguageModel` + internal tools:
      - Task planning (`task_planner`)
      - Task execution (`execute_task`)
      - Dialogue-scoped variable storage (`dialogue/variable_storage`)

- **LLM Integration**
  - `RetryLanguageModel` (`src/llm/index.ts`)
    - Wraps AI SDK providers (`@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/amazon-bedrock`, `@openrouter/ai-sdk-provider`, `@ai-sdk/deepseek`)
    - Provides non-stream (`call`/`doGenerate`) and stream (`callStream`/`doStream`) APIs
    - Selects among configured models (`LLMs`), applies provider options and timeouts
  - `src/agent/llm.ts` – Tool conversion, request building, default provider options

- **Tools System**
  - Exported tools in `src/tools/index.ts` / `src/tools/*.ts`:
    - `HumanInteractTool` – Ask for human input
    - `TaskNodeStatusTool` – Inspect workflow node status
    - `VariableStorageTool` – Agent-level variable read/write
    - `ForeachTaskTool` – Handle `<forEach>` workflow constructs
    - `WatchTriggerTool` – Handle `<watch>` workflow constructs
  - Agent automatically injects system tools based on workflow XML (`system_auto_tools` in `Agent`):
    - Adds variable/foreach/watch tools where needed, plus `HumanInteractTool` by default

- **MCP (Model Context Protocol)**
  - Clients under `src/mcp/`:
    - `SimpleSseMcpClient` (`sse.ts`) – SSE-based MCP client with reconnection logic, request/response map, and protocol version `2024-11-05`
    - `SimpleHttpMcpClient` (`http.ts`) – HTTP transport
  - MCP tools are surfaced to agents via `McpTool` + `ToolWrapper` and `IMcpClient` interface

- **Hooks & Production Configuration**
  - Types in `src/types/hooks.types.ts`:
    - `AgentHooks` – Main hooks interface
      - `beforeAgentStart`, `afterAgentComplete`
      - `beforeToolCall`, `afterToolCall`, `onToolError`, `onAgentError`
      - `onApprovalRequired` (human-in-the-loop)
      - `onCheckpoint`, `onStateChange` (persistence)
      - `onWorkflowGenerated`, `onWorkflowStepComplete`, `onWorkflowComplete`
    - `ProductionEkoConfig` – Extended config with `hooks`, `stateConfig`, `approvalConfig`, `rateLimits`, `workflow`
  - `Context` implements checkpointing and debounced state-change notifications via these hooks.

- **Utilities & XML**
  - `src/common/xml.ts` – Workflow XML parsing and helpers
  - `src/common/tree.ts` – Workflow agent tree construction
  - `src/common/utils.ts` – Shared utilities (`mergeTools`, `uuidv4`, `call_timeout`, etc.)
  - `src/common/coordinate-scaling.ts` – Map screenshot coordinates across scales

## Environment Runtimes

Each environment package wraps `ai-agent-core` with platform-specific agents and tooling.

- **Node.js Runtime (`packages/ai-agent-nodejs`)**
  - Depends on `playwright` and `chromium-bidi`
  - Provides `BrowserAgent`, `FileAgent` for Node-based automation
  - Example usage: `example/nodejs/src/index.ts`
    - Configures `LLMs`, creates `XSky`, registers `BrowserAgent` + `FileAgent`, and runs a natural-language task

- **Web Runtime (`packages/ai-agent-web`)**
  - Uses `html2canvas` for screenshots
  - Targets browser SPA usage (see `example/web`)

- **Browser Extension Runtime (`packages/ai-agent-extension`)**
  - Integrates with Chrome extension APIs (`@types/chrome`)
  - Example extension implementation under `example/extension`

- **Electron Runtime (`packages/ai-agent-electron`)**
  - Depends on `electron`
  - Provides bindings/hooks for Electron main/preload/renderer (see `example/electron`)

## Testing

Per-package Jest configs (all use `ts-jest`):

- Core: `packages/ai-agent-core/jest.config.js`
  - `preset: "ts-jest"`, `testEnvironment: "node"`
  - Roots: `<rootDir>/src`, `<rootDir>/test`
  - `setupFiles`: `dotenv/config`, `test/jest.polyfills.ts`
  - `testMatch`: `**/*.test.ts`
- Other packages (`ai-agent-nodejs`, `ai-agent-web`, `ai-agent-extension`, `ai-agent-electron`) have simple Jest configs co-located in each package.

Run a single test file (example for core):

```bash
cd packages/ai-agent-core
pnpm test -- src/core/eko.test.ts
```

## Examples & Getting Started

Look at `example/` for end-to-end usage:

- **Node.js**: `example/nodejs/src/index.ts` – minimal setup for `XSky` with `BrowserAgent` + `FileAgent`
- **Electron**: `example/electron/src/main/*`, `preload`, `renderer`
- **Web**: `example/web/src/main.ts`
- **Extension**: `example/extension/src/*`

These examples are the fastest way to understand how `XSky`, `Agent`, tools, and callbacks are wired together in each environment.

## Style & Conventions

- TypeScript with strict typing; 2-space indentation, single quotes, semicolons
- Named exports from modules; default export only where it improves DX (e.g., `XSky`)
- Core types live under `src/types/` (`core.types.ts`, `llm.types.ts`, `tools.types.ts`, `hooks.types.ts`)
- Keep new hooks, tools, and agents consistent with existing patterns in:
  - `src/agent/base.ts`, `src/agent/browser/*`
  - `src/tools/*`
  - `src/core/*` (planning, dialogue, context)

When adding new features, prefer extending the core primitives (Agent, Tool, Hooks, MCP clients) rather than introducing ad-hoc orchestration logic in environment packages.
