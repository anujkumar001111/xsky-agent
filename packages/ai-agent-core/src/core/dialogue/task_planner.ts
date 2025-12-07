import { JSONSchema7 } from "json-schema";
import { XSky } from "../xsky";
import { XSkyDialogue } from "../dialogue";
import { DialogueParams, DialogueTool, ToolResult } from "../../types";

export const TOOL_NAME = "taskPlanner";

/**
 * A tool for planning tasks.
 */
export default class TaskPlannerTool implements DialogueTool {
  readonly name: string = TOOL_NAME;
  readonly description: string;
  readonly parameters: JSONSchema7;
  private xskyDialogue: XSkyDialogue;
  private params: DialogueParams;

  /**
   * Creates an instance of the TaskPlannerTool.
   * @param xskyDialogue - The XSkyDialogue instance to use.
   * @param params - The parameters for the dialogue.
   */
  constructor(xskyDialogue: XSkyDialogue, params: DialogueParams) {
    const agents = xskyDialogue.getConfig().agents || [];
    const agentNames = agents.map((agent) => agent.Name).join(", ");
    this.description = `Used for task planning, this tool is only responsible for generating task plans, not executing them, the following agents are available: ${agentNames}...`;
    this.parameters = {
      type: "object",
      properties: {
        taskDescription: {
          type: "string",
          description:
            "Task description, Do not omit any information from the user's question, maintain the task as close to the user's input as possible, and use the same language as the user's question.",
        },
        oldTaskId: {
          type: "string",
          description:
            "Previous task ID, modifications based on the previously planned task.",
        },
      },
      required: ["taskDescription"],
    };
    this.params = params;
    this.xskyDialogue = xskyDialogue;
  }

  /**
   * Executes the tool.
   * @param args - The arguments for the tool.
   * @returns A promise that resolves to the result of the tool.
   */
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const taskDescription = args.taskDescription as string;
    const oldTaskId = args.oldTaskId as string;
    if (oldTaskId) {
      const xsky = this.xskyDialogue.getXSky(oldTaskId);
      if (xsky) {
        // modify the old action plan
        const workflow = await xsky.modify(oldTaskId, taskDescription);
        const taskPlan = workflow.xml;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                taskId: oldTaskId,
                taskPlan: taskPlan,
              }),
            },
          ],
        };
      }
    }
    // generate a new action plan
    const taskId = this.params.messageId as string;
    const xsky = new XSky({
      ...this.xskyDialogue.getConfig(),
      callback: this.params.callback?.taskCallback,
    });
    const workflow = await xsky.generate(
      taskDescription,
      taskId,
      this.xskyDialogue.getGlobalContext()
    );
    this.xskyDialogue.addXSky(taskId, xsky);
    const taskPlan = workflow.xml;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            taskId: taskId,
            taskPlan: taskPlan,
          }),
        },
      ],
    };
  }
}

export { TaskPlannerTool as ActionPlannerTool };
