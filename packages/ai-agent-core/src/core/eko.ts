import config from "../config";
import Context from "./context";
import { Agent } from "../agent";
import { Planner } from "./plan";
import Log from "../common/log";
import Chain, { AgentChain } from "./chain";
import { buildAgentTree } from "../common/tree";
import { mergeAgents, uuidv4 } from "../common/utils";
import {
  EkoConfig,
  EkoResult,
  Workflow,
  NormalAgentNode,
} from "../types/core.types";
import { checkTaskReplan, replanWorkflow } from "./replan";

/**
 * @file eko.ts
 * @description Main orchestrator for the Eko AI agent framework.
 * This file defines the Eko class, which manages the lifecycle of agent workflows,
 * including generation, execution, pausing, resuming, and termination.
 *
 * Architecture:
 * - Acts as the central controller for the agent system.
 * - Integrates Planner for workflow generation.
 * - Manages execution context and state persistence.
 * - Handles agent-to-agent communication and parallel execution.
 * - Provides hook points for extending functionality (logging, monitoring, etc.).
 *
 * Dependencies:
 * - config: System-wide configuration.
 * - Context: Execution state container.
 * - Planner: Workflow generation engine.
 * - Chain: Execution history tracker.
 * - Agent: Base agent definition.
 */

/**
 * The main class for the Eko AI agent system.
 * Orchestrates the entire lifecycle of an AI task from prompt to execution.
 *
 * Responsibilities:
 * 1. Initialize and manage task contexts.
 * 2. Coordinate workflow generation via the Planner.
 * 3. Execute agent workflows (serial or parallel).
 * 4. Handle runtime control (pause, resume, abort).
 * 5. Manage inter-agent communication and resource sharing.
 */
export class Eko {
  /**
   * System configuration including LLM settings, available agents, and callbacks.
   */
  protected config: EkoConfig;

  /**
   * Registry of active tasks, mapped by task ID.
   * Maintains the state (Context) for each running or paused workflow.
   */
  protected taskMap: Map<string, Context>;

  /**
   * Creates an instance of the Eko orchestration engine.
   * @param config - The configuration object defining system behavior, agents, and integrations.
   */
  constructor(config: EkoConfig) {
    this.config = config;
    this.taskMap = new Map();
  }

  /**
   * Generates a structural workflow based on a user prompt.
   * This method initializes the task context and invokes the Planner to create an execution plan.
   *
   * @param taskPrompt - The natural language description of the task to perform.
   * @param taskId - Unique identifier for the task (defaults to a new UUID).
   * @param contextParams - Optional initial state variables to populate in the context.
   * @returns A promise resolving to the generated Workflow object containing the execution graph.
   * @throws Will throw an error if planning fails.
   */
  public async generate(
    taskPrompt: string,
    taskId: string = uuidv4(),
    contextParams?: Record<string, any>
  ): Promise<Workflow> {
    // Initialize available agents from config
    const agents = [...(this.config.agents || [])];
    const chain: Chain = new Chain(taskPrompt);
    const context = new Context(taskId, this.config, agents, chain);

    // Populate initial context variables if provided
    if (contextParams) {
      Object.keys(contextParams).forEach((key) =>
        context.variables.set(key, contextParams[key])
      );
    }

    try {
      this.taskMap.set(taskId, context);

      // Dynamic Agent Discovery: If A2A client is configured, fetch relevant external agents
      if (this.config.a2aClient) {
        const a2aList = await this.config.a2aClient.listAgents(taskPrompt);
        context.agents = mergeAgents(context.agents, a2aList);
      }

      // Delegate to Planner to generate the workflow structure (XML -> Object)
      const planner = new Planner(context);
      context.workflow = await planner.plan(taskPrompt);
      return context.workflow;
    } catch (e) {
      // Cleanup on failure to prevent memory leaks
      this.deleteTask(taskId);
      throw e;
    }
  }

  /**
   * Modifies an existing workflow based on new user input or changing requirements.
   * Supports dynamic replanning during execution.
   *
   * @param taskId - The identifier of the active task to modify.
   * @param modifyTaskPrompt - The new instructions or feedback to guide the replanning.
   * @returns A promise resolving to the updated Workflow.
   */
  public async modify(
    taskId: string,
    modifyTaskPrompt: string
  ): Promise<Workflow> {
    const context = this.taskMap.get(taskId);

    // If task doesn't exist, treat it as a new generation request
    if (!context) {
      return await this.generate(modifyTaskPrompt, taskId);
    }

    // Refresh external agents for the new prompt context
    if (this.config.a2aClient) {
      const a2aList = await this.config.a2aClient.listAgents(modifyTaskPrompt);
      context.agents = mergeAgents(context.agents, a2aList);
    }

    // Trigger replanning logic
    const planner = new Planner(context);
    context.workflow = await planner.replan(modifyTaskPrompt);
    return context.workflow;
  }

  /**
   * Executes a previously generated workflow for a specific task.
   * Manages the execution loop, error handling, and lifecycle states (pause/resume).
   *
   * @param taskId - The unique identifier of the task to execute.
   * @returns A promise resolving to the final EkoResult.
   * @throws Will throw if the task context is not found.
   */
  public async execute(taskId: string): Promise<EkoResult> {
    const context = this.getTask(taskId);
    if (!context) {
      throw new Error("The task does not exist");
    }

    // Ensure task is in a runnable state
    if (context.pause) {
      context.setPause(false);
    }

    // Reset abort signal if it was previously triggered
    if (context.controller.signal.aborted) {
      context.reset();
    }

    // Clear previous conversation history for a fresh run
    // Note: This might need review if history preservation is desired across pauses
    context.conversation = [];

    try {
      return await this.doRunWorkflow(context);
    } catch (e: any) {
      Log.error("execute error", e);
      return {
        taskId,
        success: false,
        stopReason: e?.name == "AbortError" ? "abort" : "error",
        result: e ? e.name + ": " + e.message : "Error",
        error: e,
      };
    }
  }

  /**
   * Convenience method to generate and immediately execute a workflow.
   * Combines `generate` and `execute` into a single call.
   *
   * @param taskPrompt - The task description.
   * @param taskId - Optional task ID.
   * @param contextParams - Optional context variables.
   * @returns The execution result.
   */
  public async run(
    taskPrompt: string,
    taskId: string = uuidv4(),
    contextParams?: Record<string, any>
  ): Promise<EkoResult> {
    await this.generate(taskPrompt, taskId, contextParams);
    return await this.execute(taskId);
  }

  /**
   * Re-initializes a context from an existing workflow object.
   * Useful for restoring state from storage or resuming complex workflows.
   *
   * @param workflow - The Workflow object to hydrate context from.
   * @param contextParams - Additional parameters to inject.
   * @returns The initialized Context object.
   */
  public async initContext(
    workflow: Workflow,
    contextParams?: Record<string, any>
  ): Promise<Context> {
    const agents = this.config.agents || [];
    const chain: Chain = new Chain(workflow.taskPrompt || workflow.name);
    const context = new Context(workflow.taskId, this.config, agents, chain);

    // Re-fetch external agents if applicable
    if (this.config.a2aClient) {
      const a2aList = await this.config.a2aClient.listAgents(
        workflow.taskPrompt || workflow.name
      );
      context.agents = mergeAgents(context.agents, a2aList);
    }

    if (contextParams) {
      Object.keys(contextParams).forEach((key) =>
        context.variables.set(key, contextParams[key])
      );
    }
    context.workflow = workflow;
    this.taskMap.set(workflow.taskId, context);
    return context;
  }

  /**
   * Internal execution loop for the workflow.
   * Iterates through the agent dependency tree, executing agents serially or in parallel.
   * Handles replanning triggers and lifecycle hooks.
   *
   * @param context - The execution context containing state and workflow.
   * @returns The final result of the workflow.
   */
  private async doRunWorkflow(context: Context): Promise<EkoResult> {
    const hooks = this.config.hooks;
    const agents = context.agents as Agent[];
    const workflow = context.workflow as Workflow;
    if (!workflow || workflow.agents.length == 0) {
      throw new Error("Workflow error");
    }

    // ============ ON WORKFLOW GENERATED HOOK ============
    if (hooks?.onWorkflowGenerated) {
      try {
        await hooks.onWorkflowGenerated(context, workflow);
      } catch (hookError) {
        Log.error("onWorkflowGenerated hook error:", hookError);
      }
    }

    // Map agents by name for quick lookup during execution
    const agentNameMap = agents.reduce((map, item) => {
      map[item.Name] = item;
      return map;
    }, {} as { [key: string]: Agent });

    // Build the execution tree from the flat agent list based on dependencies
    let agentTree = buildAgentTree(workflow.agents);
    const results: string[] = [];

    // Main execution loop: traverses the agent tree
    while (true) {
      // Check for pause/abort signals before starting next step
      await context.checkAborted();
      let lastAgent: Agent | undefined;

      if (agentTree.type === "normal") {
        // --- SERIAL EXECUTION ---
        const agent = agentNameMap[agentTree.agent.name];
        if (!agent) {
          throw new Error("Unknown Agent: " + agentTree.agent.name);
        }
        lastAgent = agent;
        const agentNode = agentTree.agent;

        // Track execution history
        const agentChain = new AgentChain(agentNode);
        context.chain.push(agentChain);

        // Execute the single agent
        agentTree.result = await this.runAgent(
          context,
          agent,
          agentTree,
          agentChain
        );
        results.push(agentTree.result);
      } else {
        // --- PARALLEL EXECUTION ---
        const parallelAgents = agentTree.agents;

        // Helper to run a single agent in the parallel group
        const doRunAgent = async (
          agentNode: NormalAgentNode,
          index: number
        ) => {
          const agent = agentNameMap[agentNode.agent.name];
          if (!agent) {
            throw new Error("Unknown Agent: " + agentNode.agent.name);
          }
          lastAgent = agent;
          const agentChain = new AgentChain(agentNode.agent);
          context.chain.push(agentChain);
          const result = await this.runAgent(
            context,
            agent,
            agentNode,
            agentChain
          );
          return { result: result, agentChain, index };
        };

        let agent_results: string[] = [];

        // Check configuration for parallel execution strategy
        let agentParallel = context.variables.get("agentParallel");
        if (agentParallel === undefined) {
          agentParallel = config.agentParallel;
        }

        if (agentParallel) {
          // True parallel execution using Promise.all
          const parallelResults = await Promise.all(
            parallelAgents.map((agent, index) => doRunAgent(agent, index))
          );
          // Ensure deterministic order of results
          parallelResults.sort((a, b) => a.index - b.index);
          parallelResults.forEach(({ agentChain }) => {
            context.chain.push(agentChain);
          });
          agent_results = parallelResults.map(({ result }) => result);
        } else {
          // Sequential execution of "parallel" nodes (fallback strategy)
          for (let i = 0; i < parallelAgents.length; i++) {
            const { result, agentChain } = await doRunAgent(
              parallelAgents[i],
              i
            );
            context.chain.push(agentChain);
            agent_results.push(result);
          }
        }
        results.push(agent_results.join("\n\n"));
      }

      // Clear conversation buffer after each step to manage context window
      context.conversation.splice(0, context.conversation.length);

      // --- DYNAMIC REPLANNING ---
      // In expert mode, check if the agent requested a plan modification
      if (
        config.expertMode &&
        !workflow.modified &&
        agentTree.nextAgent &&
        lastAgent?.AgentContext &&
        (await checkTaskReplan(lastAgent.AgentContext))
      ) {
        // Trigger replan logic
        await replanWorkflow(lastAgent.AgentContext);
      }

      // If workflow was modified (re-planned), rebuild the tree and continue loop
      if (workflow.modified) {
        workflow.modified = false;
        // Rebuild tree starting from currently pending agents
        agentTree = buildAgentTree(
          workflow.agents.filter((agent) => agent.status == "init")
        );
        continue;
      }

      // Move to next node in the tree
      if (!agentTree.nextAgent) {
        break;
      }
      agentTree = agentTree.nextAgent;
    }

    const ekoResult: EkoResult = {
      success: true,
      stopReason: "done",
      taskId: context.taskId,
      result: results[results.length - 1] || "",
    };

    // ============ ON WORKFLOW COMPLETE HOOK ============
    if (hooks?.onWorkflowComplete) {
      try {
        await hooks.onWorkflowComplete(context, ekoResult);
      } catch (hookError) {
        Log.error("onWorkflowComplete hook error:", hookError);
      }
    }

    return ekoResult;
  }

  /**
   * Runs a specific agent instance within the workflow.
   * Wraps the agent execution with hooks, error handling, and status updates.
   *
   * @param context - Global execution context.
   * @param agent - The agent implementation instance.
   * @param agentNode - The workflow node definition for this agent.
   * @param agentChain - History tracking for this specific agent run.
   * @returns The text result produced by the agent.
   */
  protected async runAgent(
    context: Context,
    agent: Agent,
    agentNode: NormalAgentNode,
    agentChain: AgentChain
  ): Promise<string> {
    const hooks = this.config.hooks;

    try {
      agentNode.agent.status = "running";

      // Notify callback of agent start
      this.config.callback &&
        (await this.config.callback.onMessage({
          taskId: context.taskId,
          agentName: agentNode.agent.name,
          nodeId: agentNode.agent.id,
          type: "agent_start",
          agentNode: agentNode.agent,
        }));

      // Execute the agent's main logic
      // Note: beforeAgentStart hook is called inside agent.run()
      agentNode.result = await agent.run(context, agentChain);
      agentNode.agent.status = "done";

      // Retrieve local context after execution
      const agentContext = agent.AgentContext;

      // ============ AFTER AGENT COMPLETE HOOK ============
      if (hooks?.afterAgentComplete && agentContext) {
        try {
          const hookResult = await hooks.afterAgentComplete(agentContext, agentNode.result);

          // Allow hook to request a retry of the agent
          if (hookResult?.retry) {
            Log.info(`Retrying agent ${agentNode.agent.name} due to afterAgentComplete hook`);
            agentNode.agent.status = "running";
            return this.runAgent(context, agent, agentNode, agentChain);
          }
        } catch (afterHookError) {
          Log.error("afterAgentComplete hook error:", afterHookError);
          // Suppress hook errors to avoid crashing the workflow
        }
      }

      // ============ WORKFLOW STEP COMPLETE HOOK ============
      if (hooks?.onWorkflowStepComplete) {
        try {
          await hooks.onWorkflowStepComplete(context, agentNode.agent, agentNode.result);
        } catch (stepHookError) {
          Log.error("onWorkflowStepComplete hook error:", stepHookError);
        }
      }

      // Notify callback of success
      this.config.callback &&
        (await this.config.callback.onMessage(
          {
            taskId: context.taskId,
            agentName: agentNode.agent.name,
            nodeId: agentNode.agent.id,
            type: "agent_result",
            agentNode: agentNode.agent,
            result: agentNode.result,
          },
          agent.AgentContext
        ));
      return agentNode.result;
    } catch (e: any) {
      agentNode.agent.status = "error";

      const agentContext = agent.AgentContext;

      // ============ ON AGENT ERROR HOOK ============
      // Allows custom error handling strategies: retry, skip, abort, etc.
      if (hooks?.onAgentError && agentContext) {
        try {
          const errorAction = await hooks.onAgentError(agentContext, e);
          switch (errorAction) {
            case "retry":
              Log.info(`Retrying agent ${agentNode.agent.name} after error`);
              agentNode.agent.status = "init";
              return this.runAgent(context, agent, agentNode, agentChain);
            case "skip":
              agentNode.result = `Skipped due to error: ${e.message}`;
              agentNode.agent.status = "done";
              return agentNode.result;
            case "abort":
              throw e;
            case "escalate":
            case "continue":
            default:
              // Fall through to standard error handling
              break;
          }
        } catch (errorHookError) {
          Log.error("onAgentError hook failed:", errorHookError);
        }
      }

      // Notify callback of error
      this.config.callback &&
        (await this.config.callback.onMessage(
          {
            taskId: context.taskId,
            agentName: agentNode.agent.name,
            nodeId: agentNode.agent.id,
            type: "agent_result",
            agentNode: agentNode.agent,
            error: e,
          },
          agent.AgentContext
        ));
      throw e;
    }
  }

  /**
   * Retrieves an active task context by ID.
   * @param taskId - The task identifier.
   * @returns The task Context or undefined.
   */
  public getTask(taskId: string): Context | undefined {
    return this.taskMap.get(taskId);
  }

  /**
   * Returns a list of all active task IDs managed by this instance.
   * @returns Array of task ID strings.
   */
  public getAllTaskId(): string[] {
    return [...this.taskMap.keys()];
  }

  /**
   * Terminates and removes a task from memory.
   * @param taskId - The task identifier to delete.
   * @returns True if successful, false if task was not found.
   */
  public deleteTask(taskId: string): boolean {
    this.abortTask(taskId);
    const context = this.taskMap.get(taskId);
    if (context) {
      context.variables.clear();
    }
    return this.taskMap.delete(taskId);
  }

  /**
   * Signals a task to abort execution immediately.
   * @param taskId - The task identifier.
   * @param reason - Optional string describing why the task was aborted.
   * @returns True if the task was found and signaled, false otherwise.
   */
  public abortTask(taskId: string, reason?: string): boolean {
    let context = this.taskMap.get(taskId);
    if (context) {
      // Ensure we're not paused so the abort signal is processed
      context.setPause(false);
      this.onTaskStatus(context, "abort", reason);
      context.controller.abort(reason);
      return true;
    } else {
      return false;
    }
  }

  /**
   * Toggles the pause state of a task.
   * @param taskId - The task identifier.
   * @param pause - True to pause, false to resume.
   * @param abortCurrentStep - If pausing, whether to interrupt the currently running step.
   * @param reason - Optional reason for the state change.
   * @returns True if successful.
   */
  public pauseTask(
    taskId: string,
    pause: boolean,
    abortCurrentStep?: boolean,
    reason?: string
  ): boolean {
    const context = this.taskMap.get(taskId);
    if (context) {
      this.onTaskStatus(context, pause ? "pause" : "resume-pause", reason);
      context.setPause(pause, abortCurrentStep);
      return true;
    } else {
      return false;
    }
  }

  /**
   * Injects a user message into the task's conversation stream.
   * Used for human-in-the-loop interaction.
   *
   * @param taskId - The task identifier.
   * @param userPrompt - The text message from the user.
   * @returns The updated conversation array.
   */
  public chatTask(taskId: string, userPrompt: string): string[] | undefined {
    const context = this.taskMap.get(taskId);
    if (context) {
      context.conversation.push(userPrompt);
      return context.conversation;
    }
  }

  /**
   * Dynamically registers a new agent definition to the system.
   * @param agent - The Agent instance to add.
   */
  public addAgent(agent: Agent): void {
    this.config.agents = this.config.agents || [];
    this.config.agents.push(agent);
  }

  /**
   * Helper to propagate status changes to the currently running agent.
   * Allows agents to react to system-level events (pause/abort).
   *
   * @param context - The task context.
   * @param status - The new status string.
   * @param reason - Optional reason.
   */
  private async onTaskStatus(
    context: Context,
    status: string,
    reason?: string
  ) {
    const [agent] = context.currentAgent() || [];
    if (agent) {
      const onTaskStatus = (agent as any)["onTaskStatus"];
      if (onTaskStatus) {
        await onTaskStatus.call(agent, status, reason);
      }
    }
  }
}
