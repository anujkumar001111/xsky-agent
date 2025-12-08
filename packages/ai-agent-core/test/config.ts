import dotenv from "dotenv";

dotenv.config();

/**
 * Configuration helper for LLM selection.
 * Implements Dev/Prod separation:
 * - Development: Prefer OpenAI Compatible proxy (cost-effective)
 * - Production: Prefer Official OpenAI API
 */

export const isDev = process.env.NODE_ENV !== "production";

export const LLMConfig = {
    openai: {
        // In dev, use compatible proxy if available, otherwise fall back to official
        apiKey: isDev
            ? process.env.OPENAI_COMPATIBLE_API_KEY || process.env.OPENAI_API_KEY
            : process.env.OPENAI_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY,

        baseURL: isDev
            ? process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.OPENAI_BASE_URL
            : process.env.OPENAI_BASE_URL || process.env.OPENAI_COMPATIBLE_BASE_URL,

        // Default models based on environment
        model: isDev
            ? process.env.OPENAI_COMPATIBLE_MODEL || "gpt-4.1"
            : "gpt-4.1",
    },

    anthropic: {
        apiKey: isDev
            ? process.env.ANTHROPIC_COMPATIBLE_API_KEY || process.env.ANTHROPIC_API_KEY
            : process.env.ANTHROPIC_API_KEY,

        baseURL: isDev
            ? process.env.ANTHROPIC_COMPATIBLE_API_BASE || process.env.ANTHROPIC_BASE_URL
            : process.env.ANTHROPIC_BASE_URL,

        model: isDev
            ? process.env.ANTHROPIC_COMPATIBLE_MODEL || "claude-3-haiku-20240307"
            : "claude-3-5-sonnet-20240620"
    }
};
