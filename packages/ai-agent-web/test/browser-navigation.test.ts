import BrowserAgent from '../src/browser';
import { AgentContext } from '@xsky/ai-agent-core';

describe('BrowserAgent Navigation (Web)', () => {
  let agent: BrowserAgent;
  let mockContext: AgentContext;
  let originalPushState: typeof history.pushState;
  let originalDispatchEvent: typeof window.dispatchEvent;

  beforeEach(() => {
    agent = new BrowserAgent();
    mockContext = {} as AgentContext;
    jest.clearAllMocks();

    // Store originals
    originalPushState = history.pushState;
    originalDispatchEvent = window.dispatchEvent;

    // Mock history.pushState
    history.pushState = jest.fn();
    window.dispatchEvent = jest.fn();
  });

  afterEach(() => {
    // Restore originals
    history.pushState = originalPushState;
    window.dispatchEvent = originalDispatchEvent;
  });

  describe('navigate_to', () => {
    it('should navigate to relative path', async () => {
      // @ts-ignore - accessing protected method
      await agent.navigate_to(mockContext, '/test-page');

      expect(history.pushState).toHaveBeenCalledWith(null, '', '/test-page');
      expect(window.dispatchEvent).toHaveBeenCalled();
    });

    it('should throw error for cross-origin navigation', async () => {
      await expect(
        // @ts-ignore - accessing protected method
        agent.navigate_to(mockContext, 'http://external-site.com/page')
      ).rejects.toThrow('Unable to access other websites');
    });
  });

  describe('switch_tab', () => {
    it('should return current tab info since web only has single tab', async () => {
      document.title = 'Test Page';

      // @ts-ignore - accessing protected method
      const result = await agent.switch_tab(mockContext, 0);

      expect(result.tabId).toBe(0);
      expect(result.title).toBe('Test Page');
    });
  });
});
