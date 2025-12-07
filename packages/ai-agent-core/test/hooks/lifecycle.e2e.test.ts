import { XSky, Agent, AgentContext, type AgentParams, type LLMs, type XSkyConfig, type Workflow } from "../../src";
import type { AgentHooks } from "../../src/types/hooks.types";

class DummySuccessAgent extends Agent {
  constructor() {
    super({ name: "DummyAgent", description: "Dummy success agent", tools: [] } as AgentParams);
  }

  async run(context: any, agentChain: any): Promise<string> {
    const agentContext = new AgentContext(context, this, agentChain);
    // Expose AgentContext so hooks and XSky.runAgent can use it
    (this as any).agentContext = agentContext;

    const hooks = context.config.hooks as AgentHooks | undefined;
    if (hooks?.beforeAgentStart) {
      await hooks.beforeAgentStart(agentContext);
    }

    return "dummy-result";
  }
}

class DummyErrorAgent extends Agent {
  constructor() {
    super({ name: "ErrorAgent", description: "Dummy error agent", tools: [] } as AgentParams);
  }

  async run(context: any, agentChain: any): Promise<string> {
    const agentContext = new AgentContext(context, this, agentChain);
    (this as any).agentContext = agentContext;

    const hooks = context.config.hooks as AgentHooks | undefined;
    if (hooks?.beforeAgentStart) {
      await hooks.beforeAgentStart(agentContext);
    }

    throw new Error("agent failed");
  }
}

function createDummyLlms(): LLMs {
  return {
    default: {
      provider: "openai",
      model: "gpt-4",
      apiKey: "test-key",
    },
  } as any;
}

function createSingleAgentWorkflow(taskId: string, agentName: string): Workflow {
  return {
    taskId,
    name: "Test Workflow",
    thought: "test",
    agents: [
      {
        id: "a1",
        name: agentName,
        task: "do something",
        dependsOn: [],
        nodes: [],
        status: "init",
        xml: `<agent name="${agentName}"></agent>`,
      },
    ],
    xml: "<root></root>",
    modified: false,
    taskPrompt: "test prompt",
  };
}

// E2E-style tests that exercise workflow/agent lifecycle hooks via XSky.
// Tool-level hooks remain covered in hooks.integration.test.ts.
describe("Workflow/Agent Hook Lifecycle with XSky.run", () => {
  it("should trigger workflow and agent hooks for successful run", async () => {
    const events: string[] = [];

    const hooks: AgentHooks = {
      onWorkflowGenerated: async () => {
        events.push("workflowGenerated");
      },
      beforeAgentStart: async (ctx) => {
        events.push(`beforeAgentStart:${ctx.agent.Name}`);
        return undefined;
      },
      afterAgentComplete: async (ctx, result) => {
        events.push(`afterAgentComplete:${result}`);
        return undefined;
      },
      onWorkflowStepComplete: async (ctx, agent, result) => {
        events.push(`workflowStepComplete:${agent.name}`);
      },
      onWorkflowComplete: async (ctx, ekoResult) => {
        events.push(`workflowComplete:${ekoResult.success}`);
      },
    };

    const llms = createDummyLlms();
    const agent = new DummySuccessAgent();

    const config: XSkyConfig = {
      llms,
      agents: [agent as Agent],
      hooks,
    } as any;

    const xsky = new XSky(config);
    const workflow = createSingleAgentWorkflow("task-success", "DummyAgent");
    await xsky.initContext(workflow);
    const result = await xsky.execute(workflow.taskId);

    expect(result.success).toBe(true);
    expect(result.taskId).toBe("task-success");
    expect(result.result).toBe("dummy-result");

    expect(events).toEqual([
      "workflowGenerated",
      "beforeAgentStart:DummyAgent",
      "afterAgentComplete:dummy-result",
      "workflowStepComplete:DummyAgent",
      "workflowComplete:true",
    ]);
  });

  it("should trigger agent error hook and skip workflow complete on failure", async () => {
    const events: string[] = [];

    const hooks: AgentHooks = {
      onWorkflowGenerated: async () => {
        events.push("workflowGenerated");
      },
      beforeAgentStart: async (ctx) => {
        events.push(`beforeAgentStart:${ctx.agent.Name}`);
        return undefined;
      },
      onAgentError: async (ctx, error) => {
        events.push(`agentError:${error.message}`);
        return "continue";
      },
      onWorkflowComplete: async (ctx, ekoResult) => {
        events.push(`workflowComplete:${ekoResult.success}`);
      },
    };

    const llms = createDummyLlms();
    const agent = new DummyErrorAgent();

    const config: XSkyConfig = {
      llms,
      agents: [agent as Agent],
      hooks,
    } as any;

    const xsky = new XSky(config);
    const workflow = createSingleAgentWorkflow("task-error", "ErrorAgent");
    await xsky.initContext(workflow);

    const result = await xsky.execute(workflow.taskId);

    expect(result.success).toBe(false);
    expect(result.taskId).toBe("task-error");
    expect(String(result.result)).toContain("agent failed");

    expect(events).toEqual([
      "workflowGenerated",
      "beforeAgentStart:ErrorAgent",
      "agentError:agent failed",
      // onWorkflowComplete should not be called on failure
    ]);
  });
})
