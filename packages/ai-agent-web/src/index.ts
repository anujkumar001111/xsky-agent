/**
 * @module @xsky/ai-agent-web
 * Web browser adapter for XSky AI Agent framework.
 * Provides browser automation capabilities for web applications using html2canvas for screenshots.
 * 
 * This package enables AI agents to run directly in web browsers with:
 * - In-page DOM manipulation and interaction
 * - Screenshot capture using html2canvas library
 * - Client-side web automation without server dependencies
 * - Integration with existing web applications
 */

// Export the main browser agent for web-based AI automation
export { BrowserAgent } from "./browser.js";