# XSky AI Agent - Product Overview

> Steering document for AI assistants: Product features, business rules, and user workflows

## Product Summary

XSky AI Agent is a production-ready JavaScript/TypeScript framework for creating AI-powered automation agents across multiple platforms (browser, Node.js, Electron, web apps, browser extensions).

## Core Value Propositions

1. **Multi-Platform Deployment**: Single codebase deploys to 4+ environments
2. **Workflow Orchestration**: Natural language tasks converted to executable agent workflows
3. **Human-in-the-Loop**: Pause, resume, and collaborate during agent execution
4. **MCP Integration**: Model Context Protocol support for LLM tool connectivity
5. **Provider Agnostic**: Supports OpenAI, Anthropic, Google, AWS Bedrock, OpenRouter, DeepSeek

## Target Users

| User Type | Use Case |
|-----------|----------|
| Application Developers | Build AI-powered automation into apps |
| Enterprise Teams | Create browser/desktop automation workflows |
| Tool Builders | Extend with custom agents and MCP servers |
| AI Researchers | Prototype multi-agent systems |

## Core Features

### 1. Eko Orchestrator
- Main entry point for all agent operations
- Converts natural language prompts to XML workflows
- Manages task lifecycle (generate → execute → result)
- Handles parallel/sequential agent execution

### 2. Workflow Planning
- Planner LLM converts task prompts to WorkflowAgent definitions
- Dependency graph resolution with `dependsOn` relationships
- Supports forEach loops and watch triggers
- Re-planning on errors (expert mode)

### 3. Agent Types
| Agent | Platform | Purpose |
|-------|----------|---------|
| BaseBrowserAgent | All | Browser automation base |
| BaseBrowserLabelsAgent | All | Element labeling for clicks |
| BaseBrowserScreenAgent | All | Screenshot-based interaction |
| BaseFileAgent | Node/Electron | File system operations |
| BaseShellAgent | Node/Electron | Shell command execution |
| BaseComputerAgent | Desktop | Desktop GUI automation |

### 4. Human-in-the-Loop Callbacks
- `onHumanConfirm` - Yes/No confirmation prompts
- `onHumanInput` - Free-form text input
- `onHumanSelect` - Single/multi-select from options
- `onHumanHelp` - Request login or assistance

### 5. MCP Client Support
- `SimpleSseMcpClient` - Server-Sent Events transport
- `SimpleHttpMcpClient` - HTTP request/response transport
- `SimpleStdioMcpClient` (nodejs package) - Subprocess communication

### 6. Memory Management
- `EkoMemory` for conversation compression
- Configurable compression threshold (default: 80 messages)
- Prevents context overflow in long-running tasks

## Business Rules

### Task Execution Rules
1. Tasks have unique `taskId` identifiers
2. Workflows can be paused/resumed without data loss
3. Aborted tasks trigger cleanup via `AbortController`
4. Agent errors can trigger automatic re-planning (expert mode)

### Agent Selection Rules
1. Planner selects agents based on task requirements
2. Agents with matching capabilities are prioritized
3. Missing agent throws descriptive error
4. Custom agents registered via `eko.addAgent()`

### LLM Provider Rules
1. At least one LLM provider must be configured
2. `default` provider used when no specific provider requested
3. Named providers accessible via `llms[providerName]`
4. Retry logic with exponential backoff (max 3 retries)

### Streaming Callback Rules
1. All execution events emit `StreamCallbackMessage`
2. Message types: workflow, agent_start, text, thinking, tool_use, tool_result, agent_result, error, finish
3. Callbacks are async and awaited before continuing

## User Workflows

### Basic Task Execution
```
User: "Go to google.com and search for AI news"
  ↓
Eko.run(taskPrompt)
  ↓
Planner.plan() → Workflow XML
  ↓
Agent execution loop
  ↓
Result returned
```

### Custom Agent Integration
```
1. Create agent class extending base agent
2. Implement required tools and methods
3. Register with eko.addAgent(customAgent)
4. Agent available for workflow planning
```

### MCP Server Connection
```
1. Create MCP client instance (SSE/HTTP/STDIO)
2. Call client.connect()
3. Pass to EkoConfig.defaultMcpClient
4. Tools discovered and available to agents
```

## Feature Flags / Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `config.maxReactNum` | 500 | Max dialogue turns per agent |
| `config.maxTokens` | 16000 | Max tokens per LLM request |
| `config.maxRetryNum` | 3 | Max LLM call retries |
| `config.agentParallel` | false | Enable parallel agent execution |
| `config.compressThreshold` | 80 | Messages before compression |
| `config.compressTokensThreshold` | 80000 | Token count to trigger compression |
| `config.largeTextLength` | 8000 | Character length considered "large text" |
| `config.fileTextMaxLength` | 20000 | Max character length for file text |
| `config.maxDialogueImgFileNum` | 1 | Max images allowed in dialogue |
| `config.toolResultMultimodal` | true | Allow multimodal tool results |
| `config.parallelToolCalls` | true | Allow parallel tool invocations |
| `config.expertMode` | false | Enable error-recovery re-planning |
| `config.expertModeTodoLoopNum` | 10 | Todo loop iterations in expert mode |
| `config.useDomIntelligence` | false | Enable DOM element intelligence |

## Environment Variables

| Variable | Required For | Purpose |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI provider | Authentication |
| `ANTHROPIC_API_KEY` | Anthropic provider | Authentication |
| `GOOGLE_API_KEY` | Google provider | Authentication |
| `OPENROUTER_API_KEY` | OpenRouter provider | Authentication |
| `DEEPSEEK_API_KEY` | DeepSeek provider | Authentication |
| `OPENAI_BASE_URL` | Optional | Custom OpenAI endpoint |

## Package Distribution

| Package | npm | Description |
|---------|-----|-------------|
| `@xsky/ai-agent-core` | Public | Core framework |
| `@xsky/ai-agent-nodejs` | Public | Node.js + Playwright |
| `@xsky/ai-agent-web` | Public | Browser environment |
| `@xsky/ai-agent-extension` | Public | Chrome extension |
| `@xsky/ai-agent-electron` | Public | Electron desktop |

## Non-Functional Requirements

- **Node.js**: v18+
- **pnpm**: v10+
- **TypeScript**: v5.8+
- **Bundler**: Rollup with CJS/ESM dual outputs
- **Testing**: Jest with ts-jest
