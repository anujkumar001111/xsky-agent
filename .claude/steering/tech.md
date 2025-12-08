# Tech Stack

## Primary Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | 5.8+ | Primary language, strict typing |
| Node.js | 20+ | Runtime for nodejs package and tooling |
| pnpm | 10.18+ | Package manager with workspaces |
| Rollup | 4.40+ | Build bundler for all packages |
| Jest + ts-jest | 29.x | Testing framework |

## Key Dependencies

### Core LLM Providers (`ai-agent-core`)
| Package | Purpose |
|---------|---------|
| `@ai-sdk/anthropic` | Claude models |
| `@ai-sdk/openai` | OpenAI/GPT models |
| `@ai-sdk/google` | Gemini models |
| `@ai-sdk/amazon-bedrock` | AWS Bedrock Claude |
| `@ai-sdk/deepseek` | DeepSeek models |
| `@openrouter/ai-sdk-provider` | OpenRouter multi-model |
| `@ai-sdk/openai-compatible` | Any OpenAI-compatible API |

### Core Utilities
| Package | Purpose |
|---------|---------|
| `@xmldom/xmldom` | Workflow XML parsing |
| `zod` | Schema validation for tools |
| `secure-json-parse` | Safe JSON parsing for untrusted input |

### Runtime-Specific
| Package | Runtime | Purpose |
|---------|---------|---------|
| `playwright` | nodejs | Browser automation |
| `chromium-bidi` | nodejs | Browser DevTools protocol |
| `html2canvas` | web | Screenshot capture |
| `electron` | electron | Desktop runtime |
| `@types/chrome` | extension | Chrome extension APIs |

## Build System

- **Build tool**: Rollup with TypeScript plugin
- **Package manager**: pnpm workspaces
- **Test framework**: Jest with ts-jest preset
- **Module format**: Dual ESM (`index.esm.js`) + CJS (`index.cjs`)

## Common Commands

```bash
# Development
pnpm install              # Install all workspace dependencies
pnpm build                # Build all packages (sequential)
pnpm build-core           # Build only ai-agent-core

# Testing
pnpm test                 # Run all package tests
pnpm -w --filter @xsky/ai-agent-core test  # Test specific package
cd packages/ai-agent-core && pnpm test -- path/to/file.test.ts  # Single test

# Maintenance
pnpm clean                # Remove node_modules and dist everywhere
pnpm bench                # Run benchmarks (npx tsx benchmarks/core.bench.ts)
```

## Project-Specific Conventions

### Code Style
- 2-space indentation
- Single quotes for strings
- Semicolons required
- Strict TypeScript (`strict: true`)

### Exports
- Prefer **named exports** from modules
- Default export only for main entries (`XSky`, `BrowserAgent`)
- Re-export public API from `src/index.ts`

### File Naming
- **kebab-case** for all files: `browser-agent.ts`, `tool-sandbox.ts`
- Types in `src/types/` with `.types.ts` suffix
- Tests mirror source: `src/core/xsky.ts` → `test/core/xsky.test.ts`

### Agent Development
- Extend base classes: `Agent`, `BaseBrowserAgent`, `BaseBrowserLabelsAgent`
- Implement abstract methods for platform-specific behavior
- Register tools in constructor, not dynamically

### Tool Development
- One tool per file in `src/tools/`
- Use Zod for parameter schemas
- Export from `src/tools/index.ts`
- Set `noPlan: true` for tools that shouldn't be auto-scheduled

### Type Definitions
Keep types organized in `src/types/`:
- `core.types.ts` - XSky, Workflow, Context types
- `llm.types.ts` - LLM configuration, request/response
- `tools.types.ts` - Tool, ToolResult, ToolSchema
- `hooks.types.ts` - AgentHooks, ProductionXSkyConfig
- `security.types.ts` - Permissions, sandbox, audit

## Testing Strategy

- **Unit tests**: Core functions, utilities, parsers (`test/common/`, `test/tools/`)
- **Agent tests**: Mock agents for orchestrator testing (`test/core/agents.ts`)
- **Integration tests**: Real LLM calls when API keys available (conditional)
- **Browser tests**: Shared Playwright instance (`test/shared-browser.ts`)

### Test Patterns
```typescript
// Conditional test execution (skip without API keys)
const t = process.env.OPENAI_API_KEY ? test : test.skip;

// Shared browser pattern
const browser = await getSharedBrowser();
const page = await createTestPage(browser);
// ... test ...
await cleanupTestContext(page);
await releaseSharedBrowser();
```

## Error Handling

- Use `try/catch` with specific error types
- Hooks receive errors: `onToolError`, `onAgentError` with recovery policies
- Circuit breaker for LLM providers (3 failures → 60s cooldown)
- `AbortController` for task cancellation

## Environment Variables

```bash
# LLM API Keys (at least one required for agent execution)
ANTHROPIC_API_KEY=           # Claude models
OPENAI_API_KEY=              # OpenAI models
GOOGLE_API_KEY=              # Gemini models
DEEPSEEK_API_KEY=            # DeepSeek models
OPENROUTER_API_KEY=          # OpenRouter

# AWS Bedrock (if using)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=

# Development
OPENAI_COMPATIBLE_API_KEY=   # For testing with proxies
OPENAI_COMPATIBLE_BASE_URL=  # Custom endpoint
```
