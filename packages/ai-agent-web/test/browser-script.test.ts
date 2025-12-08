import BrowserAgent from '../src/browser';
import { AgentContext } from '@xsky/ai-agent-core';

describe('BrowserAgent Script Execution (Web)', () => {
  let agent: BrowserAgent;
  let mockContext: AgentContext;

  beforeEach(() => {
    agent = new BrowserAgent();
    mockContext = {} as AgentContext;
    jest.clearAllMocks();
  });

  describe('execute_script', () => {
    it('should execute function with first argument', async () => {
      const mockFunc = jest.fn().mockReturnValue('result');
      const args = ['arg1', 'arg2'];

      // @ts-ignore - accessing protected method
      const result = await agent.execute_script(mockContext, mockFunc, args);

      expect(mockFunc).toHaveBeenCalledWith('arg1');
      expect(result).toBe('result');
    });

    it('should execute function that returns object', async () => {
      const mockFunc = jest.fn().mockReturnValue({ key: 'value', count: 42 });

      // @ts-ignore - accessing protected method
      const result = await agent.execute_script(mockContext, mockFunc, []);

      expect(result).toEqual({ key: 'value', count: 42 });
    });

    it('should execute function that returns undefined', async () => {
      const mockFunc = jest.fn().mockReturnValue(undefined);

      // @ts-ignore - accessing protected method
      const result = await agent.execute_script(mockContext, mockFunc, []);

      expect(result).toBeUndefined();
    });

    it('should execute function that returns array', async () => {
      const mockFunc = jest.fn().mockReturnValue([1, 2, 3]);

      // @ts-ignore - accessing protected method
      const result = await agent.execute_script(mockContext, mockFunc, []);

      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle function that accesses DOM', async () => {
      // Set up a DOM element
      document.body.innerHTML = '<div id="test">Hello World</div>';

      const domFunc = () => {
        const el = document.getElementById('test');
        return el ? el.textContent : null;
      };

      // @ts-ignore - accessing protected method
      const result = await agent.execute_script(mockContext, domFunc, []);

      expect(result).toBe('Hello World');
    });

    it('should handle empty args array', async () => {
      const mockFunc = jest.fn().mockReturnValue('no args result');

      // @ts-ignore - accessing protected method
      const result = await agent.execute_script(mockContext, mockFunc, []);

      expect(mockFunc).toHaveBeenCalledWith(undefined);
      expect(result).toBe('no args result');
    });
  });
});
