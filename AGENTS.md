# AGENTS.md

This file defines specialized AI agent configurations for development workflows on this repository.

## Available Agents

### xsky-architect
**Purpose**: Design features, plan architecture, make technical decisions
**When to use**: Before implementing new features or making significant changes
**Capabilities**:
- Analyze existing codebase patterns
- Design component interfaces
- Plan multi-package changes
- Evaluate architectural trade-offs

### xsky-implementer
**Purpose**: Write code, implement features, make code changes
**When to use**: When implementing features, fixing bugs, writing new functionality
**Capabilities**:
- Write TypeScript code following project conventions
- Implement agents, tools, and MCP clients
- Add tests alongside implementations
- Update package exports

### xsky-reviewer
**Purpose**: Review code changes, PRs, and implementations
**When to use**: After implementing features, before merging PRs
**Capabilities**:
- Check code quality and patterns
- Verify test coverage
- Identify potential issues
- Suggest improvements

### xsky-test-engineer
**Purpose**: Write tests, debug test failures, improve coverage
**When to use**: When writing tests or debugging test issues
**Capabilities**:
- Write Jest tests with ts-jest
- Mock dependencies appropriately
- Debug test failures
- Improve test coverage

### browser-tools-specialist
**Purpose**: Work on browser automation tools and DOM functionality
**When to use**: When working on browser agents, labeling, or DOM extraction
**Capabilities**:
- Implement browser automation tools
- Work with DOM Intelligence system
- Handle element labeling
- Write browser-specific tests

### llm-integration-specialist
**Purpose**: Work on LLM provider integrations
**When to use**: When adding providers, fixing LLM issues, or optimizing prompts
**Capabilities**:
- Integrate new LLM providers
- Debug provider-specific issues
- Optimize system prompts
- Handle streaming and token management

### mcp-integration-specialist
**Purpose**: Work on MCP client implementations
**When to use**: When adding MCP clients or debugging MCP issues
**Capabilities**:
- Implement SSE, HTTP, or STDIO MCP clients
- Debug MCP communication
- Handle tool discovery and execution
- Integrate external MCP servers

### workflow-xml-specialist
**Purpose**: Work on workflow planning and XML parsing
**When to use**: When modifying planner, workflow structure, or XML parsing
**Capabilities**:
- Modify workflow XML schema
- Debug planning issues
- Improve workflow generation
- Handle dependency resolution

## Agent Selection Guide

| Task Type | Primary Agent | Supporting Agents |
|-----------|---------------|-------------------|
| New feature design | xsky-architect | - |
| Feature implementation | xsky-implementer | xsky-test-engineer |
| Bug fix | xsky-implementer | xsky-reviewer |
| Code review | xsky-reviewer | - |
| Test writing | xsky-test-engineer | xsky-implementer |
| Browser automation | browser-tools-specialist | xsky-implementer |
| LLM integration | llm-integration-specialist | xsky-implementer |
| MCP work | mcp-integration-specialist | xsky-implementer |
| Workflow changes | workflow-xml-specialist | xsky-architect |

## Workflow Patterns

### Feature Development
```
1. xsky-architect → Design the feature
2. xsky-implementer → Implement the code
3. xsky-test-engineer → Add tests
4. xsky-reviewer → Review implementation
```

### Bug Fix
```
1. xsky-implementer → Investigate and fix
2. xsky-test-engineer → Add regression test
3. xsky-reviewer → Verify fix
```

### Provider Addition
```
1. xsky-architect → Design integration approach
2. llm-integration-specialist → Implement provider
3. xsky-test-engineer → Add provider tests
4. xsky-reviewer → Review integration
```

## Context for Agents

All agents should understand:

### Core Concepts
- **Eko**: Main orchestrator that converts tasks to workflows
- **Workflow**: XML-based task graph with agent dependencies
- **Agent**: Execution unit (Browser, File, Shell, etc.)
- **Context**: State container for task execution
- **Chain**: Execution history tracking

### Package Structure
- `ai-agent-core`: Core framework (required by all adapters)
- `ai-agent-nodejs`: Node.js + Playwright
- `ai-agent-web`: Browser environment
- `ai-agent-extension`: Chrome extension
- `ai-agent-electron`: Electron desktop

### Key Files
| Purpose | Location |
|---------|----------|
| Orchestrator | `packages/ai-agent-core/src/core/eko.ts` |
| Planner | `packages/ai-agent-core/src/core/plan.ts` |
| Agent base | `packages/ai-agent-core/src/agent/base.ts` |
| Types | `packages/ai-agent-core/src/types/*.ts` |
| Config | `packages/ai-agent-core/src/config/index.ts` |

### Conventions
- Named exports (default only for main entries)
- TypeScript strict mode
- Zod for runtime validation
- Jest for testing
- Rollup for building (CJS + ESM)
