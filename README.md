# XSky AI Agent Framework

A production-ready JavaScript AI Agent framework for creating reliable agents across browser and Node.js environments.

## Features

- Cross-platform agents for browser, Node.js, Electron, and browser extensions
- XML-based workflow planning and execution via the XSky orchestrator
- Integration with multiple LLM providers (Anthropic, OpenAI, Google, DeepSeek, OpenRouter)
- Model Context Protocol (MCP) support for dynamic external tools
- Playwright-based browser automation with DOM intelligence and coordinate tools
- Production hooks, checkpointing, and rate limiting for robust deployments

## Monorepo Structure

- `packages/`
  - `ai-agent-core/` – Core orchestrator, agents, tools, MCP clients
  - `ai-agent-nodejs/` – Node.js/Playwright runtime (`BrowserAgent`, `FileAgent`)
  - `ai-agent-web/` – Web runtime for in-page automation
  - `ai-agent-extension/` – Browser extension runtime
  - `ai-agent-electron/` – Electron runtime integration
- `example/`
  - `nodejs/` – Node.js usage example
  - `web/` – Web SPA example
  - `extension/` – Chrome extension example
  - `electron/` – Electron desktop example
- `.claude/` – Steering docs and Claude Code configuration
- `docs/`, `GUIDES/` – Additional documentation and guides

## Prerequisites

- Node.js 18+
- pnpm 8+
- At least one LLM provider API key:
  - `DEEPSEEK_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `GOOGLE_API_KEY`
  - `OPENROUTER_API_KEY`

## Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests for all packages
pnpm test
```

Common commands (from repo root):

```bash
pnpm build      # Build all workspaces
pnpm test       # Run all package test suites
pnpm clean      # Remove node_modules and dist
```

## Quick Start (Node.js)

```ts
import { XSky } from "@xsky/ai-agent-core";
import { BrowserAgent, FileAgent } from "@xsky/ai-agent-nodejs";

const xsky = new XSky({
  llms: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY || "" },
  },
});

xsky.registerAgent(new BrowserAgent());
xsky.registerAgent(new FileAgent());

(async () => {
  await xsky.run("Navigate to example.com and take a screenshot");
})();
```

See `example/nodejs/` for a complete runnable sample, including Playwright browser setup.

## Core Concepts

- **XSky Orchestrator** – Plans and executes XML workflows for a natural-language task
- **Agents** – Specialized classes (browser, file, etc.) that implement tools an XSky workflow can call
- **Dialogue Layer** – `XSkyDialogue` wraps XSky for chat-style interactions with planning and execution tools
- **MCP Clients** – `SimpleSseMcpClient` and `SimpleHttpMcpClient` expose external MCP tools as agent tools

## Development

Each package is an independent workspace with its own build and test scripts.

Package-level commands (run inside a package directory, e.g. `packages/ai-agent-core`):

```bash
pnpm build
pnpm test
```

Testing example for the core package:

```bash
cd packages/ai-agent-core
pnpm test -- src/core/eko.test.ts
```

## Examples

- `example/nodejs/` – Minimal Node.js XSky + BrowserAgent + FileAgent setup
- `example/web/` – In-browser agent using `ai-agent-web`
- `example/extension/` – Chrome extension demonstrating sidebar and content-script control
- `example/electron/` – Desktop app using `ai-agent-electron`

## Contributing

- Follow coding guidelines in `AGENTS.md` and `CLAUDE.md`
- Use pnpm for dependency management and scripts
- Keep changes focused and covered by tests where applicable

## License

MIT (see LICENSE if present in this repository).
