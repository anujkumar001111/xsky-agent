import { Agent } from "../agent";
import { sleep, uuidv4 } from "../common/utils";
import Chain, { AgentChain } from "./chain";
import {
  XSkyConfig,
  LanguageModelV2Prompt,
  Workflow,
  WorkflowAgent,
} from "../types";
import { DomIntelligenceCache } from "../agent/browser/dom_intelligence";
import type { Checkpoint } from "../types/hooks.types";

export interface AdaptiveWaitSignal {
  type: 'mutation' | 'event' | 'animation' | 'load';
  elementId?: string;
  timestamp: number;
  data: unknown;
}

/**
 * Execution context for a single workflow task.
 *
 * The Context class encapsulates all state and configuration needed for a workflow execution,
 * providing centralized access to variables, agents, configuration, and execution control.
 * It manages pause/resume functionality, checkpointing for fault tolerance, and
 * coordinates between different agents and tools during workflow execution.
 */
export default class Context {
  /** Unique identifier for this workflow execution */
  taskId: string;
  /** XSky configuration containing LLM settings, agents, and production hooks */
  config: XSkyConfig;
  /** Execution chain tracking the sequence of agent calls and results */
  chain: Chain;
  /** Available agents that can be invoked during workflow execution */
  agents: Agent[];
  /** AbortController for cancelling the entire workflow execution */
  controller: AbortController;
  /** Key-value store for workflow variables shared between agents */
  variables: Map<string, any>;
  /** Current workflow definition with agents and execution plan */
  workflow?: Workflow;
  /** Conversation history for chat-style interactions */
  conversation: string[] = [];
  /** Pause status: 0=running, 1=paused, 2=resume-pending */
  private pauseStatus: 0 | 1 | 2 = 0;
  /** Controllers for individual execution steps that can be aborted independently */
  readonly currentStepControllers: Set<AbortController> = new Set();

  // ============ CHECKPOINT SYSTEM ============
  /** Timer for periodic state checkpointing */
  private checkpointTimer?: ReturnType<typeof setInterval>;
  /** Debounce timer for batching state change saves */
  private stateChangeDebounceTimer?: ReturnType<typeof setTimeout>;
  /** Pending state changes waiting to be persisted */
  private pendingStateChanges: Map<string, any> = new Map();

  /**
   * Creates an instance of the Context.
   * @param taskId - The ID of the task.
   * @param config - The configuration for the task.
   * @param agents - The agents available for the task.
   * @param chain - The chain of execution for the task.
   */
  constructor(
    taskId: string,
    config: XSkyConfig,
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
    this.stopCheckpointing();
  }

  // ============ CHECKPOINT SYSTEM ============

  /**
   * Starts automatic checkpointing at the specified interval.
   * @param intervalMs - Interval in milliseconds between checkpoints.
   */
  startCheckpointing(intervalMs: number): void {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
    }

    this.checkpointTimer = setInterval(async () => {
      await this.createCheckpoint();
    }, intervalMs);
  }

  /**
   * Stops automatic checkpointing.
   */
  stopCheckpointing(): void {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = undefined;
    }
  }

  /**
   * Creates a checkpoint and triggers the onCheckpoint hook.
   * @returns The created checkpoint, or undefined if no hook is configured.
   */
  async createCheckpoint(): Promise<Checkpoint | undefined> {
    const hooks = this.config.hooks;
    if (!hooks?.onCheckpoint) {
      return undefined;
    }

    const checkpoint: Checkpoint = {
      id: uuidv4(),
      taskId: this.taskId,
      state: JSON.stringify(this.serialize()),
      metadata: {
        agentCount: this.chain.agents.length,
        variableCount: this.variables.size,
        timestamp: Date.now(),
      },
      createdAt: Date.now(),
    };

    try {
      await hooks.onCheckpoint(checkpoint);
    } catch (error) {
      // Don't fail the workflow if checkpoint fails
      console.error("Checkpoint hook error:", error);
    }

    return checkpoint;
  }

  /**
   * Serializes the context state for checkpointing.
   */
  serialize(): Record<string, any> {
    return {
      taskId: this.taskId,
      variables: Object.fromEntries(this.variables),
      conversation: this.conversation,
      workflowProgress: this.workflow?.agents.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.status,
      })),
    };
  }

  /**
   * Restores context state from a checkpoint.
   * @param state - The serialized state to restore.
   */
  restore(state: Record<string, any>): void {
    if (state.variables) {
      this.variables = new Map(Object.entries(state.variables));
    }
    if (state.conversation) {
      this.conversation = state.conversation;
    }
  }

  // ============ STATE CHANGE TRACKING ============

  /**
   * Sets a variable and triggers the onStateChange hook (debounced).
   * @param key - The variable key.
   * @param value - The variable value.
   */
  setVariable(key: string, value: any): void {
    this.variables.set(key, value);
    this.queueStateChange(key, value);
  }

  /**
   * Gets a variable value.
   * @param key - The variable key.
   */
  getVariable<T = any>(key: string): T | undefined {
    return this.variables.get(key);
  }

  /**
   * Queues a state change for debounced hook notification.
   */
  private queueStateChange(key: string, value: any): void {
    const hooks = this.config.hooks;
    if (!hooks?.onStateChange) {
      return;
    }

    this.pendingStateChanges.set(key, value);

    // Debounce: wait 100ms before firing hook
    if (this.stateChangeDebounceTimer) {
      clearTimeout(this.stateChangeDebounceTimer);
    }

    this.stateChangeDebounceTimer = setTimeout(async () => {
      await this.flushStateChanges();
    }, 100);
  }

  /**
   * Flushes pending state changes to the onStateChange hook.
   */
  private async flushStateChanges(): Promise<void> {
    const hooks = this.config.hooks;
    if (!hooks?.onStateChange || this.pendingStateChanges.size === 0) {
      return;
    }

    // Fire hook for each pending change
    for (const [key, value] of this.pendingStateChanges) {
      try {
        await hooks.onStateChange(this, key, value);
      } catch (error) {
        console.error("onStateChange hook error:", error);
      }
    }

    this.pendingStateChanges.clear();
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
