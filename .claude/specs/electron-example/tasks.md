# Electron Example - Implementation Tasks

## Phase 1: Project Setup

### Task 1.1: Create Project Structure
**Status**: Pending
**Priority**: High
**Files to create**:
- `example/electron/package.json`
- `example/electron/tsconfig.json`
- `example/electron/rollup.config.js`
- `example/electron/.env.example`
- `example/electron/README.md`

**Acceptance Criteria**:
- [ ] Package.json with correct dependencies
- [ ] TypeScript configured for Electron
- [ ] Rollup configured for main/preload/renderer bundles
- [ ] Environment template with LLM keys

### Task 1.2: Set Up Directory Structure
**Status**: Pending
**Priority**: High
**Files to create**:
- `example/electron/src/main/` directory
- `example/electron/src/preload/` directory
- `example/electron/src/renderer/` directory

**Acceptance Criteria**:
- [ ] Directory structure matches design document
- [ ] Each directory has appropriate entry files

---

## Phase 2: Main Process Implementation

### Task 2.1: Create Entry Point
**Status**: Pending
**Priority**: High
**File**: `example/electron/src/main/index.ts`

**Implementation**:
```typescript
// Initialize Electron app
// Create main window
// Set up IPC handlers
// Initialize agent service
// Handle app lifecycle (ready, activate, window-all-closed)
```

**Acceptance Criteria**:
- [ ] App starts without errors
- [ ] Window created on app ready
- [ ] Proper app quit handling

### Task 2.2: Implement Window Manager
**Status**: Pending
**Priority**: High
**File**: `example/electron/src/main/window.ts`

**Implementation**:
```typescript
// Create BrowserWindow with secure webPreferences
// Create WebContentsView for browser automation
// Position browser view within main window
// Handle resize events to adjust browser view bounds
```

**Acceptance Criteria**:
- [ ] Main window renders correctly
- [ ] Browser view embedded and visible
- [ ] Window resize adjusts browser view

### Task 2.3: Implement Agent Service
**Status**: Pending
**Priority**: High
**File**: `example/electron/src/main/agent-service.ts`

**Implementation**:
```typescript
// Load LLM configuration from environment
// Initialize BrowserAgent with WebContentsView
// Initialize FileAgent
// Create XSky instance with streaming callback
// Implement runTask, pauseTask, abortTask methods
// Forward events to renderer via IPC
```

**Acceptance Criteria**:
- [ ] AgentService initializes without errors
- [ ] Can execute simple navigation task
- [ ] Events streamed to renderer

### Task 2.4: Implement IPC Handlers
**Status**: Pending
**Priority**: High
**File**: `example/electron/src/main/ipc-handlers.ts`

**Implementation**:
```typescript
// Define IPC channel constants
// Implement handlers for:
//   - xsky:run-task
//   - xsky:pause-task
//   - xsky:abort-task
//   - view:navigate
//   - view:screenshot
//   - view:go-back
//   - view:go-forward
//   - view:refresh
// Input validation for all handlers
```

**Acceptance Criteria**:
- [ ] All IPC channels registered
- [ ] Input validation prevents malformed requests
- [ ] Error responses formatted correctly

---

## Phase 3: Preload Script

### Task 3.1: Create Preload Script
**Status**: Pending
**Priority**: High
**File**: `example/electron/src/preload/preload.ts`

**Implementation**:
```typescript
// Use contextBridge to expose secure API
// Expose window.electronAPI.xsky.* methods
// Expose window.electronAPI.view.* methods
// Add TypeScript type declarations
```

**Acceptance Criteria**:
- [ ] API exposed via contextBridge
- [ ] Type declarations for window.electronAPI
- [ ] No Node.js globals leaked to renderer

---

## Phase 4: Renderer Implementation

### Task 4.1: Create HTML Shell
**Status**: Pending
**Priority**: High
**File**: `example/electron/src/renderer/index.html`

**Implementation**:
```html
<!-- Navigation bar with URL input -->
<!-- Split layout: browser view + chat panel -->
<!-- Chat message list -->
<!-- Chat input with send button -->
<!-- Status bar with task controls -->
```

**Acceptance Criteria**:
- [ ] Layout matches design mockup
- [ ] All interactive elements have IDs
- [ ] Responsive to window resize

### Task 4.2: Implement Renderer Logic
**Status**: Pending
**Priority**: High
**File**: `example/electron/src/renderer/renderer.ts`

**Implementation**:
```typescript
// State management (status, messages, currentUrl)
// Event handlers for:
//   - Send button click
//   - URL bar navigation
//   - Pause/Stop buttons
//   - Navigation buttons
// Task event listener for streaming updates
// Message rendering
```

**Acceptance Criteria**:
- [ ] Messages render correctly
- [ ] Task status updates in real-time
- [ ] Navigation controls work

### Task 4.3: Add Styling
**Status**: Pending
**Priority**: Medium
**File**: `example/electron/src/renderer/styles.css`

**Implementation**:
```css
/* Layout grid/flexbox */
/* Navigation bar styling */
/* Chat panel styling */
/* Message bubbles (user vs agent) */
/* Status bar and buttons */
/* Loading/error states */
```

**Acceptance Criteria**:
- [ ] Clean, professional appearance
- [ ] User vs agent messages visually distinct
- [ ] Button states (hover, active, disabled)

---

## Phase 5: Build & Integration

### Task 5.1: Configure Build System
**Status**: Pending
**Priority**: High
**File**: `example/electron/rollup.config.js`

**Implementation**:
```javascript
// Main process bundle (CJS)
// Preload bundle (CJS)
// Renderer bundle (IIFE)
// TypeScript plugin
// Node resolve plugin
// CommonJS plugin for Electron
```

**Acceptance Criteria**:
- [ ] `pnpm build` produces all bundles
- [ ] No build errors or warnings
- [ ] Output files in dist/

### Task 5.2: Add NPM Scripts
**Status**: Pending
**Priority**: High
**File**: `example/electron/package.json` (update)

**Scripts**:
```json
{
  "scripts": {
    "build": "rollup -c",
    "start": "electron dist/main.js",
    "dev": "pnpm build && pnpm start",
    "watch": "rollup -c -w"
  }
}
```

**Acceptance Criteria**:
- [ ] `pnpm dev` builds and runs app
- [ ] `pnpm watch` rebuilds on changes

---

## Phase 6: Testing & Documentation

### Task 6.1: Manual Testing
**Status**: Pending
**Priority**: High

**Test Cases**:
1. App launches without errors
2. Navigate to google.com via URL bar
3. Execute task: "Go to google.com and search for AI news"
4. Verify agent navigates and interacts
5. Take screenshot via button
6. Pause and resume task
7. Abort running task
8. Test with missing API key (error handling)

**Acceptance Criteria**:
- [ ] All test cases pass
- [ ] Error states handled gracefully
- [ ] Console logs are helpful

### Task 6.2: Write README
**Status**: Pending
**Priority**: Medium
**File**: `example/electron/README.md`

**Content**:
```markdown
# XSky AI Agent - Electron Example

## Overview
## Prerequisites
## Installation
## Configuration
## Usage
## Project Structure
## Troubleshooting
## License
```

**Acceptance Criteria**:
- [ ] Clear setup instructions
- [ ] Environment variable documentation
- [ ] Usage examples with screenshots

---

## Phase 7: Polish & Finalization

### Task 7.1: Error Handling Review
**Status**: Pending
**Priority**: Medium

**Review Areas**:
- LLM API failures
- Network errors
- Invalid user input
- Task cancellation
- IPC communication errors

**Acceptance Criteria**:
- [ ] All errors caught and logged
- [ ] User-friendly error messages
- [ ] No uncaught exceptions

### Task 7.2: Code Cleanup
**Status**: Pending
**Priority**: Low

**Tasks**:
- Remove console.log statements (except Log utility)
- Add JSDoc comments to public functions
- Ensure consistent code style
- Run TypeScript strict checks

**Acceptance Criteria**:
- [ ] No TypeScript errors
- [ ] Consistent formatting
- [ ] Helpful comments

---

## Task Dependencies

```
1.1 ──► 1.2 ──► 2.1 ──► 2.2 ──► 2.3 ──► 2.4
                               │
                               ▼
              3.1 ─────────────┤
                               │
                               ▼
              4.1 ──► 4.2 ──► 4.3
                               │
                               ▼
              5.1 ──► 5.2 ──► 6.1 ──► 6.2 ──► 7.1 ──► 7.2
```

## Estimated Effort

| Phase | Tasks | Estimated Hours |
|-------|-------|-----------------|
| Phase 1: Project Setup | 2 | 1-2h |
| Phase 2: Main Process | 4 | 3-4h |
| Phase 3: Preload | 1 | 0.5-1h |
| Phase 4: Renderer | 3 | 2-3h |
| Phase 5: Build | 2 | 1-2h |
| Phase 6: Testing/Docs | 2 | 2-3h |
| Phase 7: Polish | 2 | 1-2h |
| **Total** | **16** | **10-17h** |

## Implementation Notes

### Key Imports

```typescript
// Main process
import { app, BrowserWindow, WebContentsView, ipcMain } from 'electron';
import { XSky, Agent, Log, LLMs, StreamCallbackMessage } from '@xsky/ai-agent-core';
import { BrowserAgent, FileAgent, getPreloadPath } from '@xsky/ai-agent-electron';

// Preload
import { contextBridge, ipcRenderer } from 'electron';
```

### Security Checklist

- [ ] contextIsolation: true
- [ ] nodeIntegration: false
- [ ] sandbox: true
- [ ] IPC channel whitelist
- [ ] Input validation on all handlers
- [ ] No sensitive data in renderer console

### Common Pitfalls to Avoid

1. **Don't** use `remote` module (deprecated)
2. **Don't** enable `nodeIntegration` in renderer
3. **Don't** pass raw user input to `executeJavaScript`
4. **Don't** forget to handle window close/app quit
5. **Don't** hardcode API keys in source
