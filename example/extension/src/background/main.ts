import { XSky, LLMs, StreamCallbackMessage } from "@xsky/ai-agent-core";
import { StreamCallback, HumanCallback } from "@xsky/ai-agent-core/types";
import { BrowserAgent } from "@xsky/ai-agent-extension";

function printLog(message: string, type: "info" | "error" | "success" = "info") {
  const result = { message, type };
  return result;
}

export async function main(prompt: string): Promise<XSky> {
  let config = await getLLMConfig();
  if (!config || !config.apiKey) {
    printLog("Please configure apiKey, configure in the XSky extension options of the browser extensions.", "error");
    throw new Error("apiKey not configured");
  }

  const llms: LLMs = {
    default: {
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      config: {
        baseURL: config.baseURL,
      },
    },
  };

  const callback: StreamCallback = {
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
      chrome.runtime.sendMessage({ type: "message", data: message });
    },
  };

  let agents = [new BrowserAgent()];
  let xsky = new XSky({ llms, agents, callback });

  await xsky.run(prompt);
  return xsky;
}

async function getLLMConfig(): Promise<any> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["llmConfig"], (result) => {
      resolve(result.llmConfig);
    });
  });
}
