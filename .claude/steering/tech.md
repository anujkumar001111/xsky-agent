# Tech Stack

## Package Manager

Use **pnpm** for all package operations. Run commands from repo root unless noted.

## Documentation

> **Detailed documentation is available in the `docs/` directory.**

- [Installation](../docs/getting-started/installation.md)
- [Architecture Overview](../docs/architecture/monorepo-structure.md)
- [Core Engine](../docs/architecture/core-engine.md)
- [LLM Configuration](../docs/guides/configure-llms.md)

## Core Dependencies

- **TypeScript**: Strict typing, 2-space indent, single quotes, semicolons
- **AI SDK**: `ai` package with provider SDKs
- **Rollup**: Build system for all packages
- **Jest + ts-jest**: Test framework

## Runtime-Specific Dependencies

| Package | Key Dependencies |
|---------|-----------------|
| ai-agent-nodejs | `playwright`, `chromium-bidi` |
| ai-agent-web | `html2canvas` |
| ai-agent-extension | `@types/chrome` |
| ai-agent-electron | `electron` |

## Common Commands

```bash
# From repo root
pnpm install           # Install all workspace dependencies
pnpm build             # Build all packages (sequential)
pnpm test              # Run all test suites
pnpm clean             # Remove node_modules and dist

# Package-specific (run inside package directory)
pnpm build             # Build via Rollup
pnpm test              # Run Jest tests
pnpm test -- path.test.ts  # Single test file
```

## LLM Configuration

Configure providers in `LLMs` object before creating `Eko`:
```typescript
import { LLMs } from '@xsky/ai-agent-core';
LLMs.default = { provider: 'anthropic', model: 'claude-3-5-sonnet-20240620' };
```

## Conventions

- Named exports from modules; default export only for main exports like `Eko`
- Types in `src/types/` (core.types.ts, llm.types.ts, tools.types.ts, hooks.types.ts)
- Test files use `.test.ts` extension in `__tests__/` or alongside source
- Environment variables for API keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, etc.
