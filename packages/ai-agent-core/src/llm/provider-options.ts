/**
 * Shared LLM provider utilities.
 * 
 * This file contains utility functions that are used by both the LLM module
 * and agent modules, extracted here to break circular dependencies.
 */

import { SharedV2ProviderOptions } from "@ai-sdk/provider";

/**
 * Returns the default provider options for the language model.
 * @returns The default provider options.
 */
export function defaultLLMProviderOptions(): SharedV2ProviderOptions {
    return {
        openai: {
            stream_options: {
                include_usage: true,
            },
        },
        openrouter: {
            reasoning: {
                max_tokens: 10,
            },
        },
    };
}

/**
 * Returns the default provider options for messages.
 * @returns The default provider options.
 */
export function defaultMessageProviderOptions(): SharedV2ProviderOptions {
    return {
        anthropic: {
            cacheControl: { type: "ephemeral" },
        },
        bedrock: {
            cachePoint: { type: "default" },
        },
        openrouter: {
            cacheControl: { type: "ephemeral" },
        },
    };
}
