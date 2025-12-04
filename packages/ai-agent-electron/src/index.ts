/**
 * @module @xsky/ai-agent-electron
 * Electron desktop adapter for XSky AI Agent framework.
 * Provides browser automation and file system access for Electron applications
 * with support for secure contextIsolation mode.
 */

export { default as BrowserAgent } from "./browser";
export type { BrowserAgentSecurityOptions } from "./browser";
export { default as FileAgent } from "./file";
// export { ElectronComputerAgent } from "./computer"; // Temporarily disabled due to external dependencies
export { SimpleStdioMcpClient } from "./mcp/stdio";

// Re-export preload path helper for convenience
import * as path from "path";
import { fileURLToPath } from "url";

/**
 * Get the path to the bundled preload script.
 * Use this when setting up WebContentsView with contextIsolation.
 *
 * @example
 * ```typescript
 * import { getPreloadPath } from "@xsky/ai-agent-electron";
 *
 * const view = new WebContentsView({
 *   webPreferences: {
 *     contextIsolation: true,
 *     nodeIntegration: false,
 *     sandbox: true,
 *     preload: getPreloadPath()
 *   }
 * });
 * ```
 */
export function getPreloadPath(): string {
  // Handle both ESM and CJS environments
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return path.join(__dirname, "preload.js");
  } catch {
    // Fallback for CJS
    return path.join(__dirname, "preload.js");
  }
}