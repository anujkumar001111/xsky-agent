import BrowserAgent from '../src/browser';
import { AgentContext, config } from '@xsky/ai-agent-core';
import { WebContentsView } from 'electron';

describe('BrowserAgent Screenshot with Scaling (Electron)', () => {
  let agent: BrowserAgent;
  let mockContext: AgentContext;
  let mockView: WebContentsView;
  let originalConfig: any;

  beforeEach(() => {
    mockView = new WebContentsView({} as any);
    agent = new BrowserAgent(mockView);
    mockContext = {} as AgentContext;

    // Store original config
    originalConfig = { ...config.screenshotScaling };

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original config
    config.screenshotScaling = originalConfig;
  });

  describe('screenshot without scaling', () => {
    beforeEach(() => {
      config.screenshotScaling = { enabled: false, maxWidth: 1024, maxHeight: 768 };
    });

    it('should capture page without resize', async () => {
      const mockImage = {
        getSize: () => ({ width: 1920, height: 1080 }),
        resize: jest.fn(),
        toDataURL: () => 'data:image/jpeg;base64,test-image',
      };
      (mockView.webContents.capturePage as jest.Mock).mockResolvedValue(mockImage);

      // @ts-ignore - accessing protected method
      await agent.screenshot(mockContext);

      expect(mockImage.resize).not.toHaveBeenCalled();
    });

    it('should set lastScaleFactor to 1 when scaling disabled', async () => {
      const mockImage = {
        getSize: () => ({ width: 1920, height: 1080 }),
        resize: jest.fn(),
        toDataURL: () => 'data:image/jpeg;base64,test-image',
      };
      (mockView.webContents.capturePage as jest.Mock).mockResolvedValue(mockImage);

      // @ts-ignore - accessing protected method
      await agent.screenshot(mockContext);

      expect(agent.lastScaleFactor).toBe(1);
    });
  });

  describe('screenshot with scaling enabled', () => {
    beforeEach(() => {
      config.screenshotScaling = { enabled: true, maxWidth: 1024, maxHeight: 768 };
    });

    it('should resize when image exceeds max dimensions', async () => {
      const mockResizedImage = {
        toDataURL: () => 'data:image/jpeg;base64,resized-image',
      };
      const mockImage = {
        getSize: () => ({ width: 1920, height: 1080 }),
        resize: jest.fn().mockReturnValue(mockResizedImage),
        toDataURL: () => 'data:image/jpeg;base64,original-image',
      };
      (mockView.webContents.capturePage as jest.Mock).mockResolvedValue(mockImage);

      // @ts-ignore - accessing protected method
      const result = await agent.screenshot(mockContext);

      expect(mockImage.resize).toHaveBeenCalled();
      // Width is the constraint: 1024/1920 ≈ 0.533
      expect(agent.lastScaleFactor).toBeCloseTo(0.533, 2);
    });

    it('should not resize when image fits within bounds', async () => {
      const mockImage = {
        getSize: () => ({ width: 800, height: 600 }),
        resize: jest.fn(),
        toDataURL: () => 'data:image/jpeg;base64,small-image',
      };
      (mockView.webContents.capturePage as jest.Mock).mockResolvedValue(mockImage);

      // @ts-ignore - accessing protected method
      await agent.screenshot(mockContext);

      expect(mockImage.resize).not.toHaveBeenCalled();
      expect(agent.lastScaleFactor).toBe(1);
    });

    it('should scale height-constrained images correctly', async () => {
      const mockResizedImage = {
        toDataURL: () => 'data:image/jpeg;base64,resized-image',
      };
      const mockImage = {
        getSize: () => ({ width: 1024, height: 1536 }), // Height is constraint
        resize: jest.fn().mockReturnValue(mockResizedImage),
        toDataURL: () => 'data:image/jpeg;base64,original-image',
      };
      (mockView.webContents.capturePage as jest.Mock).mockResolvedValue(mockImage);

      // @ts-ignore - accessing protected method
      await agent.screenshot(mockContext);

      expect(mockImage.resize).toHaveBeenCalled();
      // Height is the constraint: 768/1536 = 0.5
      expect(agent.lastScaleFactor).toBe(0.5);
    });
  });

  describe('screenshot return format', () => {
    it('should return jpeg format', async () => {
      config.screenshotScaling = { enabled: false, maxWidth: 1024, maxHeight: 768 };
      const mockImage = {
        getSize: () => ({ width: 800, height: 600 }),
        toDataURL: () => 'data:image/jpeg;base64,test-image',
      };
      (mockView.webContents.capturePage as jest.Mock).mockResolvedValue(mockImage);

      // @ts-ignore - accessing protected method
      const result = await agent.screenshot(mockContext);

      expect(result.imageType).toBe('image/jpeg');
    });
  });
});
