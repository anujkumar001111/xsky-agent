import BrowserAgent from '../src/browser';
import { AgentContext } from '@xsky/ai-agent-core';
import { WebContentsView } from 'electron';

describe('BrowserAgent Navigation (Electron)', () => {
  let agent: BrowserAgent;
  let mockContext: AgentContext;
  let mockView: WebContentsView;

  beforeEach(() => {
    mockView = new WebContentsView({} as any);
    agent = new BrowserAgent(mockView);
    mockContext = {} as AgentContext;
    jest.clearAllMocks();
  });

  describe('navigate_to', () => {
    it('should load URL in webContents', async () => {
      // @ts-ignore - accessing protected method
      await agent.navigate_to(mockContext, 'http://example.com');

      expect(mockView.webContents.loadURL).toHaveBeenCalledWith('http://example.com');
    });

    it('should return URL and title after navigation', async () => {
      // @ts-ignore - accessing protected method
      const result = await agent.navigate_to(mockContext, 'http://example.com');

      expect(result.url).toBe('http://localhost/');
      expect(result.title).toBe('Test Page');
    });
  });

  describe('go_back', () => {
    it('should go back in history when possible', async () => {
      (mockView.webContents.navigationHistory.canGoBack as jest.Mock).mockReturnValue(true);

      // @ts-ignore - accessing protected method
      await agent.go_back(mockContext);

      expect(mockView.webContents.navigationHistory.goBack).toHaveBeenCalled();
    });

    it('should not go back when history is empty', async () => {
      (mockView.webContents.navigationHistory.canGoBack as jest.Mock).mockReturnValue(false);

      // @ts-ignore - accessing protected method
      await agent.go_back(mockContext);

      expect(mockView.webContents.navigationHistory.goBack).not.toHaveBeenCalled();
    });
  });

  describe('get_all_tabs', () => {
    it('should return single tab with current page info', async () => {
      (mockView.webContents.getURL as jest.Mock).mockReturnValue('http://test.com/page');
      (mockView.webContents.getTitle as jest.Mock).mockReturnValue('Test Title');

      // @ts-ignore - accessing protected method
      const tabs = await agent.get_all_tabs(mockContext);

      expect(tabs).toEqual([
        {
          tabId: 0,
          url: 'http://test.com/page',
          title: 'Test Title',
        },
      ]);
    });
  });

  describe('switch_tab', () => {
    it('should return current tab info (single tab in Electron)', async () => {
      (mockView.webContents.getURL as jest.Mock).mockReturnValue('http://test.com');
      (mockView.webContents.getTitle as jest.Mock).mockReturnValue('Test');

      // @ts-ignore - accessing protected method
      const result = await agent.switch_tab(mockContext, 0);

      expect(result).toEqual({
        tabId: 0,
        url: 'http://test.com',
        title: 'Test',
      });
    });
  });
});
