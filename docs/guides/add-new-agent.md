# Guide: Adding a New Agent

Sometimes the built-in `BrowserAgent` or `FileAgent` aren't enough. You might need an agent that specializes in SQL queries, controls a robot, or manages a specific API.

## Step 1: Extend the Agent Class

Create `src/agents/MySqlAgent.ts`:

```typescript
import { Agent, Tool, Context } from '@xsky/ai-agent-core';
import { z } from 'zod';

export class MySqlAgent extends Agent {
  name = 'sql_expert';
  description = 'Executes SQL queries against the production database.';

  constructor(private connectionString: string) {
    super();
  }

  // 1. Define System Prompt
  async getAgentSystemPrompt(context: Context): Promise<string> {
    return `You are a SQL expert.
            You have read-only access to the database.
            Only run SELECT queries.`;
  }

  // 2. Define Tools
  getTools(): Tool[] {
    return [{
      name: 'run_query',
      description: 'Execute a SQL query',
      parameters: z.object({
        sql: z.string().describe('The SQL query to run')
      }),
      execute: async ({ sql }) => {
        // Implementation here...
        return JSON.stringify(results);
      }
    }];
  }
}
```

## Step 2: Register the Agent

In your initialization code:

```typescript
const sqlAgent = new MySqlAgent(process.env.DB_URL);
xsky.registerAgent(sqlAgent);
```

## Step 3: Use It

You can now ask XSky to use this agent:

```typescript
await xsky.run('Find the top 5 customers by revenue from last month');
```

XSky's planner will see `sql_expert` in the registry and assign the task to it.
