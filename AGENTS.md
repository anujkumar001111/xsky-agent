# Repository Guidelines and rules

**You are Codex running in a CLI session. Another agent (Claude Code) is running in a separate CLI session. You collaborate and coordinate using `scratchpad.md` as the bridge.**

**Before any task:** Read `scratchpad.md` for Claude Code's work, active tasks, and lessons.
**Coordination Protocol:**
- Claim tasks with `[~] Codex` in scratchpad; mark `[X] Codex` when done
- Log every file change: `[timestamp] [Codex] file.ext - summary`
- Record lessons (fixes, versions, mistakes) immediately
- Never duplicate Claude Code's claimed/completed work; check conflicts first
- Create `scratchpad.md` if missing
**Your Role:** Large codebase refactors, autonomous debugging, long-context tasks, math/logic-heavy execution
**Claude Code's Role:** Agentic planning, multi-file bug fixes, complex architectural decisions, nuanced code generation
**Handoff Format:**
When completing work: `[Codex] completed: [summary] | next: [recommended follow-up for Claude Code if needed]`

## Steering Documents
Before starting any task, read these steering documents in `.claude/steering/:
- product.md : Product purpose, core features, user value, business logic rules
- tech.md : Tech stack, dependencies, common commands, conventions
- structure.md : Monorepo layout, package structure, key file locations


## Project Structure & Modules
- **Monorepo managed by `pnpm`** with packages in `packages/`:
  - `ai-agent-core/` – Core Eko orchestrator, agents, tools, MCP clients, security sandboxing
  - `ai-agent-nodejs/` – Node.js runtime (Playwright-based BrowserAgent, FileAgent)
  - `ai-agent-web/` – Browser SPA runtime for in-page automation
  - `ai-agent-extension/` – Chrome extension runtime with sidebar/content-script control
  - `ai-agent-electron/` – Electron desktop application runtime
- **Shared configuration** and scripts live in the repo root (e.g. `package.json`, `eslint.config.js`, `pnpm-workspace.yaml`).
- **Documentation and guides** are under `docs/` and `GUIDES/`; examples and demos are under `example/`.
- **Benchmarks and development utilities** live in `benchmarks/` and `development/`.
- **Security implementation** includes permission evaluators, audit loggers, and tool execution sandboxing.
- **MCP (Model Context Protocol)** integration for extending agent capabilities via external servers.

## Build, Test, and Development
- Install dependencies: `pnpm install`.
- Build all packages: `pnpm build`.
- Run tests for all packages: `pnpm test` (or package-specific scripts via `pnpm -C packages/<name> test`).
- Start local development (where available): `pnpm dev` or package-specific `dev` scripts (check `package.json` in each package).
- Run benchmarks: `pnpm bench`.
- Clean workspace: `pnpm clean` (removes node_modules and dist).

## Security & Production Features
- **Security Sandboxing**: `ToolExecutionSandbox` wraps all tool calls with permission checks, audit logging, and approval gates
- **Permission System**: `DefaultPermissionEvaluator` with pattern-based resource permissions (file_system, network, etc.)
- **Audit Logging**: `InMemoryAuditLogger` tracks all tool executions with tamper-proof logging
- **Production Hooks**: Rate limiting, checkpointing, pause/resume, human-in-the-loop approvals
- **MCP Integration**: `SimpleSseMcpClient` and `SimpleHttpMcpClient` for external tool extensions

## Coding Style & Naming
- Use TypeScript/JavaScript with 2‑space indentation and explicit imports.
- Prefer descriptive, lowerCamelCase for variables and functions, PascalCase for types/classes, and kebab-case for file and directory names.
- Run `pnpm lint` and `pnpm format` (if configured) before opening a PR; do not introduce new tooling without discussion.
- Named exports from modules; default export only for main exports like `Eko`
- Types in `src/types/` (core.types.ts, llm.types.ts, tools.types.ts, hooks.types.ts)
- Test files use `.test.ts` extension in `__tests__/` or alongside source
- Config files: Standard names (`jest.config.js`, `rollup.config.js`, `tsconfig.json`)

## LLM Configuration
Configure providers in `LLMs` object before creating `Eko`:
```typescript
import { LLMs } from '@xsky/ai-agent-core';
LLMs.default = { provider: 'anthropic', model: 'claude-3-5-sonnet-20240620' };
```

## Conventions
- Environment variables for API keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`
- Use `Eko.run()` for simple generate+execute flows; use `Eko.generate()` + `Eko.execute()` for workflows needing inspection or modification
- Register agents via `context.setAgent()` before execution
- Workflows use XML format with `<agent>`, `<forEach>`, and `<watch>` constructs
- Hooks (`AgentHooks`) drive observability, approval, and persistence

## Testing Guidelines
- Keep tests close to code when possible (e.g. `*.test.ts` or `__tests__/` inside the relevant package).
- When fixing a bug, add or update a test that fails without the fix.
- Aim to keep or improve current coverage; avoid disabling existing tests.
- Use Jest + ts-jest for testing framework
- Run `pnpm test` from package root or `pnpm test -- path.test.ts` for single test files

## Commit & Pull Request Guidelines
- Write clear, imperative commit messages (e.g. `fix: handle empty agent input`, `feat: add web agent settings`).
- Keep changes focused; separate unrelated changes into different commits or PRs.
- For PRs, include: a short summary, motivation, testing performed (`pnpm test`, manual steps), and links to related issues or docs. Use screenshots only when UI changes are involved.

## Key Business Logic Rules
- Use `Eko.run()` for simple generate+execute flows; use `Eko.generate()` + `Eko.execute()` for workflows needing inspection or modification
- Register agents via `context.setAgent()` before execution
- Configure LLM providers in `LLMs` before instantiating Eko
- Workflows use XML format with `<agent>`, `<forEach>`, and `<watch>` constructs
- Hooks (`AgentHooks`) drive observability, approval, and persistence

## Agent-Specific Instructions
- Obey any `AGENTS.md` in subdirectories when editing files there; more specific files override this root guide.
- Keep edits minimal and aligned with the existing style; avoid large refactors unless explicitly requested.
- When working on security-related code, ensure all tool executions go through the `ToolExecutionSandbox`
- For new agents, extend `Agent` or `BaseBrowserAgent` and place in appropriate package
- For new tools, add to `packages/ai-agent-core/src/tools/` and export from index.ts
