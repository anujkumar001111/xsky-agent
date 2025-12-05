# Agents API Reference

## `Agent` (Abstract Base)

`src/agent/base.ts`

### Properties
- `name`: string (unique identifier)
- `description`: string (used by Planner)

### Methods (to override)
- `getTools()`: Return array of `Tool` objects.
- `getAgentSystemPrompt(context)`: Return system prompt string.

## `BaseBrowserAgent`

`src/agent/browser/browser_base.ts`

Abstract contract for browser automation.

### Key Capabilities (Tools)
- `goto(url)`
- `click(selector)`
- `type(selector, text)`
- `scroll(x, y)`
- `screenshot()`
- `get_dom()`: Returns simplified DOM snapshot.

## `PlaywrightBrowserAgent`

`packages/ai-agent-nodejs`

Implementation of `BaseBrowserAgent` using Playwright.

### Config
- `headless`: boolean
- `browser`: 'chromium' | 'firefox' | 'webkit'

## `FileAgent`

`packages/ai-agent-nodejs`

### Tools
- `read_file(path)`
- `write_file(path, content)`
- `list_files(path)`
- `delete_file(path)`
