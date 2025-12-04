# Electron Example - Requirements Document

## Overview

Create a working, functional Electron example application demonstrating the XSky AI Agent framework's browser automation capabilities in a desktop environment.

## Problem Statement

The XSky framework includes `@xsky/ai-agent-electron` package with `BrowserAgent`, `FileAgent`, and `SimpleStdioMcpClient` exports, but there is no working Electron example in the `example/` directory. Developers need a reference implementation to understand how to:

1. Set up Electron with XSky AI Agent
2. Configure secure browser automation with contextIsolation
3. Use the preload script for safe IPC communication
4. Execute AI-driven browser tasks in a desktop app

## Functional Requirements

### FR-1: Electron Application Shell
- **FR-1.1**: Main process with BrowserWindow and WebContentsView
- **FR-1.2**: Proper preload script setup with contextIsolation enabled
- **FR-1.3**: Secure IPC handlers for agent communication
- **FR-1.4**: Window management (minimize, maximize, close)

### FR-2: Browser View Integration
- **FR-2.1**: WebContentsView embedded in main window for web content
- **FR-2.2**: Navigation controls (back, forward, refresh, URL bar)
- **FR-2.3**: Screenshot capture capability
- **FR-2.4**: Page content extraction (HTML and PDF)

### FR-3: AI Agent Integration
- **FR-3.1**: Initialize Eko orchestrator with LLM configuration
- **FR-3.2**: Register BrowserAgent for browser automation
- **FR-3.3**: Register FileAgent for file system operations
- **FR-3.4**: Support streaming callbacks for real-time UI updates

### FR-4: User Interface
- **FR-4.1**: Chat input for natural language commands
- **FR-4.2**: Message display showing agent responses
- **FR-4.3**: Task status indicator (idle, running, paused, error)
- **FR-4.4**: Agent activity log panel

### FR-5: Task Management
- **FR-5.1**: Start task from natural language prompt
- **FR-5.2**: Pause/resume task execution
- **FR-5.3**: Abort running tasks
- **FR-5.4**: Display task results

## Non-Functional Requirements

### NFR-1: Security
- **NFR-1.1**: Use contextIsolation for secure script execution
- **NFR-1.2**: Validate all IPC channels (whitelist approach)
- **NFR-1.3**: Sandbox mode enabled for WebContentsView
- **NFR-1.4**: No nodeIntegration in renderer

### NFR-2: Performance
- **NFR-2.1**: Responsive UI during agent execution
- **NFR-2.2**: Non-blocking IPC communication
- **NFR-2.3**: Efficient screenshot capture

### NFR-3: Developer Experience
- **NFR-3.1**: TypeScript for type safety
- **NFR-3.2**: Hot reload during development
- **NFR-3.3**: Clear console logging
- **NFR-3.4**: Comprehensive README with setup instructions

### NFR-4: Compatibility
- **NFR-4.1**: Electron 20+ (peer dependency requirement)
- **NFR-4.2**: Node.js 18+
- **NFR-4.3**: Works on macOS, Windows, Linux

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | Anthropic Claude API key |
| `OPENAI_API_KEY` | Yes* | OpenAI API key |
| `ANTHROPIC_BASE_URL` | No | Custom Anthropic endpoint |
| `OPENAI_BASE_URL` | No | Custom OpenAI endpoint |

*At least one LLM provider key required

## Success Criteria

1. **Build Success**: `pnpm build` produces working Electron app
2. **Run Success**: `pnpm start` launches application without errors
3. **Agent Execution**: Can execute "Go to google.com and search for AI" task
4. **Screenshot**: Can capture and display browser screenshot
5. **File Operations**: Can save content to local file system

## Out of Scope

- Production packaging (electron-builder configuration)
- Auto-updates
- Multiple browser tabs/windows
- MCP server integration (can be added later)
- Custom theming

## Dependencies

```json
{
  "dependencies": {
    "@xsky/ai-agent-core": "workspace:*",
    "@xsky/ai-agent-electron": "workspace:*"
  },
  "devDependencies": {
    "electron": "^33.3.1",
    "typescript": "^5.8.3"
  }
}
```

## Acceptance Criteria

- [ ] Application starts without errors
- [ ] Browser view loads websites correctly
- [ ] AI agent can navigate to URLs
- [ ] AI agent can interact with page elements
- [ ] Screenshots are captured successfully
- [ ] File operations work correctly
- [ ] Task can be paused and resumed
- [ ] Proper error handling and user feedback

## References

- Existing Node.js example: `example/nodejs/`
- Electron package: `packages/ai-agent-electron/`
- BrowserAgent implementation: `packages/ai-agent-electron/src/browser.ts`
- Preload script: `packages/ai-agent-electron/src/preload.ts`
