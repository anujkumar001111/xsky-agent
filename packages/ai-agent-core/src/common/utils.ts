import { Agent } from "../agent";
import { Tool, ToolSchema } from "../types/tools.types";
import { LanguageModelV2FunctionTool } from "@ai-sdk/provider";

/**
 * Sleeps for a specified amount of time.
 * @param time - The time to sleep in milliseconds.
 * @returns A promise that resolves when the time has passed.
 */
export function sleep(time: number): Promise<void> {
  return new Promise((resolve) => setTimeout(() => resolve(), Math.max(0, time)));
}

/**
 * Generates a UUID v4.
 * @returns A UUID v4.
 */
export function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Calls a function with a timeout.
 * @param fun - The function to call.
 * @param timeout - The timeout in milliseconds.
 * @param error_callback - A callback to call if the function times out.
 * @returns A promise that resolves with the result of the function or rejects if the function times out.
 */
export function call_timeout<R extends Promise<any>>(
  fun: () => R,
  timeout: number,
  error_callback?: (e: string) => void
): Promise<R> {
  return new Promise(async (resolve, reject) => {
    let timer = setTimeout(() => {
      reject(new Error("Timeout"));
      error_callback && error_callback("Timeout");
    }, timeout);
    try {
      const result = await fun();
      clearTimeout(timer);
      resolve(result);
    } catch (e) {
      clearTimeout(timer);
      reject(e);
      error_callback && error_callback(e + "");
    }
  });
}

/**
 * Converts a tool schema to a language model function tool.
 * @param tool - The tool schema to convert.
 * @returns The converted language model function tool.
 */
export function convertToolSchema(
  tool: ToolSchema
): LanguageModelV2FunctionTool {
  if ("function" in tool) {
    return {
      type: "function",
      name: tool.function.name,
      description: tool.function.description,
      inputSchema: tool.function.parameters,
    };
  } else if ("input_schema" in tool) {
    return {
      type: "function",
      name: tool.name,
      description: tool.description,
      inputSchema: tool.input_schema,
    };
  } else if ("inputSchema" in tool) {
    return {
      type: "function",
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    };
  } else {
    return {
      type: "function",
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters,
    };
  }
}

/**
 * Converts a media data string to an image.
 * @param mediaData - The media data to convert.
 * @returns The converted image.
 */
export function toImage(mediaData: string): Uint8Array | string | URL {
  return toFile(mediaData);
}

/**
 * Converts a media data string to a file.
 * @param mediaData - The media data to convert.
 * @param type - The type of the media data.
 * @returns The converted file.
 */
export function toFile(mediaData: string, type: "base64|url" | "binary|url" = "base64|url"): Uint8Array | string | URL {
  if (mediaData.startsWith("http://") || mediaData.startsWith("https://")) {
    return new URL(mediaData);
  } else if (mediaData.startsWith("//") && mediaData.indexOf(".") > 0 && mediaData.length < 1000) {
    return new URL("https:" + mediaData);
  }
  if (mediaData.startsWith("data:")) {
    mediaData = mediaData.substring(mediaData.indexOf(",") + 1);
  }
  if (type === "binary|url") {
    // @ts-ignore
    if (typeof Buffer != "undefined") {
      // @ts-ignore
      const buffer = Buffer.from(mediaData, "base64");
      return new Uint8Array(buffer);
    } else {
      const binaryString = atob(mediaData);
      const fileData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        fileData[i] = binaryString.charCodeAt(i);
      }
      return fileData;
    }
  } else {
    return mediaData;
  }
}

/**
 * Mapping of file extensions to MIME types for common file formats.
 */
const EXTENSION_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.csv': 'text/csv',
};

/**
 * Gets the MIME type of a data string.
 * @param data - The data string to get the MIME type of.
 * @returns The MIME type of the data string.
 */
export function getMimeType(data: string | undefined | null): string {
  const defaultType = "image/png";
  if (!data) {
    return defaultType;
  }

  // Extract MIME type from data URI
  if (data.startsWith("data:")) {
    return data.split(";")[0].split(":")[1] || defaultType;
  }

  // Check for file extension in the data string
  if (data.indexOf(".") > -1) {
    for (const [ext, mimeType] of Object.entries(EXTENSION_MIME_TYPES)) {
      if (data.indexOf(ext) > -1) {
        return mimeType;
      }
    }
  }

  return defaultType;
}

/**
 * Merges two lists of tools.
 * @param tools1 - The first list of tools.
 * @param tools2 - The second list of tools.
 * @returns The merged list of tools.
 */
export function mergeTools<T extends Tool | LanguageModelV2FunctionTool>(tools1: T[], tools2: T[]): T[] {
  let tools: T[] = [];
  let toolMap2 = tools2.reduce((map, tool) => {
    map[tool.name] = tool;
    return map;
  }, {} as Record<string, T>);
  let names = [];
  for (let i = 0; i < tools1.length; i++) {
    let tool1 = tools1[i];
    let tool2 = toolMap2[tool1.name];
    if (tool2) {
      tools.push(tool2);
      delete toolMap2[tool1.name];
    } else {
      tools.push(tool1);
    }
  }
  for (let i = 0; i < tools2.length; i++) {
    let tool2 = tools2[i];
    if (toolMap2[tool2.name] && names.indexOf(tool2.name) === -1) {
      tools.push(tool2);
      names.push(tool2.name);
    }
  }
  return tools;
}

/**
 * Merges two lists of agents.
 * @param agents1 - The first list of agents.
 * @param agents2 - The second list of agents.
 * @returns The merged list of agents.
 */
export function mergeAgents(agents1: Agent[], agents2: Agent[]): Agent[] {
  let agents: Agent[] = [];
  let agentMap2 = agents2.reduce((map, agent) => {
    map[agent.Name] = agent;
    return map;
  }, {} as Record<string, Agent>);
  for (let i = 0; i < agents1.length; i++) {
    let agent1 = agents1[i];
    let agent2 = agentMap2[agent1.Name];
    if (agent2) {
      agents.push(agent2);
      delete agentMap2[agent1.Name];
    } else {
      agents.push(agent1);
    }
  }
  for (let i = 0; i < agents2.length; i++) {
    let agent2 = agents2[i];
    if (agentMap2[agent2.Name]) {
      agents.push(agent2);
    }
  }
  return agents;
}

/**
 * Substrings a string to a maximum length.
 * @param str - The string to substring.
 * @param maxLength - The maximum length of the string.
 * @param appendPoint - Whether to append "..." to the end of the string if it is too long.
 * @returns The substringed string.
 */
export function sub(
  str: string,
  maxLength: number,
  appendPoint: boolean = true
): string {
  if (!str) {
    return "";
  }
  if (str.length > maxLength) {
    // return str.substring(0, maxLength) + (appendPoint ? "..." : "");
    return Array.from(str).slice(0, maxLength).join('') + (appendPoint ? "..." : "");
  }
  return str;
}

/**
 * Fixes a JSON string.
 * @param code - The JSON string to fix.
 * @returns The fixed JSON object.
 */
export function fixJson(code: string) {
  if (!code) {
    return {};
  }
  try {
    return JSON.parse(code);
  } catch (e) { }
  try {
    return JSON.parse(code + "\"}");
  } catch (e) { }
  const stack: string[] = [];
  for (let i = 0; i < code.length; i++) {
    let s = code[i];
    if (s === "{") {
      stack.push("}");
    } else if (s === "}") {
      stack.pop();
    } else if (s === "[") {
      stack.push("]");
    } else if (s === "]") {
      stack.pop();
    } else if (s === '"') {
      if (stack[stack.length - 1] === '"') {
        stack.pop();
      } else {
        stack.push('"');
      }
    }
  }
  const missingParts = [];
  while (stack.length > 0) {
    missingParts.push(stack.pop());
  }
  let json = code + missingParts.join("");
  try {
    return JSON.parse(json);
  } catch (e) {
    return {};
  }
}

/**
 * Fixes an XML tag.
 * @param code - The XML tag to fix.
 * @returns The fixed XML tag.
 */
export function fixXmlTag(code: string) {
  code = code.trim();
  if (code.endsWith("<")) {
    code = code.substring(0, code.length - 1);
  }
  if (code.indexOf('&') > -1) {
    code = code.replace(/&(?![a-zA-Z0-9#]+;)/g, '&amp;');
  }
  function fixDoubleChar(code: string) {
    const stack: string[] = [];
    for (let i = 0; i < code.length; i++) {
      let s = code[i];
      if (s === "<") {
        stack.push(">");
      } else if (s === ">") {
        stack.pop();
      } else if (s === '"') {
        if (stack[stack.length - 1] === '"') {
          stack.pop();
        } else {
          stack.push('"');
        }
      }
    }
    const missingParts = [];
    while (stack.length > 0) {
      missingParts.push(stack.pop());
    }
    return code + missingParts.join("");
  }
  let eIdx = code.lastIndexOf(" ");
  let endStr = eIdx > -1 ? code.substring(eIdx + 1) : "";
  if (code.endsWith("=")) {
    code += '""';
  } else if (
    endStr == "name" ||
    endStr == "id" ||
    endStr == "depen" ||
    endStr == "depends" ||
    endStr == "dependsOn" ||
    endStr == "input" ||
    endStr == "output" ||
    endStr == "items" ||
    endStr == "event" ||
    endStr == "loop"
  ) {
    let idx1 = code.lastIndexOf(">");
    let idx2 = code.lastIndexOf("<");
    if (idx1 < idx2 && code.lastIndexOf(" ") > idx2) {
      code += '=""';
    }
  }
  code = fixDoubleChar(code);
  const stack: string[] = [];
  function isSelfClosing(tag: string) {
    return tag.endsWith("/>");
  }
  for (let i = 0; i < code.length; i++) {
    let s = code[i];
    if (s === "<") {
      const isEndTag = code[i + 1] === "/";
      let endIndex = code.indexOf(">", i);
      let tagContent = code.slice(i, endIndex + 1);
      if (isSelfClosing(tagContent)) {
      } else if (isEndTag) {
        stack.pop();
      } else {
        stack.push(tagContent);
      }
      if (endIndex == -1) {
        break;
      }
      i = endIndex;
    }
  }
  const missingParts = [];
  while (stack.length > 0) {
    const top = stack.pop() as string;
    if (top.startsWith("<")) {
      let arr = top.match(/<(\w+)/) as string[];
      if (arr) {
        const tagName = arr[1];
        missingParts.push(`</${tagName}>`);
      }
    } else {
      missingParts.push(top);
    }
  }
  let completedCode = code + missingParts.join("");
  return completedCode;
}
