---
name: LLM Integration
description: This skill should be used when the user asks about "LLM providers", "model configuration", "streaming", "prompts", "token optimization", "AI SDK", or needs to work with language model integration in XSky.
version: 1.0.0
---

# LLM Integration in XSky

This skill provides knowledge for LLM provider integration in XSky.

## Supported Providers

| Provider | Package | Models |
|----------|---------|--------|
| OpenAI | @ai-sdk/openai | gpt-4o, gpt-4o-mini, gpt-3.5-turbo |
| Anthropic | @ai-sdk/anthropic | claude-3-opus, claude-3-sonnet, claude-3-haiku |
| Google | @ai-sdk/google | gemini-pro, gemini-1.5-pro |
| AWS Bedrock | @ai-sdk/amazon-bedrock | Various |
| OpenRouter | @openrouter/ai-sdk-provider | Multiple providers |
| DeepSeek | @ai-sdk/deepseek | deepseek-chat |
| OpenAI-compatible | @ai-sdk/openai-compatible | Custom endpoints |

## Configuration

```typescript
const eko = new Eko({
  llms: {
    default: {
      provider: "openai",
      model: "gpt-4o",
      apiKey: process.env.OPENAI_API_KEY,
      config: {
        temperature: 0.7,
        maxTokens: 4000
      }
    },
    fast: {
      provider: "anthropic",
      model: "claude-3-haiku-20240307",
      apiKey: process.env.ANTHROPIC_API_KEY
    }
  },
  planLlms: ["default"],     // For workflow planning
  compressLlms: ["fast"]     // For memory compression
});
```

## Streaming Callbacks

```typescript
callback: {
  async onMessage(message) {
    switch (message.type) {
      case "text": // Streaming text
      case "tool_use": // Tool being called
      case "tool_result": // Tool result
      case "agent_start": // Agent started
      case "agent_result": // Agent completed
      case "finish": // Task done
    }
  }
}
```

## Human-in-the-Loop

```typescript
callback: {
  async onHumanConfirm(context, prompt) {
    return await showConfirmDialog(prompt);
  },
  async onHumanInput(context, prompt) {
    return await showInputDialog(prompt);
  },
  async onHumanSelect(context, prompt, options, multiple) {
    return await showSelectDialog(prompt, options);
  }
}
```

## Token Optimization

1. Use `compressThreshold` to auto-compress long conversations
2. Use efficient models for simple tasks
3. Truncate page content before sending to LLM
4. Use progressive disclosure in prompts

## Adding New Provider

1. Install AI SDK adapter: `pnpm add @ai-sdk/<provider>`
2. Create provider file in `src/llm/providers/`
3. Register in provider factory
4. Update LLMProvider type

## Key Source Files

| File | Purpose |
|------|---------|
| `packages/ai-agent-core/src/llm/index.ts` | Provider factory |
| `packages/ai-agent-core/src/types/llm.types.ts` | Type definitions |
| `packages/ai-agent-core/src/core/dialogue.ts` | Streaming dialogue loop |
| `packages/ai-agent-core/src/types/dialogue.types.ts` | Dialogue types |
