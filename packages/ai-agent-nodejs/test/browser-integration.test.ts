import BrowserAgent from '../src/browser';

describe('BrowserAgent Integration Tests - Close Method', () => {
  let agent: BrowserAgent;

  beforeEach(() => {
    agent = new BrowserAgent();
  });

  afterEach(async () => {
    // Ensure cleanup happens even if test fails
    try {
      await agent.close();
    } catch (error) {
      console.error('Cleanup failed in afterEach:', error);
    }
  });

  describe('Close Method Integration', () => {
    test('close() method exists and is callable', () => {
      expect(typeof agent.close).toBe('function');
    });

    test('close() can be called on fresh agent without error', async () => {
      await expect(agent.close()).resolves.toBeUndefined();
    });

    test('close() is idempotent - can be called multiple times safely', async () => {
      await agent.close();
      await agent.close(); // Should not throw
      await expect(agent.close()).resolves.toBeUndefined();
    });

    test('close() handles errors gracefully and still cleans up state', async () => {
      // Manually set up some state to test cleanup
      agent['browser_context'] = {
        pages: jest.fn().mockReturnValue([]),
        close: jest.fn().mockRejectedValue(new Error('Mock error'))
      } as any;

      // Attempt cleanup - should handle error but still clean up
      await expect(agent.close()).rejects.toThrow('Mock error');

      // Verify state is cleaned up despite error
      expect(agent['browser_context']).toBeNull();
      expect(agent['current_page']).toBeNull();
    });

    test('close() properly handles CDP connections (no browser ownership)', async () => {
      // Simulate CDP connection (no browser ownership)
      agent['cdpWsEndpoint'] = 'ws://localhost:9222';
      agent['browser'] = { mock: 'browser' } as any;

      await agent.close();

      // Browser should NOT be closed when using CDP
      expect(agent['browser']).toEqual({ mock: 'browser' });
      expect(agent['browser_context']).toBeNull();
      expect(agent['current_page']).toBeNull();
    });

    test('close() logs individual page close errors but continues cleanup', async () => {
      // Set up mock context with pages that fail to close
      const mockPage = { close: jest.fn().mockRejectedValue(new Error('Page close failed')) };
      const mockContext = {
        pages: jest.fn().mockReturnValue([mockPage]),
        close: jest.fn().mockResolvedValue(undefined)
      };
      agent['browser_context'] = mockContext as any;

      // Spy on console.warn
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await agent.close();

      // Should log page close error but continue
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to close page: Page close failed')
      );

      // Context should still be closed
      expect(mockContext.close).toHaveBeenCalled();
      expect(agent['browser_context']).toBeNull();

      consoleWarnSpy.mockRestore();
    });

    test('close() handles concurrent cleanup operations', async () => {
      // Test that multiple close() calls don't interfere
      const closePromises = [
        agent.close(),
        agent.close(),
        agent.close()
      ];

      // All should resolve without error
      await expect(Promise.all(closePromises)).resolves.toEqual([undefined, undefined, undefined]);
    });
  });
});