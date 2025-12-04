/**
 * The global configuration for the AI agent.
 * Controls behavior limits, compression settings, and feature flags.
 */
type GlobalConfig = {
  /** Product name identifier */
  name: string;
  /** Operating system platform */
  platform: "windows" | "mac" | "linux";
  /** Maximum number of reaction cycles for agent execution */
  maxReactNum: number;
  /** Maximum tokens for LLM requests */
  maxTokens: number;
  /** Maximum retry attempts for failed operations */
  maxRetryNum: number;
  /** Whether agents can execute in parallel */
  agentParallel: boolean;
  /** Message count threshold to trigger dialogue compression */
  compressThreshold: number;
  /** Token count threshold to trigger dialogue compression */
  compressTokensThreshold: number;
  /** Character length considered "large text" */
  largeTextLength: number;
  /** Maximum character length for file text content */
  fileTextMaxLength: number;
  /** Maximum number of images allowed in dialogue */
  maxDialogueImgFileNum: number;
  /** Whether tool results can include multimodal content */
  toolResultMultimodal: boolean;
  /** Whether to allow parallel tool calls */
  parallelToolCalls: boolean;
  /** Enable expert mode for advanced features */
  expertMode: boolean;
  /** Number of todo loop iterations in expert mode */
  expertModeTodoLoopNum: number;
  /** Whether to use DOM intelligence extraction */
  useDomIntelligence?: boolean;
  /** Maximum recent screenshots to keep in memory (0 = disabled) */
  maxRecentScreenshots: number;
  /** Enable coordinate-based mouse operations (click_at_coordinates, hover_at_coordinates, etc.) */
  enableCoordinateTools?: boolean;
  /** Screenshot scaling for optimal LLM processing */
  screenshotScaling: {
    /** Enable scaling (default: false for backward compatibility) */
    enabled: boolean;
    /** Maximum width in pixels (default: 1024 - XGA) */
    maxWidth: number;
    /** Maximum height in pixels (default: 768 - XGA) */
    maxHeight: number;
  };
}

/**
 * Default global configuration values.
 * These values can be overridden at runtime through configuration APIs.
 */
const config: GlobalConfig = {
  name: "Eko",
  platform: "mac",
  maxReactNum: 500,
  maxTokens: 16000,
  maxRetryNum: 3,
  agentParallel: false,
  compressThreshold: 80,
  compressTokensThreshold: 80000,
  largeTextLength: 8000,
  fileTextMaxLength: 20000,
  maxDialogueImgFileNum: 1,
  toolResultMultimodal: true,
  parallelToolCalls: true,
  expertMode: false,
  expertModeTodoLoopNum: 10,
  useDomIntelligence: false,
  maxRecentScreenshots: 0,
  enableCoordinateTools: true,
  screenshotScaling: {
    enabled: false,
    maxWidth: 1024,
    maxHeight: 768,
  },
};

export default config;