import BrowserAgent from '../src/browser';
import { AgentContext } from '@xsky/ai-agent-core';
import html2canvas from 'html2canvas';

jest.mock('html2canvas');

describe('BrowserAgent Screenshot (Web)', () => {
  let agent: BrowserAgent;
  let mockContext: AgentContext;

  beforeEach(() => {
    agent = new BrowserAgent();
    mockContext = {} as AgentContext;
    jest.clearAllMocks();

    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
    Object.defineProperty(window, 'scrollX', { value: 0, writable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
  });

  describe('screenshot', () => {
    it('should take screenshot with correct dimensions', async () => {
      const mockCanvas = {
        toDataURL: jest.fn().mockReturnValue('data:image/jpeg;base64,test-image-data'),
      };
      (html2canvas as jest.Mock).mockResolvedValue(mockCanvas);

      // @ts-ignore - accessing protected method
      const result = await agent.screenshot(mockContext);

      expect(html2canvas).toHaveBeenCalled();
      expect(result.imageBase64).toBe('test-image-data');
      expect(result.imageType).toBe('image/jpeg');
    });

    it('should pass correct options to html2canvas', async () => {
      const mockCanvas = {
        toDataURL: jest.fn().mockReturnValue('data:image/jpeg;base64,test-image-data'),
      };
      (html2canvas as jest.Mock).mockResolvedValue(mockCanvas);

      // @ts-ignore - accessing protected method
      await agent.screenshot(mockContext);

      expect(html2canvas).toHaveBeenCalledWith(
        expect.anything(), // document.documentElement or document.body
        expect.objectContaining({
          width: 1024,
          height: 768,
          windowWidth: 1024,
          windowHeight: 768,
          useCORS: true,
          foreignObjectRendering: true,
        })
      );
    });

    it('should handle scroll position', async () => {
      Object.defineProperty(window, 'scrollX', { value: 100, writable: true });
      Object.defineProperty(window, 'scrollY', { value: 200, writable: true });

      const mockCanvas = {
        toDataURL: jest.fn().mockReturnValue('data:image/jpeg;base64,test-image-data'),
      };
      (html2canvas as jest.Mock).mockResolvedValue(mockCanvas);

      // @ts-ignore - accessing protected method
      await agent.screenshot(mockContext);

      expect(html2canvas).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          x: 100,
          y: 200,
          scrollX: -100,
          scrollY: -200,
        })
      );
    });

    it('should strip data URL prefix from base64', async () => {
      const mockCanvas = {
        toDataURL: jest.fn().mockReturnValue('data:image/jpeg;base64,actual-image-content'),
      };
      (html2canvas as jest.Mock).mockResolvedValue(mockCanvas);

      // @ts-ignore - accessing protected method
      const result = await agent.screenshot(mockContext);

      expect(result.imageBase64).toBe('actual-image-content');
      expect(result.imageBase64).not.toContain('data:image');
      expect(result.imageBase64).not.toContain('base64,');
    });
  });
});
