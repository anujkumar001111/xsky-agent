/**
 * E2E Workflow Tests
 *
 * Tests the complete XSky workflow from planning to execution
 * using mock agents and tools.
 */

import { XSky, Agent, LLMs, Log } from '../../src';
import type { Tool, ToolResult } from '../../src/types/tools.types';
import { z } from 'zod';

// Skip tests if no API key available
const hasApiKey = !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
const conditionalDescribe = hasApiKey ? describe : describe.skip;

// Mock tool for testing
const MockSearchTool: Tool = {
  name: 'mock_search',
  description: 'Mock search tool for testing',
  parameters: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
    return {
      content: [
        {
          type: 'text',
          text: `Search results for: ${args.query}\n1. Result one\n2. Result two\n3. Result three`,
        },
      ],
    };
  },
};

// Mock agent for testing
class MockAgent extends Agent {
  constructor() {
    super({
      name: 'mock',
      description: 'A mock agent for testing workflow execution',
      tools: [MockSearchTool],
      llms: ['default'],
    });
  }
}

conditionalDescribe('XSky E2E Workflow Tests', () => {
  let xsky: XSky;
  let mockAgent: MockAgent;

  beforeAll(() => {
    // Suppress logs during tests
    Log.setLevel(0);
  });

  afterAll(async () => {
    // Ensure all tasks are cleaned up to prevent async operations after test completion
    if (xsky) {
      const taskIds = xsky.getAllTaskId();
      taskIds.forEach((id) => xsky.abortTask(id));
      // Allow pending promises to resolve
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });

  beforeEach(() => {
    // Configure LLMs - use available provider
    const llms: LLMs = {};

    if (process.env.OPENAI_API_KEY) {
      llms.default = {
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKey: process.env.OPENAI_API_KEY,
      };
    } else if (process.env.ANTHROPIC_API_KEY) {
      llms.default = {
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        apiKey: process.env.ANTHROPIC_API_KEY,
      };
    }

    mockAgent = new MockAgent();

    xsky = new XSky({
      llms,
      agents: [mockAgent],
    });
  });

  afterEach(() => {
    // Cleanup any pending tasks
    const taskIds = xsky.getAllTaskId();
    taskIds.forEach((id) => xsky.abortTask(id));
  });

  describe('Workflow Generation', () => {
    it('should generate a workflow from a simple task', async () => {
      const workflow = await xsky.generate('Use mock_search to find information about testing');

      expect(workflow).toBeDefined();
      expect(workflow.taskId).toBeDefined();
      expect(workflow.thought).toBeDefined();
    }, 30000);

    it('should include agent in generated workflow', async () => {
      const workflow = await xsky.generate('Use mock agent to search for TypeScript best practices');

      expect(workflow.agents).toBeDefined();
      // The LLM should generate a workflow with at least one agent
      expect(workflow.agents.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Full Execution Flow', () => {
    it('should execute a complete workflow', async () => {
      const result = await xsky.run('Use mock_search tool to find JavaScript frameworks');

      expect(result).toBeDefined();
      expect(result.taskId).toBeDefined();
      // Result should have stopReason (abort, error, or done)
      expect(result.stopReason).toBeDefined();
      expect(['abort', 'error', 'done']).toContain(result.stopReason);
    }, 60000);
  });

  describe('Task Management', () => {
    it('should track task after generation', async () => {
      const workflow = await xsky.generate('Simple search task');

      expect(xsky.getTask(workflow.taskId)).toBeDefined();
    }, 30000);

    it('should allow aborting a task', async () => {
      const workflow = await xsky.generate('A task to abort');

      const aborted = xsky.abortTask(workflow.taskId);

      expect(aborted).toBe(true);
    }, 30000);

    it('should delete task from tracking', async () => {
      const workflow = await xsky.generate('A task to delete');
      const taskId = workflow.taskId;

      xsky.deleteTask(taskId);

      expect(xsky.getTask(taskId)).toBeUndefined();
    }, 30000);

    it('should list all task IDs', async () => {
      await xsky.generate('Task 1');
      await xsky.generate('Task 2');

      const taskIds = xsky.getAllTaskId();

      expect(taskIds.length).toBe(2);
    }, 30000);
  });
});

// Tests that work without API keys
describe('XSky Unit Tests (No API Required)', () => {
  describe('XSky Constructor', () => {
    it('should create XSky instance with empty config', () => {
      const xsky = new XSky({
        llms: {},
        agents: [],
      });

      expect(xsky).toBeDefined();
      expect(xsky.getAllTaskId()).toEqual([]);
    });

    it('should accept custom agents', () => {
      const mockAgent = new MockAgent();
      const xsky = new XSky({
        llms: {},
        agents: [mockAgent],
      });

      expect(xsky).toBeDefined();
    });

    it('should expose config', () => {
      const xsky = new XSky({
        llms: { default: { provider: 'openai', model: 'test', apiKey: 'test' } },
        agents: [],
      });

      expect(xsky.config).toBeDefined();
      expect(xsky.config.llms).toBeDefined();
    });
  });

  describe('Task Management Without Tasks', () => {
    it('should return empty array for getAllTaskId when no tasks', () => {
      const xsky = new XSky({
        llms: {},
        agents: [],
      });

      expect(xsky.getAllTaskId()).toEqual([]);
    });

    it('should return undefined for non-existent task', () => {
      const xsky = new XSky({
        llms: {},
        agents: [],
      });

      expect(xsky.getTask('non-existent')).toBeUndefined();
    });

    it('should return false when aborting non-existent task', () => {
      const xsky = new XSky({
        llms: {},
        agents: [],
      });

      expect(xsky.abortTask('non-existent')).toBe(false);
    });

    it('should return false when deleting non-existent task', () => {
      const xsky = new XSky({
        llms: {},
        agents: [],
      });

      expect(xsky.deleteTask('non-existent')).toBe(false);
    });
  });

  describe('Agent Management', () => {
    it('should allow adding agents after construction', () => {
      const xsky = new XSky({
        llms: {},
        agents: [],
      });

      const mockAgent = new MockAgent();
      xsky.addAgent(mockAgent);

      // No error means success
      expect(true).toBe(true);
    });
  });
});
