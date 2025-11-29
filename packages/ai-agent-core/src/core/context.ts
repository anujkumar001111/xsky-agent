import { Agent } from "../agent";
import { sleep } from "../common/utils";
import Chain, { AgentChain } from "./chain";
import {
  EkoConfig,
  LanguageModelV2Prompt,
  Workflow,
  WorkflowAgent,
} from "../types";
import { DomIntelligenceCache } from "../agent/browser/dom_intelligence";

export interface AdaptiveWaitSignal {
  type: 'mutation' | 'event' | 'animation' | 'load';
  elementId?: string;
  timestamp: number;
  data: unknown;
}

/**
 * The context for a task.
 */
export default class Context {
  taskId: string;
  config: EkoConfig;
  chain: Chain;
  agents: Agent[];
  controller: AbortController;
  variables: Map<string, any>;
  workflow?: Workflow;
  conversation: string[] = [];
  private pauseStatus: 0 | 1 | 2 = 0;
  readonly currentStepControllers: Set<AbortController> = new Set();

  /**
   * Creates an instance of the Context.
   * @param taskId - The ID of the task.
   * @param config - The configuration for the task.
   * @param agents - The agents available for the task.
   * @param chain - The chain of execution for the task.
   */
  constructor(
    taskId: string,
    config: EkoConfig,
    agents: Agent[],
    chain: Chain
  ) {
    this.taskId = taskId;
    this.config = config;
    this.agents = agents;
    this.chain = chain;
    this.variables = new Map();
    this.controller = new AbortController();
  }

  /**
   * Checks if the task has been aborted.
   * @param noCheckPause - Whether to skip checking for a pause.
   */
  async checkAborted(noCheckPause?: boolean): Promise<void> {
    if (this.controller.signal.aborted) {
      const error = new Error("Operation was interrupted");
      error.name = "AbortError";
      throw error;
    }
    while (this.pauseStatus > 0 && !noCheckPause) {
      await sleep(500);
      if (this.pauseStatus == 2) {
        this.currentStepControllers.forEach((c) => {
          c.abort("Pause");
        });
        this.currentStepControllers.clear();
      }
      if (this.controller.signal.aborted) {
        const error = new Error("Operation was interrupted");
        error.name = "AbortError";
        throw error;
      }
    }
  }

  /**
   * Gets the current agent.
   * @returns The current agent, or null if there is no current agent.
   */
  currentAgent(): [Agent, WorkflowAgent, AgentContext] | null {
    const agentNode = this.chain.agents[this.chain.agents.length - 1];
    if (!agentNode) {
      return null;
    }
    const agent = this.agents.filter(
      (agent) => agent.Name == agentNode.agent.name
    )[0];
    if (!agent) {
      return null;
    }
    const agentContext = agent.AgentContext as AgentContext;
    return [agent, agentNode.agent, agentContext];
  }

  /**
   * Whether the task is paused.
   */
  get pause() {
    return this.pauseStatus > 0;
  }

  /**
   * Sets the pause status of the task.
   * @param pause - Whether to pause the task.
   * @param abortCurrentStep - Whether to abort the current step.
   */
  setPause(pause: boolean, abortCurrentStep?: boolean) {
    this.pauseStatus = pause ? (abortCurrentStep ? 2 : 1) : 0;
    if (this.pauseStatus == 2) {
      this.currentStepControllers.forEach((c) => {
        c.abort("Pause");
      });
      this.currentStepControllers.clear();
    }
  }

  /**
   * Resets the context.
   */
  reset() {
    this.pauseStatus = 0;
    if (!this.controller.signal.aborted) {
      this.controller.abort();
    }
    this.currentStepControllers.forEach((c) => {
      c.abort("reset");
    });
    this.currentStepControllers.clear();
    this.controller = new AbortController();
  }
}

/**
 * The context for an agent.
 */
export class AgentContext {
  agent: Agent;
  context: Context;
  agentChain: AgentChain;
  variables: Map<string, any>;
  consecutiveErrorNum: number;
  messages?: LanguageModelV2Prompt;

  // DOM Intelligence related properties
  domIntelligenceCache?: DomIntelligenceCache;
  adaptiveWaitSignals: AdaptiveWaitSignal[] = [];

  /**
   * Creates an instance of the AgentContext.
   * @param context - The context for the task.
   * @param agent - The agent.
   * @param agentChain - The agent chain.
   */
  constructor(context: Context, agent: Agent, agentChain: AgentChain) {
    this.context = context;
    this.agent = agent;
    this.agentChain = agentChain;
    this.variables = new Map();
    this.consecutiveErrorNum = 0;
  }

  addAdaptiveWaitSignal(signal: AdaptiveWaitSignal) {
    this.adaptiveWaitSignals.push(signal);
    // Keep only recent signals (e.g., last 5 seconds)
    const now = Date.now();
    this.adaptiveWaitSignals = this.adaptiveWaitSignals.filter(s => now - s.timestamp < 5000);
  }

  getLatestSignal(type?: string): AdaptiveWaitSignal | undefined {
      if (type) {
          return this.adaptiveWaitSignals.filter(s => s.type === type).pop();
      }
      return this.adaptiveWaitSignals[this.adaptiveWaitSignals.length - 1];
  }
}
