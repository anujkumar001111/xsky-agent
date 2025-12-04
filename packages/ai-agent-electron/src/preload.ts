/**
 * Preload script for secure Electron browser agent.
 * This script runs in a sandboxed context with contextIsolation enabled,
 * exposing only specific, safe APIs to the renderer process.
 */
import { contextBridge, ipcRenderer } from 'electron';

/**
 * Expose a limited, secure API to the renderer process.
 * All communication happens through IPC channels.
 */
contextBridge.exposeInMainWorld('xskyAgent', {
  /**
   * Execute a function in the renderer context.
   * REMOVED: This function is unsafe as it allows arbitrary code execution in the preload context.
   * Agents should execute scripts in the main world via WebContents.executeJavaScript.
   */
  // executeScript: removed for security

  /**
   * Get clickable elements from the page (for browser automation)
   */
  getClickableElements: (highlight: boolean): unknown => {
    if (typeof (window as any).get_clickable_elements === 'function') {
      return (window as any).get_clickable_elements(highlight);
    }
    return null;
  },

  /**
   * Get a highlighted element by index
   */
  getHighlightElement: (index: number): Element | null => {
    if (typeof (window as any).get_highlight_element === 'function') {
      return (window as any).get_highlight_element(index);
    }
    return null;
  },

  /**
   * Remove highlights from the page
   */
  removeHighlight: (): void => {
    if (typeof (window as any).remove_highlight === 'function') {
      (window as any).remove_highlight();
    }
  },

  /**
   * Send message to main process
   */
  send: (channel: string, data: unknown): void => {
      // Validate channel name
      const allowedChannels = ['agent-action', 'agent-result', 'agent-error'];
      if (!allowedChannels.includes(channel)) {
        console.error(`[Preload] Blocked unauthorized channel: ${channel}`);
        return;
      }

      // Validate data payload size (approximate)
      try {
        const str = JSON.stringify(data);
        if (str && str.length > 1024 * 1024 * 10) { // 10MB limit
          console.error('[Preload] Blocked payload exceeding size limit');
          return;
        }
      } catch (e) {
        // Ignore circular reference errors or similar during validation, let IPC handle it or fail
      }

      ipcRenderer.send(channel, data);
    },

  /**
   * Receive message from main process
   */
  on: (channel: string, callback: (data: unknown) => void): void => {
    const allowedChannels = ['agent-command', 'agent-response'];
    if (allowedChannels.includes(channel)) {
      // Wrap callback to ensure we don't leak event object
      ipcRenderer.on(channel, (_event, data) => callback(data));
    }
  },

  /**
   * One-time receive from main process
   */
  once: (channel: string, callback: (data: unknown) => void): void => {
    const allowedChannels = ['agent-command', 'agent-response'];
    if (allowedChannels.includes(channel)) {
      ipcRenderer.once(channel, (_event, data) => callback(data));
    }
  },

  /**
   * Invoke main process handler and get result
   */
  invoke: async (channel: string, data: unknown): Promise<unknown> => {
    const allowedChannels = ['agent-execute', 'agent-screenshot', 'agent-navigate'];
    if (!allowedChannels.includes(channel)) {
      throw new Error(`Channel ${channel} is not allowed`);
    }

    // Validate data payload size
    try {
      const str = JSON.stringify(data);
      if (str && str.length > 1024 * 1024 * 10) { // 10MB limit
        throw new Error('Payload exceeds size limit');
      }
    } catch (e) {
      // Ignore
    }

    return await ipcRenderer.invoke(channel, data);
  }
});

// Type declaration for the exposed API
declare global {
  interface Window {
    xskyAgent: {
      executeScript: (serializedFunc: string, args: unknown[]) => Promise<unknown>;
      getClickableElements: (highlight: boolean) => unknown;
      getHighlightElement: (index: number) => Element | null;
      removeHighlight: () => void;
      send: (channel: string, data: unknown) => void;
      on: (channel: string, callback: (data: unknown) => void) => void;
      once: (channel: string, callback: (data: unknown) => void) => void;
      invoke: (channel: string, data: unknown) => Promise<unknown>;
    };
  }
}
