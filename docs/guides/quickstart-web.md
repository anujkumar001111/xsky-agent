# Web (SPA) Quickstart

This guide shows how to use XSky in a single-page app (SPA) to automate the *current* tab (in-page automation).

## Constraints

- Runs entirely in the browser; no Node APIs.
- No direct file system access.
- Screenshots via `html2canvas`, not real browser screenshots.

## 1. Install Dependencies

In your SPA project (e.g., Vite + React):

```bash
pnpm add @xsky/ai-agent-core @xsky/ai-agent-web
```

## 2. Initialize XSky in the Browser

Create `src/agent.ts`:

```typescript
import { XSky, LLMs, StreamCallbackMessage } from '@xsky/ai-agent-core';
import { BrowserAgent } from '@xsky/ai-agent-web';

// Configure LLM via an API route or a server-side proxy.
// In browser-only setups you usually call your own backend
// which then talks to the LLM provider.

const llms: LLMs = {
  default: {
    provider: 'openai',
    model: 'gpt-4o',
    // Typically uses a custom baseURL that hits your backend
    config: {
      baseURL: '/api/llm',
    },
  },
};

const callback = {
  onMessage: async (message: StreamCallbackMessage) => {
    if (!message.streamDone) return;
    console.log('message:', JSON.stringify(message, null, 2));
  },
};

export function createWebXSky() {
  const agents = [new BrowserAgent()];
  const xsky = new XSky({ llms, agents, callback });
  return xsky;
}
```

## 3. Using XSky from a React Component

`src/App.tsx`:

```tsx
import { useState } from 'react';
import { XSky, LLMs } from '@xsky/ai-agent-core';
import { BrowserAgent } from '@xsky/ai-agent-web';

const agents = [new BrowserAgent()];
const xsky = new XSky({ llms, agents });

export function App() {
  const [prompt, setPrompt] = useState('Scroll the page and summarize visible content');
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);

  const runTask = async () => {
    setRunning(true);
    try {
      const res = await eko.run(prompt);
      setResult(res);
    } finally {
      setRunning(false);
    }
  };

  return (
    <main>
      <h1>Web Agent Demo</h1>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} />
      <button onClick={runTask} disabled={running}>
        {running ? 'Running...' : 'Run Task'}
      </button>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </main>
  );
}
```

## 4. Security Considerations

- Never expose raw provider API keys in the browser.
- Route LLM traffic through your backend and enforce rate limits.
- Be explicit about which elements the agent is allowed to interact with (e.g., restrict to a container div).

## 5. Limitations vs Node/Electron

- No access to other tabs or windows; only the current page.
- No true file system operations (use downloads or backend APIs instead).
- Screenshots are rendered, not pixel-perfect browser captures.

For desktop-level control or multi-tab workflows, prefer the Node.js or Electron runtimes.
