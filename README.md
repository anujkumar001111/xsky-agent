# XSky AI Agent

A production-ready JavaScript framework for creating AI-powered automation agents across multiple platforms.

## Overview

XSky AI Agent is a powerful and flexible framework designed to simplify the development of AI agents. It provides a comprehensive set of tools and features to build, manage, and deploy agents that can automate complex tasks across various environments. Whether you're creating a simple chatbot or a sophisticated multi-agent system, XSky AI Agent offers the building blocks you need to get started quickly.

## Features

- **Multi-platform**: Build agents that run in browser extensions, web apps, Node.js, and Electron applications.
- **Multi-agent Orchestration**: Run multiple agents in parallel with dependency management to create complex workflows.
- **Human-in-the-loop**: Pause, resume, and interrupt agent execution to allow for human intervention and collaboration.
- **MCP Integration**: Native support for the Model Context Protocol (MCP) enables seamless communication with language models.
- **Dynamic LLM Selection**: Support for over 10 AI providers, allowing you to choose the best language model for your needs.
- **Workflow Planning**: Convert natural language descriptions into executable task graphs, enabling agents to plan and execute complex tasks.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- pnpm

### Installation

To get started with XSky AI Agent, clone the repository and install the dependencies:

```bash
# Clone the repository
git clone https://github.com/your-repo/xsky-ai-agent.git

# Navigate to the project directory
cd xsky-ai-agent

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Running the Example

To run the example Node.js agent, follow these steps:

```bash
# Navigate to the example directory
cd example/nodejs

# Install dependencies
pnpm install

# Build the example
pnpm run build

# Set your OpenAI API key and run the example
OPENAI_API_KEY=... pnpm run start
```

## Packages

XSky AI Agent is a monorepo that consists of the following packages:

- **`@xsky/ai-agent-core`**: The main framework that provides the core functionality for creating and managing agents.
- **`@xsky/ai-agent-nodejs`**: A package for creating agents that run in a Node.js environment.
- **`@xsky/ai-agent-web`**: A package for creating agents that run in a web browser.
- **`@xsky/ai-agent-extension`**: A package for creating agents that run in a browser extension.
- **`@xsky/ai-agent-electron`**: A package for creating agents that run in an Electron application.

## Usage

To use XSky AI Agent in your project, you can install the core package:

```bash
pnpm install @xsky/ai-agent-core
```

You can then import the necessary classes and functions to create your own agents. For more detailed usage instructions, please refer to the documentation in each package.

## Contributing

We welcome contributions to XSky AI Agent! If you're interested in contributing, please read our [contributing guide](CONTRIBUTING.md) to get started.

## License

XSky AI Agent is licensed under the [MIT License](LICENSE).
