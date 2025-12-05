/**
 * @module @xsky/ai-agent-nodejs
 * Node.js adapter for XSky AI Agent framework.
 * Provides Playwright-based browser automation and native filesystem access.
 * 
 * This package enables AI agents to run in Node.js environments with:
 * - Full Playwright browser automation capabilities
 * - Native file system access for file operations
 * - MCP (Model Context Protocol) support via stdio
 * - CDP (Chrome DevTools Protocol) endpoint utilities
 */

// Import utility functions for browser automation
import { getCdpWsEndpoint } from "./utils";

// Export core components for Node.js AI agent development
export { getCdpWsEndpoint };           // Utility for getting Chrome DevTools Protocol endpoint
export { BrowserAgent } from "./browser";  // Playwright-based browser automation agent
export { FileAgent } from "./file";        // Native file system access agent
export { SimpleStdioMcpClient } from "./mcp/stdio"; // MCP client for stdio communication