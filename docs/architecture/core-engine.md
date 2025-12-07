# Architecture: Core Engine

The Core Engine (`packages/ai-agent-core`) is responsible for the cognitive architecture of XSky. It handles planning, execution, and state management.

## Key Components

### XSky (`src/core/xsky.ts`)
The main entry point. It orchestrates the lifecycle of a task:

1. **Generate**: `xsky.generate(prompt)`
   - Uses `Planner` to convert natural language to XML workflow.
   - Returns a `Workflow` object with a unique ID.
2. **Execute**: `xsky.execute(workflowId)`
   - Initializes `Context`.
   - Iterates through workflow steps.
   - Manages concurrency and dependencies.

### Workflow XML
XSky uses an XML intermediate representation for plans. This provides deterministic structure while allowing LLM flexibility.

```xml
<workflow>
  <agent name="browser">
    <task>Go to example.com</task>
  </agent>
  <agent name="file">
    <task>Save data to log.txt</task>
  </agent>
</workflow>
```

Supported tags:
- `<agent>`: Execute a task with a specific agent.
- `<forEach>`: Iterate over a list of items.
- `<watch>`: Wait for a specific condition/trigger.
- `<parallel>`: Run tasks concurrently (planned).

### Context (`src/core/context.ts`)
Holds the state for a single execution run.

- **Variables**: `{{variable_name}}` storage.
- **Agent Registry**: Available agents for this run.
- **AbortController**: Signal to cancel execution.
- **Checkpoints**: Snapshots of state for resumption.

### Chain (`src/core/chain.ts`)
Records the execution history. Essential for debugging and observability.

- **AgentChain**: History of a specific agent's execution.
- **ToolChain**: History of tool calls within an agent.

### Planning (`src/core/plan.ts`)
The "Brain". Uses a system prompt that teaches the LLM how to write valid Workflow XML. It includes:
- Available agents descriptions.
- XML syntax rules.
- Few-shot examples.

### Dialogue (`src/core/dialogue.ts`)
A conversational wrapper around XSky. Maintains conversation history and "routed" user messages to:
- `task_planner`: Create a new plan.
- `execute_task`: Run a plan.
- `chat`: Just talk.
