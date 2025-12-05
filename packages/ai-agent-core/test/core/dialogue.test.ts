import {
  Agent,
  Log,
  LLMs,
  StreamCallbackMessage,
  EkoDialogue,
  config,
} from "../../src/index";
import dotenv from "dotenv";
import {
  SimpleBrowserAgent,
  SimpleComputerAgent,
  SimpleFileAgent,
} from "./agents";
import { ChatStreamCallbackMessage } from "../../src/types";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const openaiBaseURL = process.env.CUSTOM_API_URL || "http://143.198.174.251:8317/v1";
const openaiApiKey = process.env.CUSTOM_API_KEY || "sk-anything";
const openaiModel = "gpt-5.1";

let provider = "openai-compatible";
let apiKey = openaiApiKey;
let baseURL = openaiBaseURL;
let model = openaiModel;

const llms: LLMs = {
  default: {
    provider: provider,
    model: model,
    apiKey: apiKey || "",
    config: {
      baseURL: baseURL,
    },
  },
};

const t = (apiKey) ? test : test.skip;

async function run() {
  // Decrease maxTokens for tests using models with lower limits
  config.maxTokens = 4000;

  Log.setLevel(0);
  const chatCallback = {
    onMessage: async (message: ChatStreamCallbackMessage) => {
      if (message.type == "text" && !message.streamDone) {
        return;
      }
      if (message.type == "tool_streaming") {
        return;
      }
      console.log("chat message: ", JSON.stringify(message, null, 2));
    },
  };
  const taskCallback = {
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
      console.log("eko message: ", JSON.stringify(message, null, 2));
    },
  };
  const agents: Agent[] = [
    new SimpleBrowserAgent(),
    new SimpleComputerAgent(),
    new SimpleFileAgent(),
  ];
  const segmentedExecution: boolean = true;
  const dialogue = new EkoDialogue({ llms, agents, segmentedExecution });
  const result1 = await dialogue.chat({
    user: "Hello",
    callback: {
      chatCallback,
      taskCallback,
    },
  });
  console.log("=================>\nresult1: ", result1);
  const result2 = await dialogue.chat({
    user: "Search for information about Musk",
    callback: {
      chatCallback,
      taskCallback,
    },
  });
  console.log("=================>\nresult2: ", result2);
  if (segmentedExecution) {
    const result3 = await dialogue.chat({
      user: "Modify the plan: search on X and focus on Tesla information",
      callback: {
        chatCallback,
        taskCallback,
      },
    });
    console.log("=================>\nresult3: ", result3);
    const result4 = await dialogue.segmentedExecution({
      callback: {
        chatCallback,
        taskCallback,
      },
    });
    console.log("=================>\nresult4: ", result4);
  }
}

t("dialogue", async () => {
  await run();
}, 300000);
