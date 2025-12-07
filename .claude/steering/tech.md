# Tech Steering

This document defines the technology stack, build system, and development conventions for the XSky AI Agent monorepo.

## Tech Stack

| Technology | Purpose | Location |
|------------|---------|----------|
| TypeScript | Primary language, strict typing | All packages |
| pnpm | Package manager with workspaces | Repo root |
| Rollup | Build bundler | `packages/*/rollup.config.*` |
| Jest + ts-jest | Testing framework | `packages/*/jest.config.js` |
| Playwright + chromium-bidi | Browser automation | `packages/ai-agent-nodejs` |
| Electron | Desktop runtime | `packages/ai-agent-electron` |
| html2canvas | Screenshot capture | `packages/ai-agent-web` |
| Chrome APIs | Extension integration | `packages/ai-agent-extension` |
| AI SDK providers | LLM integration | `packages/ai-agent-core/src/llm/` |

## Commands

Run from repository root:

```bash
pnpm install          # Install all workspace dependencies
pnpm build            # Build all packages (sequential)
pnpm test             # Run all tests (sequential)
pnpm bench            # Run benchmarks
pnpm clean            # Remove node_modules and dist
```

Run from individual package directory:

```bash
pnpm build            # Build single package
pnpm test             # Run package tests
pnpm test -- path.test.ts  # Run single test file
```

## Environment Configuration

### API Keys
Set these environment variables (never hardcode or log):
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_API_KEY`
- `DEEPSEEK_API_KEY`
- `OPENROUTER_API_KEY`

### LLM Configuration
Configure providers before creating `XSky`:

```typescript
import { LLMs } from '@xsky/ai-agent-core';
LLMs.default = { provider: 'anthropic', model: 'claude-3-5-sonnet-20240620' };
```

Always use `RetryLanguageModel` instead of direct provider clients.

## Coding Conventions

### Formatting
- 2-space indentation
- Single quotes
- Semicolons required

### Naming
- **PascalCase**: Types, classes, interfaces
- **camelCase**: Variables, functions, methods
- **kebab-case**: File names, directory names

### Exports
- Prefer named exports
- Default exports only for main entries (e.g., `XSky`, Next.js pages)

### Type Definitions
Keep types in `packages/ai-agent-core/src/types/`:
- `core.types.ts` - Core framework types
- `llm.types.ts` - LLM configuration types
- `tools.types.ts` - Tool definition types
- `hooks.types.ts` - Hook interface types
- `security.types.ts` - Security system types

## Architecture Patterns

### Orchestration
Use `XSky` as the single orchestrator:
- Extend planning via `core/plan.ts`, `core/replan.ts`
- Extend context via `core/context.ts`
- Never bypass XSky for workflow execution

### Agents
Extend `Agent` base class from `packages/ai-agent-core/src/agent/base.ts`:
- Gets standard prompt construction
- Gets tool integration
- Gets error handling

### Tools
Implement domain actions as tools:
- One tool per file in `src/tools/`
- Clear input/output types with Zod validation
- Export from `src/tools/index.ts`
- Avoid embedding I/O in agent logic

### MCP Integration
Use MCP clients from `packages/ai-agent-core/src/mcp/`:
- `SimpleSseMcpClient` for SSE transport
- `SimpleHttpMcpClient` for HTTP transport

## Security Implementation

Use security layer from `packages/ai-agent-core/src/security/`:

```typescript
// Wrap risky tool execution
const sandbox = new ToolExecutionSandbox(evaluator, logger);
const result = await sandbox.execute(tool, args);
```

Components:
- `ToolExecutionSandbox` - Sandboxed execution wrapper
- `DefaultPermissionEvaluator` - Permission rule evaluation
- `InMemoryAuditLogger` - Tamper-proof audit logging

## Testing

### Test Location
- Tests in `test/` or `__tests__/` directories
- Use `.test.ts` extension
- Mirror source structure in test folders

### Test Commands
```bash
# From package directory
pnpm test                           # All tests
pnpm test -- src/core/xsky.test.ts  # Single file
```

### Coverage
- Add tests when fixing bugs (fail without fix, pass with fix)
- Maintain or improve existing coverage
- Never disable existing tests without justification

## Examples vs Anti-Patterns

### Good
```typescript
// New tool in src/tools/browser_scroll.ts
export const browserScrollTool = {
  name: 'browser_scroll',
  parameters: z.object({ direction: z.enum(['up', 'down']) }),
  execute: async (params) => { /* implementation */ }
};
// Export from src/tools/index.ts
```

### Bad
```typescript
// Calling Playwright directly without tool wrapper
await page.scroll(); // Don't do this in app code
```

### Good
```typescript
// Extending security for new resource type
const evaluator = new DefaultPermissionEvaluator({
  clipboard: { level: 'require_approval' }
});
```

### Bad
```typescript
// Ad-hoc security bypass
if (process.env.ALLOW_DANGEROUS) {
  // Skip permission check - never do this
}
```
