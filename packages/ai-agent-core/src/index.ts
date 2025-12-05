// Core framework imports
import config from "./config";                    // Global configuration settings
import Log from "./common/log";                   // Logging utility for consistent output
import { Planner } from "./core/plan";           // Workflow planning engine
import { RetryLanguageModel } from "./llm";      // LLM wrapper with retry logic
import { EkoMemory } from "./memory/memory";     // Memory management system
import { Eko, EkoDialogue } from "./core/index"; // Main orchestrator and dialogue interface
import Chain, { AgentChain } from "./core/chain"; // Workflow chain management
import Context, { AgentContext } from "./core/context"; // Execution context handling
import { SimpleSseMcpClient, SimpleHttpMcpClient } from "./mcp"; // Model Context Protocol clients

// Export the main Eko class as default for easy import
export default Eko;

// Core framework exports - main components for building AI agents
export {
  Eko,                      // Main orchestrator class for workflow execution
  EkoDialogue,             // Dialogue interface for chat-style interactions
  EkoMemory,               // Memory management for persistent state
  Log,                     // Logging utility
  config,                  // Global configuration
  Context,                 // Base context class
  Planner,                 // Workflow planning engine
  AgentContext,            // Context for agent execution
  Chain,                   // Workflow chain management
  AgentChain,              // Agent-specific chain implementation
  SimpleSseMcpClient,      // Server-Sent Events MCP client
  SimpleHttpMcpClient,     // HTTP-based MCP client
  RetryLanguageModel,      // LLM wrapper with retry capabilities
};

// Agent base classes and interfaces - foundation for creating specialized agents
export {
  Agent,                      // Base agent interface
  type AgentParams,          // Type definition for agent initialization parameters
  BaseFileAgent,             // Base class for file system agents
  BaseShellAgent,            // Base class for shell/command agents
  BaseComputerAgent,         // Base class for computer control agents
  BaseBrowserAgent,          // Base class for browser automation agents
  BaseBrowserLabelsAgent,    // Base class for label-based browser agents
  BaseBrowserScreenAgent,    // Base class for screen-based browser agents
} from "./agent";

// Built-in tools - core functionality available to all agents
export {
  HumanInteractTool,        // Tool for human-in-the-loop interactions
  TaskNodeStatusTool,       // Tool for managing task node status
  VariableStorageTool,      // Tool for persistent variable storage
  ForeachTaskTool,          // Tool for iterative task execution
  WatchTriggerTool,         // Tool for event-driven triggers
} from "./tools";

// Core type definitions - TypeScript interfaces for the framework
export {
  type LLMs,                  // Type definition for LLM provider configurations
  type LLMRequest,           // Type definition for LLM API requests
  type StreamCallback,       // Type definition for streaming response callbacks
  type HumanCallback,        // Type definition for human interaction callbacks
  type EkoConfig,            // Type definition for Eko configuration
  type Workflow,             // Type definition for workflow structures
  type WorkflowAgent,        // Type definition for workflow agent configurations
  type WorkflowNode,         // Type definition for workflow node structures
  type StreamCallbackMessage, // Type definition for streaming callback messages
} from "./types";

// Hooks and production types - interfaces for advanced workflow control
export type {
  AgentHooks,               // Type definition for agent lifecycle hooks
  ToolHookResult,           // Type definition for tool execution hook results
  ErrorHookResult,          // Type definition for error handling hook results
  AgentHookResult,          // Type definition for agent execution hook results
  ApprovalRequest,          // Type definition for approval workflow requests
  ApprovalResult,           // Type definition for approval workflow results
  Checkpoint,               // Type definition for workflow checkpoint structures
  StateConfig,              // Type definition for state management configuration
  ApprovalConfig,           // Type definition for approval system configuration
  RateLimitConfig,          // Type definition for rate limiting configuration
  ProductionEkoConfig,       // Type definition for production-ready Eko configuration
} from "./types/hooks.types";

// Utility functions - helper functions for common operations
export {
  mergeTools,               // Merge multiple tool collections into one
  toImage,                  // Convert data to image format
  toFile,                   // Convert data to file format
  convertToolSchema,        // Convert between different tool schema formats
  uuidv4,                   // Generate UUID v4 identifiers
  call_timeout,             // Utility for function call timeout handling
} from "./common/utils";

// Keyboard utilities - functions for keyboard input handling and automation
export {
  PLAYWRIGHT_KEY_MAP,       // Mapping of keyboard keys to Playwright format
  MODIFIER_KEYS,            // List of modifier keys (Ctrl, Alt, Shift, etc.)
  normalizeKey,             // Normalize keyboard input to standard format
  validateKey,              // Validate keyboard input
  keyCombination,           // Create key combinations (e.g., Ctrl+C)
  pressKeysInSequence,      // Press multiple keys in sequence
  typeText,                 // Type text with keyboard simulation
} from "./common/keyboard";

// XML workflow utilities - functions for parsing and building XML workflows
export {
  parseWorkflow,            // Parse XML workflow into internal representation
  resetWorkflowXml,         // Reset XML workflow to initial state
  buildSimpleAgentWorkflow, // Build simple XML workflow for single agent
} from "./common/xml";

// Specialized utility exports - domain-specific helper functions
export { buildAgentTree } from "./common/tree";                    // Build hierarchical agent tree structures
export { extract_page_content } from "./agent/browser/utils";     // Extract content from web pages
export { scaleCoordinates, scaleCoordinate } from "./common/coordinate-scaling"; // Scale coordinates between different screen resolutions

// Production utilities - advanced features for production deployments
export {
  RateLimiter,              // Rate limiting implementation
  RateLimitPresets,         // Pre-configured rate limit presets
  createRateLimitedHook,    // Create hook with rate limiting
  createBlocklistHook,      // Create hook for blocking operations
  createApprovalRequiredHook, // Create hook requiring approval
  createUrlSanitizerHook,   // Create hook for URL sanitization
  combineHooks,             // Combine multiple hooks into one
  createAuditHook,          // Create hook for audit logging
  createErrorRecoveryHook,  // Create hook for error recovery
} from "./utils";

// Security components - tools for secure agent execution
export {
  DefaultPermissionEvaluator, // Default implementation for permission evaluation
  InMemoryAuditLogger,       // In-memory audit logging implementation
  AuditLoggerFactory,        // Factory for creating audit loggers
  ToolExecutionSandbox,      // Sandbox for secure tool execution
  ToolSandboxFactory,        // Factory for creating tool sandboxes
  type ToolSandboxOptions,    // Type definition for sandbox configuration
  type SandboxResult,        // Type definition for sandbox execution results
} from "./security";

// Security type definitions - interfaces for security system components
export type {
  PermissionLevel,           // Enum for permission levels (allow, deny, etc.)
  ResourceType,             // Type definition for resource categorization
  SecurityPermission,        // Type definition for security permissions
  ToolConstraint,           // Type definition for tool execution constraints
  SecurityContext,          // Type definition for security execution context
  ResourceAccess,           // Type definition for resource access requests
  PermissionEvaluation,     // Type definition for permission evaluation results
  AuditLogEntry,            // Type definition for audit log entries
  SecurityConfig,           // Type definition for security system configuration
  IPermissionEvaluator,     // Interface for permission evaluators
  IAuditLogger,             // Interface for audit loggers
} from "./types/security.types";
