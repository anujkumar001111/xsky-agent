import BrowserAgent from '../src/browser';
import { AgentContext } from '@xsky/ai-agent-core';
import { WebContentsView } from 'electron';

describe('BrowserAgent (Electron)', () => {
  let agent: BrowserAgent;
  let mockContext: AgentContext;
  let mockView: WebContentsView;

  beforeEach(() => {
    mockView = new WebContentsView({} as any);
    agent = new BrowserAgent(mockView);
    mockContext = {} as AgentContext;
    jest.clearAllMocks();
  });

  it('should initialize correctly', () => {
    expect(agent).toBeDefined();
    // @ts-ignore
    expect(agent.name).toBe('Browser');
  });

  it('should get all tabs', async () => {
    // @ts-ignore
    const tabs = await agent.get_all_tabs(mockContext);

    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toEqual({
      tabId: 0,
      url: 'http://localhost/',
      title: 'Test Page'
    });
  });

  it('should navigate to url', async () => {
    // @ts-ignore
    const result = await agent.navigate_to(mockContext, 'http://example.com');

    expect(mockView.webContents.loadURL).toHaveBeenCalledWith('http://example.com');
    expect(result).toEqual({
      url: 'http://localhost/',
      title: 'Test Page'
    });
  });

  it('should take screenshot', async () => {
    // @ts-ignore
    const result = await agent.screenshot(mockContext);

    expect(mockView.webContents.capturePage).toHaveBeenCalled();
    expect(result).toEqual({
      imageBase64: 'data:image/jpeg;base64,mocked-image', // Note: actual implementation adds prefix
      imageType: 'image/jpeg'
    });
  });

  it('should execute script in legacy mode (default)', async () => {
    const mockFunc = () => 'result';
    // @ts-ignore
    await agent.execute_script(mockContext, mockFunc, []);

    expect(mockView.webContents.executeJavaScript).toHaveBeenCalled();
    // Check if the called code contains the function string
    const calledCode = (mockView.webContents.executeJavaScript as jest.Mock).mock.calls[0][0];
    expect(calledCode).toContain('const func = () => \'result\'');
  });

  it('should use secure mode when configured', async () => {
    agent = new BrowserAgent(mockView, undefined, undefined, { useContextIsolation: true });
    const mockFunc = () => 'result';

    // @ts-ignore
    await agent.execute_script(mockContext, mockFunc, []);

    expect(mockView.webContents.executeJavaScript).toHaveBeenCalled();
    const calledCode = (mockView.webContents.executeJavaScript as jest.Mock).mock.calls[0][0];
    // Secure mode checks for window.xskyAgent
    expect(calledCode).toContain('window.xskyAgent');
  });
});
