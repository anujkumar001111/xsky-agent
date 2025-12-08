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

- **XSky Orchestrator** (`src/core/xsky.ts`)
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
    - `ProductionXSkyConfig` – Extended config with `hooks`, `stateConfig`, `approvalConfig`, `rateLimits`, `workflow`
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
pnpm test -- src/core/xsky.test.ts
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

## Implementation Guide

- **AGENTS.md**: Environment setup and implementation guidelines for Jules AI agent

---

## Quick Start

### Normal Development
Just code! No special commands needed.

### Structured AI Workflow
1. Run `/steering` first (creates/updates this file + steering docs)
2. Run `/spec <feature>` to plan features (lightweight, runs locally)
3. Run `/jules <feature>` to implement (heavy lifting, runs in cloud)
4. Run `/reviewer` to review PRs

---

## Workflow Instructions

### Spec Development (LOCAL - Lightweight)
- **Command**: `/spec <feature-name>`
- **Creates**: `.claude/specs/{feature}/` with requirements.md, design.md, tasks.md
- **Where**: Runs on your machine (lightweight text generation)
- **Approval**: Each phase requires your approval before proceeding

### Jules Implementation (CLOUD - Heavy Lifting)
- **Command**: `/jules <feature>` or `/jules "<task description>"`
- **What**: Coding, testing, building, fixing
- **Where**: Cloud VMs (offloads heavy work from your machine)
- **Output**: Pull Request
- **Status**: `/jules status` to check all accounts and sessions

### Review (LOCAL or CLOUD)
- **Command**: `/reviewer <PR-url>` or `/reviewer local`
- **Quick reviews**: Run locally
- **Deep reviews**: Can delegate heavy analysis to Jules

---

## Jules Handoff Protocol

**Before calling /jules:**
1. Spec files committed and pushed to remote
2. All phases approved (requirements, design, tasks)
3. Check session availability: `/jules status`

**Jules reads these files:**
- `AGENTS.md` - Setup and conventions
- `.claude/steering/*` - Project rules
- `.claude/specs/{feature}/*` - What to build

---

## Resource Division

| Task Type | Where | Reason |
|-----------|-------|--------|
| Spec creation | LOCAL | Lightweight text, needs human review |
| Steering docs | LOCAL | Project setup, one-time |
| Session coordination | LOCAL | Orchestration logic |
| Heavy coding | JULES | CPU-intensive, parallel capable |
| Test execution | JULES | May need full env setup |
| Complex/parallel work | JULES | Offload from local machine |
| PR review | EITHER | Local for quick, Jules for deep |

---

# Lessons

## User Specified Lessons
[To be filled by user]

## AI Learned Lessons
[To be accumulated over time]

---

# Scratchpad

[Task planning area]

---

<re_instructions>

### Workflow Initialization

Before starting any task:
1. Read ALL files in `.claude/steering/` directory
2. Read this `CLAUDE.md` file completely
3. Understand project conventions and constraints
4. Follow the rules mentioned in steering documents

### Spec Workflow Execution

To start a new feature specification:

1. **Load Workflow System**
   - Read `.claude/system-prompts/spec-workflow-starter.md` for complete instructions
   - Adopt the persona and follow instructions exactly

2. **Follow Sequence**: Requirements → Design → Tasks (as defined in loaded instructions)

### Jules Handoff Protocol

**CRITICAL**: After finalizing spec files (requirements.md, design.md, tasks.md):

**Step 1: Commit and Push Specs**
- Commit all spec files to git
- Push to remote repository
- MUST complete before Jules handoff

**Step 2: Pre-flight Checks**
```bash
# Verify clean state
git status

# Get repository info
git config --get remote.origin.url
```

**Step 3: Session Management**
- Check for existing sessions:
  - Look for `sessionId` in `.claude/specs/{feature}/feature_status.md`
  - OR search via `list_sessions` for matching source + prompt
- Reuse existing session if found via `get_session`

**Step 4: Create Jules Session** (if no existing session)

Use Google Jules MCP server with `create_session`:

```javascript
{
  source: "sources/github/<org>/<repo>",  // From git remote
  prompt: `
CONTEXT DOCUMENTS:
- Requirements: .claude/specs/{feature}/requirements.md
- Design: .claude/specs/{feature}/design.md
- Tasks: .claude/specs/{feature}/tasks.md

PROJECT CONVENTIONS:
- Read ALL files in .claude/steering/ directory first
- Follow conventions in tech.md strictly
- Respect architecture in structure.md

EXECUTION PROTOCOL:
1. Analysis Phase
   - Read steering documents completely
   - Read all spec documents (requirements, design, tasks)
   - Understand task dependencies from tasks.md diagram

2. Implementation Phase
   - Execute tasks in dependency order
   - After each milestone: Update .claude/specs/{feature}/feature_status.md
   - Every 3 tasks: Update CLAUDE.md Scratchpad section

3. Quality Gates
   - Run tests after each task
   - Verify against requirements before marking complete
   - Follow code conventions from tech.md

4. Loop Detection
   - If >5 modifications to same file without progress: STOP
   - Create draft PR with current state
   - Report: "Loop detected on [file]. Manual review needed."

5. Completion
   - Create PR with descriptive title
   - Include summary of implemented features
   - Link to feature_status.md for details

STATE TRACKING FORMAT:
feature_status.md:
---
| Task ID | Status | Timestamp | Notes |
|---------|--------|-----------|-------|
| 1       | done   | [ISO]     | [Brief note] |
| 2.1     | in_progress | [ISO] | [Current work] |
---

CLAUDE.md Scratchpad:
---
## [Feature Name] - [Status] - [Date]
- [x] Task 1
- [ ] Task 2
- Current: [What's being worked on]
---

OUTPUT: Pull Request URL
  `,
  requirePlanApproval: false
}
```

### Review Protocol

When Jules PR is submitted:

1. **Fetch Changes**
   ```bash
   git fetch origin
   git checkout [pr-branch]
   ```

2. **Verification Checklist**
   - [ ] Implementation matches requirements.md
   - [ ] Code follows conventions in tech.md
   - [ ] All tests pass
   - [ ] No security vulnerabilities introduced
   - [ ] feature_status.md is complete

3. **Security & Quality Checks**
   - Review for security vulnerabilities
   - Verify code style and patterns
   - Check for logic errors
   - Validate test coverage

4. **Decision Flow**
   ```
   If heavy refactor/fixes needed:
     → Delegate back to Jules with specific feedback

   If minimal issues:
     → Fix locally and test

   If satisfactory:
     → Merge to main
     → Clean up branches
     → Move to next feature
   ```

### File Creation Policy

**ALLOWED** (Essential files for system operation):
- Setup: `requirements.txt`, `package.json`, `README.md` (if critical)
- Configuration: `.env.example`, `config.yaml`
- Agent configs: `CLAUDE.md`, `AGENTS.md`, `.claude/` contents
- Tests: Only when explicitly needed for functionality

**FORBIDDEN** (Non-functional content):
- Analytical or summary documents (unless requested)
- Status reports, progress summaries
- Documentation for documentation's sake

### Memory Management

**Lessons Section** (Update when you learn):
```markdown
## User Specified Lessons
- [Lesson from user feedback]

## AI Learned Lessons
- [Library version that worked: library@version]
- [Fix for recurring issue: problem → solution]
```

**Scratchpad Usage** (Task planning and tracking):
```markdown
## Current Task: [Task Name]

### Understanding
[Explain the task in your own words]

### Plan
- [ ] Step 1
- [ ] Step 2
- [x] Step 3 (completed)

### Progress Notes
- [Timestamp]: [What was accomplished]
- [Timestamp]: [Blocker encountered and resolution]

### Next Steps
[What to do next]
```

</re_instructions>
