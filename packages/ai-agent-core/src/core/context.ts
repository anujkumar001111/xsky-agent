import { Agent } from "../agent";
import { sleep, uuidv4 } from "../common/utils";
import Chain, { AgentChain } from "./chain";
import {
  EkoConfig,
  LanguageModelV2Prompt,
  Workflow,
  WorkflowAgent,
} from "../types";
import { DomIntelligenceCache } from "../agent/browser/dom_intelligence";
import type { Checkpoint } from "../types/hooks.types";

/**
 * @file context.ts
 * @description Manages the execution state and lifecycle context for tasks and agents.
 * The Context system is split into two levels:
 * 1. Context: Global task-level state (variables, workflow, configuration).
 * 2. AgentContext: Local agent-level state (current step, specific history, error counts).
 *
 * Key Features:
 * - State persistence and variables management.
 * - Task lifecycle control (abort, pause, resume).
 * - Automatic checkpointing for recovery.
 * - Signal handling for DOM/environment events (Adaptive Wait).
 * - Hook integration for state changes.
 */

export interface AdaptiveWaitSignal {
  type: 'mutation' | 'event' | 'animation' | 'load';
  elementId?: string;
  timestamp: number;
  data: unknown;
}

/**
 * The global execution context for a single Task.
 * Acts as the "memory" and "controller" for the entire workflow execution.
 * Shared across all agents involved in the task.
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

  // Pause state: 0 = running, 1 = pause at safe point, 2 = force pause immediately
  private pauseStatus: 0 | 1 | 2 = 0;

  // Track active controllers to cancel sub-operations during pause/abort
  readonly currentStepControllers: Set<AbortController> = new Set();

  // Checkpoint system state
  private checkpointTimer?: ReturnType<typeof setInterval>;
  private stateChangeDebounceTimer?: ReturnType<typeof setTimeout>;
  private pendingStateChanges: Map<string, any> = new Map();

  /**
   * Initializes a new task context.
   * @param taskId - Unique identifier for the task.
   * @param config - Global configuration.
   * @param agents - List of available agents.
   * @param chain - Execution history tracker.
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
   * Checks if execution should be halted or paused.
   * MUST be called frequently within long-running loops.
   *
   * @param noCheckPause - If true, ignores pause state (used for cleanup/shutdown).
   * @throws {Error} Throws "AbortError" if task is cancelled.
   */
  async checkAborted(noCheckPause?: boolean): Promise<void> {
    if (this.controller.signal.aborted) {
      const error = new Error("Operation was interrupted");
      error.name = "AbortError";
      throw error;
    }
    // Handle pause logic: wait in loop until resumed or aborted
    while (this.pauseStatus > 0 && !noCheckPause) {
      await sleep(500);

      // Level 2 pause: aggressively abort current steps
      if (this.pauseStatus == 2) {
        this.currentStepControllers.forEach((c) => {
          c.abort("Pause");
        });
        this.currentStepControllers.clear();
      }

      // Check abort again during pause loop
      if (this.controller.signal.aborted) {
        const error = new Error("Operation was interrupted");
        error.name = "AbortError";
        throw error;
      }
    }
  }

  /**
   * Identifies the currently executing agent based on the chain history.
   * @returns Tuple of [Agent Instance, Agent Def, Agent Context] or null.
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
   * Read-only accessor for pause state.
   */
  get pause() {
    return this.pauseStatus > 0;
  }

  /**
   * Updates the pause state.
   * @param pause - True to pause, false to resume.
   * @param abortCurrentStep - If true, attempts to interrupt current async operation immediately.
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
   * Fully resets the context, cancelling all operations.
   * Typically used when restarting a task or clearing state.
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
   * Activates periodic state snapshots.
   * Useful for long-running tasks that might need crash recovery.
   * @param intervalMs - Frequency of checkpoints in milliseconds.
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
   * Disables automatic checkpointing.
   */
  stopCheckpointing(): void {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = undefined;
    }
  }

  /**
   * Manually triggers a state snapshot.
   * Invokes the `onCheckpoint` hook if configured.
   * @returns The generated Checkpoint object.
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
      // Fail safely: logging error but keeping workflow alive
      console.error("Checkpoint hook error:", error);
    }

    return checkpoint;
  }

  /**
   * Converts current context state into a serializable object.
   * Captures variables, conversation history, and workflow progress.
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
   * Hydrates context state from a serialized object.
   * @param state - The saved state object.
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
   * Sets a global variable and notifies listeners (debounced).
   * @param key - Variable name.
   * @param value - Value to store.
   */
  setVariable(key: string, value: any): void {
    this.variables.set(key, value);
    this.queueStateChange(key, value);
  }

  /**
   * Retrieves a global variable.
   * @param key - Variable name.
   */
  getVariable<T = any>(key: string): T | undefined {
    return this.variables.get(key);
  }

  /**
   * Internal helper to debounce state change notifications.
   * Prevents flooding the hook with rapid updates.
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
   * Emits queued state changes to the `onStateChange` hook.
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
 * Localized context for a specific Agent execution instance.
 * Wraps the global Context and adds agent-specific transient state.
 */
export class AgentContext {
  agent: Agent;
  context: Context;
  agentChain: AgentChain;
  variables: Map<string, any>; // Local variables scoped to this agent run
  consecutiveErrorNum: number;
  messages?: LanguageModelV2Prompt; // Current conversation window

  // DOM Intelligence related properties (Browser Agents)
  domIntelligenceCache?: DomIntelligenceCache;
  adaptiveWaitSignals: AdaptiveWaitSignal[] = [];

  /**
   * Initializes the agent-specific context.
   * @param context - Parent global context.
   * @param agent - The agent instance.
   * @param agentChain - History tracker for this run.
   */
  constructor(context: Context, agent: Agent, agentChain: AgentChain) {
    this.context = context;
    this.agent = agent;
    this.agentChain = agentChain;
    this.variables = new Map();
    this.consecutiveErrorNum = 0;
  }

  /**
   * Records an environmental signal for adaptive waiting logic.
   * Used by browser agents to detect page stability.
   */
  addAdaptiveWaitSignal(signal: AdaptiveWaitSignal) {
    this.adaptiveWaitSignals.push(signal);
    // Keep only recent signals (e.g., last 5 seconds) to avoid memory growth
    const now = Date.now();
    this.adaptiveWaitSignals = this.adaptiveWaitSignals.filter(s => now - s.timestamp < 5000);
  }

  /**
   * Retrieves the most recent signal of a given type.
   * @param type - Optional signal type to filter by.
   */
  getLatestSignal(type?: string): AdaptiveWaitSignal | undefined {
      if (type) {
          return this.adaptiveWaitSignals.filter(s => s.type === type).pop();
      }
      return this.adaptiveWaitSignals[this.adaptiveWaitSignals.length - 1];
  }
}
