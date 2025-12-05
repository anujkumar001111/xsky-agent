import { JSONSchema7 } from "json-schema";
import { AgentContext } from "../core/context";
import { Tool, ToolResult } from "../types/tools.types";

/** Tool name identifier for variable storage operations */
export const TOOL_NAME = "variable_storage";

/**
 * VariableStorageTool provides persistent key-value storage for workflow state.
 *
 * This tool enables agents to:
 * - Store intermediate results and computed values across workflow steps
 * - Share data between different agents in a workflow
 * - Implement conditional logic based on stored state
 * - Maintain context across long-running or resumable workflows
 *
 * Variables are scoped to the workflow execution context and automatically
 * cleaned up when the workflow completes or is aborted.
 */
export default class VariableStorageTool implements Tool {
  /** Unique tool identifier */
  readonly name: string = TOOL_NAME;
  /** Human-readable description of tool capabilities */
  readonly description: string;
  /** JSON schema defining accepted parameters and their validation */
  readonly parameters: JSONSchema7;

  constructor() {
    this.description = `Used for storing, reading, and retrieving variable data, and maintaining input/output variables in task nodes. When the same variable is stored repeatedly, it will overwrite the previous value.`;
    this.parameters = {
      type: "object",
      properties: {
        operation: {
          type: "string",
          description: "variable storage operation type.",
          enum: ["read_variable", "write_variable", "list_all_variable"],
        },
        name: {
          type: "string",
          description:
            "variable name, required when reading and writing variables, If reading variables, it supports reading multiple variables separated by commas.",
        },
        value: {
          type: "string",
          description: "variable value, required when writing variables",
        },
      },
      required: ["operation"],
    };
  }

  /**
   * Execute variable storage operations based on the requested operation type.
   *
   * @param args - Tool arguments containing operation type and parameters
   * @param agentContext - Current agent execution context with access to workflow variables
   * @returns Promise resolving to tool execution result
   */
  async execute(
    args: Record<string, unknown>,
    agentContext: AgentContext
  ): Promise<ToolResult> {
    let operation = args.operation as string;
    let resultText = "";

    switch (operation) {
      case "read_variable": {
        // Read one or more variables by name, supporting comma-separated lists
        if (!args.name) {
          resultText = "Error: name is required";
        } else {
          let result = {} as any;
          let name = args.name as string;
          // Support reading multiple variables in a single call
          let keys = name.split(",");
          for (let i = 0; i < keys.length; i++) {
            let key = keys[i].trim();
            // Variables return undefined if not set, which is valid
            let value = agentContext.context.variables.get(key);
            result[key] = value;
          }
          resultText = JSON.stringify(result);
        }
        break;
      }
      case "write_variable": {
        // Store a value in workflow variables, overwriting any existing value
        if (!args.name) {
          resultText = "Error: name is required";
          break;
        }
        if (args.value == undefined || args.value === "") {
          resultText = "Error: value is required";
          break;
        }
        let key = args.name as string;
        // Trim whitespace from key for consistency
        agentContext.context.variables.set(key.trim(), args.value);
        resultText = "success";
        break;
      }
      case "list_all_variable": {
        // Return array of all currently defined variable names for inspection
        resultText = JSON.stringify([...agentContext.context.variables.keys()]);
        break;
      }
    }
    return {
      content: [
        {
          type: "text",
          text: resultText || "",
        },
      ],
    };
  }
}

export { VariableStorageTool };
