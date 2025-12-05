import {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2StreamPart,
} from "@ai-sdk/provider";
import Log from "../common/log";
import config from "../config";
import { createOpenAI } from "@ai-sdk/openai";
import { call_timeout } from "../common/utils";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createDeepSeek } from "@ai-sdk/deepseek";
import {
  LLMs,
  LLMRequest,
  StreamResult,
  GenerateResult,
} from "../types/llm.types";
import Context, { AgentContext } from "../core/context";
import { defaultLLMProviderOptions } from "../agent/llm";

/**
 * @file index.ts
 * @description Provides a unified interface for interacting with various Large Language Models (LLMs)
 * with built-in reliability features.
 *
 * Architecture:
 * - Implements a "Retry" wrapper pattern around the standard LLM provider SDKs.
 * - Supports multiple providers (OpenAI, Anthropic, Google, AWS, etc.) via a common configuration.
 * - Handles streaming responses with timeout protection.
 * - Implements failover logic by rotating through configured models on error.
 */

/**
 * A wrapper around LanguageModelV2 that adds retry logic, failover, and timeout management.
 * Acts as the primary gateway for all LLM interactions in the system.
 */
export class RetryLanguageModel {
  private llms: LLMs;
  private names: string[];
  private stream_first_timeout: number;
  private stream_token_timeout: number;
  private context?: Context;
  private agentContext?: AgentContext;

  /**
   * Initializes the reliable LLM wrapper.
   * @param llms - Dictionary of available LLM configurations.
   * @param names - Ordered list of model names to try (failover chain).
   * @param stream_first_timeout - Max time to wait for the first token (default 30s).
   * @param stream_token_timeout - Max time to wait between tokens (default 180s).
   * @param context - Execution context for logging and state access.
   */
  constructor(
    llms: LLMs,
    names?: string[],
    stream_first_timeout?: number,
    stream_token_timeout?: number,
    context?: Context | AgentContext,
  ) {
    this.llms = llms;
    this.names = names || [];
    context && this.setContext(context);
    this.stream_first_timeout = stream_first_timeout || 30_000;
    this.stream_token_timeout = stream_token_timeout || 180_000;

    // Ensure 'default' configuration is always available as a fallback
    if (this.names.indexOf("default") == -1) {
      this.names.push("default");
    }
  }

  /**
   * Updates the execution context reference.
   * @param context - The new context (global or agent-specific).
   */
  setContext(context?: Context | AgentContext) {
    if (!context) {
      this.context = undefined;
      this.agentContext = undefined;
      return;
    }
    // Unwrap context if it's an AgentContext
    this.context = context instanceof Context ? context : context.context;
    this.agentContext = context instanceof AgentContext ? context : undefined;
  }

  /**
   * Performs a non-streaming LLM call with retry capability.
   * @param request - Standardized LLM request parameters.
   * @returns Promise resolving to the generated text/content.
   */
  async call(request: LLMRequest): Promise<GenerateResult> {
    return await this.doGenerate({
      prompt: request.messages,
      tools: request.tools,
      toolChoice: request.toolChoice,
      maxOutputTokens: request.maxTokens,
      temperature: request.temperature,
      topP: request.topP,
      topK: request.topK,
      stopSequences: request.stopSequences,
      abortSignal: request.abortSignal,
    });
  }

  /**
   * Internal execution logic for non-streaming calls.
   * Iterates through the configured model list (`names`) until a successful response is obtained.
   *
   * @param options - Low-level generation options.
   * @returns The generation result.
   */
  async doGenerate(
    options: LanguageModelV2CallOptions
  ): Promise<GenerateResult> {
    const maxTokens = options.maxOutputTokens;
    const providerOptions = options.providerOptions;
    // Duplicate names to allow for a second pass retry on the same models
    const names = [...this.names, ...this.names];
    let lastError;

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const llmConfig = this.llms[name];
      const llm = await this.getLLM(name);

      if (!llm) {
        continue;
      }

      // Merge defaults if not explicitly provided
      if (!maxTokens) {
        options.maxOutputTokens =
          llmConfig.config?.maxTokens || config.maxTokens;
      }
      if (!providerOptions) {
        options.providerOptions = defaultLLMProviderOptions();
        options.providerOptions[llm.provider] = llmConfig.options || {};
      }

      // Apply optional request middleware (handler)
      let _options = options;
      if (llmConfig.handler) {
        _options = await llmConfig.handler(_options, this.context, this.agentContext);
      }

      try {
        let result = (await llm.doGenerate(_options)) as GenerateResult;

        if (Log.isEnableDebug()) {
          Log.debug(
            `LLM nonstream body, name: ${name} => `,
            result.request?.body
          );
        }

        // Augment result with metadata
        result.llm = name;
        result.llmConfig = llmConfig;
        result.text = result.content.find((c) => c.type === "text")?.text;
        return result;
      } catch (e: any) {
        // Don't retry if the operation was explicitly aborted by the user
        if (e?.name === "AbortError") {
          throw e;
        }

        lastError = e;
        if (Log.isEnableInfo()) {
          Log.info(`LLM nonstream request, name: ${name} => `, {
            tools: _options.tools,
            messages: _options.prompt,
          });
        }
        Log.error(`LLM error, name: ${name} => `, e);
        // Loop continues to next model in chain
      }
    }

    return Promise.reject(
      lastError ? lastError : new Error("No LLM available")
    );
  }

  /**
   * Performs a streaming LLM call with retry capability.
   * @param request - Standardized LLM request parameters.
   * @returns Promise resolving to the stream result.
   */
  async callStream(request: LLMRequest): Promise<StreamResult> {
    return await this.doStream({
      prompt: request.messages,
      tools: request.tools,
      toolChoice: request.toolChoice,
      maxOutputTokens: request.maxTokens,
      temperature: request.temperature,
      topP: request.topP,
      topK: request.topK,
      stopSequences: request.stopSequences,
      abortSignal: request.abortSignal,
    });
  }

  /**
   * Internal execution logic for streaming calls.
   * Wraps the stream with a timeout monitor to detect hung connections.
   *
   * @param options - Low-level generation options.
   * @returns The stream result.
   */
  async doStream(options: LanguageModelV2CallOptions): Promise<StreamResult> {
    const maxTokens = options.maxOutputTokens;
    const providerOptions = options.providerOptions;
    const names = [...this.names, ...this.names];
    let lastError;

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const llmConfig = this.llms[name];
      const llm = await this.getLLM(name);

      if (!llm) {
        continue;
      }

      if (!maxTokens) {
        options.maxOutputTokens =
          llmConfig.config?.maxTokens || config.maxTokens;
      }
      if (!providerOptions) {
        options.providerOptions = defaultLLMProviderOptions();
        options.providerOptions[llm.provider] = llmConfig.options || {};
      }

      let _options = options;
      if (llmConfig.handler) {
        _options = await llmConfig.handler(_options, this.context, this.agentContext);
      }

      try {
        const controller = new AbortController();
        const signal = _options.abortSignal
          ? AbortSignal.any([_options.abortSignal, controller.signal])
          : controller.signal;

        // Execute stream request with "Time-to-First-Token" timeout
        const result = (await call_timeout(
          async () => await llm.doStream({ ..._options, abortSignal: signal }),
          this.stream_first_timeout,
          (e) => {
            controller.abort();
          }
        )) as StreamResult;

        const stream = result.stream;
        const reader = stream.getReader();

        // Read the first chunk to ensure stream is actually alive
        const { done, value } = await call_timeout(
          async () => await reader.read(),
          this.stream_first_timeout,
          (e) => {
            reader.cancel();
            reader.releaseLock();
            controller.abort();
          }
        );

        if (done) {
          Log.warn(`LLM stream done, name: ${name} => `, { done, value });
          reader.releaseLock();
          continue; // Empty stream, try next provider
        }

        if (Log.isEnableDebug()) {
          Log.debug(`LLM stream body, name: ${name} => `, result.request?.body);
        }

        let chunk = value as LanguageModelV2StreamPart;
        if (chunk.type == "error") {
          Log.error(`LLM stream error, name: ${name}`, chunk);
          reader.releaseLock();
          continue;
        }

        result.llm = name;
        result.llmConfig = llmConfig;

        // Wrap the verified stream to handle subsequent timeouts
        result.stream = this.streamWrapper([chunk], reader, controller);
        return result;

      } catch (e: any) {
        if (e?.name === "AbortError") {
          throw e;
        }
        lastError = e;
        if (Log.isEnableInfo()) {
          Log.info(`LLM stream request, name: ${name} => `, {
            tools: _options.tools,
            messages: _options.prompt,
          });
        }
        Log.error(`LLM error, name: ${name} => `, e);
      }
    }
    return Promise.reject(
      lastError ? lastError : new Error("No LLM available")
    );
  }

  /**
   * Factory method to instantiate specific provider SDKs based on configuration.
   * Supports OpenAI, Anthropic, Google, AWS, OpenRouter, and compatible APIs.
   *
   * @param name - Configuration key for the LLM.
   * @returns Configured LanguageModel instance or null.
   */
  private async getLLM(name: string): Promise<LanguageModelV2 | null> {
    const llm = this.llms[name];
    if (!llm) {
      return null;
    }

    // Resolve potentially async API keys and Base URLs
    let apiKey;
    if (typeof llm.apiKey === "string") {
      apiKey = llm.apiKey;
    } else {
      apiKey = await llm.apiKey();
    }

    let baseURL = undefined;
    if (llm.config?.baseURL) {
      if (typeof llm.config.baseURL === "string") {
        baseURL = llm.config.baseURL;
      } else {
        baseURL = await llm.config.baseURL();
      }
    }

    // Provider-specific instantiation logic
    if (llm.provider == "openai") {
      if (
        !baseURL ||
        baseURL.indexOf("openai.com") > -1 ||
        llm.config?.organization ||
        llm.config?.openai
      ) {
        return createOpenAI({
          apiKey: apiKey,
          baseURL: baseURL,
          fetch: llm.fetch,
          organization: llm.config?.organization,
          project: llm.config?.project,
          headers: llm.config?.headers,
        }).languageModel(llm.model);
      } else {
        // Fallback to generic compatible provider if non-standard URL
        return createOpenAICompatible({
          name: llm.model,
          apiKey: apiKey,
          baseURL: baseURL,
          fetch: llm.fetch,
          headers: llm.config?.headers,
        }).languageModel(llm.model);
      }
    } else if (llm.provider == "anthropic") {
      return createAnthropic({
        apiKey: apiKey,
        baseURL: baseURL,
        fetch: llm.fetch,
        headers: llm.config?.headers,
      }).languageModel(llm.model);
    } else if (llm.provider == "google") {
      return createGoogleGenerativeAI({
        apiKey: apiKey,
        baseURL: baseURL,
        fetch: llm.fetch,
        headers: llm.config?.headers,
      }).languageModel(llm.model);
    } else if (llm.provider == "aws") {
      let keys = apiKey.split("=");
      return createAmazonBedrock({
        accessKeyId: keys[0],
        secretAccessKey: keys[1],
        baseURL: baseURL,
        region: llm.config?.region || "us-west-1",
        fetch: llm.fetch,
        headers: llm.config?.headers,
        sessionToken: llm.config?.sessionToken,
      }).languageModel(llm.model);
    } else if (llm.provider == "openai-compatible") {
      return createOpenAICompatible({
        name: llm.config?.name || llm.model.split("/")[0],
        apiKey: apiKey,
        baseURL: baseURL || "https://openrouter.ai/api/v1",
        fetch: llm.fetch,
        headers: llm.config?.headers,
      }).languageModel(llm.model);
    } else if (llm.provider == "openrouter") {
      return createOpenRouter({
        apiKey: apiKey,
        baseURL: baseURL || "https://openrouter.ai/api/v1",
        fetch: llm.fetch,
        headers: llm.config?.headers,
        compatibility: llm.config?.compatibility,
      }).languageModel(llm.model);
    } else if (llm.provider == "deepseek") {
      return createDeepSeek({
        apiKey: apiKey,
        baseURL: baseURL,
        fetch: llm.fetch,
        headers: llm.config?.headers,
      }).languageModel(llm.model);
    } else {
      // Support custom provider instances
      return llm.provider.languageModel(llm.model);
    }
  }

  /**
   * Wraps an underlying stream to enforce a timeout between chunks.
   * Recreates the readable stream to allow injecting the already-read initial chunk.
   *
   * @param parts - Initial chunks already read.
   * @param reader - The active stream reader.
   * @param abortController - Controller to signal timeout.
   */
  private streamWrapper(
    parts: LanguageModelV2StreamPart[],
    reader: ReadableStreamDefaultReader<LanguageModelV2StreamPart>,
    abortController: AbortController
  ): ReadableStream<LanguageModelV2StreamPart> {
    let timer: any = null;
    return new ReadableStream<LanguageModelV2StreamPart>({
      start: (controller) => {
        if (parts != null && parts.length > 0) {
          for (let i = 0; i < parts.length; i++) {
            controller.enqueue(parts[i]);
          }
        }
      },
      pull: async (controller) => {
        // Set watchdog timer for next chunk
        timer = setTimeout(() => {
          abortController.abort("Streaming request timeout");
        }, this.stream_token_timeout);

        const { done, value } = await reader.read();
        clearTimeout(timer);

        if (done) {
          controller.close();
          reader.releaseLock();
          return;
        }
        controller.enqueue(value);
      },
      cancel: (reason) => {
        timer && clearTimeout(timer);
        reader.cancel(reason);
      },
    });
  }

  public get Llms(): LLMs {
    return this.llms;
  }

  public get Names(): string[] {
    return this.names;
  }
}
