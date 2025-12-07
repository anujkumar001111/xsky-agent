# Product Steering

This document defines the XSky AI Agent framework's purpose, core features, and business logic rules.

## Product Purpose

Build **production-grade AI agents** that convert natural language tasks into **deterministic, auditable workflows** across multiple environments (Node.js, browser, Electron, browser extension).

Use `XSky` (core orchestrator in `packages/ai-agent-core/src/core/xsky.ts`) to **plan and execute XML workflows**:
- Use `XSky.run()` for simple generate+execute flows
- Use `XSky.generate()` + `XSky.execute()` when workflows need inspection or modification before execution

Treat XSky as an **SDK with environment runtimes**, not a single application. Design all changes to be reusable across Node.js, web, extension, and Electron packages.

## Core Features

### XML Workflow System
Preserve XML as the central workflow abstraction:
- Use `<agent>`, `<forEach>`, `<watch>` elements defined in `packages/ai-agent-core/src/core/plan.ts`, `replan.ts`, and `common/xml.ts`
- Extend the existing XML schema rather than introducing parallel formats
- Avoid custom workflow formats that bypass the XML system

### Multi-LLM Support
Maintain provider-agnostic LLM configuration via `LLMs` from `packages/ai-agent-core/src/index.ts`:
- Support Anthropic, OpenAI, Google, DeepSeek, OpenRouter through `RetryLanguageModel` in `src/llm/index.ts`
- Never hardcode a single provider or model in shared code

### Tool-Centric Execution
Use tools in `packages/ai-agent-core/src/tools/` as the primary mechanism for agent actions:
- Create new tools under `src/tools/` with exports from `src/tools/index.ts`
- Avoid embedding side effects directly inside agent logic

### Environment Runtimes
Keep runtime-specific code in the appropriate package:
- **Node.js**: `packages/ai-agent-nodejs` (`BrowserAgent`, `FileAgent` with Playwright)
- **Web**: `packages/ai-agent-web` (in-page automation with `html2canvas`)
- **Extension**: `packages/ai-agent-extension` (Chrome APIs, sidebars, content scripts)
- **Electron**: `packages/ai-agent-electron` (desktop IPC, windows)

## User Workflows

Optimize for **developers building automation agents**, not end-users:
- Assume TypeScript integration into custom applications
- Provide clear extension points (agents, tools, hooks, MCP servers)

### Canonical Workflows
- **Node.js automation**: `BrowserAgent` + `FileAgent` for headless browser tasks
- **Web in-page**: Control DOM and capture screenshots within browser sandbox
- **Browser extension**: Content-script and sidebar agents for active tab automation
- **Electron desktop**: Agents integrated into desktop apps with embedded browsers

## Business Logic Rules

### Workflow Transparency
- Ensure `XSky.generate()` returns human-readable, debuggable workflows
- Avoid opaque single-call LLM prompts for multi-step tasks

### Auditability
- Preserve `Chain` and `Context` tracking for tool and LLM call observability
- Integrate new agents/tools into the existing chain/state system

### Security as Requirement
Route dangerous operations through the security layer in `packages/ai-agent-core/src/security/`:
- `ToolExecutionSandbox` for sandboxed execution
- `DefaultPermissionEvaluator` with permission levels: `allow`, `require_approval`, `sandbox`, `deny`
- `InMemoryAuditLogger` for audit trails
- Apply tool constraints: `rate_limit`, `timeout`, `size_limit`

### Input Validation
- Validate tool arguments with Zod schemas in `packages/ai-agent-core/src/types/tools.types.ts`
- Use `secure-json-parse` for untrusted JSON
- Never create tools with arbitrary shell/file access without permission evaluation

### MCP Integration
- Register MCP servers through `packages/ai-agent-core/src/mcp/`
- Ensure MCP tools respect permission evaluation and audit logging

## Good vs Bad Changes

### Prefer
- Extending XML workflow support with a new tag (e.g., `<retry>`) in `common/xml.ts` and `core/plan.ts`
- Adding tools like `download_file.ts` under `src/tools/` with `require_approval` for untrusted URLs

### Avoid
- Adding separate JSON-only workflow modes hardcoded in a single runtime
- Embedding file download logic inside `BrowserAgent` without permission checks
