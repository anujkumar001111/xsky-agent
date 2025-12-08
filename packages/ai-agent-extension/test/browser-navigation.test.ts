import BrowserAgent from '../src/browser';
import { AgentContext } from '@xsky/ai-agent-core';

describe('BrowserAgent Navigation (Extension)', () => {
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

  describe('navigate_to', () => {
    it('should create new tab with URL', async () => {
      const mockTab = { id: 1, url: 'http://example.com', title: 'Example', windowId: 100, status: 'complete' };
      (chrome.windows.getLastFocused as jest.Mock).mockResolvedValue({ id: 100 });
      (chrome.tabs.create as jest.Mock).mockResolvedValue(mockTab);
      (chrome.tabs.get as jest.Mock).mockResolvedValue({ ...mockTab, status: 'complete' });

      // @ts-ignore - accessing protected method
      const result = await agent.navigate_to(mockContext, 'http://example.com');

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'http://example.com',
        windowId: 100,
      });
      expect(result.url).toBe('http://example.com');
    });

    it('should store windowId in context variables', async () => {
      const mockTab = { id: 1, url: 'http://example.com', title: 'Example', windowId: 200, status: 'complete' };
      (chrome.windows.getLastFocused as jest.Mock).mockResolvedValue({ id: 100 });
      (chrome.tabs.create as jest.Mock).mockResolvedValue(mockTab);
      (chrome.tabs.get as jest.Mock).mockResolvedValue({ ...mockTab, status: 'complete' });

      // @ts-ignore - accessing protected method
      await agent.navigate_to(mockContext, 'http://example.com');

      expect(mockVariables.get('windowId')).toBe(200);
    });

    it('should track navigated tab IDs', async () => {
      const mockTab = { id: 5, url: 'http://example.com', title: 'Example', windowId: 100, status: 'complete' };
      (chrome.windows.getLastFocused as jest.Mock).mockResolvedValue({ id: 100 });
      (chrome.tabs.create as jest.Mock).mockResolvedValue(mockTab);
      (chrome.tabs.get as jest.Mock).mockResolvedValue({ ...mockTab, status: 'complete' });

      // @ts-ignore - accessing protected method
      await agent.navigate_to(mockContext, 'http://example.com');

      const navigateTabIds = mockVariables.get('navigateTabIds');
      expect(navigateTabIds).toContain(5);
    });

    it('should accumulate multiple navigated tab IDs', async () => {
      const mockTab1 = { id: 1, url: 'http://example1.com', title: 'Example 1', windowId: 100, status: 'complete' };
      const mockTab2 = { id: 2, url: 'http://example2.com', title: 'Example 2', windowId: 100, status: 'complete' };

      (chrome.windows.getLastFocused as jest.Mock).mockResolvedValue({ id: 100 });
      (chrome.tabs.create as jest.Mock)
        .mockResolvedValueOnce(mockTab1)
        .mockResolvedValueOnce(mockTab2);
      (chrome.tabs.get as jest.Mock)
        .mockResolvedValueOnce({ ...mockTab1, status: 'complete' })
        .mockResolvedValueOnce({ ...mockTab2, status: 'complete' });

      // @ts-ignore - accessing protected method
      await agent.navigate_to(mockContext, 'http://example1.com');
      // @ts-ignore - accessing protected method
      await agent.navigate_to(mockContext, 'http://example2.com');

      const navigateTabIds = mockVariables.get('navigateTabIds');
      expect(navigateTabIds).toEqual([1, 2]);
    });
  });

  describe('switch_tab', () => {
    it('should activate specified tab', async () => {
      const mockTab = { id: 5, url: 'http://example.com', title: 'Example', windowId: 100 };
      (chrome.tabs.update as jest.Mock).mockResolvedValue(mockTab);

      // @ts-ignore - accessing protected method
      const result = await agent.switch_tab(mockContext, 5);

      expect(chrome.tabs.update).toHaveBeenCalledWith(5, { active: true });
      expect(result).toEqual({
        tabId: 5,
        url: 'http://example.com',
        title: 'Example',
      });
    });

    it('should update windowId in context', async () => {
      const mockTab = { id: 5, url: 'http://example.com', title: 'Example', windowId: 300 };
      (chrome.tabs.update as jest.Mock).mockResolvedValue(mockTab);

      // @ts-ignore - accessing protected method
      await agent.switch_tab(mockContext, 5);

      expect(mockVariables.get('windowId')).toBe(300);
    });

    it('should throw error for non-existent tab', async () => {
      (chrome.tabs.update as jest.Mock).mockResolvedValue(null);

      await expect(
        // @ts-ignore - accessing protected method
        agent.switch_tab(mockContext, 999)
      ).rejects.toThrow('tabId does not exist: 999');
    });
  });
});
