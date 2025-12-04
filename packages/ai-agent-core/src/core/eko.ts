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
 * The main class for the Eko AI agent.
 */
export class Eko {
  protected config: EkoConfig;
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

    const agentNameMap = agents.reduce((map, item) => {
      map[item.Name] = item;
      return map;
    }, {} as { [key: string]: Agent });
    let agentTree = buildAgentTree(workflow.agents);
    const results: string[] = [];
    while (true) {
      await context.checkAborted();
      let lastAgent: Agent | undefined;
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
        // parallel agent
        const parallelAgents = agentTree.agents;
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
        let agentParallel = context.variables.get("agentParallel");
        if (agentParallel === undefined) {
          agentParallel = config.agentParallel;
        }
        if (agentParallel) {
          // parallel execution
          const parallelResults = await Promise.all(
            parallelAgents.map((agent, index) => doRunAgent(agent, index))
          );
          parallelResults.sort((a, b) => a.index - b.index);
          parallelResults.forEach(({ agentChain }) => {
            context.chain.push(agentChain);
          });
          agent_results = parallelResults.map(({ result }) => result);
        } else {
          // serial execution
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
      context.conversation.splice(0, context.conversation.length);
      if (
        config.expertMode &&
        !workflow.modified &&
        agentTree.nextAgent &&
        lastAgent?.AgentContext &&
        (await checkTaskReplan(lastAgent.AgentContext))
      ) {
        // replan
        await replanWorkflow(lastAgent.AgentContext);
      }
      if (workflow.modified) {
        workflow.modified = false;
        agentTree = buildAgentTree(
          workflow.agents.filter((agent) => agent.status == "init")
        );
        continue;
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

  protected async runAgent(
    context: Context,
    agent: Agent,
    agentNode: NormalAgentNode,
    agentChain: AgentChain
  ): Promise<string> {
    const hooks = this.config.hooks;

    try {
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
      agentNode.agent.status = "error";

      // AgentContext may be available even if agent.run() failed
      const agentContext = agent.AgentContext;

      // ============ ON AGENT ERROR HOOK ============
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
              // Continue with error callback
              break;
          }
        } catch (errorHookError) {
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
