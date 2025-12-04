---
name: xsky-add-provider
description: Guided workflow to add a new LLM provider to XSky
allowed-tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash", "Task"]
---

# Add New LLM Provider to XSky

You are guiding the user through adding a new LLM provider to the XSky AI Agent framework.

## Step 1: Gather Provider Information

Ask the user:
1. Which LLM provider? (e.g., Mistral, Cohere, Together AI)
2. Is there an existing AI SDK adapter? Check: https://sdk.vercel.ai/providers
3. What authentication is needed?

## Step 2: Check AI SDK Support

XSky uses Vercel's AI SDK. Check if provider has official adapter:

```bash
# Search for existing adapter
npm search @ai-sdk/<provider>
```

If adapter exists:
```bash
pnpm --filter @xsky/ai-agent-core add @ai-sdk/<provider>
```

If no adapter, use `@ai-sdk/openai-compatible` for OpenAI-compatible APIs.

## Step 3: Create Provider File

Location: `packages/ai-agent-core/src/llm/providers/`

```typescript
// packages/ai-agent-core/src/llm/providers/mistral.ts
import { createMistral } from "@ai-sdk/mistral";
import { LLMConfig } from "../../types/llm.types";

export function createMistralProvider(config: LLMConfig) {
  const mistral = createMistral({
    apiKey: config.apiKey,
    baseURL: config.config?.baseURL,
  });

  return mistral(config.model, {
    // Model-specific options
  });
}
```

## Step 4: Update Provider Factory

```typescript
// packages/ai-agent-core/src/llm/index.ts
import { createMistralProvider } from "./providers/mistral";

export function createProvider(llmConfig: LLMConfig) {
  switch (llmConfig.provider) {
    case "openai":
      return createOpenAIProvider(llmConfig);
    case "anthropic":
      return createAnthropicProvider(llmConfig);
    case "mistral":                          // Add new case
      return createMistralProvider(llmConfig);
    // ...
    default:
      throw new Error(`Unknown provider: ${llmConfig.provider}`);
  }
}
```

## Step 5: Update Types

```typescript
// packages/ai-agent-core/src/types/llm.types.ts
export type LLMProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "aws"
  | "openrouter"
  | "openai-compatible"
  | "mistral";  // Add new provider
```

## Step 6: Add Tests

```typescript
// packages/ai-agent-core/test/llm/mistral.test.ts
describe('Mistral Provider', () => {
  it('should create provider with config', () => {
    const provider = createMistralProvider({
      provider: 'mistral',
      model: 'mistral-large-latest',
      apiKey: 'test-key'
    });

    expect(provider).toBeDefined();
  });
});
```

## Step 7: Update Documentation

Add to README:
```markdown
### Mistral
{
  provider: "mistral",
  model: "mistral-large-latest",
  apiKey: process.env.MISTRAL_API_KEY,
}
```

## Step 8: Verify

```bash
pnpm build
pnpm test
```

## Environment Variable Convention

```
MISTRAL_API_KEY=your-key
```

---

Now, which LLM provider do you want to add?
