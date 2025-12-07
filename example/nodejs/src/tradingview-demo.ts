// TradingView Bitcoin Chart Demo - Mark Important Levels
// This demo showcases the XSky AI Agent's browser automation capabilities
import dotenv from "dotenv";
import { BrowserAgent } from "@xsky/ai-agent-nodejs";
import { Eko, Agent, Log, LLMs, StreamCallbackMessage, config } from "@xsky/ai-agent-core";

// Initialize environment configuration
dotenv.config({ path: "../../.env" });

// Use custom OpenAI-compatible API endpoint
const apiKey = process.env.OPENAI_COMPATABLE_API_KEY || "";
const baseURL = process.env.OPENAI_COMPATABLE_BASE_URL || "";
const model = process.env.OPENAI_COMPATABLE_MODEL || "qwen3-coder-plus";

// Configure LLMs - using custom OpenAI-compatible API
const llms: LLMs = {
    default: {
        provider: "openai",
        model: model,
        apiKey: apiKey,
        config: {
            baseURL: baseURL,
        },
    },
};

// Enable coordinate tools for precise TradingView chart interactions
config.enableCoordinateTools = true;

// Configure streaming callback for monitoring
const callback = {
    onMessage: async (message: StreamCallbackMessage) => {
        if (message.type == "workflow" && !message.streamDone) return;
        if (message.type == "text" && !message.streamDone) return;
        if (message.type == "tool_streaming") return;
        console.log("message: ", JSON.stringify(message, null, 2));
    },
};

async function run() {
    // Enable detailed logging
    Log.setLevel(1);

    // Initialize browser agent with headed mode for visibility
    const browserAgent = new BrowserAgent();
    browserAgent.setHeadless(false); // Show browser for debugging

    const agents: Agent[] = [browserAgent];

    // Create orchestrator
    const eko = new Eko({ llms, agents, callback });

    // Execute TradingView Bitcoin Chart task with improved instructions
    const task = `
    You are a trading assistant. Navigate to TradingView and mark important price levels on the Bitcoin chart.

    **Step 1: Navigate to TradingView**
    - Go to https://www.tradingview.com/chart/
    - Use wait_for_navigation to ensure the page loads completely
    
    **Step 2: Load Bitcoin Chart**
    - Click on the symbol search input at the top
    - Type "BTCUSD" and wait for search results
    - Click on BTCUSD from a major exchange (Coinbase, Bitstamp, or Kraken)
    - Wait for the chart to load
    
    **Step 3: Set Daily Timeframe**
    - Find and click the timeframe selector
    - Select "1D" or "D" for daily candles
    
    **Step 4: Draw Support and Resistance Lines**
    - Click on the drawing tools in the left sidebar (trend line icon)
    - Select "Horizontal Line" tool
    - Use click_at_coordinates to place horizontal lines at:
      - A visible support level (recent swing low)
      - A visible resistance level (recent swing high)
    
    **Step 5: Save the Result**
    - Use save_screenshot to capture the final chart with marked levels
    - Save it as "btc_chart_levels.png"
    
    Be patient with page loads and ensure each action completes before the next.
  `;

    console.log("Starting TradingView Bitcoin analysis...");
    console.log("Using custom API:", baseURL, "with model:", model);

    try {
        const result = await eko.run(task);
        console.log("Result:", result.result);
    } catch (error) {
        console.error("Task failed:", error);
    }
}

run().catch((e) => {
    console.error("Error:", e);
});
