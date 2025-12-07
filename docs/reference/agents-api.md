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

## `BrowserAgent` (Playwright)

`packages/ai-agent-nodejs/src/browser.ts`

Implementation of `BaseBrowserAgent` using Playwright with comprehensive browser automation capabilities.

### Key Methods

#### `close(): Promise<void>`
Cleanly shuts down all browser resources. **Critical for production use** to prevent resource leaks.

```typescript
const agent = new BrowserAgent();
// ... use agent ...
await agent.close(); // Always call when done
```

**Important**: Always call `close()` when finished with the agent to prevent:
- Zombie browser processes
- Memory leaks
- Test suite hangs
- Resource exhaustion in production

### Config
- `headless`: boolean (default: true)
- `browser`: 'chromium' | 'firefox' | 'webkit' (default: 'chromium')

### Error Handling Improvements
- `currentPage()`: Now logs timeout warnings instead of silent failures
- `extract_elements()`: Warns when no elements match selectors for easier debugging

## `FileAgent`

`packages/ai-agent-nodejs`

### Tools
- `read_file(path)`
- `write_file(path, content)`
- `list_files(path)`
- `delete_file(path)`
