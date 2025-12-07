# Agent Guidelines

## Build/Test Commands
- **Install**: `pnpm install`
- **Build all**: `pnpm build` (sequential across packages)
- **Test all**: `pnpm test` (sequential across packages)
- **Single test**: `cd packages/ai-agent-core && pnpm test -- test/core/xsky.test.ts`
- **Package-specific**: `pnpm -C packages/ai-agent-core test`
- **Clean**: `pnpm clean` (removes node_modules and dist)

## Code Style Guidelines
- **Language**: TypeScript with strict mode, ES2020 target, ESNext modules
- **Formatting**: 2-space indentation, single quotes, semicolons required
- **Imports**: Explicit named imports; default exports only for main APIs (like `XSky`)
- **Naming**: lowerCamelCase for variables/functions, PascalCase for types/classes/interfaces, kebab-case for files/directories
- **Types**: Strict typing required; place in `src/types/` (core.types.ts, llm.types.ts, tools.types.ts, hooks.types.ts)
- **Error Handling**: Use try/catch with specific error types; throw descriptive Error objects
- **Testing**: Jest + ts-jest; test files as `*.test.ts` alongside source or in `__tests__/`; aim for high coverage
- **File Structure**: Core types in `src/types/`, agents in `src/agent/`, tools in `src/tools/`, tests in `test/`
- **Security**: All tool executions must go through `ToolExecutionSandbox` with permission checks
