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
 * The main orchestrator class for the XSky AI Agent Framework.
 *
 * Eko manages the lifecycle of AI agent workflows, coordinating multiple specialized agents
 * (BrowserAgent, FileAgent, etc.) to accomplish complex tasks. It handles workflow planning,
 * execution, error recovery, and provides hooks for production-ready features like rate limiting,
 * security sandboxing, and human-in-the-loop interactions.
 *
 * Key responsibilities:
 * - Workflow generation from natural language prompts using LLM planning
 * - Parallel and sequential agent execution with dependency management
 * - State persistence and task resumption capabilities
 * - Streaming callbacks for real-time execution monitoring
 * - Error handling with retry, skip, and escalation strategies
 * - Integration with external MCP (Model Context Protocol) tools
 * - Agent-to-Agent communication for distributed workflows
 */
export class Eko {
  /** Configuration object containing LLM settings, registered agents, and production hooks */
  protected config: EkoConfig;
  /** Map storing active task contexts indexed by task ID for concurrent workflow execution */
  protected taskMap: Map<string, Context>;

  /**
   * Creates an instance of the Eko class.
   * @param config - The configuration for the Eko instance.
   */
  constructor(config: EkoConfig) {
    this.config = config;
    this.taskMap = new Map();
  }

  /**
   * Generates a workflow for a given task prompt.
   * @param taskPrompt - The prompt for the task.
   * @param taskId - The ID of the task.
   * @param contextParams - Additional parameters for the context.
   * @returns A promise that resolves to the generated workflow.
   */
  public async generate(
    taskPrompt: string,
    taskId: string = uuidv4(),
    contextParams?: Record<string, any>
  ): Promise<Workflow> {
    const agents = [...(this.config.agents || [])];
    const chain: Chain = new Chain(taskPrompt);
    const context = new Context(taskId, this.config, agents, chain);
    if (contextParams) {
      Object.keys(contextParams).forEach((key) =>
        context.variables.set(key, contextParams[key])
      );
    }
    try {
      this.taskMap.set(taskId, context);
      if (this.config.a2aClient) {
        const a2aList = await this.config.a2aClient.listAgents(taskPrompt);
        context.agents = mergeAgents(context.agents, a2aList);
      }
      const planner = new Planner(context);
      context.workflow = await planner.plan(taskPrompt);
      return context.workflow;
    } catch (e) {
      this.deleteTask(taskId);
      throw e;
    }
  }

  /**
   * Modifies a workflow for a given task ID and prompt.
   * @param taskId - The ID of the task to modify.
   * @param modifyTaskPrompt - The new prompt for the task.
   * @returns A promise that resolves to the modified workflow.
   */
  public async modify(
    taskId: string,
    modifyTaskPrompt: string
  ): Promise<Workflow> {
    const context = this.taskMap.get(taskId);
    if (!context) {
      return await this.generate(modifyTaskPrompt, taskId);
    }
    if (this.config.a2aClient) {
      const a2aList = await this.config.a2aClient.listAgents(modifyTaskPrompt);
      context.agents = mergeAgents(context.agents, a2aList);
    }
    const planner = new Planner(context);
    context.workflow = await planner.replan(modifyTaskPrompt);
    return context.workflow;
  }

  /**
   * Executes a workflow for a given task ID.
   * @param taskId - The ID of the task to execute.
   * @returns A promise that resolves to the result of the execution.
   */
  public async execute(taskId: string): Promise<EkoResult> {
    const context = this.getTask(taskId);
    if (!context) {
      throw new Error("The task does not exist");
    }
    if (context.pause) {
      context.setPause(false);
    }
    if (context.controller.signal.aborted) {
      context.reset();
    }
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
   * Generates and executes a workflow for a given task prompt.
   * @param taskPrompt - The prompt for the task.
   * @param taskId - The ID of the task.
   * @param contextParams - Additional parameters for the context.
   * @returns A promise that resolves to the result of the execution.
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
   * Initializes a context for a given workflow.
   * @param workflow - The workflow to initialize the context for.
   * @param contextParams - Additional parameters for the context.
   * @returns A promise that resolves to the initialized context.
   */
  public async initContext(
    workflow: Workflow,
    contextParams?: Record<string, any>
  ): Promise<Context> {
    const agents = this.config.agents || [];
    const chain: Chain = new Chain(workflow.taskPrompt || workflow.name);
    const context = new Context(workflow.taskId, this.config, agents, chain);
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
   * Executes a workflow by traversing the agent execution tree and running agents sequentially or in parallel.
   *
   * This method implements the core workflow execution algorithm:
   * 1. Builds an execution tree from workflow agents with dependency resolution
   * 2. Executes agents in topological order (respecting dependsOn relationships)
   * 3. Supports parallel execution of independent agents when agentParallel is enabled
   * 4. Handles dynamic replanning when agents detect task changes in expert mode
   * 5. Provides comprehensive error handling and recovery through hooks
   *
   * @param context - The execution context containing workflow, agents, and state
   * @returns Promise resolving to execution result with success status and final output
   */
  private async doRunWorkflow(context: Context): Promise<EkoResult> {
    const hooks = this.config.hooks;
    const agents = context.agents as Agent[];
    const workflow = context.workflow as Workflow;

    // Validate workflow has at least one agent to execute
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

    // Create lookup map for O(1) agent resolution by name during execution
    const agentNameMap = agents.reduce((map, item) => {
      map[item.Name] = item;
      return map;
    }, {} as { [key: string]: Agent });

    // Build execution tree from workflow agents, resolving dependencies into sequential/parallel structure
    let agentTree = buildAgentTree(workflow.agents);
    const results: string[] = [];

    // Main execution loop: traverse agent tree until all agents complete
    while (true) {
      await context.checkAborted(); // Check for user cancellation or pause requests
      let lastAgent: Agent | undefined;

      // Execute single agent node
      if (agentTree.type === "normal") {
        // normal agent
        const agent = agentNameMap[agentTree.agent.name];
        if (!agent) {
          throw new Error("Unknown Agent: " + agentTree.agent.name);
        }
        lastAgent = agent;
        const agentNode = agentTree.agent;
        const agentChain = new AgentChain(agentNode);
        context.chain.push(agentChain);
        agentTree.result = await this.runAgent(
          context,
          agent,
          agentTree,
          agentChain
        );
        results.push(agentTree.result);
      } else {
        // Execute parallel agent group - multiple independent agents that can run concurrently
        const parallelAgents = agentTree.agents;

        // Helper function to execute a single agent in the parallel group
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
          // Note: agentChain added to context later to prevent race conditions in parallel execution
          const result = await this.runAgent(
            context,
            agent,
            agentNode,
            agentChain
          );
          return { result: result, agentChain, index };
        };

        let agent_results: string[] = [];

        // Check if parallel execution is enabled (can be overridden per task via context variables)
        let agentParallel = context.variables.get("agentParallel");
        if (agentParallel === undefined) {
          agentParallel = config.agentParallel; // Use global config default
        }

        if (agentParallel) {
          // Execute all parallel agents concurrently using Promise.all for maximum throughput
          const parallelResults = await Promise.all(
            parallelAgents.map((agent, index) => doRunAgent(agent, index))
          );
          // Sort results back to original order and add agent chains to execution history
          parallelResults.sort((a, b) => a.index - b.index);
          parallelResults.forEach(({ agentChain }) => {
            context.chain.push(agentChain);
          });
          agent_results = parallelResults.map(({ result }) => result);
        } else {
          // Execute agents sequentially when parallel execution is disabled
          for (let i = 0; i < parallelAgents.length; i++) {
            const { result, agentChain } = await doRunAgent(
              parallelAgents[i],
              i
            );
            context.chain.push(agentChain);
            agent_results.push(result);
          }
        }

        // Combine all parallel agent results with double newlines for readability
        results.push(agent_results.join("\n\n"));
      }
      // Clear conversation history after each agent completes to prevent context pollution
      context.conversation.splice(0, context.conversation.length);

      // Expert mode: dynamically replan workflow if agent detects significant task changes
      // This enables adaptive workflows that can adjust strategy based on execution results
      if (
        config.expertMode && // Expert mode must be enabled globally
        !workflow.modified && // Don't replan if already modified
        agentTree.nextAgent && // Only replan if more agents remain
        lastAgent?.AgentContext && // Agent must have execution context
        (await checkTaskReplan(lastAgent.AgentContext)) // Agent signals replanning needed
      ) {
        await replanWorkflow(lastAgent.AgentContext);
      }

      // Handle workflow modifications from replanning or external changes
      if (workflow.modified) {
        workflow.modified = false; // Reset modification flag
        // Rebuild execution tree with only unstarted agents, effectively restarting from current point
        agentTree = buildAgentTree(
          workflow.agents.filter((agent) => agent.status == "init")
        );
        continue; // Restart execution loop with new plan
      }
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
   * Executes a single agent within the workflow, handling lifecycle hooks, error recovery, and callbacks.
   *
   * This method manages the complete agent execution lifecycle:
   * 1. Updates agent status and sends execution start callbacks
   * 2. Executes the agent with its specific tools and logic
   * 3. Applies post-execution hooks for validation and retry logic
   * 4. Handles errors with configurable recovery strategies (retry/skip/abort/escalate)
   * 5. Sends completion or error callbacks to track execution progress
   *
   * @param context - The workflow execution context
   * @param agent - The agent instance to execute
   * @param agentNode - The workflow node containing agent configuration
   * @param agentChain - Execution chain for tracking agent steps and results
   * @returns Promise resolving to the agent's execution result string
   */
  protected async runAgent(
    context: Context,
    agent: Agent,
    agentNode: NormalAgentNode,
    agentChain: AgentChain
  ): Promise<string> {
    const hooks = this.config.hooks;

    try {
      // Mark agent as actively running for status tracking and UI updates
      agentNode.agent.status = "running";

      // Note: beforeAgentStart hook is called inside agent.run() where AgentContext is available

      this.config.callback &&
        (await this.config.callback.onMessage({
          taskId: context.taskId,
          agentName: agentNode.agent.name,
          nodeId: agentNode.agent.id,
          type: "agent_start",
          agentNode: agentNode.agent,
        }));

      agentNode.result = await agent.run(context, agentChain);
      agentNode.agent.status = "done";

      // AgentContext is now available after agent.run()
      const agentContext = agent.AgentContext;

      // ============ AFTER AGENT COMPLETE HOOK ============
      if (hooks?.afterAgentComplete && agentContext) {
        try {
          const hookResult = await hooks.afterAgentComplete(agentContext, agentNode.result);
          if (hookResult?.retry) {
            Log.info(`Retrying agent ${agentNode.agent.name} due to afterAgentComplete hook`);
            agentNode.agent.status = "running";
            return this.runAgent(context, agent, agentNode, agentChain);
          }
        } catch (afterHookError) {
          Log.error("afterAgentComplete hook error:", afterHookError);
          // Don't fail if hook fails
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
      // Mark agent as failed for status tracking
      agentNode.agent.status = "error";

      // AgentContext may still be available even after failure, useful for error analysis
      const agentContext = agent.AgentContext;

      // ============ ON AGENT ERROR HOOK ============
      // Allow production hooks to implement custom error recovery strategies
      if (hooks?.onAgentError && agentContext) {
        try {
          const errorAction = await hooks.onAgentError(agentContext, e);
          switch (errorAction) {
            case "retry":
              // Reset agent status and retry execution - useful for transient failures
              Log.info(`Retrying agent ${agentNode.agent.name} after error`);
              agentNode.agent.status = "init";
              return this.runAgent(context, agent, agentNode, agentChain);
            case "skip":
              // Mark as completed with error message - allows workflow to continue despite failure
              agentNode.result = `Skipped due to error: ${e.message}`;
              agentNode.agent.status = "done";
              return agentNode.result;
            case "abort":
              // Immediately terminate workflow execution
              throw e;
            case "escalate":
            case "continue":
            default:
              // Continue with normal error handling and callbacks
              break;
          }
        } catch (errorHookError) {
          // Log hook failures but don't let them break error handling
          Log.error("onAgentError hook failed:", errorHookError);
        }
      }

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
   * Gets a task by its ID.
   * @param taskId - The ID of the task to get.
   * @returns The context for the task, or undefined if the task is not found.
   */
  public getTask(taskId: string): Context | undefined {
    return this.taskMap.get(taskId);
  }

  /**
   * Gets all task IDs.
   * @returns A list of all task IDs.
   */
  public getAllTaskId(): string[] {
    return [...this.taskMap.keys()];
  }

  /**
   * Deletes a task by its ID.
   * @param taskId - The ID of the task to delete.
   * @returns True if the task was deleted, false otherwise.
   */
  public deleteTask(taskId: string): boolean {
    this.abortTask(taskId);
    const context = this.taskMap.get(taskId);
    if (context) {
      context.variables.clear();
      context.reset();
    }
    return this.taskMap.delete(taskId);
  }

  /**
   * Aborts a task by its ID.
   * @param taskId - The ID of the task to abort.
   * @param reason - The reason for aborting the task.
   * @returns True if the task was aborted, false otherwise.
   */
  public abortTask(taskId: string, reason?: string): boolean {
    let context = this.taskMap.get(taskId);
    if (context) {
      context.setPause(false);
      this.onTaskStatus(context, "abort", reason);
      context.controller.abort(reason);
      return true;
    } else {
      return false;
    }
  }

  /**
   * Pauses or resumes a task by its ID.
   * @param taskId - The ID of the task to pause or resume.
   * @param pause - Whether to pause or resume the task.
   * @param abortCurrentStep - Whether to abort the current step when pausing.
   * @param reason - The reason for pausing or resuming the task.
   * @returns True if the task was paused or resumed, false otherwise.
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
   * Sends a chat message to a task.
   * @param taskId - The ID of the task to send the message to.
   * @param userPrompt - The message to send.
   * @returns The conversation history, or undefined if the task is not found.
   */
  public chatTask(taskId: string, userPrompt: string): string[] | undefined {
    const context = this.taskMap.get(taskId);
    if (context) {
      context.conversation.push(userPrompt);
      return context.conversation;
    }
  }

  /**
   * Adds an agent to the configuration.
   * @param agent - The agent to add.
   */
  public addAgent(agent: Agent): void {
    this.config.agents = this.config.agents || [];
    this.config.agents.push(agent);
  }

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
