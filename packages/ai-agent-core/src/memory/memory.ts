import { LanguageModelV2Message } from "@ai-sdk/provider";
import { toFile, uuidv4, getMimeType, sub } from "../common/utils";
import { EkoMessage, LanguageModelV2Prompt } from "../types";
import { defaultMessageProviderOptions } from "../agent/llm";
import config from "../config";

/**
 * Configuration options for EkoMemory instance.
 * @property maxMessages - Maximum number of messages to retain in memory.
 * @property maxTokens - Maximum estimated token count before trimming.
 * @property enableCompression - Whether to compress long messages.
 * @property compressionThreshold - Message count threshold to trigger compression.
 * @property compressionMaxLength - Maximum character length before truncating content.
 */
export interface MemoryConfig {
  maxMessages?: number;
  maxTokens?: number;
  enableCompression?: boolean;
  compressionThreshold?: number;
  compressionMaxLength?: number;
  /** Maximum recent screenshots to keep (0 = disabled, uses global config) */
  maxRecentScreenshots?: number;
}

/**
 * Memory management class for maintaining conversation history with LLMs.
 * Handles message storage, capacity management, token estimation, and compression.
 */
export class EkoMemory {
  /** The system prompt to prepend to all conversations */
  protected systemPrompt: string;
  /** Array of conversation messages */
  protected messages: EkoMessage[];
  /** Maximum number of messages to retain */
  private maxMessages: number;
  /** Maximum estimated token count */
  private maxTokens: number;
  /** Whether compression is enabled */
  private enableCompression: boolean;
  /** Message count threshold for compression */
  private compressionThreshold: number;
  /** Maximum content length before truncation */
  private compressionMaxLength: number;
  /** Maximum recent screenshots to keep (0 = disabled) */
  private maxRecentScreenshots: number;

  /**
   * Creates a new EkoMemory instance.
   * @param systemPrompt - The system prompt to use for conversations.
   * @param messages - Initial messages to populate the memory with.
   * @param config - Optional configuration options.
   */
  constructor(
    systemPrompt: string,
    messages: EkoMessage[] = [],
    memoryConfig: MemoryConfig = {}
  ) {
    this.messages = messages;
    this.systemPrompt = systemPrompt;
    this.maxMessages = memoryConfig.maxMessages ?? 15;
    this.maxTokens = memoryConfig.maxTokens ?? 16000;
    this.enableCompression = memoryConfig.enableCompression ?? false;
    this.compressionThreshold = memoryConfig.compressionThreshold ?? 10;
    this.compressionMaxLength = memoryConfig.compressionMaxLength ?? 4000;
    this.maxRecentScreenshots = memoryConfig.maxRecentScreenshots ?? config.maxRecentScreenshots;
  }

  /**
   * Generates a unique message identifier.
   * @returns A UUID string for message identification.
   */
  public genMessageId(): string {
    return uuidv4();
  }

  /**
   * Imports messages and optionally updates configuration.
   * @param data - Object containing messages and optional config to import.
   * @returns A promise that resolves when import is complete.
   */
  public async import(data: {
    messages: EkoMessage[];
    config?: MemoryConfig;
  }): Promise<void> {
    this.messages = [...data.messages];
    if (data.config) {
      await this.updateConfig(data.config);
    } else {
      await this.manageCapacity();
    }
  }

  /**
   * Adds new messages to memory and manages capacity.
   * @param messages - Array of messages to add.
   * @returns A promise that resolves when messages are added.
   */
  public async addMessages(messages: EkoMessage[]): Promise<void> {
    this.messages.push(...messages);
    await this.manageCapacity();
  }

  /**
   * Retrieves all messages in memory.
   * @returns Array of all stored messages.
   */
  public getMessages(): EkoMessage[] {
    return this.messages;
  }

  /**
   * Finds a message by its unique identifier.
   * @param id - The message ID to search for.
   * @returns The message if found, undefined otherwise.
   */
  public getMessageById(id: string): EkoMessage | undefined {
    return this.messages.find((message) => message.id === id);
  }

  /**
   * Removes a message and optionally subsequent messages until the next user message.
   * @param id - The ID of the message to remove.
   * @param removeToNextUserMessages - If true, also removes messages until the next user message.
   * @returns Array of removed message IDs, or undefined if message not found.
   */
  public removeMessageById(
    id: string,
    removeToNextUserMessages: boolean = true
  ): string[] | undefined {
    const removedIds: string[] = [];
    for (let i = 0; i < this.messages.length; i++) {
      const message = this.messages[i];
      if (message.id === id) {
        removedIds.push(id);
        if (removeToNextUserMessages) {
          for (let j = i + 1; j < this.messages.length; j++) {
            const nextMessage = this.messages[j];
            if (nextMessage.role == "user") {
              break;
            }
            removedIds.push(nextMessage.id);
          }
        }
        this.messages.splice(i, removedIds.length);
        break;
      }
    }
    return removedIds.length > 0 ? removedIds : undefined;
  }

  /**
   * Estimates the total token count for all messages including optionally the system prompt.
   * @param calcSystemPrompt - Whether to include the system prompt in the token count.
   * @returns Estimated total token count.
   */
  public getEstimatedTokens(calcSystemPrompt: boolean = true): number {
    let tokens = 0;
    if (calcSystemPrompt) {
      tokens += this.calcTokens(this.systemPrompt);
    }
    return this.messages.reduce((total, message) => {
      const content =
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content);
      return total + this.calcTokens(content);
    }, tokens);
  }

  /**
   * Calculates estimated token count for a string.
   * Uses a heuristic: Chinese characters count as 1 token each, other characters as 1 token per 4.
   * @param content - The string content to estimate tokens for.
   * @returns Estimated token count.
   */
  protected calcTokens(content: string): number {
    // Simple estimation: Each Chinese character is 1 token, other characters are counted as 1 token for every 4.
    const chineseCharCount = (content.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherCharCount = content.length - chineseCharCount;
    return chineseCharCount + Math.ceil(otherCharCount / 4);
  }

  /**
   * Updates memory configuration and triggers capacity management.
   * @param config - Partial configuration object with values to update.
   * @returns A promise that resolves when configuration is applied.
   */
  public async updateConfig(config: Partial<MemoryConfig>): Promise<void> {
    if (config.maxMessages !== undefined) {
      this.maxMessages = config.maxMessages;
    }
    if (config.maxTokens !== undefined) {
      this.maxTokens = config.maxTokens;
    }
    if (config.enableCompression !== undefined) {
      this.enableCompression = config.enableCompression;
    }
    if (config.compressionThreshold !== undefined) {
      this.compressionThreshold = config.compressionThreshold;
    }
    if (config.compressionMaxLength !== undefined) {
      this.compressionMaxLength = config.compressionMaxLength;
    }
    if (config.maxRecentScreenshots !== undefined) {
      this.maxRecentScreenshots = config.maxRecentScreenshots;
    }
    await this.manageCapacity();
  }

  /**
   * Hook for implementing dynamic system prompt updates based on message context.
   * Override this method to implement RAG (Retrieval Augmented Generation) or similar patterns.
   * @param messages - Current messages in memory for context analysis.
   * @returns A promise that resolves when the system prompt is updated.
   */
  protected async dynamicSystemPrompt(messages: EkoMessage[]): Promise<void> {
    // RAG dynamic system prompt
  }

  /**
   * Manages memory capacity by trimming old messages, compressing content, and enforcing token limits.
   * Called automatically after adding messages or updating configuration.
   * @returns A promise that resolves when capacity management is complete.
   */
  protected async manageCapacity(): Promise<void> {
    if (this.messages[this.messages.length - 1].role == "user") {
      await this.dynamicSystemPrompt(this.messages);
    }
    if (this.messages.length > this.maxMessages) {
      const excess = this.messages.length - this.maxMessages;
      this.messages.splice(0, excess);
    }
    // Filter old screenshots if enabled
    if (this.maxRecentScreenshots > 0) {
      this.filterOldScreenshots(this.maxRecentScreenshots);
    }
    if (
      this.enableCompression &&
      this.messages.length > this.compressionThreshold
    ) {
      // compress messages
      for (let i = 0; i < this.messages.length; i++) {
        const message = this.messages[i];
        if (message.role == "assistant") {
          message.content = message.content.map((part) => {
            if (
              part.type == "text" &&
              part.text.length > this.compressionMaxLength
            ) {
              return {
                type: "text",
                text: sub(part.text, this.compressionMaxLength, true),
              };
            }
            return part;
          });
        }
        if (message.role == "tool") {
          message.content = message.content.map((part) => {
            if (
              typeof part.result === "string" &&
              part.result.length > this.compressionMaxLength
            ) {
              return {
                ...part,
                result: sub(part.result, this.compressionMaxLength, true),
              };
            }
            return part;
          });
        }
      }
    }
    while (
      this.getEstimatedTokens(true) > this.maxTokens &&
      this.messages.length > 0
    ) {
      this.messages.shift();
    }
    this.fixDiscontinuousMessages();
  }

  /**
   * Repairs message sequence discontinuities to ensure valid conversation structure.
   * Ensures messages start with a user message, removes duplicate user messages,
   * and adds placeholder tool results for orphaned tool calls.
   */
  public fixDiscontinuousMessages() {
    if (this.messages.length > 0 && this.messages[0].role != "user") {
      for (let i = 0; i < this.messages.length; i++) {
        const message = this.messages[i];
        if (message.role == "user") {
          this.messages.splice(0, i);
          break;
        }
      }
    }
    const removeIds: string[] = [];
    let lastMessage: EkoMessage | null = null;
    for (let i = 0; i < this.messages.length; i++) {
      const message = this.messages[i];
      if (
        message.role == "user" &&
        lastMessage &&
        lastMessage.role == "user" &&
        message.content == lastMessage.content
      ) {
        // remove duplicate user messages
        removeIds.push(message.id);
      }
      if (
        lastMessage &&
        lastMessage.role == "assistant" &&
        lastMessage.content.filter((part) => part.type == "tool-call").length >
          0 &&
        message.role != "tool"
      ) {
        // add tool result message
        this.messages.push({
          role: "tool",
          id: this.genMessageId(),
          timestamp: message.timestamp + 1,
          content: lastMessage.content
            .filter((part) => part.type == "tool-call")
            .map((part) => {
              return {
                type: "tool-result",
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                result: "Error: No result",
              };
            }),
        });
      }
      lastMessage = message;
    }
    if (removeIds.length > 0) {
      removeIds.forEach((id) => this.removeMessageById(id));
    }
  }

  /**
   * Determines if a content part is a screenshot image.
   * Screenshots are identified by their mime type (image/jpeg or image/png)
   * and optionally by associated text mentioning "screenshot".
   * @param part - The content part to check.
   * @returns True if the content part is a screenshot.
   */
  private isScreenshot(part: any): boolean {
    if (part.type !== "image" && part.type !== "file") {
      return false;
    }
    const mimeType = part.mimeType || part.mediaType || "";
    return mimeType.startsWith("image/");
  }

  /**
   * Filters old screenshots, keeping only the N most recent ones.
   * Old screenshots are replaced with a "[screenshot]" placeholder text.
   * This reduces token usage while preserving context.
   * @param keepCount - Number of most recent screenshots to keep.
   */
  public filterOldScreenshots(keepCount: number): void {
    if (keepCount <= 0) {
      return;
    }

    // Collect all screenshot positions (message index, content index)
    const screenshotPositions: Array<{ msgIdx: number; contentIdx: number }> = [];

    for (let msgIdx = 0; msgIdx < this.messages.length; msgIdx++) {
      const message = this.messages[msgIdx];
      if (message.role !== "user" || typeof message.content === "string") {
        continue;
      }
      for (let contentIdx = 0; contentIdx < message.content.length; contentIdx++) {
        const part = message.content[contentIdx];
        if (this.isScreenshot(part)) {
          screenshotPositions.push({ msgIdx, contentIdx });
        }
      }
    }

    // If we have more screenshots than allowed, replace older ones
    if (screenshotPositions.length <= keepCount) {
      return;
    }

    // Keep the last N screenshots, replace others with placeholder
    const toReplace = screenshotPositions.slice(0, screenshotPositions.length - keepCount);

    for (const pos of toReplace) {
      const message = this.messages[pos.msgIdx];
      if (typeof message.content !== "string") {
        (message.content as any)[pos.contentIdx] = {
          type: "text",
          text: "[screenshot]",
        };
      }
    }
  }

  /**
   * Gets the current system prompt.
   * @returns The system prompt string.
   */
  public getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Retrieves the first user message in the conversation.
   * @returns The first user message, or undefined if no user messages exist.
   */
  public getFirstUserMessage(): EkoMessage | undefined {
    return this.messages.filter((message) => message.role === "user")[0];
  }

  /**
   * Retrieves the most recent user message in the conversation.
   * @returns The last user message, or undefined if no user messages exist.
   */
  public getLastUserMessage(): EkoMessage | undefined {
    const userMessages = this.messages.filter(
      (message) => message.role === "user"
    );
    return userMessages[userMessages.length - 1];
  }

  /**
   * Checks if a message with the given ID exists in memory.
   * @param id - The message ID to check for.
   * @returns True if the message exists, false otherwise.
   */
  public hasMessage(id: string): boolean {
    return this.messages.some((message) => message.id === id);
  }

  /**
   * Clears all messages from memory.
   */
  public clear(): void {
    this.messages = [];
  }

  /**
   * Builds the complete message array for LLM consumption.
   * Includes the system prompt followed by all conversation messages,
   * properly formatted for the LLM provider.
   * @returns The formatted message prompt array.
   */
  public buildMessages(): LanguageModelV2Prompt {
    const llmMessages: LanguageModelV2Message[] = [];
    for (let i = 0; i < this.messages.length; i++) {
      const message = this.messages[i];
      if (message.role == "user") {
        llmMessages.push({
          role: message.role,
          content:
            typeof message.content === "string"
              ? [
                  {
                    type: "text",
                    text: message.content,
                  },
                ]
              : message.content.map((part) => {
                  if (part.type == "text") {
                    return {
                      type: "text",
                      text: part.text,
                    };
                  } else {
                    return {
                      type: "file",
                      data: toFile(part.data),
                      mediaType: part.mimeType || getMimeType(part.data),
                    };
                  }
                }),
          providerOptions: defaultMessageProviderOptions(),
        });
      } else if (message.role == "assistant") {
        llmMessages.push({
          role: message.role,
          content: message.content.map((part) => {
            if (part.type == "text") {
              return {
                type: "text",
                text: part.text,
              };
            } else if (part.type == "reasoning") {
              return {
                type: "reasoning",
                text: part.text,
              };
            } else if (part.type == "tool-call") {
              return {
                type: "tool-call",
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                input: part.args as unknown,
              };
            } else {
              return part;
            }
          }),
        });
      } else if (message.role == "tool") {
        llmMessages.push({
          role: message.role,
          content: message.content.map((part) => {
            return {
              type: "tool-result",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              output:
                typeof part.result == "string"
                  ? {
                      type: "text",
                      value: part.result,
                    }
                  : {
                      type: "json",
                      value: part.result as any,
                    },
            };
          }),
        });
      }
    }
    return [
      {
        role: "system",
        content: this.getSystemPrompt(),
        providerOptions: defaultMessageProviderOptions(),
      },
      ...llmMessages,
    ];
  }
}
