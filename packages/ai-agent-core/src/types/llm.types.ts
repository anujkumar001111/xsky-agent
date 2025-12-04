import {
  ProviderV2,
  LanguageModelV2CallWarning,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LanguageModelV2FunctionTool,
  LanguageModelV2ToolChoice,
  LanguageModelV2Prompt,
  LanguageModelV2CallOptions,
  LanguageModelV2Content,
  SharedV2Headers,
  SharedV2ProviderMetadata,
  LanguageModelV2Usage,
  LanguageModelV2ResponseMetadata,
} from "@ai-sdk/provider";
import Context, { AgentContext } from "../core/context";

/**
 * Supported LLM provider types.
 * Can be a built-in provider string or a custom ProviderV2 implementation.
 */
export type LLMprovider =
  | "deepseek"
  | "openai"
  | "anthropic"
  | "google"
  | "aws"
  | "openrouter"
  | "openai-compatible"
  | ProviderV2;

/**
 * Configuration for a single language model.
 * @property provider - The LLM provider to use (e.g., "openai", "anthropic", "google").
 * @property model - The specific model identifier (e.g., "gpt-4", "claude-3-opus").
 * @property apiKey - API key for authentication, can be a string or async function returning a string.
 * @property config - Optional additional configuration including baseURL, temperature, and other model settings.
 * @property options - Optional provider-specific options passed to the underlying SDK.
 * @property fetch - Optional custom fetch implementation for network requests.
 * @property handler - Optional middleware function to modify request options before sending.
 */
export type LLMConfig = {
  provider: LLMprovider;
  model: string;
  apiKey: string | (() => Promise<string>);
  config?: {
    baseURL?: string | (() => Promise<string>);
    temperature?: number;
    topP?: number;
    topK?: number;
    maxTokens?: number;
    [key: string]: any;
  };
  options?: Record<string, any>;
  fetch?: typeof globalThis.fetch;
  handler?: (options: LanguageModelV2CallOptions, context?: Context, agentContext?: AgentContext) => Promise<LanguageModelV2CallOptions>;
};

/**
 * Map of named LLM configurations.
 * Must include a "default" configuration, with optional additional named configurations.
 * Named configurations can be referenced by agents for specific use cases (e.g., planning, compression).
 */
export type LLMs = {
  default: LLMConfig;
  [key: string]: LLMConfig;
};

/**
 * Result from a non-streaming LLM generation call.
 * @property llm - Name of the LLM configuration that was used.
 * @property llmConfig - The full LLM configuration object that was used.
 * @property text - Extracted text content from the response (convenience field).
 * @property content - Array of content parts returned by the model.
 * @property finishReason - Why the model stopped generating (e.g., "stop", "length", "tool-calls").
 * @property usage - Token usage statistics for the request.
 * @property providerMetadata - Optional provider-specific metadata.
 * @property request - Optional request details including the raw request body.
 * @property response - Optional response metadata including headers and body.
 * @property warnings - Array of warnings generated during the call.
 */
export type GenerateResult = {
  llm: string;
  llmConfig: LLMConfig;
  text?: string;
  content: Array<LanguageModelV2Content>;
  finishReason: LanguageModelV2FinishReason;
  usage: LanguageModelV2Usage;
  providerMetadata?: SharedV2ProviderMetadata;
  request?: {
    body?: unknown;
  };
  response?: LanguageModelV2ResponseMetadata & {
    headers?: SharedV2Headers;
    body?: unknown;
  };
  warnings: Array<LanguageModelV2CallWarning>;
};

/**
 * Result from a streaming LLM generation call.
 * @property llm - Name of the LLM configuration that was used.
 * @property llmConfig - The full LLM configuration object that was used.
 * @property stream - ReadableStream of content parts as they are generated.
 * @property request - Optional request details including the raw request body.
 * @property response - Optional response headers.
 */
export type StreamResult = {
  llm: string;
  llmConfig: LLMConfig;
  stream: ReadableStream<LanguageModelV2StreamPart>;
  request?: {
    body?: unknown;
  };
  response?: {
    headers?: SharedV2Headers;
  };
};

/**
 * Request parameters for an LLM call.
 * @property maxTokens - Optional maximum number of tokens to generate.
 * @property messages - The conversation messages to send to the model.
 * @property toolChoice - Optional specification of how the model should use tools.
 * @property tools - Optional array of function tools available to the model.
 * @property temperature - Optional sampling temperature (0-2, higher = more random).
 * @property topP - Optional nucleus sampling parameter.
 * @property topK - Optional top-k sampling parameter.
 * @property stopSequences - Optional array of sequences that stop generation.
 * @property abortSignal - Optional AbortSignal to cancel the request.
 */
export type LLMRequest = {
  maxTokens?: number;
  messages: LanguageModelV2Prompt;
  toolChoice?: LanguageModelV2ToolChoice;
  tools?: Array<LanguageModelV2FunctionTool>;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  abortSignal?: AbortSignal;
};
