# AGENTS.md - Jules Implementation Guide

This file provides environment setup and implementation guidance for Jules AI agent working on the XSky AI Agent monorepo.

## Environment Setup

### Quick Setup
```bash
# Install dependencies (from /app directory after clone)
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Prerequisites
- **Node.js**: 20+ (use nvm: `nvm use 20`)
- **pnpm**: 10.18+ (`npm install -g pnpm@latest`)
- **Playwright browsers**: `pnpm --filter @xsky/ai-agent-nodejs exec playwright install chromium`

### Environment Variables
```bash
# At least one LLM API key required for tests
export ANTHROPIC_API_KEY="your-key"
# OR
export OPENAI_API_KEY="your-key"

# Optional: OpenAI-compatible proxy for development
export OPENAI_COMPATIBLE_API_KEY="proxy-key"
export OPENAI_COMPATIBLE_BASE_URL="https://proxy.example.com/v1"
```

### Build Commands
```bash
# Full build (all packages, sequential due to dependencies)
pnpm build

# Build only core (fastest)
pnpm build-core

# Build specific package
pnpm --filter @xsky/ai-agent-nodejs build

# Clean rebuild
pnpm clean && pnpm install && pnpm build
```

### Test Commands
```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @xsky/ai-agent-core test

# Run single test file
cd packages/ai-agent-core && pnpm test -- test/core/xsky.test.ts

# Run with coverage
cd packages/ai-agent-core && pnpm test:coverage
```

## Project Architecture

### Package Structure
| Package | Version | Purpose |
|---------|---------|---------|
| `@xsky/ai-agent-core` | 0.1.4 | Core engine (planning, agents, tools, MCP, security) |
| `@xsky/ai-agent-nodejs` | 0.1.2 | Node.js runtime with Playwright BrowserAgent |
| `@xsky/ai-agent-web` | 0.1.2 | Browser SPA runtime with html2canvas |
| `@xsky/ai-agent-extension` | 0.1.2 | Chrome extension runtime |
| `@xsky/ai-agent-electron` | 0.1.9 | Electron desktop runtime |

### Build Order
**CRITICAL**: Packages must be built in this order due to dependencies:
1. `@xsky/ai-agent-core` (no dependencies)
2. All other packages (depend on core)

The `pnpm build` command handles this with `--sequential` flag.

### Key Directories
| Path | Purpose |
|------|---------|
| `packages/ai-agent-core/src/core/` | XSky orchestrator, Context, Chain, Planner |
| `packages/ai-agent-core/src/agent/` | Agent base classes |
| `packages/ai-agent-core/src/tools/` | Built-in tools |
| `packages/ai-agent-core/src/security/` | Security sandbox, permissions, audit |
| `packages/ai-agent-core/src/llm/` | RetryLanguageModel, circuit breaker |
| `packages/ai-agent-core/src/mcp/` | MCP clients (SSE, HTTP) |
| `packages/ai-agent-core/src/types/` | TypeScript type definitions |
| `example/` | Example applications for each runtime |

## Implementation Guidelines

### Before Starting Any Task
1. Read `.claude/steering/` documents (product.md, tech.md, structure.md)
2. Read spec documents in `.claude/specs/{feature}/` if they exist
3. Understand package dependencies (core → runtimes)
4. Run `pnpm build` to ensure clean state

### Code Conventions

**TypeScript**:
- Strict mode enabled
- 2-space indentation, single quotes, semicolons
- Named exports (default only for main entries like `XSky`)

**File Naming**:
- kebab-case: `browser-agent.ts`, `tool-sandbox.ts`
- Types: `*.types.ts` in `src/types/`
- Tests: `*.test.ts` mirroring source structure

**Exports**:
```typescript
// In src/tools/my_tool.ts
export const MyTool = { ... };

// In src/tools/index.ts
export { MyTool } from './my_tool';

// In src/index.ts (if public API)
export { MyTool } from './tools';
```

### Adding New Tools

1. Create file: `packages/ai-agent-core/src/tools/my_tool.ts`
```typescript
import { z } from 'zod';
import type { Tool, ToolResult } from '../types/tools.types';

export const MyTool: Tool = {
  name: 'my_tool',
  description: 'What this tool does',
  parameters: z.object({
    param1: z.string().describe('Parameter description'),
  }),
  execute: async (args, agentContext): Promise<ToolResult> => {
    // Implementation
    return { content: [{ type: 'text', text: 'Result' }] };
  },
};
```

2. Export from `src/tools/index.ts`:
```typescript
export { MyTool } from './my_tool';
```

3. Add test: `test/tools/my_tool.test.ts`

### Adding New Agents

1. For platform-agnostic base: `packages/ai-agent-core/src/agent/`
2. For runtime-specific: `packages/ai-agent-{runtime}/src/`
3. Extend appropriate base class:
   - `Agent` - Base class
   - `BaseBrowserAgent` - Browser operations
   - `BaseBrowserLabelsAgent` - DOM element labeling
   - `BaseFileAgent` - File system operations

## Task Execution Protocol

### For Each Task
1. Read task description and identify affected files
2. Check if changes affect core (requires rebuild of dependents)
3. Implement following conventions in `.claude/steering/tech.md`
4. Run tests: `pnpm test` or specific package tests
5. Verify against requirements in spec documents

### Progress Tracking
Update `.claude/specs/{feature}/feature_status.md`:
```markdown
| Task ID | Status | Timestamp | Notes |
|---------|--------|-----------|-------|
| 1       | done   | 2025-01-15T10:30:00Z | Implemented base class |
| 2.1     | in_progress | 2025-01-15T11:00:00Z | Working on tool integration |
```

### Quality Gates
Before marking task complete:
- [ ] Code compiles: `pnpm build`
- [ ] Tests pass: `pnpm test`
- [ ] Follows conventions in `.claude/steering/tech.md`
- [ ] Exports added to barrel files (`index.ts`)
- [ ] Types properly defined and exported
- [ ] No Node-only APIs in core package

## Troubleshooting

### Common Issues

**Build fails with module not found**:
```bash
# Rebuild from clean state
pnpm clean && pnpm install && pnpm build
```

**Tests skip with "API key not found"**:
```bash
# Tests requiring LLM calls skip automatically without keys
# This is expected behavior - set API keys for full test run
export OPENAI_API_KEY="your-key"
```

**Playwright browser not installed**:
```bash
pnpm --filter @xsky/ai-agent-nodejs exec playwright install chromium
```

**Jest experimental modules warning**:
```bash
# Core package uses ESM - this is handled in package.json scripts
# Run via: pnpm test (not jest directly)
```

### Loop Detection
If >5 modifications to same file without progress:
1. Stop current approach
2. Create draft PR with current state
3. Report: "Loop detected on [file]. Manual review needed."
4. Document what was attempted and why it failed

## Commit/PR Guidelines

### Message Format
```
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore
Scopes: core, nodejs, web, extension, electron, tools, security
```

Examples:
```
feat(core): add rate limiting to tool sandbox
fix(nodejs): resolve browser cleanup race condition
test(security): add permission evaluator edge cases
```

### PR Requirements
- Summary of changes with affected packages
- Link to spec documents if feature work
- Test results (or explanation if tests skip)
- Note any breaking changes

### Branch Strategy
- Feature branches from `main`
- PR title matches commit format
- Squash merge to main

## XSky-Specific Patterns

### XML Workflow Structure
```xml
<root>
  <thought>Planning reasoning here</thought>
  <agents>
    <agent name="browser" dependsOn="">
      <task>Navigate and extract data</task>
    </agent>
    <agent name="file" dependsOn="browser-00">
      <task>Save extracted data</task>
    </agent>
  </agents>
</root>
```

### Agent Execution Flow
1. XSky.generate() → Creates Workflow from task prompt
2. Workflow parsed → Agent tree with dependencies
3. Agents execute in order → Each runs ReAct loop
4. Tools called → Security sandbox → Results logged
5. XSky.execute() returns → XSkyResult with success/failure

### Key Classes
| Class | File | Purpose |
|-------|------|---------|
| `XSky` | `src/core/xsky.ts` | Main orchestrator |
| `Context` | `src/core/context.ts` | Task state, variables |
| `Chain` | `src/core/chain.ts` | Execution tracking |
| `Agent` | `src/agent/base.ts` | Base agent class |
| `RetryLanguageModel` | `src/llm/index.ts` | LLM with retry/fallback |
| `ToolExecutionSandbox` | `src/security/tool-sandbox.ts` | Security wrapper |
