import BrowserAgent from '../src/browser';

describe('BrowserAgent Performance Benchmarks', () => {
  let agent: BrowserAgent;

  beforeEach(() => {
    agent = new BrowserAgent();
  });

  afterEach(async () => {
    try {
      await agent.close();
    } catch (error) {
      // Ignore cleanup errors in benchmarks
    }
  });

  describe('Close Method Performance', () => {
    test('close() operation latency on fresh agent', async () => {
      const startTime = Date.now();
      await agent.close();
      const endTime = Date.now();

      const latency = endTime - startTime;
      expect(latency).toBeLessThan(100); // Should complete in under 100ms

      console.log(`Fresh agent close() latency: ${latency}ms`);
    });

    test('close() operation with mock resources', async () => {
      // Set up mock resources to test cleanup performance
      agent['browser_context'] = {
        pages: jest.fn().mockReturnValue([]),
        close: jest.fn().mockResolvedValue(undefined)
      } as any;

      agent['browser'] = {
        close: jest.fn().mockResolvedValue(undefined)
      } as any;

      const startTime = Date.now();
      await agent.close();
      const endTime = Date.now();

      const latency = endTime - startTime;
      expect(latency).toBeLessThan(50); // Should be very fast with mocks

      console.log(`Mock resource close() latency: ${latency}ms`);
    });

    test('close() error handling performance', async () => {
      // Set up resources that will fail to close
      agent['browser_context'] = {
        pages: jest.fn().mockReturnValue([]),
        close: jest.fn().mockRejectedValue(new Error('Test error'))
      } as any;

      const startTime = Date.now();
      try {
        await agent.close();
      } catch (error) {
        // Expected error
      }
      const endTime = Date.now();

      const latency = endTime - startTime;
      expect(latency).toBeLessThan(100); // Error handling should still be fast

      console.log(`Error handling close() latency: ${latency}ms`);
    });
  });

  describe('Memory Usage Monitoring', () => {
    test('memory usage stability during operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform multiple close operations
      for (let i = 0; i < 10; i++) {
        const tempAgent = new BrowserAgent();
        await tempAgent.close();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be minimal (less than 5MB for 10 operations)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);

      console.log(`Memory increase after 10 close() operations: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    test('no resource leaks in repeated operations', async () => {
      // This test verifies that repeated operations don't accumulate resources
      for (let i = 0; i < 5; i++) {
        const tempAgent = new BrowserAgent();
        // Simulate some state
        tempAgent['browser_context'] = {
          pages: jest.fn().mockReturnValue([]),
          close: jest.fn().mockResolvedValue(undefined)
        } as any;
        tempAgent['browser'] = { close: jest.fn().mockResolvedValue(undefined) } as any;

        await tempAgent.close();

        // Verify cleanup
        expect(tempAgent['browser_context']).toBeNull();
        expect(tempAgent['browser']).toBeNull();
        expect(tempAgent['current_page']).toBeNull();
      }

      console.log('✅ No resource leaks detected in repeated operations');
    });
  });

  describe('Concurrent Operations Performance', () => {
    test('concurrent close() operations', async () => {
      const agents: BrowserAgent[] = [];

      // Create multiple agents
      for (let i = 0; i < 5; i++) {
        const agent = new BrowserAgent();
        // Give each a mock context
        agent['browser_context'] = {
          pages: jest.fn().mockReturnValue([]),
          close: jest.fn().mockResolvedValue(undefined)
        } as any;
        agents.push(agent);
      }

      const startTime = Date.now();

      // Close all agents concurrently
      await Promise.all(agents.map(agent => agent.close()));

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Concurrent operations should complete quickly
      expect(totalTime).toBeLessThan(200); // Under 200ms for 5 concurrent closes

      console.log(`Concurrent close() operations: ${totalTime}ms for 5 agents`);
    });
  });
});