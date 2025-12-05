/**
 * @module @xsky/ai-agent-extension
 * Chrome extension adapter for XSky AI Agent framework.
 * Provides browser automation capabilities using Chrome Extension APIs.
 * 
 * This package enables AI agents to run within browser extensions,
 * allowing automation of web pages through content scripts and
 * background scripts with access to Chrome extension APIs.
 */

// Export the main browser agent implementation for Chrome extensions
export { BrowserAgent } from "./browser";