import { JSONSchema7 } from "json-schema";
import { AgentContext } from "../core/context";
import { Tool, ToolResult } from "../types/tools.types";
import { RetryLanguageModel } from "../llm";
import { LLMRequest } from "../types";
import { toImage } from "../common/utils";

/** Tool name identifier for human interaction operations */
export const TOOL_NAME = "human_interact";

/**
 * HumanInteractTool enables human-in-the-loop interactions during workflow execution.
 *
 * This tool allows agents to:
 * - Request user confirmation for potentially dangerous operations
 * - Ask for text input when tasks are ambiguous or need clarification
 * - Present multiple choice selections for decision points
 * - Request human assistance for blocked operations (login, CAPTCHA, etc.)
 *
 * The tool automatically checks login status for authentication requests and
 * integrates with the workflow's callback system for seamless human interaction.
 * It's marked as noPlan=true to prevent being included in automated planning.
 */
export default class HumanInteractTool implements Tool {
  /** Unique tool identifier */
  readonly name: string = TOOL_NAME;
  /** Human-readable description of interaction capabilities */
  readonly description: string;
  /** Prevents this tool from being included in automated workflow planning */
  readonly noPlan: boolean = true;
  /** JSON schema defining accepted parameters and their validation */
  readonly parameters: JSONSchema7;

  constructor() {
    this.description = `AI interacts with humans:
confirm: Ask the user to confirm whether to execute an operation, especially when performing dangerous actions such as deleting system files, users will choose Yes or No.
input: Prompt the user to enter text; for example, when a task is ambiguous, the AI can choose to ask the user for details, and the user can respond by inputting.
select: Allow the user to make a choice; in situations that require selection, the AI can ask the user to make a decision.
request_help: Request assistance from the user; for instance, when an operation is blocked, the AI can ask the user for help, For example, login required, CAPTCHA verification, SMS verification code, QR code scanning, payment operations, etc.`;
    this.parameters = {
      type: "object",
      properties: {
        interactType: {
          type: "string",
          description: "The type of interaction with users.",
          enum: ["confirm", "input", "select", "request_help"],
        },
        prompt: {
          type: "string",
          description: "Display prompts to users",
        },
        selectOptions: {
          type: "array",
          description:
            "Options provided to users, this parameter is required when interactType is select.",
          items: {
            type: "string",
          },
        },
        selectMultiple: {
          type: "boolean",
          description: "isMultiple, used when interactType is select",
        },
        helpType: {
          type: "string",
          description: "Help type, required when interactType is request_help.",
          enum: ["request_login", "request_assistance"],
        },
      },
      required: ["interactType", "prompt"],
    };
  }

  /**
   * Execute human interaction based on the specified interaction type.
   *
   * Routes to appropriate callback methods in the workflow configuration
   * to handle different types of human interactions seamlessly.
   *
   * @param args - Tool arguments specifying interaction type and parameters
   * @param agentContext - Current agent execution context
   * @returns Promise resolving to formatted interaction result
   */
  async execute(
    args: Record<string, unknown>,
    agentContext: AgentContext
  ): Promise<ToolResult> {
    let interactType = args.interactType as string;
    let callback = agentContext.context.config.callback;
    let resultText = "";

    // Route to appropriate human interaction callback based on type
    if (callback) {
      switch (interactType) {
        case "confirm":
          if (callback.onHumanConfirm) {
            let result = await callback.onHumanConfirm(
              agentContext,
              args.prompt as string
            );
            resultText = `confirm result: ${result ? "Yes" : "No"}`;
          }
          break;
        case "input":
          if (callback.onHumanInput) {
            let result = await callback.onHumanInput(
              agentContext,
              args.prompt as string
            );
            resultText = `input result: ${result}`;
          }
          break;
        case "select":
          if (callback.onHumanSelect) {
            let result = await callback.onHumanSelect(
              agentContext,
              args.prompt as string,
              (args.selectOptions || []) as string[],
              (args.selectMultiple || false) as boolean
            );
            resultText = `select result: ${JSON.stringify(result)}`;
          }
          break;
        case "request_help":
          if (callback.onHumanHelp) {
            if (
              args.helpType == "request_login" &&
              (await this.checkIsLogined(agentContext))
            ) {
              resultText = "Already logged in";
              break;
            }
            let result = await callback.onHumanHelp(
              agentContext,
              (args.helpType || "request_assistance") as any,
              args.prompt as string
            );
            resultText = `request_help result: ${
              result ? "Solved" : "Unresolved"
            }`;
          }
          break;
      }
    }
    if (resultText) {
      return {
        content: [
          {
            type: "text",
            text: resultText,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `Error: Unsupported ${interactType} interaction operation`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Automatically check if user is logged in by analyzing a screenshot with AI vision.
   *
   * Uses the agent's screenshot capability and LLM vision analysis to determine
   * login status, avoiding unnecessary human interaction when already authenticated.
   *
   * @param agentContext - Agent context with access to screenshot functionality
   * @returns Promise resolving to true if logged in, false otherwise
   */
  private async checkIsLogined(agentContext: AgentContext) {
    // Check if the agent has screenshot capability (typically browser agents)
    let screenshot = (agentContext.agent as any)["screenshot"];
    if (!screenshot) {
      return false;
    }

    try {
      // Capture current page screenshot
      let imageResult = (await screenshot.call(agentContext.agent, agentContext)) as {
        imageBase64: string;
        imageType: "image/jpeg" | "image/png";
      };

      // Initialize LLM for vision analysis
      let rlm = new RetryLanguageModel(
        agentContext.context.config.llms,
        agentContext.agent.Llms
      );
      rlm.setContext(agentContext);

      // Convert base64 to proper image format for LLM
      let image = toImage(imageResult.imageBase64);

      // Create vision analysis request
      let request: LLMRequest = {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "file",
                data: image,
                mediaType: imageResult.imageType,
              },
              {
                type: "text",
                text: "Check if the current website is logged in. If not logged in, output `NOT_LOGIN`. If logged in, output `LOGGED_IN`. Output directly without explanation.",
              },
            ],
          },
        ],
        abortSignal: agentContext.context.controller.signal,
      };

      // Analyze screenshot with vision-capable LLM
      let result = await rlm.call(request);
      return result.text && result.text.indexOf("LOGGED_IN") > -1;
    } catch (error) {
      console.error("Error auto checking login status:", error);
      return false;
    }
  }
}

export { HumanInteractTool };
