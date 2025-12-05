import Log from "../common/log";
import Context from "./context";
import { sleep } from "../common/utils";
import { RetryLanguageModel } from "../llm";
import { parseWorkflow } from "../common/xml";
import { LLMRequest } from "../types/llm.types";
import { StreamCallback, Workflow } from "../types/core.types";
import { getPlanSystemPrompt, getPlanUserPrompt } from "../prompt/plan";
import {
  LanguageModelV2Prompt,
  LanguageModelV2StreamPart,
  LanguageModelV2TextPart,
} from "@ai-sdk/provider";

/**
 * @file plan.ts
 * @description Implements the Planner engine for the Eko agent system.
 * The Planner is responsible for translating high-level user tasks into
 * structured executable workflows (XML-based) using Large Language Models.
 *
 * Capabilities:
 * - Generates initial plans from user prompts.
 * - Supports replanning/modification of existing workflows.
 * - Handles streaming LLM responses to provide real-time feedback.
 * - Parses raw LLM output into structured Workflow objects.
 * - Implements retry logic for robustness against LLM failures.
 */

/**
 * The Planner class orchestrates the generation of agent workflows.
 * It interfaces with the LLM to create a sequence of agent actions (the plan)
 * that will accomplish the user's task.
 */
export class Planner {
  private taskId: string;
  private context: Context;
  private callback?: StreamCallback;

  /**
   * Initializes the Planner with the execution context.
   * @param context - The shared execution context containing configuration and state.
   * @param callback - Optional callback for streaming plan generation progress.
   */
  constructor(context: Context, callback?: StreamCallback) {
    this.context = context;
    this.taskId = context.taskId;
    this.callback = callback || context.config.callback;
  }

  /**
   * Generates a new workflow plan based on a user task prompt.
   * Constructs the prompt, calls the LLM, and parses the result.
   *
   * @param taskPrompt - The user's request (string or text part).
   * @param saveHistory - Whether to persist this planning event in the context chain.
   * @returns A promise resolving to the generated Workflow object.
   */
  async plan(
    taskPrompt: string | LanguageModelV2TextPart,
    saveHistory: boolean = true
  ): Promise<Workflow> {
    let taskPromptStr;
    let userPrompt: LanguageModelV2TextPart;

    // Normalize input to ensure we have both string and object representations
    if (typeof taskPrompt === "string") {
      taskPromptStr = taskPrompt;
      userPrompt = {
        type: "text",
        text: getPlanUserPrompt(
          taskPrompt,
          this.context.variables.get("task_website"),
          this.context.variables.get("plan_ext_prompt") // Extensible prompt injection
        ),
      };
    } else {
      userPrompt = taskPrompt;
      taskPromptStr = taskPrompt.text || "";
    }

    // Construct the full prompt context for the LLM
    const messages: LanguageModelV2Prompt = [
      {
        role: "system",
        content: await getPlanSystemPrompt(this.context), // Inject system instructions + agent capabilities
      },
      {
        role: "user",
        content: [userPrompt],
      },
    ];

    return await this.doPlan(taskPromptStr, messages, saveHistory);
  }

  /**
   * Modifies an existing plan based on feedback or new requirements.
   * Leverages the history of the previous plan to provide context to the LLM.
   *
   * @param taskPrompt - The modification instruction.
   * @param saveHistory - Whether to update the plan history.
   * @returns A promise resolving to the updated Workflow.
   */
  async replan(
    taskPrompt: string,
    saveHistory: boolean = true
  ): Promise<Workflow> {
    const chain = this.context.chain;

    // If a previous plan exists, include it in the context for the replan request
    if (chain.planRequest && chain.planResult) {
      const messages: LanguageModelV2Prompt = [
        ...chain.planRequest.messages, // Previous conversation context
        {
          role: "assistant",
          content: [{ type: "text", text: chain.planResult }], // Previous plan output
        },
        {
          role: "user",
          content: [{ type: "text", text: taskPrompt }], // New modification request
        },
      ];
      return await this.doPlan(taskPrompt, messages, saveHistory);
    } else {
      // Fallback to fresh plan generation if no history exists
      return this.plan(taskPrompt, saveHistory);
    }
  }

  /**
   * Internal method to execute the LLM call and stream the plan generation.
   * Handles retry logic, error parsing, and streaming response processing.
   *
   * @param taskPrompt - The task description (for reference).
   * @param messages - The full prompt messages to send to the LLM.
   * @param saveHistory - Whether to save the result to context history.
   * @param retryNum - Current retry attempt count (internal recursion).
   * @returns The parsed Workflow object.
   */
  async doPlan(
    taskPrompt: string,
    messages: LanguageModelV2Prompt,
    saveHistory: boolean,
    retryNum: number = 0
  ): Promise<Workflow> {
    const config = this.context.config;
    // Initialize LLM wrapper with retry capabilities
    const rlm = new RetryLanguageModel(config.llms, config.planLlms);
    rlm.setContext(this.context);

    const request: LLMRequest = {
      maxTokens: 8192,
      temperature: 0.7, // Higher temperature for creative planning
      messages: messages,
      abortSignal: this.context.controller.signal,
    };

    // Execute streaming call
    const result = await rlm.callStream(request);
    const reader = result.stream.getReader();
    let streamText = "";
    let thinkingText = "";

    try {
      // Process the stream
      while (true) {
        await this.context.checkAborted(true);
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        let chunk = value as LanguageModelV2StreamPart;

        if (chunk.type == "error") {
          Log.error("Plan, LLM Error: ", chunk);
          throw new Error("LLM Error: " + chunk.error);
        }

        // Capture "thinking" process if the model supports chain-of-thought
        if (chunk.type == "reasoning-delta") {
          thinkingText += chunk.delta || "";
        }

        // Accumulate the actual plan text
        if (chunk.type == "text-delta") {
          streamText += chunk.delta || "";
        }

        if (chunk.type == "finish") {
          if (chunk.finishReason == "content-filter") {
            throw new Error("LLM error: trigger content filtering violation");
          }
          if (chunk.finishReason == "other") {
            throw new Error("LLM error: terminated due to other reasons");
          }
        }

        // Provide real-time feedback via callback if registered
        if (this.callback) {
          // Attempt to parse partial workflow for live preview
          let workflow = parseWorkflow(
            this.taskId,
            streamText,
            false, // Partial parsing allowed
            thinkingText
          );
          if (workflow) {
            await this.callback.onMessage({
              taskId: this.taskId,
              agentName: "Planer",
              type: "workflow",
              streamDone: false,
              workflow: workflow as Workflow,
            });
          }
        }
      }
    } catch (e: any) {
      // Retry logic for transient failures
      if (retryNum < 3) {
        await sleep(1000);
        return await this.doPlan(taskPrompt, messages, saveHistory, ++retryNum);
      }
      throw e;
    } finally {
      reader.releaseLock();
      if (Log.isEnableInfo()) {
        Log.info("Planner result: \n" + streamText);
      }
    }

    // Persist history for future replanning contexts
    if (saveHistory) {
      const chain = this.context.chain;
      chain.planRequest = request;
      chain.planResult = streamText;
    }

    // Final parse of the complete workflow
    let workflow = parseWorkflow(
      this.taskId,
      streamText,
      true, // Strict parsing
      thinkingText
    ) as Workflow;

    // Notify completion
    if (this.callback) {
      await this.callback.onMessage({
        taskId: this.taskId,
        agentName: "Planer",
        type: "workflow",
        streamDone: true,
        workflow: workflow,
      });
    }

    // Append original prompt to workflow metadata
    if (workflow.taskPrompt) {
      workflow.taskPrompt += "\n" + taskPrompt;
    } else {
      workflow.taskPrompt = taskPrompt;
    }
    workflow.taskPrompt = workflow.taskPrompt.trim();

    return workflow;
  }
}
