# Guide: Production Hardening

When moving from prototype to production, you need safety, observability, and control.

## 1. Rate Limiting

Prevent runaway costs or infinite loops.

```typescript
const config: ProductionXSkyConfig = {
  rateLimits: {
    maxSteps: 50,        // Max agent steps per task
    maxDuration: 120000, // 2 minutes max
    maxToolCalls: 100,   // Total tool calls
  }
};
```

## 2. Approval Flows (Human-in-the-Loop)

Block sensitive actions until a human approves.

```typescript
const config: ProductionXSkyConfig = {
  approvalConfig: {
    tools: ['delete_file', 'send_email', 'transfer_funds'],
  },
  hooks: {
    onApprovalRequired: async ({ toolName, args }) => {
      // Notify user UI
      const approved = await myUi.askUser(`Allow ${toolName}?`);
      return { approved };
    }
  }
};
```

## 3. Checkpointing

Save state to recover from crashes.

```typescript
const config: ProductionXSkyConfig = {
  hooks: {
    onCheckpoint: async (state) => {
      await db.checkpoints.save({
        workflowId: state.workflowId,
        data: JSON.stringify(state)
      });
    }
  }
};
```

To resume:

```typescript
const savedState = await db.checkpoints.get(id);
await eko.execute(id, { resumeFrom: JSON.parse(savedState) });
```

## 4. Audit Logging

Record every action for compliance.

```typescript
const config: ProductionXSkyConfig = {
  hooks: {
    afterToolCall: async ({ toolName, args, result }) => {
      logger.info('Tool execution', { toolName, args, result });
    },
    onAgentError: async (error) => {
      logger.error('Agent failure', error);
    }
  }
};
```

## 5. Secrets Redaction

Never log sensitive data.

```typescript
const config: ProductionXSkyConfig = {
  hooks: {
    afterToolCall: async ({ result }) => {
      if (typeof result === 'string') {
        return result.replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED]');
      }
      return result;
    }
  }
};
```
