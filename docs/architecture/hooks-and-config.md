# Architecture: Hooks & Configuration

XSky is designed for production use, where observability and control are critical.

## Production Configuration

The `ProductionEkoConfig` interface extends the basic config with operational controls:

```typescript
const config: ProductionEkoConfig = {
  llm: { ... },
  hooks: myHooks,
  rateLimits: {
    maxSteps: 50,
    maxDuration: 60000,
  },
  approvalConfig: {
    tools: ['delete_file', 'transfer_money'], // Require approval
  },
  stateConfig: {
    persistInterval: 5000, // Checkpoint every 5s
  }
};
```

## Agent Hooks

Hooks allow you to intercept and react to lifecycle events. They are typed in `AgentHooks`.

### Lifecycle Hooks

- `beforeAgentStart` / `afterAgentComplete`
- `onWorkflowGenerated` / `onWorkflowComplete`
- `onWorkflowStepComplete`

### Execution Hooks

- **`beforeToolCall(tool, args)`**:
  - Can modify args.
  - Can block execution by throwing.
  - Can return a result immediately (mocking).

- **`afterToolCall(tool, result)`**:
  - Observe results.
  - redact sensitive data.

- **`onToolError(error)`**:
  - Custom error handling/reporting.

### Human-in-the-Loop Hooks

- **`onApprovalRequired(info)`**:
  - Triggered when a sensitive tool is called (if configured).
  - Must return `approved: boolean` or `modifications`.

### Persistence Hooks

- **`onCheckpoint(state)`**:
  - Called periodically or on important state changes.
  - Save `state` to database/disk to allow resuming later.

- **`onStateChange(diff)`**:
  - Real-time updates for UI (e.g., "Agent is typing...", "Tool executed").

## Example: Audit Logger Hook

```typescript
const auditLogger: AgentHooks = {
  afterToolCall: async ({ toolName, args, result }) => {
    await db.logs.create({
      action: toolName,
      params: JSON.stringify(args),
      output: JSON.stringify(result),
      timestamp: new Date()
    });
  }
};
```
