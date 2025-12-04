# XSky AI Agent

A production-ready JavaScript/TypeScript framework for creating AI-powered automation agents across multiple platforms.

## Overview

XSky AI Agent is a powerful and flexible framework designed to simplify the development of AI agents. It provides a comprehensive set of tools and features to build, manage, and deploy agents that can automate complex tasks across various environments. Whether you're creating a simple chatbot or a sophisticated multi-agent system, XSky AI Agent offers the building blocks you need to get started quickly.

## Features

- **Multi-platform**: Build agents that run in browser extensions, web apps, Node.js, and Electron applications.
- **Multi-agent Orchestration**: Run multiple agents in parallel with dependency management to create complex workflows.
- **Human-in-the-loop**: Pause, resume, and interrupt agent execution to allow for human intervention and collaboration.
- **MCP Integration**: Native support for the Model Context Protocol (MCP) enables seamless communication with language models.
- **Dynamic LLM Selection**: Support for multiple AI providers (OpenAI, Anthropic, Google, AWS Bedrock, OpenRouter, and more).
- **Workflow Planning**: Convert natural language descriptions into executable task graphs.
- **DOM Intelligence**: Extract comprehensive information from web pages for browser automation.
- **Memory Management**: Built-in conversation memory with compression and capacity management.

## Table of Contents

- [Getting Started](#getting-started)
- [Installation](#installation)
- [Packages](#packages)
- [Architecture](#architecture)
- [Usage Examples](#usage-examples)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Getting Started

### Prerequisites

- Node.js v18 or higher
- pnpm v10 or higher

### Installation

Clone the repository and install dependencies:

```bash
# Clone the repository
git clone https://github.com/xsky-ai/ai-agent.git

# Navigate to the project directory
cd ai-agent

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Quick Start

Install the core package in your project:

```bash
pnpm add @xsky/ai-agent-core
```

Create a simple agent:

```typescript
import { Eko } from "@xsky/ai-agent-core";

// Initialize Eko with LLM configuration
const eko = new Eko({
  llms: {
    default: {
      provider: "openai",
      model: "gpt-4",
      apiKey: process.env.OPENAI_API_KEY,
    },
  },
});

// Execute a task
const result = await eko.run("Search for the latest news about AI");
console.log(result);
```

## Packages

XSky AI Agent is organized as a monorepo with the following packages:

### Core Package

**`@xsky/ai-agent-core`** - The foundation framework providing:
- Agent runtime and execution context
- Workflow planning and orchestration
- Memory management and compression
- LLM provider integrations
- Tool and MCP client interfaces
- DOM intelligence and element extraction

```bash
pnpm add @xsky/ai-agent-core
```

### Environment Adapters

**`@xsky/ai-agent-nodejs`** - Node.js adapter with Playwright-based browser automation:
- Full browser control via Playwright
- Native filesystem access
- STDIO MCP client for subprocess communication

```bash
pnpm add @xsky/ai-agent-nodejs
```

**`@xsky/ai-agent-web`** - Web browser adapter:
- In-page browser automation
- html2canvas-based screenshots
- Same-origin navigation support

```bash
pnpm add @xsky/ai-agent-web
```

**`@xsky/ai-agent-extension`** - Chrome extension adapter:
- Chrome Extension API integration
- Tab management and navigation
- Cross-tab screenshot capture

```bash
pnpm add @xsky/ai-agent-extension
```

**`@xsky/ai-agent-electron`** - Electron desktop adapter:
- WebContentsView integration
- Secure contextIsolation support
- PDF content extraction
- Native file system access

```bash
pnpm add @xsky/ai-agent-electron
```

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Eko (Main Entry)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Planner    │  │   Chain      │  │    AgentContext      │  │
│  │  (Workflow)  │  │ (Execution)  │  │  (State Management)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │    Memory    │  │   Dialogue   │  │      Replan          │  │
│  │ (Compression)│  │  (LLM Loop)  │  │ (Error Recovery)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                        Agent Layer                              │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────┐  │
│  │ Browser  │ │   File   │ │  LLM   │ │  Shell │ │ Computer │  │
│  │  Agent   │ │  Agent   │ │ Agent  │ │ Agent  │ │  Agent   │  │
│  └──────────┘ └──────────┘ └────────┘ └────────┘ └──────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                     LLM Provider Layer                          │
│  ┌────────┐ ┌───────────┐ ┌────────┐ ┌─────────┐ ┌───────────┐ │
│  │ OpenAI │ │ Anthropic │ │ Google │ │ Bedrock │ │OpenRouter │ │
│  └────────┘ └───────────┘ └────────┘ └─────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Workflow Execution Flow

1. **Planning**: Natural language task → Workflow XML
2. **Parsing**: XML → Agent nodes with dependencies
3. **Scheduling**: Dependency resolution → Execution order
4. **Execution**: Agent dialogue loops with tool calls
5. **Result Aggregation**: Combine outputs from all agents

## Usage Examples

### Node.js Browser Automation

```typescript
import { Eko } from "@xsky/ai-agent-core";
import { BrowserAgent } from "@xsky/ai-agent-nodejs";

const browserAgent = new BrowserAgent();
browserAgent.initUserDataDir(); // Use default Chrome profile

const eko = new Eko({
  llms: {
    default: {
      provider: "openai",
      model: "gpt-4o",
      apiKey: process.env.OPENAI_API_KEY,
    },
  },
  agents: [browserAgent],
});

const result = await eko.run(
  "Go to google.com and search for 'XSky AI Agent'"
);
```

### With MCP Server

```typescript
import { Eko } from "@xsky/ai-agent-core";
import { SimpleStdioMcpClient } from "@xsky/ai-agent-nodejs";

const mcpClient = new SimpleStdioMcpClient("node", ["mcp-server.js"]);
await mcpClient.connect();

const eko = new Eko({
  llms: {
    default: {
      provider: "anthropic",
      model: "claude-3-opus-20240229",
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  },
  defaultMcpClient: mcpClient,
});

const result = await eko.run("Use the available tools to complete my task");
```

### Streaming Callbacks

```typescript
const eko = new Eko({
  llms: { /* ... */ },
  callback: {
    async onMessage(message) {
      switch (message.type) {
        case "text":
          console.log("Assistant:", message.text);
          break;
        case "tool_use":
          console.log("Using tool:", message.toolName);
          break;
        case "tool_result":
          console.log("Tool result:", message.toolResult);
          break;
        case "finish":
          console.log("Finished:", message.finishReason);
          break;
      }
    },
  },
});
```

### Human-in-the-Loop

```typescript
const eko = new Eko({
  llms: { /* ... */ },
  callback: {
    async onMessage(message) { /* ... */ },
    async onHumanConfirm(context, prompt) {
      // Show confirmation dialog to user
      return await showConfirmDialog(prompt);
    },
    async onHumanInput(context, prompt) {
      // Get text input from user
      return await showInputDialog(prompt);
    },
    async onHumanSelect(context, prompt, options, multiple) {
      // Show selection dialog
      return await showSelectDialog(prompt, options, multiple);
    },
  },
});
```

## Configuration

### LLM Providers

```typescript
// OpenAI
{
  provider: "openai",
  model: "gpt-4o",
  apiKey: process.env.OPENAI_API_KEY,
  config: {
    baseURL: "https://api.openai.com/v1", // Optional custom endpoint
    temperature: 0.7,
  },
}

// Anthropic
{
  provider: "anthropic",
  model: "claude-3-opus-20240229",
  apiKey: process.env.ANTHROPIC_API_KEY,
}

// Google (Gemini)
{
  provider: "google",
  model: "gemini-pro",
  apiKey: process.env.GOOGLE_API_KEY,
}

// AWS Bedrock
{
  provider: "aws",
  model: "anthropic.claude-3-opus-20240229-v1:0",
  apiKey: "", // Uses AWS credentials from environment
}

// OpenRouter
{
  provider: "openrouter",
  model: "anthropic/claude-3-opus",
  apiKey: process.env.OPENROUTER_API_KEY,
}

// OpenAI-compatible endpoints
{
  provider: "openai-compatible",
  model: "your-model",
  apiKey: process.env.API_KEY,
  config: {
    baseURL: "https://your-endpoint.com/v1",
  },
}
```

### Global Configuration

The framework uses a global configuration object that can be customized:

```typescript
import config from "@xsky/ai-agent-core/config";

// Available configuration options:
config.maxReactNum;          // Maximum reaction cycles (default: 500)
config.maxTokens;            // Maximum tokens for LLM requests (default: 16000)
config.maxRetryNum;          // Maximum retry attempts (default: 3)
config.agentParallel;        // Enable parallel agent execution (default: false)
config.compressThreshold;    // Message count to trigger compression (default: 80)
config.parallelToolCalls;    // Enable parallel tool calls (default: true)
config.expertMode;           // Enable expert mode (default: false)
config.useDomIntelligence;   // Enable DOM intelligence (default: false)
```

## API Reference

### Eko Class

The main entry point for creating and running agents.

```typescript
class Eko {
  constructor(config: EkoConfig);

  // Execute a task from natural language
  run(task: string, signal?: AbortSignal): Promise<EkoResult>;

  // Execute a pre-built workflow
  execute(workflow: Workflow, signal?: AbortSignal): Promise<EkoResult>;

  // Abort current execution
  abort(): void;
}
```

### EkoConfig Interface

```typescript
interface EkoConfig {
  llms: LLMs;                          // LLM configurations (required)
  agents?: Agent[];                     // Custom agents to register
  planLlms?: string[];                  // LLM names for planning
  compressLlms?: string[];              // LLM names for compression
  callback?: StreamCallback & HumanCallback;  // Callbacks
  defaultMcpClient?: IMcpClient;        // Default MCP client
  a2aClient?: IA2aClient;               // Agent-to-Agent client
}
```

### Agent Classes

All agents extend from base classes and provide platform-specific implementations:

- **BaseBrowserLabelsAgent**: Base for browser automation with element labeling
- **BaseFileAgent**: Base for filesystem operations
- **BaseLLMAgent**: Base for LLM-powered agents

### Tool Interface

```typescript
interface Tool {
  readonly name: string;
  readonly description?: string;
  readonly parameters: JSONSchema7;
  readonly noPlan?: boolean;
  readonly supportParallelCalls?: boolean;

  execute(
    args: Record<string, unknown>,
    agentContext: AgentContext,
    toolCall: LanguageModelV2ToolCallPart
  ): Promise<ToolResult>;
}
```

## Development

### Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Clean build artifacts
pnpm clean

# Build specific package
pnpm --filter @xsky/ai-agent-core build

# Run specific package tests
pnpm --filter @xsky/ai-agent-core test

# Run single test file
pnpm --filter @xsky/ai-agent-core test -- path/to/test.ts
```

### Running Examples

#### Node.js Example

```bash
cd example/nodejs
pnpm install
pnpm build
OPENAI_API_KEY=your-key pnpm start
```

#### Web Example

```bash
cd example/web
pnpm install
pnpm start
```

#### Extension Example

```bash
cd example/extension
pnpm install
pnpm build
# Load the dist/ folder as an unpacked extension in Chrome
```

### Project Structure

```
.
├── packages/
│   ├── ai-agent-core/          # Core framework
│   │   ├── src/
│   │   │   ├── agent/          # Agent implementations
│   │   │   ├── core/           # Core runtime (Eko, Chain, etc.)
│   │   │   ├── common/         # Utilities (logging, XML, etc.)
│   │   │   ├── config/         # Global configuration
│   │   │   ├── llm/            # LLM provider implementations
│   │   │   ├── memory/         # Memory management
│   │   │   ├── mcp/            # MCP clients (SSE, HTTP)
│   │   │   └── types/          # TypeScript type definitions
│   │   └── test/               # Tests
│   │
│   ├── ai-agent-nodejs/        # Node.js adapter
│   ├── ai-agent-web/           # Web browser adapter
│   ├── ai-agent-extension/     # Chrome extension adapter
│   └── ai-agent-electron/      # Electron adapter
│
├── example/
│   ├── nodejs/                 # Node.js example
│   ├── web/                    # React web example
│   └── extension/              # Browser extension example
│
└── package.json                # Monorepo configuration
```

### Testing

Tests use Jest with ts-jest. Each package has its own test configuration:

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test -- --coverage

# Run tests in watch mode
pnpm test -- --watch
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | For OpenAI provider |
| `OPENAI_BASE_URL` | Custom OpenAI endpoint | No |
| `ANTHROPIC_API_KEY` | Anthropic API key | For Anthropic provider |
| `GOOGLE_API_KEY` | Google AI API key | For Google provider |
| `OPENROUTER_API_KEY` | OpenRouter API key | For OpenRouter provider |

## Contributing

We welcome contributions to XSky AI Agent! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code:
- Follows the existing code style
- Includes appropriate documentation
- Has test coverage for new features
- Passes all existing tests

## License

XSky AI Agent is licensed under the [MIT License](LICENSE).

## Support

- **Documentation**: Check the inline documentation and JSDoc comments
- **Issues**: Report bugs and feature requests on GitHub Issues
- **Discussions**: Join community discussions on GitHub Discussions
