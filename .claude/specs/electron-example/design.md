# Electron Example - Design Document

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Electron Application                        │
├─────────────────────────────────────────────────────────────────┤
│  Main Process                                                    │
│  ├── index.ts (Entry point)                                      │
│  ├── window.ts (Window management)                               │
│  ├── ipc-handlers.ts (IPC channel handlers)                      │
│  └── agent-service.ts (Eko orchestration)                        │
├─────────────────────────────────────────────────────────────────┤
│  Preload                                                         │
│  └── preload.ts (Secure API bridge)                              │
├─────────────────────────────────────────────────────────────────┤
│  Renderer Process                                                │
│  ├── index.html (UI shell)                                       │
│  ├── renderer.ts (UI logic)                                      │
│  └── styles.css (Styling)                                        │
├─────────────────────────────────────────────────────────────────┤
│  WebContentsView (Browser automation target)                     │
│  └── Managed by BrowserAgent                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Main Process (`src/main/`)

#### 1.1 Entry Point (`index.ts`)

```typescript
// Responsibilities:
// - Initialize Electron app
// - Create main window
// - Set up IPC handlers
// - Initialize agent service

import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';
import { setupIpcHandlers } from './ipc-handlers';
import { AgentService } from './agent-service';

app.whenReady().then(async () => {
  const mainWindow = createMainWindow();
  const agentService = new AgentService(mainWindow);
  setupIpcHandlers(agentService);
});
```

#### 1.2 Window Manager (`window.ts`)

```typescript
// Creates main window with:
// - BrowserWindow for UI
// - WebContentsView for browser automation
// - Secure webPreferences

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Create browser view for agent automation
  const browserView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: getPreloadPath() // From @xsky/ai-agent-electron
    }
  });

  return mainWindow;
}
```

#### 1.3 Agent Service (`agent-service.ts`)

```typescript
// Manages AI agent lifecycle:
// - Initialize Eko with LLM config
// - Create and register agents
// - Handle task execution
// - Emit events to renderer

export class AgentService {
  private eko: Eko;
  private browserAgent: BrowserAgent;
  private fileAgent: FileAgent;
  private currentTaskId?: string;

  constructor(mainWindow: BrowserWindow, browserView: WebContentsView) {
    // Initialize agents
    this.browserAgent = new BrowserAgent(browserView, undefined, undefined, {
      useContextIsolation: true
    });
    this.fileAgent = new FileAgent();

    // Initialize Eko
    this.eko = new Eko({
      llms: this.getLlmConfig(),
      agents: [this.browserAgent, this.fileAgent],
      callback: this.createCallback(mainWindow)
    });
  }

  async runTask(prompt: string): Promise<EkoResult> {
    return await this.eko.run(prompt);
  }

  async pauseTask(taskId: string): Promise<void> {
    await this.eko.pauseTask(taskId, true);
  }

  async abortTask(taskId: string): Promise<void> {
    await this.eko.abortTask(taskId);
  }
}
```

#### 1.4 IPC Handlers (`ipc-handlers.ts`)

```typescript
// IPC channel definitions:
// - eko:run-task - Start new task
// - eko:pause-task - Pause/resume task
// - eko:abort-task - Cancel task
// - eko:get-status - Get current status
// - view:navigate - Navigate browser view
// - view:screenshot - Capture screenshot

const IPC_CHANNELS = {
  RUN_TASK: 'eko:run-task',
  PAUSE_TASK: 'eko:pause-task',
  ABORT_TASK: 'eko:abort-task',
  GET_STATUS: 'eko:get-status',
  NAVIGATE: 'view:navigate',
  SCREENSHOT: 'view:screenshot',
  TASK_EVENT: 'eko:task-event' // For streaming to renderer
} as const;
```

### 2. Preload Script (`src/preload/preload.ts`)

```typescript
// Exposes secure API to renderer:
// - window.electronAPI.eko.* for agent operations
// - window.electronAPI.view.* for browser control

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  eko: {
    runTask: (prompt: string) => ipcRenderer.invoke('eko:run-task', prompt),
    pauseTask: (taskId: string) => ipcRenderer.invoke('eko:pause-task', taskId),
    abortTask: (taskId: string) => ipcRenderer.invoke('eko:abort-task', taskId),
    onTaskEvent: (callback: (event: TaskEvent) => void) => {
      ipcRenderer.on('eko:task-event', (_, event) => callback(event));
    }
  },
  view: {
    navigate: (url: string) => ipcRenderer.invoke('view:navigate', url),
    screenshot: () => ipcRenderer.invoke('view:screenshot'),
    goBack: () => ipcRenderer.invoke('view:go-back'),
    goForward: () => ipcRenderer.invoke('view:go-forward'),
    refresh: () => ipcRenderer.invoke('view:refresh')
  }
});
```

### 3. Renderer (`src/renderer/`)

#### 3.1 UI Layout (`index.html`)

```
┌──────────────────────────────────────────────────────────────┐
│  Navigation Bar                                               │
│  [◀] [▶] [🔄] [________________________URL_INPUT____________] │
├─────────────────────────────────┬────────────────────────────┤
│                                 │  Chat Panel                │
│                                 │  ┌────────────────────────┐│
│     Browser View                │  │ Agent: Hello!         ││
│     (WebContentsView)           │  │ User: Search for AI   ││
│                                 │  │ Agent: Navigating...  ││
│                                 │  └────────────────────────┘│
│                                 │  ┌────────────────────────┐│
│                                 │  │ [________________][⏎] ││
│                                 │  └────────────────────────┘│
├─────────────────────────────────┼────────────────────────────┤
│  Status: Running task #abc123   │  [⏸️ Pause] [⏹️ Stop]      │
└─────────────────────────────────┴────────────────────────────┘
```

#### 3.2 Renderer Logic (`renderer.ts`)

```typescript
// UI state management:
// - Task status tracking
// - Message history
// - Navigation state

interface AppState {
  status: 'idle' | 'running' | 'paused' | 'error';
  currentTaskId?: string;
  messages: Message[];
  currentUrl: string;
}

// Event handlers
document.getElementById('send-btn')?.addEventListener('click', async () => {
  const input = document.getElementById('chat-input') as HTMLInputElement;
  const prompt = input.value.trim();
  if (prompt) {
    addMessage('user', prompt);
    input.value = '';
    setState({ status: 'running' });

    try {
      const result = await window.electronAPI.eko.runTask(prompt);
      addMessage('agent', result.result);
      setState({ status: 'idle' });
    } catch (error) {
      addMessage('error', error.message);
      setState({ status: 'error' });
    }
  }
});
```

## Data Flow

### Task Execution Flow

```
User Input (Renderer)
       │
       ▼
[IPC: eko:run-task]
       │
       ▼
Main Process: AgentService.runTask()
       │
       ▼
Eko.run(prompt)
       │
       ├──► Planner.plan() → Workflow XML
       │
       ▼
Agent Execution Loop
       │
       ├──► BrowserAgent.navigate_to()
       │       └──► WebContentsView.loadURL()
       │
       ├──► BrowserAgent.execute_script()
       │       └──► WebContents.executeJavaScript()
       │
       ├──► BrowserAgent.screenshot()
       │       └──► WebContents.capturePage()
       │
       ▼
StreamCallback.onMessage()
       │
       ▼
[IPC: eko:task-event] → Renderer
       │
       ▼
UI Update
```

### Screenshot Flow

```
User clicks "Screenshot" or Agent needs screenshot
       │
       ▼
Main Process: browserView.webContents.capturePage()
       │
       ▼
NativeImage.toDataURL()
       │
       ▼
Return base64 image to renderer/agent
```

## File Structure

```
example/electron/
├── package.json
├── tsconfig.json
├── rollup.config.js
├── .env.example
├── README.md
├── src/
│   ├── main/
│   │   ├── index.ts           # Entry point
│   │   ├── window.ts          # Window management
│   │   ├── ipc-handlers.ts    # IPC channel handlers
│   │   └── agent-service.ts   # Eko orchestration
│   ├── preload/
│   │   └── preload.ts         # Secure API bridge
│   └── renderer/
│       ├── index.html         # UI shell
│       ├── renderer.ts        # UI logic
│       └── styles.css         # Styling
└── dist/                      # Build output
```

## Security Model

### Context Isolation

```
┌─────────────────────────────────────────────────────────────┐
│  Main Process (Node.js access)                               │
│  ├── Full file system access                                 │
│  ├── Native modules                                          │
│  └── IPC server                                              │
├─────────────────────────────────────────────────────────────┤
│  Preload (Limited bridge)                                    │
│  ├── contextBridge.exposeInMainWorld()                       │
│  ├── Whitelisted IPC channels only                           │
│  └── No direct Node.js access                                │
├─────────────────────────────────────────────────────────────┤
│  Renderer (Sandboxed)                                        │
│  ├── window.electronAPI only                                 │
│  ├── No require() or import                                  │
│  └── Standard web APIs                                       │
└─────────────────────────────────────────────────────────────┘
```

### IPC Channel Whitelist

| Channel | Direction | Validation |
|---------|-----------|------------|
| `eko:run-task` | Renderer → Main | String prompt, max 10KB |
| `eko:pause-task` | Renderer → Main | Valid taskId |
| `eko:abort-task` | Renderer → Main | Valid taskId |
| `eko:task-event` | Main → Renderer | StreamCallbackMessage |
| `view:navigate` | Renderer → Main | Valid URL |
| `view:screenshot` | Renderer → Main | No params |

## Configuration

### LLM Configuration

```typescript
// Loaded from environment variables
const llmConfig: LLMs = {
  default: {
    provider: process.env.DEFAULT_PROVIDER || 'anthropic',
    model: process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    config: {
      baseURL: process.env.ANTHROPIC_BASE_URL
    }
  },
  openai: {
    provider: 'openai',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY || '',
    config: {
      baseURL: process.env.OPENAI_BASE_URL
    }
  }
};
```

### Build Configuration

```javascript
// rollup.config.js
export default [
  // Main process bundle
  {
    input: 'src/main/index.ts',
    output: { file: 'dist/main.js', format: 'cjs' },
    external: ['electron', '@xsky/ai-agent-core', '@xsky/ai-agent-electron']
  },
  // Preload bundle
  {
    input: 'src/preload/preload.ts',
    output: { file: 'dist/preload.js', format: 'cjs' },
    external: ['electron']
  },
  // Renderer bundle
  {
    input: 'src/renderer/renderer.ts',
    output: { file: 'dist/renderer.js', format: 'iife' }
  }
];
```

## Error Handling

### Error Categories

| Category | Handling | User Feedback |
|----------|----------|---------------|
| LLM API Error | Retry with backoff | "Connection issue, retrying..." |
| Navigation Error | Log and continue | "Failed to load page" |
| Script Execution Error | Catch and report | Show in agent message |
| Task Abort | Clean termination | "Task cancelled" |
| IPC Timeout | Reject promise | "Operation timed out" |

### Recovery Strategies

```typescript
// Retry wrapper for LLM calls
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * Math.pow(2, i)); // Exponential backoff
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Testing Strategy

### Unit Tests
- AgentService initialization
- IPC handler validation
- LLM config loading

### Integration Tests
- Full task execution flow
- Screenshot capture
- File operations

### Manual Testing Checklist
- [ ] App launches without errors
- [ ] Browser view loads google.com
- [ ] AI task "search for AI" works
- [ ] Screenshot captured correctly
- [ ] Pause/resume works
- [ ] Abort cancels task
- [ ] Error states display correctly
