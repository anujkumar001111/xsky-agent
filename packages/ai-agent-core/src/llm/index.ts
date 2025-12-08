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
import { defaultLLMProviderOptions } from "./provider-options";

import { CircuitBreaker } from "./circuit-breaker";

/**
 * A language model that retries on failure.
 */
export class RetryLanguageModel {
  private llms: LLMs;
  private names: string[];
  private stream_first_timeout: number;
  private stream_token_timeout: number;
  private context?: Context;
  private agentContext?: AgentContext;
  private circuitBreaker: CircuitBreaker;

  /**
   * Creates an instance of the RetryLanguageModel.
   * @param llms - The language models to use.
   * @param names - The names of the language models to use.
   * @param stream_first_timeout - The timeout for the first token in a stream.
   * @param stream_token_timeout - The timeout for subsequent tokens in a stream.
   * @param context - The context to use.
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
    if (this.names.indexOf("default") == -1) {
      this.names.push("default");
    }
    this.circuitBreaker = new CircuitBreaker();
  }

  /**
   * Sets the context for the language model.
   * @param context - The context to set.
   */
  setContext(context?: Context | AgentContext) {
    if (!context) {
      this.context = undefined;
      this.agentContext = undefined;
      return;
    }
    this.context = context instanceof Context ? context : context.context;
    this.agentContext = context instanceof AgentContext ? context : undefined;
  }

  /**
   * Calls the language model.
   * @param request - The request to send to the language model.
   * @returns A promise that resolves to the result of the call.
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
   * Generates a response from the language model.
   * @param options - The options for the generation.
   * @returns A promise that resolves to the result of the generation.
   */
  async doGenerate(
    options: LanguageModelV2CallOptions
  ): Promise<GenerateResult> {
    const maxTokens = options.maxOutputTokens;
    const providerOptions = options.providerOptions;
    const names = [...this.names, ...this.names];
    let lastError;
    // Track if we skipped any providers due to open circuit
    let skippedProviders = 0;

    for (let i = 0; i < names.length; i++) {
      const name = names[i];

      // key for circuit breaker includes provider name
      if (this.circuitBreaker.isOpen(name)) {
        Log.warn(`Circuit breaker open for LLM provider: ${name}, skipping`);
        skippedProviders++;
        continue;
      }

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
        let result = (await llm.doGenerate(_options)) as GenerateResult;
        if (Log.isEnableDebug()) {
          Log.debug(
            `LLM nonstream body, name: ${name} => `,
            result.request?.body
          );
        }
        result.llm = name;
        result.llmConfig = llmConfig;
        result.text = result.content.find((c) => c.type === "text")?.text;

        // Success! Record it
        this.circuitBreaker.recordSuccess(name);
        return result;
      } catch (e: any) {
        if (e?.name === "AbortError") {
          throw e; // Abort errors shouldn't trip circuit breaker
        }
        lastError = e;

        // Record failure
        this.circuitBreaker.recordFailure(name);

        if (Log.isEnableInfo()) {
          Log.info(`LLM nonstream request, name: ${name} => `, {
            tools: _options.tools,
            messages: _options.prompt,
          });
        }
        Log.error(`LLM error, name: ${name} => `, e);
      }
    }

    // If we skipped providers and failed to get a result, mention it in error
    if (skippedProviders > 0 && !lastError) {
      return Promise.reject(new Error(`All safe LLM providers are currently unavailable (Circuit Breaker Open)`));
    }

    return Promise.reject(
      lastError ? lastError : new Error("No LLM available")
    );
  }

  /**
   * Calls the language model with a stream.
   * @param request - The request to send to the language model.
   * @returns A promise that resolves to the result of the call.
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
   * Generates a stream from the language model.
   * @param options - The options for the generation.
   * @returns A promise that resolves to the result of the generation.
   */
  async doStream(options: LanguageModelV2CallOptions): Promise<StreamResult> {
    const maxTokens = options.maxOutputTokens;
    const providerOptions = options.providerOptions;
    const names = [...this.names, ...this.names];
    let lastError;
    let skippedProviders = 0;

    for (let i = 0; i < names.length; i++) {
      const name = names[i];

      if (this.circuitBreaker.isOpen(name)) {
        Log.warn(`Circuit breaker open for LLM provider: ${name}, skipping`);
        skippedProviders++;
        continue;
      }

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
        const result = (await call_timeout(
          async () => await llm.doStream({ ..._options, abortSignal: signal }),
          this.stream_first_timeout,
          (e) => {
            controller.abort();
          }
        )) as StreamResult;
        const stream = result.stream;
        const reader = stream.getReader();
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
          continue;
        }
        if (Log.isEnableDebug()) {
          Log.debug(`LLM stream body, name: ${name} => `, result.request?.body);
        }
        let chunk = value as LanguageModelV2StreamPart;
        if (chunk.type == "error") {
          Log.error(`LLM stream error, name: ${name}`, chunk);
          reader.releaseLock();
          this.circuitBreaker.recordFailure(name);
          continue;
        }
        result.llm = name;
        result.llmConfig = llmConfig;
        result.stream = this.streamWrapper([chunk], reader, controller);

        // Success
        this.circuitBreaker.recordSuccess(name);
        return result;
      } catch (e: any) {
        if (e?.name === "AbortError") {
          throw e;
        }
        lastError = e;

        // Record failure
        this.circuitBreaker.recordFailure(name);

        if (Log.isEnableInfo()) {
          Log.info(`LLM stream request, name: ${name} => `, {
            tools: _options.tools,
            messages: _options.prompt,
          });
        }
        Log.error(`LLM error, name: ${name} => `, e);
      }
    }

    if (skippedProviders > 0 && !lastError) {
      return Promise.reject(new Error(`All safe LLM providers are currently unavailable (Circuit Breaker Open)`));
    }

    return Promise.reject(
      lastError ? lastError : new Error("No LLM available")
    );
  }

  private async getLLM(name: string): Promise<LanguageModelV2 | null> {
    const llm = this.llms[name];
    if (!llm) {
      return null;
    }
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
      return llm.provider.languageModel(llm.model);
    }
  }

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
