# Tech Steering

Use this document to align technical changes with the existing stack, tooling, and conventions of the XSky AI Agent monorepo.

## Tech Stack & Dependencies

- Use **TypeScript** throughout all packages with strict typing.
- Use **pnpm workspaces** to manage the monorepo; do not introduce alternate package managers (no npm/yarn lockfiles).
- Use **Rollup** for building packages, as configured in each `packages/*/rollup.config.*` file.
- Use **Jest + ts-jest** for tests (`testEnvironment: 'node'`), with configs like `packages/ai-agent-core/jest.config.js`.
- Use **Playwright** and `chromium-bidi` in `packages/ai-agent-nodejs` for browser automation.
- Use **Electron >=20** in `packages/ai-agent-electron`.
- Use **html2canvas** in `packages/ai-agent-web` for screenshot capture.
- Use **Chrome extension APIs** via `@types/chrome` in `packages/ai-agent-extension`.
- Use AI SDK providers via `RetryLanguageModel` in `packages/ai-agent-core/src/llm/index.ts` to talk to Anthropic, OpenAI, Google, DeepSeek, and OpenRouter.

## Commands: Build, Test, Dev

- Run **top-level commands from repo root**:
  - `pnpm install` – Install all workspace dependencies.
  - `pnpm build` – Build all packages (`pnpm -r --sequential build`).
  - `pnpm test` – Run all tests (`pnpm -r --sequential test`).
  - `pnpm clean` – Remove `node_modules` and `dist` in all packages.
- Run **package-specific commands** from within each `packages/<name>/` directory:
  - `pnpm build` – Build that package.
  - `pnpm test` – Run Jest tests for that package.
- For **Electron + Next.js dev** (when using the desktop app shell), use commands documented in the root `CLAUDE.md` (e.g., `pnpm dev`, `pnpm dev:next-only`, `pnpm dev:clean`).

## Environment & Configuration

- Use **`.env` files with dotenv** in examples and consumer apps; never hardcode API keys.
- Configure LLMs via the `LLMs` object in `packages/ai-agent-core/src/index.ts`:
  - Example:
    - `LLMs.default = { provider: 'anthropic', model: 'claude-3-5-sonnet-20240620' };`
  - Avoid directly instantiating provider clients (Anthropic, OpenAI, etc.) in app code; always go through `RetryLanguageModel`.
- Use the documented environment variables for providers:
  - `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`.
  - Never log these values; only reference them in provider configuration.

## Coding Conventions

- Use **2-space indentation, single quotes, and semicolons** across all TypeScript and JavaScript files.
- Prefer **named exports** for modules; only use default exports where existing patterns require it (e.g., `Eko` entry or Next.js pages in external apps).
- Use **PascalCase** for types and classes, **camelCase** for variables/functions, and **kebab-case** for file names.
- Keep core types under `packages/ai-agent-core/src/types/` (`core.types.ts`, `llm.types.ts`, `tools.types.ts`, `hooks.types.ts`, `security.types.ts`).
- Place new tools under `packages/ai-agent-core/src/tools/` and export them from `src/tools/index.ts` and/or the root `src/index.ts` as appropriate.
- Place new agents in the correct environment package (`ai-agent-core/src/agent`, `ai-agent-nodejs/src`, `ai-agent-web/src`, etc.) and extend the relevant base classes.

## Architecture & Extension Points

- Use `Eko` as the **only orchestrator** for workflows:
  - Add new orchestration behaviours by extending planning (`core/plan.ts`, `core/replan.ts`) or context (`core/context.ts`), not by bypassing Eko.
- Use the **Agent base class** in `packages/ai-agent-core/src/agent/base.ts` when implementing new agents to get standard prompt construction, tool integration, and error handling.
- Use the **tools system** for side effects:
  - Implement domain-specific actions as tools with clear input/output types and constraints.
  - Avoid embedding IO or side effects directly into agent logic; call tools instead.
- Use the **MCP client layer** in `packages/ai-agent-core/src/mcp/` to integrate external tools.

## Security, Validation, and Testing

- Use **Zod** schemas for tool parameters and API inputs wherever possible.
- Use `secure-json-parse` when parsing untrusted JSON in core modules.
- Use `ToolExecutionSandbox`, `DefaultPermissionEvaluator`, and `InMemoryAuditLogger` to guard risky operations (`packages/ai-agent-core/src/security/`).
- Use Jest tests to cover new behaviour:
  - Follow existing patterns in `packages/ai-agent-core/test/` and other package `test/` directories.
  - Place new tests either in `test/*.test.ts` or in `__tests__/` folders; keep naming consistent with the package.

## Examples & Anti-Patterns

- Prefer: Adding a new tool `packages/ai-agent-core/src/tools/browser_scroll.ts` and registering it in `src/tools/index.ts`, then using it in `BrowserAgent`.
- Avoid: Calling Playwright APIs directly from an example app without going through a tool or agent.

- Prefer: Extending `security.types.ts` and the `DefaultPermissionEvaluator` to support a new `resourceType` (e.g., `clipboard`) with clear rules.
- Avoid: Adding ad-hoc `if (process.env.ALLOW_DANGEROUS)` checks to bypass security logic.
