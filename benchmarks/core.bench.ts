
import { Bench } from 'tinybench';
import {
  XSky,
  Agent,
  Context,
  Log,
  Chain,
  type AgentChain,
  type LLMs
} from '../packages/ai-agent-core/src/index.ts';
import {
  type LanguageModelV2,
  type LanguageModelV2StreamPart
} from '@ai-sdk/provider';

// Mock LanguageModelV2 implementation
const mockLanguageModel: LanguageModelV2 = {
  supportedUrls: [],
  specificationVersion: 'v2',
  provider: 'mock-provider',
  modelId: 'mock-model',
  doGenerate: async () => {
    return {
      text: '<root><name>Mock</name><agents><agent name="mock_agent"><task>Do something</task></agent></agents></root>',
      content: [{ type: 'text', text: '<root><name>Mock</name><agents><agent name="mock_agent"><task>Do something</task></agent></agents></root>' }],
      finishReason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    };
  },
  doStream: async () => {
    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      start(controller) {
        controller.enqueue({ type: 'text-delta', delta: '<root><name>Mock</name><agents><agent name="mock_agent"><task>Do something</task></agent></agents></root>', id: '1' });
        controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } });
        controller.close();
      }
    });
    return {
      stream,
      rawCall: { rawPrompt: null, rawSettings: {} },
    };
  },
} as any;

// Mock ProviderV2
const mockProvider = {
  languageModel: () => mockLanguageModel,
  textEmbeddingModel: () => { throw new Error('Not implemented'); },
  chatModel: () => mockLanguageModel,
};

const complexXml = `<root><name>Complex</name><agents>
  ${Array.from({ length: 50 }, (_, i) =>
    `<agent name="mock_agent" id="${i}"><task>Task ${i}</task></agent>`
  ).join('')}
</agents></root>`;

const mockComplexLanguageModel: LanguageModelV2 = {
  supportedUrls: [],
  specificationVersion: 'v2',
  provider: 'mock-provider',
  modelId: 'complex-model',
  doGenerate: async () => {
    return {
      text: complexXml,
      content: [{ type: 'text', text: complexXml }],
      finishReason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    };
  },
  doStream: async () => {
    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      start(controller) {
        controller.enqueue({ type: 'text-delta', delta: complexXml, id: '1' });
        controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } });
        controller.close();
      }
    });
    return {
      stream,
      rawCall: { rawPrompt: null, rawSettings: {} },
    };
  },
} as any;

const mockComplexProvider = {
  languageModel: () => mockComplexLanguageModel,
  textEmbeddingModel: () => { throw new Error('Not implemented'); },
  chatModel: () => mockComplexLanguageModel,
};

// Define a simple mock agent
class MockAgent extends Agent {
  constructor() {
    super({
      name: 'mock_agent',
      description: 'A mock agent for benchmarking',
      tools: []
    });
  }

  async run(context: Context, chain: AgentChain): Promise<string> {
    return "Mock agent execution result";
  }
}

async function runBenchmarks() {
  Log.setLevel(5); // LogLevel.OFF
  const bench = new Bench({ time: 1000 });

  // Setup
  const llms: LLMs = {
    default: {
      provider: mockProvider as any,
      model: 'mock-model',
      apiKey: 'mock-key',
    }
  };
  const agents = [new MockAgent()];

  // 1. Benchmark Workflow Generation
  bench.add('XSky.generate (Simple)', async () => {
    const xsky = new XSky({ llms, agents });
    await xsky.generate('Create a workflow');
  });

  // 2. Benchmark Full Run (Generate + Execute)
  bench.add('XSky.run (Simple)', async () => {
    const xsky = new XSky({ llms, agents });
    await xsky.run('Run a task');
  });

  // 3. Benchmark Complex Workflow (50 agents)
  const complexLlms: LLMs = {
    default: {
      provider: mockComplexProvider as any,
      model: 'complex-model',
      apiKey: 'mock-key',
    }
  };

  bench.add('XSky.run (Complex - 50 agents)', async () => {
    const xsky = new XSky({ llms: complexLlms, agents });
    await xsky.run('Run complex task');
  });

  // 4. Benchmark Large Context (Prompt Construction Overhead)
  const largeHistory = Array.from({ length: 1000 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `This is message ${i} with some significant content to simulate a real conversation history that needs to be processed.`
  }));

  const mockLargeContextLanguageModel: LanguageModelV2 = {
    ...mockLanguageModel,
    doGenerate: async (options) => {
      // Simulate processing time proportional to input size (optional, but good for realism)
      // await new Promise(resolve => setTimeout(resolve, 10));
      return mockLanguageModel.doGenerate(options);
    }
  } as any;

  const largeContextLlms: LLMs = {
    default: {
      provider: {
        ...mockProvider,
        languageModel: () => mockLargeContextLanguageModel,
        chatModel: () => mockLargeContextLanguageModel,
      } as any,
      model: 'mock-model',
      apiKey: 'mock-key',
    }
  };

  bench.add('XSky.generate (Large Context - 1000 msgs)', async () => {
    const xsky = new XSky({ llms: largeContextLlms, agents });
    // Manually inject history into context if possible, or just pass a huge prompt
    // For this bench, we'll simulate a huge prompt which triggers internal context building
    const hugePrompt = largeHistory.map(m => m.content).join('\n');
    await xsky.generate(hugePrompt); // Pass the FULL prompt (~100k chars)
  });

  // 5. Benchmark Heavy Tools (50 complex tools)
  // Mock a tool with a complex Zod schema (if we were using Zod, but Tool interface uses JSON schema/params)
  // For benchmark, we just create many tools to test internal iteration/merging/conversion
  const heavyTools = Array.from({ length: 50 }, (_, i) => ({
    name: `tool_${i}`,
    description: `Description for tool ${i}`,
    parameters: {
      type: "object",
      properties: {
        arg1: { type: "string" },
        arg2: { type: "number" },
        arg3: { type: "array", items: { type: "string" } }
      },
      required: ["arg1"]
    },
    execute: async () => `Result ${i}`
  }));

  class HeavyToolAgent extends Agent {
    constructor() {
      super({
        name: 'heavy_tool_agent',
        description: 'Agent with many tools',
        tools: heavyTools as any[]
      });
    }
  }

  bench.add('Agent.run (Heavy Tools - 50 tools)', async () => {
    const context = new Context('task-id', { llms, agents: [] }, [], new Chain('task'));
    const agent = new HeavyToolAgent();
    // We need to bypass the full XSky loop to test just the agent run overhead (tool conversion, system prompt build)
    // But XSky.run is fine too, just adds the planner overhead
    // Let's test Agent.run directly to isolate tool overhead
    await agent.run(context, {
      agent: {
        name: 'heavy',
        id: '1',
        task: 'task',
        status: 'running',
        nodes: [],
        xml: '<agent name="heavy"><task>task</task></agent>'
      }
    } as any);
  });

  // 6. Benchmark Large Output Parsing (Large XML)
  const hugeXml = `<root><name>Huge</name><agents>\n${Array.from({ length: 500 }, (_, i) =>
    `<agent name="mock_agent" id="${i}"><task>Task ${i} with significant description to make it larger</task></agent>`
  ).join('\n')}\n</agents></root>`;

  const mockHugeOutputLanguageModel: LanguageModelV2 = {
    ...mockLanguageModel,
    doGenerate: async () => {
      return {
        text: hugeXml,
        content: [{ type: 'text', text: hugeXml }],
        finishReason: 'stop',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    }
  } as any;

  const hugeOutputLlms: LLMs = {
    default: {
      provider: {
        ...mockProvider,
        languageModel: () => mockHugeOutputLanguageModel,
        chatModel: () => mockHugeOutputLanguageModel,
      } as any,
      model: 'mock-model',
      apiKey: 'mock-key',
    }
  };

  bench.add('XSky.generate (Large Output - 500 agents)', async () => {
    const xsky = new XSky({ llms: hugeOutputLlms, agents });
    await xsky.generate('Create huge workflow');
  });

  console.log("Running benchmarks...");
  await bench.run();

  console.table(bench.table());
}

runBenchmarks().catch(console.error);
