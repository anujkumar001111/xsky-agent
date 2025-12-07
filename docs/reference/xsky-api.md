# XSky API Reference

## `XSky` Class

The main orchestrator class.

```typescript
import { XSky } from '@xsky/ai-agent-core';
const xsky = new XSky(config?);
```

### Methods

#### `generate(taskPrompt: string, taskId?: string, contextParams?: Record<string, any>): Promise<Workflow>`
Generates a workflow plan from a natural language prompt without executing it.

- **taskPrompt**: The natural language description of the task to plan.
- **taskId**: Optional task identifier (auto-generated UUID if not provided).
- **contextParams**: Optional initial variables to inject into context (accessible via `{{var}}`).
- **Returns**: A `Workflow` object containing the ID and XML plan.
- **Use Case**: When you want to review/edit the plan before execution.

#### `execute(taskId: string): Promise<XSkyResult>`
Executes an existing workflow by task ID.

- **taskId**: Task ID returned by `generate()` or provided to `run()`.
- **Returns**: Final result of the execution with success status and result data.

#### `run(taskPrompt: string, taskId?: string, contextParams?: Record<string, any>): Promise<XSkyResult>`
Convenience method that calls `generate()` then `execute()`.

- **taskPrompt**: The natural language description of the task to execute.
- **taskId**: Optional task identifier (auto-generated UUID if not provided).
- **contextParams**: Optional initial variables to inject into context (accessible via `{{var}}`).
- **Returns**: Final result of the execution with success status and result data.
- **Use Case**: Simple "fire and forget" tasks.

#### `registerAgent(agent: Agent): void`
Adds an agent to the registry. Agents must be registered before workflows can use them.

#### `stop(workflowId: string): void`
Signals the execution context to abort.

### Configuration (`XSkyConfig`)

- **llm**: LLM configuration object (provider, model, API key).
- **hooks**: `AgentHooks` object.
- **tools**: Global tools available to all agents.
