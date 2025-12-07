import { BrowserWindow, WebContentsView } from 'electron';
import { XSky, Agent, LLMs, StreamCallbackMessage } from '@xsky/ai-agent-core';
import { BrowserAgent, FileAgent, getPreloadPath } from '@xsky/ai-agent-electron';
import * as path from 'path';

export class AgentService {
  private xsky: XSky;
  private browserAgent: BrowserAgent;
  private fileAgent: FileAgent;
  private mainWindow: BrowserWindow;
  private currentTaskId?: string;

  constructor(mainWindow: BrowserWindow, browserView: WebContentsView) {
    this.mainWindow = mainWindow;

    // Initialize agents
    // Note: We use contextIsolation: true for security, which matches the preload we configured in window.ts
    this.browserAgent = new BrowserAgent(browserView, undefined, undefined, {
      useContextIsolation: true,
      preloadPath: getPreloadPath()
    });

    this.fileAgent = new FileAgent(browserView);

    // Initialize XSky
    this.xsky = new XSky({
      llms: this.getLlmConfig(),
      agents: [this.browserAgent, this.fileAgent],
      callback: {
        onMessage: this.handleStreamMessage.bind(this)
      }
    });
  }

  /**
   * Run a new task
   */
  async runTask(prompt: string): Promise<any> {
    try {
      console.log('[AgentService] Running task:', prompt);
      const result = await this.xsky.run(prompt);
      return result;
    } catch (error) {
      console.error('[AgentService] Task failed:', error);
      throw error;
    }
  }

  /**
   * Pause or resume a task
   */
  async pauseTask(taskId: string): Promise<void> {
    // Determine if we should pause or resume based on current state
    // For simplicity in this example, we'll just toggle pause
    // In a real app, you'd track state more explicitly
    await this.xsky.pauseTask(taskId, true);
  }

  /**
   * Abort a task
   */
  async abortTask(taskId: string): Promise<void> {
    await this.xsky.abortTask(taskId);
  }

  /**
   * Handle streaming messages from XSky
   */
  private async handleStreamMessage(message: StreamCallbackMessage): Promise<void> {
    // Forward the message to the renderer process
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('xsky:task-event', message);
    }

    // Keep track of task ID
    if (message.type === 'workflow' && message.workflow) {
      this.currentTaskId = message.workflow.taskId;
    }
  }

  /**
   * Load LLM configuration from environment variables
   */
  private getLlmConfig(): LLMs {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!openaiApiKey && !anthropicApiKey) {
      console.warn('[AgentService] No API keys found in environment variables!');
    }

    return {
      default: {
        provider: (process.env.DEFAULT_PROVIDER as any) || 'anthropic',
        model: process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514',
        apiKey: anthropicApiKey || openaiApiKey || '',
        config: {
          baseURL: process.env.ANTHROPIC_BASE_URL
        }
      },
      openai: {
        provider: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        apiKey: openaiApiKey || '',
        config: {
          baseURL: process.env.OPENAI_BASE_URL
        }
      },
      anthropic: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        apiKey: anthropicApiKey || '',
        config: {
          baseURL: process.env.ANTHROPIC_BASE_URL
        }
      }
    };
  }
}
