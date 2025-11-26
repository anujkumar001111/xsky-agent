import * as fs from "fs/promises";
import * as path from "path";
import { glob } from 'glob';
import { AgentContext, BaseFileAgent } from "@xsky/ai-agent-core";
import { Tool } from "@xsky/ai-agent-core/types";
import { WebContentsView, app } from "electron";

/**
 * A file agent that runs in an Electron environment.
 */
export default class FileAgent extends BaseFileAgent {

  private detailView: WebContentsView;
  private customPrompt?: string;

  /**
   * Creates an instance of the FileAgent.
   * @param detailView - The Electron WebContentsView to use.
   * @param work_path - The working path for the agent.
   * @param mcpClient - The MCP client to use.
   * @param customPrompt - A custom prompt to use.
   */
  constructor(detailView: WebContentsView, work_path?: string, mcpClient?: any, customPrompt?: string) {
    super(work_path, ['default'], [], mcpClient);
    this.detailView = detailView;
    this.customPrompt = customPrompt;
  }

  /**
   * Overrides the extended system prompt to support a custom prompt.
   * @param agentContext - The context for the agent.
   * @param tools - The tools available to the agent.
   * @returns A promise that resolves to the custom prompt.
   */
  protected async extSysPrompt(
    agentContext: AgentContext,
    tools: Tool[]
  ): Promise<string> {
    return this.customPrompt || "";
  }

  /**
   * Lists the files in a directory.
   * @param agentContext - The context for the agent.
   * @param directoryPath - The path to the directory.
   * @returns A promise that resolves to a list of files.
   */
  protected async file_list(
    agentContext: AgentContext,
    directoryPath: string
  ): Promise<
    Array<{
      path: string;
      name?: string;
      isDirectory?: boolean;
      size?: string;
      modified?: string;
    }>
  > {
    const files = await fs.readdir(directoryPath);
    const fileDetails = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(directoryPath, file);
        const stats = await fs.stat(filePath);
        return {
          name: file,
          path: filePath,
          isDirectory: stats.isDirectory(),
          size: this.formatFileSize(stats.size),
          modified: stats.mtime.toLocaleString(),
        };
      })
    );
    return fileDetails;
  }

  /**
   * Reads a file.
   * @param agentContext - The context for the agent.
   * @param filePath - The path to the file.
   * @returns A promise that resolves to the content of the file.
   */
  protected async file_read(
    agentContext: AgentContext,
    filePath: string
  ): Promise<string> {
    return await fs.readFile(filePath, "utf-8");
  }

  /**
   * Writes a file.
   * @param agentContext - The context for the agent.
   * @param filePath - The path to the file.
   * @param content - The content to write to the file.
   * @param append - Whether to append to the file.
   * @returns A promise that resolves when the file has been written.
   */
  protected async file_write(
    agentContext: AgentContext,
    filePath: string,
    content: string,
    append: boolean
  ): Promise<any> {

    const directory = path.dirname(filePath);
    const fileName = path.basename(filePath);
    await fs.mkdir(directory, { recursive: true });
    // this.mainView.webContents.loadURL(`http://localhost:5173/static/${fileName}`);
    if (append) {
      await fs.appendFile(filePath, content, "utf-8");
    } else {
      await fs.writeFile(filePath, content, "utf-8");
    }
    // Select appropriate preview URL based on runtime environment
    const previewUrl = app.isPackaged
      ? `client://${fileName}`                          // Production environment uses custom protocol
      : `http://localhost:5173/static/${fileName}`;     // Development environment uses local service

    this.detailView.webContents.send('file-updated', 'preview', previewUrl);

    // Return file information for attachment collection
    return {
      filePath,
      fileName,
      previewUrl,
      size: content.length
    };
  }

  /**
   * Replaces a string in a file.
   * @param agentContext - The context for the agent.
   * @param filePath - The path to the file.
   * @param oldStr - The string to replace.
   * @param newStr - The string to replace it with.
   */
  protected async file_str_replace(
    agentContext: AgentContext,
    filePath: string,
    oldStr: string,
    newStr: string
  ): Promise<any> {
    let content = await fs.readFile(filePath, "utf-8");
    const originalContent = content;
    content = content.replace(new RegExp(oldStr, "g"), newStr);
    if (content === originalContent) {
      return;
    }
    await fs.writeFile(filePath, content, "utf-8");
  }

  /**
   * Finds files by name.
   * @param agentContext - The context for the agent.
   * @param directoryPath - The path to the directory to search in.
   * @param globPattern - The glob pattern to search for.
   * @returns A promise that resolves to a list of files.
   */
  protected async file_find_by_name(
    agentContext: AgentContext,
    directoryPath: string,
    globPattern: string
  ): Promise<
    Array<{
      path: string;
      name?: string;
      isDirectory?: boolean;
      size?: string;
      modified?: string;
    }>
  > {
    const pattern = path.join(directoryPath, globPattern);
    const files = await glob(pattern);
    const fileDetails = await Promise.all(
      files.map(async (file) => {
        const stats = await fs.stat(file);
        return {
          name: path.basename(file),
          path: file,
          isDirectory: stats.isDirectory(),
          size: this.formatFileSize(stats.size),
          modified: stats.mtime.toLocaleString(),
        };
      })
    );
    return fileDetails;
  }

  /**
   * Formats a file size.
   * @param size - The size in bytes.
   * @returns The formatted file size.
   */
  protected formatFileSize(size: number): string {
    if (size < 1024) {
      return size + " B";
    }
    if (size < 1024 * 1024) {
      return (size / 1024).toFixed(1) + " KB";
    }
    return (size / 1024 / 1024).toFixed(1) + " MB";
  }
}

export { FileAgent };
