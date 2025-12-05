# Eko API Reference

## `Eko` Class

The main orchestrator class.

```typescript
import { Eko } from '@xsky/ai-agent-core';
const eko = new Eko(config?);
```

### Methods

#### `generate(prompt: string, options?: GenerateOptions): Promise<Workflow>`
Generates a workflow plan from a natural language prompt without executing it.

- **Returns**: A `Workflow` object containing the ID and XML plan.
- **Use Case**: When you want to review/edit the plan before execution.

#### `execute(workflowId: string, contextParams?: Record<string, any>): Promise<ExecutionResult>`
Executes an existing workflow by ID.

- **workflowId**: ID returned by `generate()`.
- **contextParams**: Initial variables to inject into context (accessible via `{{var}}`).
- **Returns**: Final result of the execution.

#### `run(prompt: string, options?: RunOptions): Promise<ExecutionResult>`
Convenience method that calls `generate()` then `execute()`.

- **Use Case**: Simple "fire and forget" tasks.

#### `registerAgent(agent: Agent): void`
Adds an agent to the registry. Agents must be registered before workflows can use them.

#### `stop(workflowId: string): void`
Signals the execution context to abort.

### Configuration (`EkoConfig`)

- **llm**: LLM configuration object (provider, model, API key).
- **hooks**: `AgentHooks` object.
- **tools**: Global tools available to all agents.
