// Eko orchestrator integration test
// Tests the core workflow execution engine with browser and file agents
import {
  Eko,                    // Main orchestrator class
  Agent,                  // Agent interface
  Log,                    // Logging utility
  LLMs,                   // LLM configuration type
  StreamCallbackMessage,  // Streaming callback message type
} from "../../src/index";
import dotenv from "dotenv"; // Environment variable loader
import { SimpleBrowserAgent, SimpleFileAgent } from "./agents"; // Test agent implementations

// Load environment configuration for API keys
dotenv.config();

// Extract OpenAI configuration from environment
const openaiBaseURL = process.env.OPENAI_BASE_URL;
const openaiApiKey = process.env.OPENAI_API_KEY;

// Configure LLM provider for testing
const llms: LLMs = {
  default: {
    provider: "openai",
    model: "gpt-4o",      // Use GPT-4 for reliable test results
    apiKey: openaiApiKey || "",
    config: {
      baseURL: openaiBaseURL,
    },
  },
};

/**
 * Integration test for the Eko orchestrator.
 *
 * This test verifies that the core workflow execution engine can:
 * 1. Initialize with multiple agent types
 * 2. Process natural language tasks
 * 3. Coordinate between browser and file agents
 * 4. Handle streaming callbacks appropriately
 * 5. Return meaningful results
 */
async function run() {
  Log.setLevel(0);
  const callback = {
    onMessage: async (message: StreamCallbackMessage) => {
      if (message.type == "workflow" && !message.streamDone) {
        return;
      }
      if (message.type == "text" && !message.streamDone) {
        return;
      }
      if (message.type == "tool_streaming") {
        return;
      }
      console.log("message: ", JSON.stringify(message, null, 2));
    },
  };
  const agents: Agent[] = [
    new SimpleBrowserAgent(),
    new SimpleFileAgent(),
  ];
  const eko = new Eko({ llms, agents, callback });
  const result = await eko.run("Read the desktop file list");
  console.log("result: ", result.result);
}

const t = process.env.OPENAI_API_KEY ? test : test.skip;

t("eko", async () => {
  await run();
});
