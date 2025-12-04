import { ipcMain, WebContentsView } from 'electron';
import { AgentService } from './agent-service';

export const IPC_CHANNELS = {
  RUN_TASK: 'eko:run-task',
  PAUSE_TASK: 'eko:pause-task',
  ABORT_TASK: 'eko:abort-task',
  NAVIGATE: 'view:navigate',
  SCREENSHOT: 'view:screenshot',
  GO_BACK: 'view:go-back',
  GO_FORWARD: 'view:go-forward',
  REFRESH: 'view:refresh'
} as const;

export function setupIpcHandlers(agentService: AgentService, view: WebContentsView) {
  // Eko Agent Handlers
  ipcMain.handle(IPC_CHANNELS.RUN_TASK, async (_, prompt: string) => {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt');
    }
    // Max prompt length check
    if (prompt.length > 10000) {
      throw new Error('Prompt too long');
    }
    return await agentService.runTask(prompt);
  });

  ipcMain.handle(IPC_CHANNELS.PAUSE_TASK, async (_, taskId: string) => {
    if (!taskId || typeof taskId !== 'string') return;
    return await agentService.pauseTask(taskId);
  });

  ipcMain.handle(IPC_CHANNELS.ABORT_TASK, async (_, taskId: string) => {
    if (!taskId || typeof taskId !== 'string') return;
    return await agentService.abortTask(taskId);
  });

  // View Control Handlers
  ipcMain.handle(IPC_CHANNELS.NAVIGATE, async (_, url: string) => {
    if (!url || typeof url !== 'string') return;
    // Basic URL validation
    try {
      new URL(url);
    } catch {
      // Try adding https:// if missing
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
    }
    await view.webContents.loadURL(url);
    return view.webContents.getURL();
  });

  ipcMain.handle(IPC_CHANNELS.SCREENSHOT, async () => {
    const image = await view.webContents.capturePage();
    return image.toDataURL();
  });

  ipcMain.handle(IPC_CHANNELS.GO_BACK, () => {
    if (view.webContents.navigationHistory.canGoBack()) {
      view.webContents.navigationHistory.goBack();
    }
  });

  ipcMain.handle(IPC_CHANNELS.GO_FORWARD, () => {
    if (view.webContents.navigationHistory.canGoForward()) {
      view.webContents.navigationHistory.goForward();
    }
  });

  ipcMain.handle(IPC_CHANNELS.REFRESH, () => {
    view.webContents.reload();
  });
}
