import BrowserAgent from '../src/browser';
import { AgentContext } from '@xsky/ai-agent-core';

describe('BrowserAgent Script Execution (Extension)', () => {
  let agent: BrowserAgent;
  let mockContext: AgentContext;
  let mockVariables: Map<string, any>;

  beforeEach(() => {
    mockVariables = new Map();
    mockContext = {
      variables: {
        get: (key: string) => mockVariables.get(key),
        set: (key: string, value: any) => mockVariables.set(key, value),
        getAll: () => Object.fromEntries(mockVariables),
      },
    } as unknown as AgentContext;

    agent = new BrowserAgent();
    jest.clearAllMocks();
  });

  describe('execute_script', () => {
    beforeEach(() => {
      (chrome.windows.getLastFocused as jest.Mock).mockResolvedValue({ id: 100 });
      (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 1 }]);
    });

    it('should execute script in active tab', async () => {
      const mockFunc = () => 'result';
      const mockFrameResults = [{ result: 'executed result' }];
      (chrome.scripting.executeScript as jest.Mock).mockResolvedValue(mockFrameResults);

      // @ts-ignore - accessing protected method
      const result = await agent.execute_script(mockContext, mockFunc, []);

      expect(chrome.scripting.executeScript).toHaveBeenCalled();
      expect(result).toBe('executed result');
    });

    it('should pass function and args to executeScript', async () => {
      const mockFunc = (arg: string) => `received: ${arg}`;
      const args = ['test-arg'];
      const mockFrameResults = [{ result: 'received: test-arg' }];
      (chrome.scripting.executeScript as jest.Mock).mockResolvedValue(mockFrameResults);

      // @ts-ignore - accessing protected method
      await agent.execute_script(mockContext, mockFunc, args);

      const callArgs = (chrome.scripting.executeScript as jest.Mock).mock.calls[0][0];
      expect(callArgs.target).toEqual({ tabId: 1 });
      expect(callArgs.func).toBe(mockFunc);
      expect(callArgs.args).toEqual(args);
    });

    it('should use correct tab ID from getTabId', async () => {
      mockVariables.set('windowId', 200);
      const mockTabs = [{ id: 5 }, { id: 10 }];
      (chrome.tabs.query as jest.Mock).mockResolvedValue(mockTabs);
      (chrome.scripting.executeScript as jest.Mock).mockResolvedValue([{ result: 'ok' }]);

      // @ts-ignore - accessing protected method
      await agent.execute_script(mockContext, () => 'test', []);

      const callArgs = (chrome.scripting.executeScript as jest.Mock).mock.calls[0][0];
      // Should use last tab from query results
      expect(callArgs.target.tabId).toBe(10);
    });
  });
});
