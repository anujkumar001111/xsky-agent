# XSky AI Agent - Electron Example

A desktop application demonstrating how to integrate XSky AI Agent framework with Electron. This example showcases secure browser automation using `BrowserAgent` with `WebContentsView`.

## Features

- **Secure Browser Automation**: Uses `contextIsolation` and secure IPC bridge
- **Split View UI**: Real-time chat interface alongside browser automation view
- **Task Orchestration**: Full Eko orchestrator integration
- **Streaming Updates**: Real-time feedback from AI agents

## Prerequisites

- Node.js 18+
- pnpm 10+
- An API key for Anthropic or OpenAI

## Installation

1. Install dependencies from the monorepo root:
   ```bash
   pnpm install
   ```

2. Build the dependencies:
   ```bash
   pnpm build
   ```

3. Copy the example environment file:
   ```bash
   cd example/electron
   cp .env.example .env
   ```

4. Edit `.env` and add your API keys.

## Usage

Development mode (hot reload):
```bash
pnpm dev
```

Build and run:
```bash
pnpm build
pnpm start
```

## Project Structure

```
src/
├── main/              # Main process
│   ├── index.ts       # Entry point
│   ├── window.ts      # Window & View management
│   ├── agent-service.ts # Eko orchestration
│   └── ipc-handlers.ts # IPC communication
├── preload/           # Preload script
│   └── preload.ts     # Secure API bridge
└── renderer/          # Renderer process (UI)
    ├── index.html     # UI shell
    ├── renderer.ts    # UI logic
    └── styles.css     # Styling
```

## Security Note

This example implements best practices for Electron security:
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- IPC channel whitelisting in preload script

## License

MIT
