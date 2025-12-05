# Product: XSky AI Agent Framework

## Purpose

XSky is an AI agent framework that enables natural language task automation across multiple runtime environments. The core `Eko` orchestrator plans and executes workflows using LLM-powered agents.

## Documentation

> **See [`docs/intro/overview.md`](../docs/intro/overview.md) for a full product overview.**

## Core Features

- **Workflow Planning**: Generate XML-based workflows from natural language prompts via `Eko.generate()`
- **Multi-Agent Execution**: Coordinate multiple specialized agents (BrowserAgent, FileAgent, custom agents)
- **Browser Automation**: DOM manipulation, navigation, screenshots, element labeling across environments
- **MCP Integration**: Extend agent capabilities via Model Context Protocol servers (SSE, HTTP)
- **Dialogue Interface**: Conversational task execution through `EkoDialogue`
- **Human-in-the-Loop**: Approval hooks and `HumanInteractTool` for supervised automation

## User Value

- Automate browser-based workflows with natural language
- Build AI agents for Node.js, Electron, browser extensions, or in-page SPAs
- Extend capabilities via MCP servers and custom tools
- Maintain control with checkpointing, pause/resume, and approval hooks

## Key Business Logic Rules

- Use `Eko.run()` for simple generate+execute flows; use `Eko.generate()` + `Eko.execute()` for workflows needing inspection or modification
- Register agents via `context.setAgent()` before execution
- Configure LLM providers in `LLMs` before instantiating Eko
- Workflows use XML format with `<agent>`, `<forEach>`, and `<watch>` constructs
- Hooks (`AgentHooks`) drive observability, approval, and persistence

## Strategic Roadmap (V2)

### 1. Security Sandboxing and Trust Boundaries

**Status**: Integration Phase (Core implemented, pending integration)

- **Permission System**: `DefaultPermissionEvaluator` with pattern-based resource permissions
- **Tool Isolation**: `ToolExecutionSandbox` wraps all tool calls with security checks
- **Audit Logging**: `InMemoryAuditLogger` tracks all tool executions with approval workflow
- **Approval Gates**: Integration hooks for human-in-the-loop on high-risk operations
- **Constraints**: Rate limiting, timeouts, argument validation, output filtering

**Implementation files**:
- `src/types/security.types.ts` - Type definitions
- `src/security/permission-evaluator.ts` - Permission evaluation engine
- `src/security/audit-logger.ts` - Audit logging system
- `src/security/tool-sandbox.ts` - Tool execution sandbox wrapper
- `src/security/index.ts` - Module exports

**API Usage**:
```typescript
import { ToolSandboxFactory } from '@xsky/ai-agent-core';

const sandbox = ToolSandboxFactory.createDefault(securityConfig);
const result = await sandbox.execute(
  agentContext,
  'read_file',
  { path: '/data/users.json' },
  () => readFile('/data/users.json'),
  [{ type: 'file_system', identifier: '/data/users.json', accessType: 'read' }]
);
```

### 2. Multi-Modal Input/Output Capabilities

**Status**: Planned

- Vision model integration for multi-page document analysis
- PDF extraction with layout preservation
- Screenshot analysis with OCR
- Video frame extraction and analysis
- Audio transcription support

### 3. Enterprise Observability and Compliance Infrastructure

**Status**: Planned

- Comprehensive audit trail with tamper-proof logging
- GDPR/HIPAA compliance helpers
- Rate limiting and quota management
- Cost tracking and budget alerts
- Performance profiling and optimization recommendations
