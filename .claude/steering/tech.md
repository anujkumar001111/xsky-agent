# XSky AI Agent - Technical Reference

> Steering document for AI assistants: Tech stack, commands, and conventions

## Tech Stack Overview

### Languages & Runtimes
| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | 5.8+ | Primary language |
| Node.js | 18+ | Server runtime |
| pnpm | 10.18+ | Package manager |

### Core Dependencies
| Package | Purpose |
|---------|---------|
| `@ai-sdk/provider` | LLM provider abstraction |
| `@ai-sdk/openai` | OpenAI integration |
| `@ai-sdk/anthropic` | Anthropic integration |
| `@ai-sdk/google` | Google AI integration |
| `@ai-sdk/amazon-bedrock` | AWS Bedrock integration |
| `@ai-sdk/deepseek` | DeepSeek integration |
| `@openrouter/ai-sdk-provider` | OpenRouter integration |
| `@ai-sdk/openai-compatible` | Generic OpenAI-compatible endpoints |
| `zod` | Runtime schema validation |
| `@xmldom/xmldom` | XML parsing for workflows |
| `secure-json-parse` | Safe JSON parsing |

### Environment Adapters
| Package | Dependencies |
|---------|-------------|
| `@xsky/ai-agent-nodejs` | playwright, chromium-bidi, glob |
| `@xsky/ai-agent-web` | html2canvas |
| `@xsky/ai-agent-extension` | Chrome Extension APIs |
| `@xsky/ai-agent-electron` | Electron APIs, glob |

### Build Tools
| Tool | Version | Purpose |
|------|---------|---------|
| Rollup | 4.40+ | Bundle CJS/ESM |
| @rollup/plugin-typescript | 12.1+ | TypeScript compilation |
| @rollup/plugin-commonjs | 28.0+ | CommonJS interop |
| @rollup/plugin-node-resolve | 16.0+ | Node module resolution |
| @rollup/plugin-json | 6.1+ | JSON imports |

### Testing Tools
| Tool | Version | Purpose |
|------|---------|---------|
| Jest | 29.7+ | Test runner |
| ts-jest | 29.3+ | TypeScript Jest integration |
| jsdom | 22.1+ | DOM environment for testing |

## Development Commands

### Monorepo Root Commands
```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Clean all build artifacts
pnpm clean
```

### Package-Specific Commands
```bash
# Build specific package
pnpm --filter @xsky/ai-agent-core build
pnpm --filter @xsky/ai-agent-electron build
pnpm --filter @xsky/ai-agent-nodejs build
pnpm --filter @xsky/ai-agent-web build
pnpm --filter @xsky/ai-agent-extension build

# Test specific package
pnpm --filter @xsky/ai-agent-core test
pnpm --filter @xsky/ai-agent-nodejs test

# Run single test file
pnpm --filter @xsky/ai-agent-core test -- path/to/test.ts
```

### Example Projects
```bash
# Node.js example
cd example/nodejs && pnpm install && pnpm start

# Web example
cd example/web && pnpm install && pnpm start

# Extension example
cd example/extension && pnpm install && pnpm build
```

## Code Conventions

### File Naming
- Source files: `kebab-case.ts` (e.g., `dom_intelligence.ts`, `browser_labels.ts`)
- Test files: `*.test.ts` in `test/` directory
- Types: `*.types.ts` for type-only files

### Exports
- **Named exports**: Preferred for all modules
- **Default export**: Only for main entry points (e.g., `Eko`)
- **Re-exports**: Centralized in `index.ts` files

### Import Patterns
```typescript
// Relative imports within package
import { Agent } from "../agent";
import config from "../config";

// Type imports
import type { EkoConfig, Workflow } from "../types";
```

### Class Naming
| Pattern | Example | Usage |
|---------|---------|-------|
| `Base*` | `BaseBrowserAgent` | Abstract base classes |
| `Simple*` | `SimpleSseMcpClient` | Basic implementations |
| `*Context` | `AgentContext` | State containers |
| `*Tool` | `HumanInteractTool` | Tool implementations |

### Type Definitions
```typescript
// Union types with type discriminator
export type WorkflowNode =
  | WorkflowTextNode
  | WorkflowForEachNode
  | WorkflowWatchNode;

// Configuration objects
export type EkoConfig = {
  llms: LLMs;
  agents?: Agent[];
  // ...
};

// Callback interfaces
export interface StreamCallback {
  onMessage: (message: StreamCallbackMessage) => Promise<void>;
}
```

### Error Handling
```typescript
// Abort pattern
if (this.controller.signal.aborted) {
  const error = new Error("Operation was interrupted");
  error.name = "AbortError";
  throw error;
}

// Retry pattern
if (retryNum < 3) {
  await sleep(1000);
  return await this.doPlan(taskPrompt, messages, saveHistory, ++retryNum);
}
```

### Async Patterns
- All public methods returning promises are `async`
- Use `Promise.all()` for parallel operations
- Abort signals propagated via `AbortController`

## Project Configuration

### TypeScript (tsconfig.json patterns)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "esModuleInterop": true
  }
}
```

### Rollup Output
```javascript
// Dual CJS/ESM output pattern
output: [
  { file: 'dist/index.cjs.js', format: 'cjs' },
  { file: 'dist/index.esm.js', format: 'esm' }
]
```

### Package.json Exports
```json
{
  "exports": {
    ".": {
      "require": "./dist/index.cjs.js",
      "import": "./dist/index.esm.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

### Jest Configuration
```javascript
{
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts']
}
```

## API Patterns

### Eko Methods
| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `generate()` | taskPrompt, taskId?, contextParams? | Workflow | Plan without execute |
| `execute()` | taskId | EkoResult | Execute planned workflow |
| `run()` | taskPrompt, taskId?, contextParams? | EkoResult | Plan + execute |
| `modify()` | taskId, modifyTaskPrompt | Workflow | Re-plan existing task |
| `pauseTask()` | taskId, pause, abortCurrentStep? | boolean | Pause/resume |
| `abortTask()` | taskId, reason? | boolean | Cancel execution |
| `deleteTask()` | taskId | boolean | Cleanup resources |

### Agent Interface
```typescript
abstract class Agent {
  abstract Name: string;
  abstract AgentContext: AgentContext | null;
  abstract run(context: Context, agentChain: AgentChain): Promise<string>;
}
```

### Tool Interface
```typescript
interface Tool {
  name: string;
  description?: string;
  parameters: JSONSchema7;
  noPlan?: boolean;
  supportParallelCalls?: boolean;
  execute(args: Record<string, unknown>, agentContext: AgentContext): Promise<ToolResult>;
}
```

### MCP Client Interface
```typescript
interface IMcpClient {
  listTools(): Promise<Tool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
}
```

## Debugging

### Logging
```typescript
import Log from "../common/log";

Log.info("Message");     // Info level
Log.error("Error", e);   // Error level
Log.isEnableInfo();      // Check if info enabled
```

### Context Inspection
```typescript
// Get current workflow state
const context = eko.getTask(taskId);
context.workflow;        // Current workflow
context.chain;           // Execution chain
context.variables;       // Task variables
context.conversation;    // Chat history
```

## Version Requirements

| Dependency | Minimum Version |
|------------|-----------------|
| Node.js | 18.0.0 |
| pnpm | 10.0.0 |
| TypeScript | 5.8.0 |
| Electron | 20.0.0 (peer) |
| Playwright | 1.52.0 |

## Prompt System

The planning system uses LLM prompts defined in `src/prompt/plan.ts`.

### Prompt Templates

| Template | Purpose |
|----------|---------|
| `PLAN_SYSTEM_TEMPLATE` | System prompt for Planner LLM |
| `PLAN_USER_TEMPLATE` | User prompt with task description |
| `PLAN_TASK_DESCRIPTION` | Instructions for task decomposition |
| `PLAN_EXAMPLE_LIST` | 5 example workflows for few-shot learning |

### Prompt Functions

```typescript
// Get system prompt with agent list and examples
getPlanSystemPrompt(context: Context, planTaskDescription?: string, planExampleList?: string[]): Promise<string>

// Get user prompt with task and platform info
getPlanUserPrompt(task_prompt: string, task_website?: string, ext_prompt?: string): string
```

### Customization Points

| Variable | Purpose |
|----------|---------|
| `context.variables.get("plan_task_description")` | Override task description |
| `context.variables.get("plan_example_list")` | Override examples |
| `context.variables.get("task_website")` | Pre-fill task website |
| `context.variables.get("plan_ext_prompt")` | Append extra instructions |

### Workflow XML Schema

```xml
<root>
  <name>Task Name</name>
  <thought>Planning reasoning</thought>
  <agents>
    <agent name="AgentName" id="0" dependsOn="">
      <task>Agent task description</task>
      <nodes>
        <node>Step description</node>
        <node input="varName">Read variable</node>
        <node output="varName">Write variable</node>
        <forEach items="listVar">
          <node>Loop step</node>
        </forEach>
        <watch event="dom" loop="true">
          <description>Watch description</description>
          <trigger>
            <node>Trigger step</node>
          </trigger>
        </watch>
      </nodes>
    </agent>
  </agents>
</root>
```

## Troubleshooting (quick reference)
- **AbortError**: Raised when task/controller is aborted; ensure callers catch and surface abort reasons.
- **LLM retries**: Planner retries up to 3 times (`maxRetryNum=3`); expect exponential-ish backoff between attempts.
- **Compression triggers**: Dialogue compression starts at 80 messages (`compressThreshold=80`) or when token count exceeds `compressTokensThreshold=80000`.
