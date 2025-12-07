import { contextBridge, ipcRenderer } from 'electron';
import type { StreamCallbackMessage } from '@xsky/ai-agent-core';

const IPC_CHANNELS = {
  RUN_TASK: 'xsky:run-task',
  PAUSE_TASK: 'xsky:pause-task',
  ABORT_TASK: 'xsky:abort-task',
  NAVIGATE: 'view:navigate',
  SCREENSHOT: 'view:screenshot',
  GO_BACK: 'view:go-back',
  GO_FORWARD: 'view:go-forward',
  REFRESH: 'view:refresh',
  TASK_EVENT: 'xsky:task-event'
} as const;

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  xsky: {
    runTask: (prompt: string) => ipcRenderer.invoke(IPC_CHANNELS.RUN_TASK, prompt),
    pauseTask: (taskId: string) => ipcRenderer.invoke(IPC_CHANNELS.PAUSE_TASK, taskId),
    abortTask: (taskId: string) => ipcRenderer.invoke(IPC_CHANNELS.ABORT_TASK, taskId),
    onTaskEvent: (callback: (event: StreamCallbackMessage) => void) => {
      const subscription = (_: any, event: StreamCallbackMessage) => callback(event);
      ipcRenderer.on(IPC_CHANNELS.TASK_EVENT, subscription);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TASK_EVENT, subscription);
    }
  },
  view: {
    navigate: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.NAVIGATE, url),
    screenshot: () => ipcRenderer.invoke(IPC_CHANNELS.SCREENSHOT),
    goBack: () => ipcRenderer.invoke(IPC_CHANNELS.GO_BACK),
    goForward: () => ipcRenderer.invoke(IPC_CHANNELS.GO_FORWARD),
    refresh: () => ipcRenderer.invoke(IPC_CHANNELS.REFRESH)
  }
});

// Type definitions for the exposed API
export interface ElectronAPI {
  xsky: {
    runTask: (prompt: string) => Promise<any>;
    pauseTask: (taskId: string) => Promise<void>;
    abortTask: (taskId: string) => Promise<void>;
    onTaskEvent: (callback: (event: StreamCallbackMessage) => void) => () => void;
  };
  view: {
    navigate: (url: string) => Promise<string>;
    screenshot: () => Promise<string>;
    goBack: () => Promise<void>;
    goForward: () => Promise<void>;
    refresh: () => Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
