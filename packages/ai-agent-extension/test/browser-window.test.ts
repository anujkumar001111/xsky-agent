import BrowserAgent from '../src/browser';
import { AgentContext } from '@xsky/ai-agent-core';

describe('BrowserAgent Window Management (Extension)', () => {
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

  describe('getWindowId (via get_all_tabs)', () => {
    it('should use cached windowId from context if available', async () => {
      mockVariables.set('windowId', 999);

      const mockTabs = [{ id: 1, url: 'http://example.com', title: 'Example' }];
      (chrome.tabs.query as jest.Mock).mockResolvedValue(mockTabs);

      // @ts-ignore - accessing protected method
      await agent.get_all_tabs(mockContext);

      expect(chrome.tabs.query).toHaveBeenCalledWith({ windowId: 999 });
      expect(chrome.windows.getLastFocused).not.toHaveBeenCalled();
    });

    it('should get last focused window if no cached windowId', async () => {
      (chrome.windows.getLastFocused as jest.Mock).mockResolvedValue({ id: 100 });
      const mockTabs = [{ id: 1, url: 'http://example.com', title: 'Example' }];
      (chrome.tabs.query as jest.Mock).mockResolvedValue(mockTabs);

      // @ts-ignore - accessing protected method
      await agent.get_all_tabs(mockContext);

      expect(chrome.windows.getLastFocused).toHaveBeenCalledWith({ windowTypes: ['normal'] });
    });

    it('should fallback to current window if getLastFocused fails', async () => {
      (chrome.windows.getLastFocused as jest.Mock).mockResolvedValue(null);
      (chrome.windows.getCurrent as jest.Mock).mockResolvedValue({ id: 200 });
      const mockTabs = [{ id: 1, url: 'http://example.com', title: 'Example' }];
      (chrome.tabs.query as jest.Mock).mockResolvedValue(mockTabs);

      // @ts-ignore - accessing protected method
      await agent.get_all_tabs(mockContext);

      expect(chrome.windows.getCurrent).toHaveBeenCalledWith({ windowTypes: ['normal'] });
    });
  });

  describe('get_all_tabs', () => {
    it('should return formatted tab list', async () => {
      (chrome.windows.getLastFocused as jest.Mock).mockResolvedValue({ id: 100 });
      const mockTabs = [
        { id: 1, url: 'http://example1.com', title: 'Example 1' },
        { id: 2, url: 'http://example2.com', title: 'Example 2' },
        { id: 3, url: 'http://example3.com', title: 'Example 3' },
      ];
      (chrome.tabs.query as jest.Mock).mockResolvedValue(mockTabs);

      // @ts-ignore - accessing protected method
      const result = await agent.get_all_tabs(mockContext);

      expect(result).toEqual([
        { tabId: 1, url: 'http://example1.com', title: 'Example 1' },
        { tabId: 2, url: 'http://example2.com', title: 'Example 2' },
        { tabId: 3, url: 'http://example3.com', title: 'Example 3' },
      ]);
    });

    it('should return empty array for window with no tabs', async () => {
      (chrome.windows.getLastFocused as jest.Mock).mockResolvedValue({ id: 100 });
      (chrome.tabs.query as jest.Mock).mockResolvedValue([]);

      // @ts-ignore - accessing protected method
      const result = await agent.get_all_tabs(mockContext);

      expect(result).toEqual([]);
    });
  });
});
