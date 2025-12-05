# Electron Quickstart

This guide shows how to integrate XSky into an Electron app so agents can automate the browser view inside your desktop application.

## Prerequisites

- Electron 28+
- Node.js 18+
- pnpm

## High-Level Architecture

In Electron, you typically:
- Run **Eko** and agents in the **main process**.
- Expose a small IPC API to the **renderer** (React/Vue/etc.).
- Optionally stream status updates from main → renderer.

```mermaid
graph TD
  Renderer[Renderer (UI)] -->|IPC: startTask| Main[Main Process]
  Main --> Eko[Eko + Agents]
  Eko --> BrowserView[Electron BrowserView / WebContents]
  Main -->|IPC: status| Renderer
```

## 1. Install Dependencies

```bash
pnpm add @xsky/ai-agent-core @xsky/ai-agent-electron dotenv
```

## 2. Main Process Setup

`electron/main.ts`:

```typescript
import { app, BrowserWindow, WebContentsView, ipcMain } from 'electron';
import { Eko, LLMs, StreamCallbackMessage } from '@xsky/ai-agent-core';
import { BrowserAgent, FileAgent, getPreloadPath } from '@xsky/ai-agent-electron';
import dotenv from 'dotenv';

dotenv.config();

const llms: LLMs = {
  default: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },
};

const callback = {
  onMessage: async (message: StreamCallbackMessage) => {
    if (!message.streamDone) return;
    console.log('message:', JSON.stringify(message, null, 2));
  },
};

let mainWindow: BrowserWindow | null = null;
let detailView: WebContentsView | null = null;
let eko: Eko | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: __dirname + '/preload.js',
    },
  });

  mainWindow.loadURL('http://localhost:3000'); // your renderer app

  // Create a WebContentsView that the BrowserAgent will control
  detailView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      preload: getPreloadPath(),
    },
  });

  mainWindow.contentView.addChildView(detailView);

  // Initialize agents
  const browserAgent = new BrowserAgent(detailView, undefined, undefined, {
    useContextIsolation: true,
    preloadPath: getPreloadPath(),
  });
  const fileAgent = new FileAgent(detailView);

  eko = new Eko({ llms, agents: [browserAgent, fileAgent], callback });
}

app.whenReady().then(createWindow);

ipcMain.handle('eko:run-task', async (_event, prompt: string) => {
  if (!eko) throw new Error('Eko not initialized');
  return eko.run(prompt);
});
```

## 3. Preload Bridge

`electron/preload.ts`:

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  runTask: (prompt: string) => ipcRenderer.invoke('eko:run-task', prompt),
});
```

## 4. Renderer Usage

In your React component (`src/App.tsx`):

```tsx
declare global {
  interface Window {
    api: {
      runTask(prompt: string): Promise<any>;
    };
  }
}

export function App() {
  const [prompt, setPrompt] = useState('Open example.com and take a screenshot');
  const [status, setStatus] = useState<any>(null);

  const onRun = async () => {
    setStatus('Running...');
    const result = await window.api.runTask(prompt);
    setStatus(result);
  };

  return (
    <div>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} />
      <button onClick={onRun}>Run Task</button>
      <pre>{JSON.stringify(status, null, 2)}</pre>
    </div>
  );
}
```

## Notes

- The Electron agent typically controls a `BrowserView` or the main `webContents` to perform navigation, clicks, and screenshots.
- **Lifecycle**: Agents are bound to the `WebContentsView` lifecycle. If you destroy the view, ensure you re-initialize the agent. XSky does not currently provide explicit teardown hooks.
- For production, combine this with the [Production Hardening](./production-hardening.md) guide (rate limits, approvals, logging).
