import BrowserAgent from '../src/browser';
import { AgentContext } from '@xsky/ai-agent-core';

describe('BrowserAgent (Web)', () => {
  let agent: BrowserAgent;
  let mockContext: AgentContext;

  beforeEach(() => {
    agent = new BrowserAgent();
    mockContext = {} as AgentContext;

    // Reset mocks and browser state
    jest.clearAllMocks();

    // Set title
    document.title = 'Test Page';
  });

  it('should initialize correctly', () => {
    expect(agent).toBeDefined();
    expect(agent.name).toBe('Browser');
  });

  it('should get all tabs (simulated as single tab)', async () => {
    // @ts-ignore - accessing protected method
    const tabs = await agent.get_all_tabs(mockContext);

    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toEqual({
      tabId: 0,
      url: 'http://localhost/', // Default JSDOM URL
      title: 'Test Page'
    });
  });

  it('should take screenshot', async () => {
    // @ts-ignore - accessing protected method
    const result = await agent.screenshot(mockContext);

    expect(result).toEqual({
      imageBase64: 'mocked-image-data',
      imageType: 'image/jpeg'
    });
  });

  it('should execute script', async () => {
    const mockFunc = jest.fn().mockReturnValue('result');
    const args = ['arg1'];

    // @ts-ignore - accessing protected method
    const result = await agent.execute_script(mockContext, mockFunc, args);

    expect(mockFunc).toHaveBeenCalledWith('arg1');
    expect(result).toBe('result');
  });
});
