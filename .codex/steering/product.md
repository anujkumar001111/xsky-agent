# Product Steering

Use this document to keep AI agents aligned with the actual purpose, value proposition, and business rules of the XSky AI Agent framework.

## Product Purpose & Value

- Build **production-grade AI agents** that turn natural language tasks into **deterministic, auditable workflows** across Node.js, browser, Electron, and browser extension environments.
- Use `Eko` (core orchestrator in `packages/ai-agent-core/src/core/eko.ts`) to **plan and execute XML workflows**, not ad-hoc scripts. Prefer `Eko.run()` for simple flows and `Eko.generate()` + `Eko.execute()` when workflows need inspection or modification.
- Treat XSky as an **SDK plus runtimes**, not a single app. Always design changes so they can be reused across Node.js, web, extension, and Electron packages.

## Core Features to Preserve

- Maintain **XML-based workflows** as the central abstraction:
  - Use `<agent>`, `<forEach>`, `<watch>` elements, as implemented in `packages/ai-agent-core/src/core/plan.ts`, `replan.ts`, and `common/xml.ts`.
  - Avoid adding parallel custom workflow formats; extend the existing XML schema instead.
- Keep **multi-LLM support** consistent with the `LLMs` configuration exported from `packages/ai-agent-core/src/index.ts`.
  - Support Anthropic, OpenAI, Google, DeepSeek, OpenRouter via `RetryLanguageModel` in `src/llm/index.ts`.
  - Do not hardcode a single provider or model in shared code; use provider-agnostic configuration patterns.
- Preserve **tool-centric execution**:
  - Use tools in `packages/ai-agent-core/src/tools/` as the primary way agents act.
  - When adding new behavior, prefer a new tool file under `src/tools/` plus exports from `src/tools/index.ts` instead of embedding side effects inside agents.
- Maintain **environment-specific runtimes**:
  - Node.js runtime: `packages/ai-agent-nodejs` (`BrowserAgent`, `FileAgent`).
  - Web runtime: `packages/ai-agent-web` (in-page automation with `html2canvas`).
  - Extension runtime: `packages/ai-agent-extension` (Chrome APIs, sidebars, content scripts).
  - Electron runtime: `packages/ai-agent-electron` (desktop IPC and windows).
  - Avoid coupling core logic to any single runtime; keep environment-specific code inside the relevant package.

## User Value & Workflows

- Optimize the framework for **developers building automation agents**, not end-users:
  - Assume users will write TypeScript and integrate into their own apps.
  - Provide clear extension points (agents, tools, hooks, MCP servers) rather than monolithic features.
- Support these canonical workflows:
  - **Node.js automation**: Use `BrowserAgent` + `FileAgent` from `packages/ai-agent-nodejs` so developers can run tasks like "Open page, capture screenshot, extract headings, save to file".
  - **Web in-page automation**: Use `ai-agent-web` to control the current page DOM and screenshots, keeping all side effects inside the browser sandbox.
  - **Browser extension agents**: Use `ai-agent-extension` to implement content-script and sidebar agents that automate the currently open tab.
  - **Electron desktop agents**: Use `ai-agent-electron` to integrate agents into desktop apps that drive embedded browsers or local resources.

## Business Logic & Behavioral Rules

- Always **treat workflows as first-class, inspectable artifacts**:
  - Ensure `Eko.generate()` returns workflows that are human-readable and debuggable.
  - Avoid opaque, single-call LLM prompts for multi-step tasks when they should be modeled as workflows.
- Keep **agent behavior explainable and auditable**:
  - Preserve or extend `Chain` and `Context` tracking so each tool call and LLM call is observable.
  - When adding new agents or tools, integrate them into the existing chain/state system rather than creating side channels.
- Maintain **security and approvals** as business requirements, not optional add-ons:
  - Route dangerous operations through `ToolExecutionSandbox`, `DefaultPermissionEvaluator`, and `InMemoryAuditLogger` in `packages/ai-agent-core/src/security/`.
  - Use permission levels (`allow`, `require_approval`, `sandbox`, `deny`) and tool constraints (`rate_limit`, `timeout`, `size_limit`) for any tool that touches file system, network, system commands, or MCP servers.
- Design features so they **work across multiple environments**:
  - When introducing new tool categories (e.g., clipboard, OS-level automation), clearly document which runtimes support them and provide safe fallbacks or explicit errors in unsupported environments.

## Security, Validation, and Safety Rules

- Treat **external input as untrusted**:
  - Validate tool arguments with Zod schemas or `arg_validation` constraints in `packages/ai-agent-core/src/types/tools.types.ts`.
  - Use `secure-json-parse` where untrusted JSON is parsed.
- Prevent **dangerous defaults**:
  - Do not create tools that execute arbitrary shell commands or file writes without explicit permission evaluation and audit logging.
  - Avoid exposing raw environment variables beyond what is necessary for LLM configuration.
- Keep **MCP tool usage** within the security model:
  - Register MCP servers through the core MCP clients in `packages/ai-agent-core/src/mcp/`.
  - Ensure MCP tools respect permission evaluation and audit logging like built-in tools.

## Examples of Good vs Bad Product Changes

- Prefer: Extending XML workflow support with a new `<retry>` tag implemented in `common/xml.ts` and `core/plan.ts`, documented and validated.
- Avoid: Adding a separate JSON-only workflow mode hardcoded in a single runtime.

- Prefer: Adding a `download_file` tool under `src/tools/download_file.ts` that uses `node-fetch`, with security constraints marking it as `require_approval` for untrusted URLs.
- Avoid: Embedding file download logic directly inside `BrowserAgent` without permission checks or audit logging.
