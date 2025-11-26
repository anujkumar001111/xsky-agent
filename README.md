

# XSky AI Agent

A production-ready JavaScript framework for creating AI-powered automation agents across multiple platforms.

## Features

- **Multi-platform**: Browser extensions, web apps, Node.js, and Electron
- **Multi-agent orchestration**: Run multiple agents in parallel with dependency management
- **Human-in-the-loop**: Pause, resume, and interrupt capabilities
- **MCP integration**: Native Model Context Protocol support
- **Dynamic LLM selection**: Support for 10+ AI providers
- **Workflow planning**: Convert natural language to executable task graphs

## Quick Start

```bash
# Install dependencies
pnpm install

# Build packages
pnpm build

# Run example
cd example/nodejs
pnpm install
pnpm run build
OPENAI_API_KEY=... pnpm run start
```

## Packages

- `@xsky/ai-agent-core` - Main framework
- `@xsky/ai-agent-nodejs` - Node.js agents
- `@xsky/ai-agent-web` - Web application agents
- `@xsky/ai-agent-extension` - Browser extension agents
- `@xsky/ai-agent-electron` - Electron desktop agents

## Installation

```bash
pnpm install @xsky/ai-agent-core
```

## License

MIT
