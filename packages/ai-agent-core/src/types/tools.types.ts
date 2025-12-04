import { JSONSchema7 } from "json-schema";
import { AgentContext } from "../core/context";
import { LanguageModelV2ToolCallPart } from "@ai-sdk/provider";

/**
 * Schema definition for a tool, supporting multiple formats from different providers.
 * Allows defining tools using OpenAI, Anthropic, or generic JSON Schema formats.
 */
export type ToolSchema =
  | {
      /** Tool name identifier */
      name: string;
      /** Optional human-readable description of what the tool does */
      description?: string;
      /** JSON Schema defining the tool's input parameters */
      parameters: JSONSchema7;
    }
  | {
      /** Tool name identifier */
      name: string;
      /** Optional human-readable description of what the tool does */
      description?: string;
      /** JSON Schema defining the tool's input (Anthropic format) */
      input_schema: JSONSchema7;
    }
  | {
      /** Tool name identifier */
      name: string;
      /** Optional human-readable description of what the tool does */
      description?: string;
      /** JSON Schema defining the tool's input (camelCase format) */
      inputSchema: JSONSchema7;
    }
  | {
      /** Discriminator for OpenAI function format */
      type: "function";
      /** Function definition object */
      function: {
        /** Function name identifier */
        name: string;
        /** Optional human-readable description */
        description?: string;
        /** JSON Schema defining the function's parameters */
        parameters: JSONSchema7;
      };
    };

/**
 * Result returned from a tool execution.
 * @property content - Array of content items (text and/or image) representing the tool's output.
 * @property isError - Optional flag indicating if the result represents an error condition.
 * @property extInfo - Optional extended information for passing metadata between tools and handlers.
 */
export type ToolResult = {
  content:
    | [
        {
          type: "text";
          text: string;
        }
      ]
    | [
        {
          type: "image";
          data: string;
          mimeType?: string;
        }
      ]
    | [
        {
          type: "text";
          text: string;
        },
        {
          type: "image";
          data: string;
          mimeType?: string;
        }
      ];
  isError?: boolean;
  extInfo?: Record<string, unknown>;
};

/**
 * Interface for executing a tool with given arguments.
 */
export interface ToolExecuter {
  /**
   * Executes the tool with the provided arguments.
   * @param args - Key-value pairs of arguments matching the tool's parameter schema.
   * @param agentContext - The execution context containing agent state and utilities.
   * @param toolCall - The original tool call from the LLM for reference.
   * @returns A promise resolving to the tool's result.
   */
  execute: (
    args: Record<string, unknown>,
    agentContext: AgentContext,
    toolCall: LanguageModelV2ToolCallPart
  ) => Promise<ToolResult>;
}

/**
 * Complete tool definition including metadata, schema, and execution logic.
 * Extends ToolExecuter with additional metadata for agent planning and parallel execution control.
 */
export interface Tool extends ToolExecuter {
  /** Unique name identifier for the tool */
  readonly name: string;
  /** Human-readable description of what the tool does */
  readonly description?: string;
  /** JSON Schema defining the tool's input parameters */
  readonly parameters: JSONSchema7;
  /** If true, this tool is excluded from workflow planning */
  readonly noPlan?: boolean;
  /** Alternative description used specifically during planning phase */
  readonly planDescription?: string;
  /** If true, multiple calls to this tool can be executed in parallel */
  readonly supportParallelCalls?: boolean;
}
