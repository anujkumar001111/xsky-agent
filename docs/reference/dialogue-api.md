# Dialogue API Reference

## `EkoDialogue` Class

A conversational wrapper around Eko, designed for chat interfaces.

```typescript
import { EkoDialogue } from '@xsky/ai-agent-core';
const dialogue = new EkoDialogue(eko);
```

### Methods

#### `chat(message: string): Promise<DialogueResponse>`
Process a user message. The dialogue model will decide to:
1. **Answer directly**: If it's a question or chit-chat.
2. **Plan a task**: If the user asks to do something (`task_planner` tool).
3. **Execute a task**: If a plan is ready/approved (`execute_task` tool).

#### `getHistory(): Message[]`
Returns the conversation history.

#### `clearHistory(): void`
Resets the conversation.

### Internal Tools

EkoDialogue uses specialized internal tools to control Eko:

- **`task_planner`**: Generates a workflow from the user's request.
- **`execute_task`**: Runs the generated workflow.
- **`variable_storage`**: Remembers context across the conversation.
