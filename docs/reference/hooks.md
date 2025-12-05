# Hooks Reference

Hooks allow you to intercept and modify framework behavior.

## `AgentHooks` Interface

### `beforeAgentStart`
- **Signature**: `(context: Context) => Promise<void>`
- **When**: Before an agent starts its execution loop.

### `afterAgentComplete`
- **Signature**: `(context: Context) => Promise<void>`
- **When**: After an agent finishes its task.

### `beforeToolCall`
- **Signature**: `(params: { toolName: string, args: any }) => Promise<ToolCallResult | void>`
- **When**: Before a tool is executed.
- **Return**:
  - `void`: Continue execution normally.
  - `ToolCallResult`: Mock the tool execution (skip actual tool).
  - `throw`: Block the execution.

### `afterToolCall`
- **Signature**: `(params: { toolName: string, args: any, result: any }) => Promise<any>`
- **When**: After a tool executes.
- **Return**:
  - `void`: Return original result.
  - `any`: Override result (e.g., redact secrets).

### `onToolError`
- **Signature**: `(error: Error, toolName: string) => Promise<void>`
- **When**: A tool throws an exception.

### `onApprovalRequired`
- **Signature**: `(info: ApprovalInfo) => Promise<ApprovalResult>`
- **When**: A sensitive tool is called (configured in `approvalConfig`).
- **Return**: `{ approved: boolean, modifications?: any }`.

### `onCheckpoint`
- **Signature**: `(state: Checkpoint) => Promise<void>`
- **When**: State changes significantly. Used for persistence.

### `onStateChange`
- **Signature**: `(diff: StateDiff) => void`
- **When**: Real-time state updates (logs, status).
