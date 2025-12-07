import {
  XSky,
  Agent,
  Log,
  LLMs,
  StreamCallbackMessage,
  SimpleSseMcpClient,
  SimpleHttpMcpClient,
} from "../../src/index";
import { TaskNodeStatusTool } from "../../src/tools";
import { LLMConfig } from "../config";

const llms: LLMs = {
  default: {
    provider: "anthropic",
    model: LLMConfig.anthropic.model,
    apiKey: LLMConfig.anthropic.apiKey || "",
    config: {
      baseURL: LLMConfig.anthropic.baseURL,
    },
  },
  openai: {
    provider: "openai",
    model: LLMConfig.openai.model,
    apiKey: LLMConfig.openai.apiKey || "",
    config: {
      baseURL: LLMConfig.openai.baseURL,
    },
  },
};

async function runWithSse() {
  Log.setLevel(0);
  let callback = {
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
  let sseUrl = "http://localhost:8083/sse";
  let mcpClient = new SimpleSseMcpClient(sseUrl);
  let agents: Agent[] = [
    new Agent({
      name: "SmartMall",
      description: "Provide product inquiry, inventory management, and order processing.",
      tools: [],
      // tools: [new TaskNodeStatusTool()],
      mcpClient: mcpClient,
      llms: Object.keys(llms),
    }),
  ];
  let xsky = new XSky({ llms, agents, callback });
  let result = await xsky.run(
    "I have 3000 RMB, please help me buy a Huawei MateBook X Pro and 1 Bluetooth earphone, 1 mobile power bank."
  );
  console.log("result: ", JSON.stringify(result));
}

async function runWithHttp() {
  Log.setLevel(0);
  let callback = {
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
  let httpUrl = "http://localhost:3088/mcp";
  let mcpClient = new SimpleHttpMcpClient(httpUrl);
  let agents: Agent[] = [
    new Agent({
      name: "Code",
      description: "Run code snippet.",
      tools: [],
      // tools: [new TaskNodeStatusTool()],
      mcpClient: mcpClient,
      llms: Object.keys(llms),
    }),
  ];
  let xsky = new XSky({ llms, agents, callback });
  let result = await xsky.run(
    "Execute the following JavaScript code: \n```\nconsole.log('Hello, world!');\n```"
  );
  console.log("result: ", JSON.stringify(result));
}



// const t = process.env.TEST_MCP ? test : test.skip;

test.skip("xsky", async () => {
  // await runWithSse();
  await runWithHttp();
});


