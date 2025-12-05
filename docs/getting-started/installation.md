# Installation & Setup

## Prerequisites

- Node.js 18+
- pnpm (recommended)

## Installation

XSky is a monorepo framework. You typically consume specific packages in your application.

```bash
# Install core package
pnpm add @xsky/ai-agent-core

# Install environment-specific runtime (choose one)
pnpm add @xsky/ai-agent-nodejs    # For Node.js apps
pnpm add @xsky/ai-agent-web       # For browser SPAs
pnpm add @xsky/ai-agent-electron  # For Electron apps
# Extension package is usually built from source
```

## Minimal Node.js Example

Here's the simplest way to get started with a Node.js script:

```typescript
import { Eko, LLMs } from '@xsky/ai-agent-core';
import { BrowserAgent } from '@xsky/ai-agent-nodejs';
import dotenv from 'dotenv';

dotenv.config();

// 1. Configure LLM
LLMs.default = {
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20240620',
  apiKey: process.env.ANTHROPIC_API_KEY
};

async function main() {
  // 2. Initialize Eko
  const eko = new Eko();

  // 3. Register Agents
  // BrowserAgent requires Playwright dependencies installed
  const browserAgent = new BrowserAgent();
  eko.registerAgent(browserAgent);

  // 4. Run a task
  console.log('Starting task...');
  const result = await eko.run('Go to google.com and search for "XSky AI framework"');

  console.log('Task complete:', result);
}

main().catch(console.error);
```

## Configuration

You need at least one LLM provider API key in your environment variables:

```env
ANTHROPIC_API_KEY=sk-...
# OR
OPENAI_API_KEY=sk-...
```

## Next Steps

- [Node.js Quickstart](./quickstart-node.md)
- [Web Quickstart](./quickstart-web.md)
- [Electron Quickstart](./quickstart-electron.md)
