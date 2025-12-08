import FileAgent from '../src/file';
import { AgentContext } from '@xsky/ai-agent-core';
import { WebContentsView } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  appendFile: jest.fn(),
  mkdir: jest.fn(),
}));

// Mock glob
jest.mock('glob', () => ({
  glob: jest.fn(),
}));

describe('FileAgent (Electron)', () => {
  let agent: FileAgent;
  let mockContext: AgentContext;
  let mockView: WebContentsView;

  beforeEach(() => {
    mockView = new WebContentsView({} as any);
    // Mock webContents.send for file-updated events
    mockView.webContents.send = jest.fn();
    agent = new FileAgent(mockView, '/test/workdir');
    mockContext = {} as AgentContext;
    jest.clearAllMocks();
  });

  describe('file_list', () => {
    it('should list files in directory', async () => {
      const mockFiles = ['file1.txt', 'file2.txt', 'folder'];
      (fs.readdir as jest.Mock).mockResolvedValue(mockFiles);
      (fs.stat as jest.Mock)
        .mockResolvedValueOnce({ isDirectory: () => false, size: 100, mtime: new Date('2024-01-01') })
        .mockResolvedValueOnce({ isDirectory: () => false, size: 2048, mtime: new Date('2024-01-02') })
        .mockResolvedValueOnce({ isDirectory: () => true, size: 0, mtime: new Date('2024-01-03') });

      // @ts-ignore - accessing protected method
      const result = await agent.file_list(mockContext, '/test/dir');

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('file1.txt');
      expect(result[0].isDirectory).toBe(false);
      expect(result[2].isDirectory).toBe(true);
    });

    it('should include file paths', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['test.txt']);
      (fs.stat as jest.Mock).mockResolvedValue({ isDirectory: () => false, size: 100, mtime: new Date() });

      // @ts-ignore - accessing protected method
      const result = await agent.file_list(mockContext, '/test/dir');

      expect(result[0].path).toBe('/test/dir/test.txt');
    });
  });

  describe('file_read', () => {
    it('should read file content', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('file content here');

      // @ts-ignore - accessing protected method
      const result = await agent.file_read(mockContext, '/test/file.txt');

      expect(fs.readFile).toHaveBeenCalledWith('/test/file.txt', 'utf-8');
      expect(result).toBe('file content here');
    });
  });

  describe('file_write', () => {
    it('should write file and create directory if needed', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      // @ts-ignore - accessing protected method
      const result = await agent.file_write(mockContext, '/test/new/file.txt', 'content', false);

      expect(fs.mkdir).toHaveBeenCalledWith('/test/new', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith('/test/new/file.txt', 'content', 'utf-8');
    });

    it('should append to file when append flag is true', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.appendFile as jest.Mock).mockResolvedValue(undefined);

      // @ts-ignore - accessing protected method
      await agent.file_write(mockContext, '/test/file.txt', 'appended content', true);

      expect(fs.appendFile).toHaveBeenCalledWith('/test/file.txt', 'appended content', 'utf-8');
    });

    it('should send file-updated event', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      // @ts-ignore - accessing protected method
      await agent.file_write(mockContext, '/test/file.txt', 'content', false);

      expect(mockView.webContents.send).toHaveBeenCalledWith(
        'file-updated',
        'preview',
        expect.any(String)
      );
    });

    it('should return file info', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      // @ts-ignore - accessing protected method
      const result = await agent.file_write(mockContext, '/test/file.txt', 'content', false);

      expect(result.filePath).toBe('/test/file.txt');
      expect(result.fileName).toBe('file.txt');
      expect(result.size).toBe(7); // 'content'.length
    });
  });

  describe('file_str_replace', () => {
    it('should replace string in file', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('Hello World World');
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      // @ts-ignore - accessing protected method
      await agent.file_str_replace(mockContext, '/test/file.txt', 'World', 'Universe');

      expect(fs.writeFile).toHaveBeenCalledWith('/test/file.txt', 'Hello Universe Universe', 'utf-8');
    });

    it('should not write if no replacement made', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('Hello World');
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      // @ts-ignore - accessing protected method
      await agent.file_str_replace(mockContext, '/test/file.txt', 'NotFound', 'Replacement');

      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      // @ts-ignore - accessing protected method
      expect(agent.formatFileSize(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      // @ts-ignore - accessing protected method
      expect(agent.formatFileSize(2048)).toBe('2.0 KB');
    });

    it('should format megabytes', () => {
      // @ts-ignore - accessing protected method
      expect(agent.formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
    });
  });
});
