# Node.js Quickstart

This guide walks you through building a headless automation script using `ai-agent-nodejs`.

## Setup

1. Create a new project:
```bash
mkdir my-agent-app
cd my-agent-app
npm init -y
pnpm add typescript ts-node @types/node -D
pnpm tsc --init
```

2. Install XSky dependencies:
```bash
pnpm add @xsky/ai-agent-core @xsky/ai-agent-nodejs dotenv
```

3. Install Playwright browsers (required for BrowserAgent):
```bash
npx playwright install chromium
```

## Creating the Agent

Create `src/index.ts`:

```typescript
import dotenv from 'dotenv';
import { BrowserAgent, FileAgent } from '@xsky/ai-agent-nodejs';
import { Eko, LLMs, StreamCallbackMessage } from '@xsky/ai-agent-core';

dotenv.config();

const llms: LLMs = {
  default: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    config: {
      baseURL: process.env.ANTHROPIC_BASE_URL,
    },
  },
};

const callback = {
  onMessage: async (message: StreamCallbackMessage) => {
    // Basic example: only log final messages
    if (!message.streamDone) return;
    console.log('message:', JSON.stringify(message, null, 2));
  },
};

async function runAgent() {
  // Initialize Browser + File agents
  const browserAgent = new BrowserAgent();

  // Explicitly set headless mode (defaults to false)
  // Set to true for background execution without visible browser
  browserAgent.setHeadless(false);

  const agents = [browserAgent, new FileAgent()];

  // Initialize orchestration engine
  const eko = new Eko({ llms, agents, callback });

  // Execute a multi-step task
  const prompt = `
    1. Go to news.ycombinator.com
    2. Capture a screenshot of the homepage
    3. Extract the top 3 headlines
    4. Save the headlines to 'hn-top-3.txt'
  `;

  try {
    console.log('Planning task...');
    // generate() creates the XML workflow plan
    const workflow = await eko.generate(prompt);
    console.log('Plan generated. Executing...');

    // execute() runs the plan
    await eko.execute(workflow.id);

    console.log('Done! Check ./output for results.');
  } catch (error) {
    console.error('Agent failed:', error);
  }

  // Note: XSky currently relies on process exit for cleanup.
  // Long-running services should manage process lifecycle carefully.
}

runAgent();
```

## Running It

```bash
# Make sure ANTHROPIC_API_KEY is in .env
npx ts-node src/index.ts
```

## What Happened?

1. **Planning**: Eko used the LLM to convert your natural language request into a structured workflow.
2. **Execution**:
   - `BrowserAgent` launched Chromium, navigated to HN, took a screenshot.
   - `BrowserAgent` analyzed the DOM to find headlines.
   - `FileAgent` wrote the extracted text to disk.

## Next Steps

- Learn about [Custom Agents](../guides/add-new-agent.md)
- Explore [Hooks](../reference/hooks.md) for production safety
