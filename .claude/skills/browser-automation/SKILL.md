---
name: Browser Automation
description: This skill should be used when the user asks about "browser tools", "DOM manipulation", "element labeling", "screenshot", "script injection", "page navigation", "browser automation", or needs to work with browser-related functionality in XSky.
version: 1.0.0
---

# Browser Automation in XSky

This skill provides knowledge for browser automation in XSky.

## Browser Agent Hierarchy

```
BaseBrowserAgent (abstract)
├── BaseBrowserLabelsAgent
│   └── Uses element labeling for interaction
└── BaseBrowserScreenAgent
    └── Uses screenshot analysis for interaction
```

## Platform Implementations

| Package | Class | Platform |
|---------|-------|----------|
| ai-agent-electron | BrowserAgent | Electron WebContentsView |
| ai-agent-nodejs | BrowserAgent | Playwright |
| ai-agent-web | BrowserAgent | Same-origin pages |
| ai-agent-extension | BrowserAgent | Chrome Extension API |

## Abstract Methods to Implement

Every browser agent must implement:

```typescript
// Take screenshot
protected abstract screenshot(ctx: AgentContext): Promise<{
  imageBase64: string;
  imageType: "image/jpeg" | "image/png";
}>;

// Navigate to URL
protected abstract navigate_to(ctx: AgentContext, url: string): Promise<{
  url: string;
  title?: string;
}>;

// Execute script in page context
protected abstract execute_script(
  ctx: AgentContext,
  fn: Function,
  args: any[]
): Promise<any>;

// Get all tabs
protected abstract get_all_tabs(ctx: AgentContext): Promise<Array<{
  tabId: number;
  url: string;
  title: string;
}>>;

// Switch to tab
protected abstract switch_tab(ctx: AgentContext, tabId: number): Promise<{
  tabId: number;
  url: string;
  title: string;
}>;

// Go back in history
protected abstract go_back(ctx: AgentContext): Promise<void>;
```

## Built-in Tools

BaseBrowserLabelsAgent provides these tools:
- `web_navigate` - Go to URL
- `web_click` - Click element by label
- `web_type` - Type text
- `web_scroll` - Scroll page
- `web_extract` - Extract content
- `web_screenshot` - Capture page

## Element Labeling System

The labeling approach:
1. Finds all interactive elements
2. Assigns numeric labels
3. Overlays labels on page
4. User references elements by number

## Script Execution Safety

For Electron with contextIsolation:
```typescript
// Secure mode via preload
if (securityOptions.useContextIsolation) {
  await window.xskyAgent.executeScript(fn, args);
} else {
  // Legacy direct execution
  await webContents.executeJavaScript(code);
}
```

## Key Source Files

| File | Purpose |
|------|---------|
| `packages/ai-agent-core/src/agent/browser/browser_base.ts` | Base browser agent |
| `packages/ai-agent-core/src/agent/browser/browser_labels.ts` | Labels agent |
| `packages/ai-agent-electron/src/browser.ts` | Electron implementation |
| `packages/ai-agent-nodejs/src/browser.ts` | Playwright implementation |
