# Guide: Configuring LLMs

XSky uses the Vercel AI SDK under the hood, supporting many providers.

## Configuration Object

Set `LLMs.default` before initializing XSky.

```typescript
import { LLMs } from '@xsky/ai-agent-core';

LLMs.default = {
  provider: 'anthropic', // or 'openai', 'google', 'deepseek', 'openrouter'
  model: 'claude-3-5-sonnet-20240620',
  apiKey: process.env.ANTHROPIC_API_KEY,
  options: {
    temperature: 0,
    maxTokens: 4000,
  }
};
```

## Supported Providers

### Anthropic
```typescript
{
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20240620',
  // apiKey: ...
}
```

### OpenAI
```typescript
{
  provider: 'openai',
  model: 'gpt-4o',
  // apiKey: ...
}
```

### OpenRouter (Access to Llama 3, etc.)
```typescript
{
  provider: 'openrouter',
  model: 'meta-llama/llama-3.1-70b-instruct',
  apiKey: process.env.OPENROUTER_API_KEY
}
```

### DeepSeek
```typescript
{
  provider: 'deepseek',
  model: 'deepseek-coder',
  apiKey: process.env.DEEPSEEK_API_KEY
}
```

### Google Vertex / Gemini
```typescript
{
  provider: 'google',
  model: 'gemini-1.5-pro-latest',
  // apiKey: ...
}
```

### Custom Endpoint (Local LLM / vLLM)
Use the OpenAI provider with a custom `baseURL`.

```typescript
{
  provider: 'openai',
  model: 'local-model',
  options: {
    baseURL: 'http://localhost:1234/v1',
  }
}
```

## Timeouts

You can control request timeouts (in milliseconds):

```typescript
LLMs.default = {
  // ...
  timeout: 60000, // 60 seconds
};
```
