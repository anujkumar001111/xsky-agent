# Product Overview

XSky is a **production-ready AI agent framework** that converts natural language tasks into deterministic, auditable XML workflows, executing them across multiple environments (Node.js, Browser, Electron, Browser Extension).

## Core Features

- **XML Workflow System**: Natural language → structured XML workflows with `<agent>`, `<forEach>`, `<watch>` elements for transparent, debuggable automation
- **Multi-LLM Support**: Provider-agnostic via Anthropic, OpenAI, Google, Bedrock, DeepSeek, OpenRouter with automatic retry and circuit breaker
- **Multi-Environment Runtimes**: Single core engine with platform-specific adapters for Node.js/Playwright, Browser SPA, Chrome Extension, and Electron desktop
- **Tool-Centric Execution**: All agent actions through composable tools with security sandbox, permission evaluation, and audit logging
- **MCP Integration**: Dynamic tool discovery via Model Context Protocol (SSE, HTTP, Stdio clients)
- **Production Hooks**: Complete lifecycle hooks for approvals, checkpointing, state persistence, rate limiting, and telemetry

## User Value Proposition

**For developers building AI automation agents**: XSky provides a structured, auditable approach to AI agent development. Instead of opaque LLM calls, tasks become transparent XML workflows that can be inspected, modified, and debugged before execution.

**Key Benefits**:
- Predictable agent behavior through explicit workflow planning
- Security by default with permission evaluation and sandboxed execution
- Cross-platform deployment with single core codebase
- Production-ready with hooks for enterprise concerns (approval flows, audit trails, state recovery)

## Key Business Logic Rules

### Workflow Transparency
- `XSky.generate()` MUST return human-readable, debuggable XML workflows
- NEVER use opaque single-call LLM prompts for multi-step tasks
- All planned agents and dependencies must be visible in workflow output

### Auditability
- ALL tool executions MUST be tracked via `Chain` and `ToolChain`
- LLM requests, tool calls, and agent execution timelines MUST be preserved
- New agents/tools MUST integrate with existing chain/state system

### Security as Requirement
- Route dangerous operations through `ToolExecutionSandbox`
- Apply `DefaultPermissionEvaluator` with levels: `allow`, `require_approval`, `sandbox`, `deny`
- Use `InMemoryAuditLogger` (or custom backend) for audit trails
- Tool constraints (`rate_limit`, `timeout`, `size_limit`) MUST be enforced

### Environment Isolation
- Runtime-specific code stays in appropriate package (nodejs, web, extension, electron)
- Core package (`ai-agent-core`) MUST remain platform-agnostic
- NO Node-only APIs (`fs`, `path`, `child_process`) in core package

### Tool Design
- One tool per file in `src/tools/`
- Clear input/output types with Zod validation
- Export from `src/tools/index.ts`
- NEVER embed I/O logic directly in agent code

## Success Metrics

- **Workflow Completion Rate**: % of tasks that execute to completion without human intervention
- **Agent Reusability**: Same agents work across all 4 runtime environments
- **Audit Coverage**: 100% of tool executions logged with timing and approval data
- **Security Compliance**: Zero tool executions bypass permission evaluation when security enabled
