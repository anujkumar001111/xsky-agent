// Load environment variables for API keys and configuration
import dotenv from "dotenv";
// Import core framework components
import { BrowserAgent, FileAgent } from "@xsky/ai-agent-nodejs";  // Node.js-specific agents
import { XSky, Agent, Log, LLMs, StreamCallbackMessage } from "@xsky/ai-agent-core"; // Core framework

// Initialize environment configuration
dotenv.config();

// Extract LLM provider configurations from environment variables
const openaiBaseURL = process.env.OPENAI_BASE_URL;
const openaiApiKey = process.env.OPENAI_API_KEY;
const claudeBaseURL = process.env.ANTHROPIC_BASE_URL;
const claudeApiKey = process.env.ANTHROPIC_API_KEY;

// Configure available language models with their API credentials
const llms: LLMs = {
  // Default LLM - Anthropic Claude for high-quality reasoning
  default: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    apiKey: claudeApiKey || "",
    config: {
      baseURL: claudeBaseURL,
    },
  },
  // Alternative LLM - OpenAI GPT for cost-effective processing
  openai: {
    provider: "openai",
    model: "gpt-5-mini",
    apiKey: openaiApiKey || "",
    config: {
      baseURL: openaiBaseURL,
    },
  },
};

// Configure streaming callback for real-time execution monitoring
const callback = {
  onMessage: async (message: StreamCallbackMessage) => {
    // Filter out intermediate streaming messages to reduce noise
    if (message.type == "workflow" && !message.streamDone) {
      return;
    }
    if (message.type == "text" && !message.streamDone) {
      return;
    }
    if (message.type == "tool_streaming") {
      return;
    }
    // Log final messages for debugging and monitoring
    console.log("message: ", JSON.stringify(message, null, 2));
  },
};

/**
 * Main execution function demonstrating the XSky AI Agent framework.
 * 
 * This example shows:
 * 1. Setting up multiple agents (Browser + File)
 * 2. Configuring LLM providers with environment variables
 * 3. Creating an XSky orchestrator instance
 * 4. Running a complex multi-step task that requires both agents
 * 
 * The task "Search for the latest news about Musk, summarize and save to desktop as Musk.md"
 * demonstrates the framework's ability to:
 * - Use BrowserAgent to search and gather web information
 * - Use FileAgent to process and save the results
 * - Coordinate between agents automatically through the XSky orchestrator
 */
async function run() {
  // Enable detailed logging for debugging
  Log.setLevel(1);

  // Initialize agents with different capabilities
  const agents: Agent[] = [
    new BrowserAgent(),  // For web search and content extraction
    new FileAgent()       // For file operations and saving results
  ];

  // Create the main orchestrator with LLMs, agents, and callbacks
  const xsky = new XSky({ llms, agents, callback });

  // Define the prompt for the task
  const prompt = "Search for the latest news about Musk, summarize and save to desktop as Musk.md";

  // Execute a complex task that requires both browser and file capabilities
  const result = await xsky.run(prompt);

  // Output the final result
  console.log("result: ", result.result);
}

// Execute the main function with error handling
run().catch((e) => {
  console.log(e);
});
