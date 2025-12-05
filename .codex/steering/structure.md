# Structure Steering

Use this document to maintain a consistent project structure and file organization across the XSky AI Agent monorepo.

## Monorepo Layout

- Keep the **monorepo root** organized around packages and examples:
  - `packages/` – All reusable libraries and runtimes.
  - `example/` – Example apps demonstrating how to use the framework (Node.js, web, extension, Electron).
  - `docs/`, `GUIDES/`, `benchmarks/`, `development/` – Documentation, guides, benchmarks, and dev utilities.
- Avoid introducing new top-level directories unless they serve a cross-package concern on the same level as the existing ones.

## Package-Level Structure

- Preserve the pattern within each `packages/<name>/` directory:
  - `src/` – Source TypeScript files.
  - `test/` or `__tests__/` – Jest tests.
  - `jest.config.*` – Jest configuration.
  - `rollup.config.*` – Build configuration.
  - `tsconfig.*.json` – TypeScript configs.
- Follow the core package structure in `packages/ai-agent-core/src/`:
  - `core/` – Orchestrator, planning, context, dialogue (`eko.ts`, `plan.ts`, `replan.ts`, `context.ts`, `dialogue.ts`).
  - `agent/` – Base agent class and specialized agents (browser, dialogue, etc.).
  - `tools/` – Built-in tools and tool exports.
  - `mcp/` – MCP client implementations.
  - `common/` – Shared utilities (`xml.ts`, `tree.ts`, `utils.ts`, `coordinate-scaling.ts`).
  - `types/` – Shared type definitions, including security and tool types.

## Naming Patterns

- Use **kebab-case** for filenames (e.g., `tool-execution-sandbox.ts`, `browser-agent.ts`), except where existing files use established variants; match nearby files.
- Use **index.ts** files for public exports within packages:
  - Example: `packages/ai-agent-core/src/index.ts` re-exports Eko, tools, LLM config, and types.
- Use **descriptive names** that describe the module responsibility (e.g., `default-permission-evaluator.ts` instead of `permissions.ts`).

## Imports & Module Boundaries

- Keep imports **within package boundaries**:
  - Use relative paths inside packages (e.g., `../common/utils`), not cross-package imports from `src` directories.
  - Use package names (e.g., `@xsky/ai-agent-core`) from consumers and examples; do not import from `../../packages/ai-agent-core/src` in external apps.
- In the UI/desktop shell (outside this monorepo), use **`@/` aliases** for React components and hooks as documented in the root `CLAUDE.md`.

## Agent & Tool Organization

- Place **core agents** under `packages/ai-agent-core/src/agent/` and environment-specific agents under their respective packages:
  - Node-specific agents (e.g., browser/file) in `packages/ai-agent-nodejs/src/`.
  - Web agents in `packages/ai-agent-web/src/`.
  - Extension agents in `packages/ai-agent-extension/src/`.
  - Electron integration agents/hooks in `packages/ai-agent-electron/src/`.
- Place **new tools** under `packages/ai-agent-core/src/tools/` with one tool per file when possible.
  - Export new tools from `src/tools/index.ts` and then from the root `src/index.ts` when they should be public.

## Tests & Examples

- Mirror **source structure** in tests:
  - For `src/core/eko.ts`, keep tests in `test/core/eko.test.ts` or a similar nested folder structure.
  - For `src/tools/*`, keep tests grouped by domain (e.g., `test/tools/*.test.ts`).
- Use the **example apps** as the canonical reference for composing agents and Eko:
  - Node.js: `example/nodejs/src/index.ts`.
  - Web: `example/web/src/main.ts` (or equivalent entry).
  - Extension: `example/extension/src/*`.
  - Electron: `example/electron/src/*`.

## Structural Anti-Patterns to Avoid

- Avoid mixing **runtime-specific code** into the core package:
  - Do not add Node-only APIs (fs, path, child_process) into `ai-agent-core`; keep them inside `ai-agent-nodejs` or environment-specific packages.
- Avoid creating **parallel tool systems**:
  - Always extend the existing `src/tools/` system instead of defining new ad-hoc tool registries.
- Avoid **deep relative imports** across packages in examples:
  - Use published package entrypoints (`@xsky/ai-agent-core`, `@xsky/ai-agent-nodejs`) instead of `../../../packages/...` paths.

Maintain this document as a living description of how the monorepo is organized. When you introduce new top-level concepts (e.g., a new runtime, a new cross-cutting security module), update this file with the rationale and patterns to follow.