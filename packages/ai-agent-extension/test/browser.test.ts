import BrowserAgent from '../src/browser';
import { AgentContext } from '@xsky/ai-agent-core';

describe('BrowserAgent (Extension)', () => {
  let agent: BrowserAgent;
  let mockContext: AgentContext;
  let mockVariables: Map<string, any>;

  beforeEach(() => {
    mockVariables = new Map();
    mockContext = {
      variables: {
        get: (key: string) => mockVariables.get(key),
        set: (key: string, value: any) => mockVariables.set(key, value),
        getAll: () => Object.fromEntries(mockVariables)
      }
    } as unknown as AgentContext;

    agent = new BrowserAgent();
    jest.clearAllMocks();
  });

  it('should initialize correctly', () => {
    expect(agent).toBeDefined();
    // @ts-ignore - accessing protected property
    expect(agent.name).toBe('Browser');
  });

  it('should get all tabs', async () => {
    const mockTabs = [
      { id: 1, url: 'http://example.com', title: 'Example' }
    ];

    // Mock getWindowId internal call
    (chrome.windows.getLastFocused as jest.Mock).mockResolvedValue({ id: 100 });
    (chrome.tabs.query as jest.Mock).mockResolvedValue(mockTabs);

    // @ts-ignore - accessing protected method
    const tabs = await agent.get_all_tabs(mockContext);

    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toEqual({
      tabId: 1,
      url: 'http://example.com',
      title: 'Example'
    });
  });

  it('should switch tab', async () => {
    const mockTab = { id: 1, url: 'http://example.com', title: 'Example', windowId: 100 };
    (chrome.tabs.update as jest.Mock).mockResolvedValue(mockTab);

    // @ts-ignore - accessing protected method
    const result = await agent.switch_tab(mockContext, 1);

    expect(result).toEqual({
      tabId: 1,
      url: 'http://example.com',
      title: 'Example'
    });
    expect(chrome.tabs.update).toHaveBeenCalledWith(1, { active: true });
    expect(mockVariables.get('windowId')).toBe(100);
  });

  it('should take screenshot', async () => {
    // Mock getWindowId internal call
    (chrome.windows.getLastFocused as jest.Mock).mockResolvedValue({ id: 100 });
    (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 1 }]);
    (chrome.tabs.captureVisibleTab as jest.Mock).mockResolvedValue('data:image/jpeg;base64,mocked-image');

    // @ts-ignore - accessing protected method
    const result = await agent.screenshot(mockContext);

    expect(result).toEqual({
      imageBase64: 'mocked-image',
      imageType: 'image/jpeg'
    });
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(100, {
      format: 'jpeg',
      quality: 60
    });
  });
});
