import BrowserAgent, { BrowserAgentSecurityOptions } from '../src/browser';
import { AgentContext } from '@xsky/ai-agent-core';
import { WebContentsView } from 'electron';

describe('BrowserAgent Security Modes (Electron)', () => {
  let mockContext: AgentContext;
  let mockView: WebContentsView;

  beforeEach(() => {
    mockView = new WebContentsView({} as any);
    mockContext = {} as AgentContext;
    jest.clearAllMocks();
  });

  describe('legacy mode (default)', () => {
    it('should use direct executeJavaScript by default', async () => {
      const agent = new BrowserAgent(mockView);

      // @ts-ignore - accessing protected method
      await agent.execute_script(mockContext, () => 'result', []);

      const calledCode = (mockView.webContents.executeJavaScript as jest.Mock).mock.calls[0][0];
      expect(calledCode).toContain('const func =');
      expect(calledCode).not.toContain('window.xskyAgent');
    });

    it('should serialize function correctly', async () => {
      const agent = new BrowserAgent(mockView);
      const testFunc = (x: number) => x * 2;

      // @ts-ignore - accessing protected method
      await agent.execute_script(mockContext, testFunc, [5]);

      const calledCode = (mockView.webContents.executeJavaScript as jest.Mock).mock.calls[0][0];
      expect(calledCode).toContain('const func = (x) => x * 2');
    });
  });

  describe('secure mode (contextIsolation)', () => {
    it('should use window.xskyAgent API when enabled', async () => {
      const securityOptions: BrowserAgentSecurityOptions = {
        useContextIsolation: true,
        preloadPath: '/path/to/preload.js',
      };
      const agent = new BrowserAgent(mockView, undefined, undefined, securityOptions);

      // @ts-ignore - accessing protected method
      await agent.execute_script(mockContext, () => 'result', []);

      const calledCode = (mockView.webContents.executeJavaScript as jest.Mock).mock.calls[0][0];
      expect(calledCode).toContain('window.xskyAgent');
      expect(calledCode).toContain('window.xskyAgent.executeScript');
    });

    it('should serialize function as string for secure mode', async () => {
      const securityOptions: BrowserAgentSecurityOptions = {
        useContextIsolation: true,
      };
      const agent = new BrowserAgent(mockView, undefined, undefined, securityOptions);
      const testFunc = () => document.title;

      // @ts-ignore - accessing protected method
      await agent.execute_script(mockContext, testFunc, []);

      const calledCode = (mockView.webContents.executeJavaScript as jest.Mock).mock.calls[0][0];
      expect(calledCode).toContain(JSON.stringify(testFunc.toString()));
    });
  });

  describe('constructor options', () => {
    it('should accept custom prompt', async () => {
      const agent = new BrowserAgent(mockView, undefined, 'Custom system prompt');

      // @ts-ignore - accessing protected method
      const prompt = await agent.extSysPrompt(mockContext, []);

      expect(prompt).toBe('Custom system prompt');
    });

    it('should return empty string when no custom prompt', async () => {
      const agent = new BrowserAgent(mockView);

      // @ts-ignore - accessing protected method
      const prompt = await agent.extSysPrompt(mockContext, []);

      expect(prompt).toBe('');
    });
  });
});
