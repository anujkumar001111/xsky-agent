import {
  extractUsedTool,
  removeDuplicateToolUse,
  handleLargeContextMessages,
} from '../../src/memory/index';
import { LanguageModelV2Prompt, LanguageModelV2FunctionTool } from '@ai-sdk/provider';

describe('memory/compression', () => {
  describe('extractUsedTool', () => {
    test('should extract tools used in tool messages', () => {
      const messages: LanguageModelV2Prompt = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'tool1',
              toolCallId: 'call-1',
              output: { type: 'text', value: 'result' },
            },
            {
              type: 'tool-result',
              toolName: 'tool2',
              toolCallId: 'call-2',
              output: { type: 'text', value: 'result' },
            },
          ],
        },
      ];

      const agentTools: LanguageModelV2FunctionTool[] = [
        {
          type: 'function',
          name: 'tool1',
          description: 'Tool 1',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          type: 'function',
          name: 'tool2',
          description: 'Tool 2',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          type: 'function',
          name: 'tool3',
          description: 'Tool 3',
          inputSchema: { type: 'object', properties: {} },
        },
      ];

      const result = extractUsedTool(messages, agentTools);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('tool1');
      expect(result[1].name).toBe('tool2');
    });

    test('should return empty array when no tool messages', () => {
      const messages: LanguageModelV2Prompt = [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ];

      const agentTools: LanguageModelV2FunctionTool[] = [
        {
          type: 'function',
          name: 'tool1',
          description: 'Tool 1',
          inputSchema: { type: 'object', properties: {} },
        },
      ];

      const result = extractUsedTool(messages, agentTools);

      expect(result).toHaveLength(0);
    });

    test('should not include duplicate tool names', () => {
      const messages: LanguageModelV2Prompt = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'tool1',
              toolCallId: 'call-1',
              output: { type: 'text', value: 'result1' },
            },
            {
              type: 'tool-result',
              toolName: 'tool1',
              toolCallId: 'call-2',
              output: { type: 'text', value: 'result2' },
            },
            {
              type: 'tool-result',
              toolName: 'tool2',
              toolCallId: 'call-3',
              output: { type: 'text', value: 'result3' },
            },
          ],
        },
      ];

      const agentTools: LanguageModelV2FunctionTool[] = [
        {
          type: 'function',
          name: 'tool1',
          description: 'Tool 1',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          type: 'function',
          name: 'tool2',
          description: 'Tool 2',
          inputSchema: { type: 'object', properties: {} },
        },
      ];

      const result = extractUsedTool(messages, agentTools);

      expect(result).toHaveLength(2);
      expect(result.filter(t => t.name === 'tool1')).toHaveLength(1);
    });

    test('should skip tools not found in agent tools', () => {
      const messages: LanguageModelV2Prompt = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'unknown_tool',
              toolCallId: 'call-1',
              output: { type: 'text', value: 'result' },
            },
          ],
        },
      ];

      const agentTools: LanguageModelV2FunctionTool[] = [
        {
          type: 'function',
          name: 'tool1',
          description: 'Tool 1',
          inputSchema: { type: 'object', properties: {} },
        },
      ];

      const result = extractUsedTool(messages, agentTools);

      expect(result).toHaveLength(0);
    });

    test('should handle multiple tool messages', () => {
      const messages: LanguageModelV2Prompt = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'tool1',
              toolCallId: 'call-1',
              output: { type: 'text', value: 'result1' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolName: 'tool2',
              toolCallId: 'call-2',
              output: { type: 'text', value: 'result2' },
            },
          ],
        },
      ];

      const agentTools: LanguageModelV2FunctionTool[] = [
        {
          type: 'function',
          name: 'tool1',
          description: 'Tool 1',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          type: 'function',
          name: 'tool2',
          description: 'Tool 2',
          inputSchema: { type: 'object', properties: {} },
        },
      ];

      const result = extractUsedTool(messages, agentTools);

      expect(result).toHaveLength(2);
      expect(result.map(t => t.name)).toContain('tool1');
      expect(result.map(t => t.name)).toContain('tool2');
    });
  });

  describe('removeDuplicateToolUse', () => {
    test('should not modify results with no tool calls', () => {
      const results = [
        { type: 'text' as const, text: 'Hello' },
        { type: 'text' as const, text: 'World' },
      ];

      const result = removeDuplicateToolUse(results);

      expect(result).toEqual(results);
      expect(result).toHaveLength(2);
    });

    test('should not modify results with single tool call', () => {
      const results: any[] = [
        { type: 'text', text: 'Hello' },
        {
          type: 'tool-call',
          toolName: 'tool1',
          toolCallId: 'call-1',
          input: { param: 'value' },
        },
      ];

      const result = removeDuplicateToolUse(results);

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('Hello');
      expect(result[1].toolName).toBe('tool1');
    });

    test('should remove duplicate tool calls with same name and input', () => {
      const results: any[] = [
        { type: 'text', text: 'Hello' },
        {
          type: 'tool-call',
          toolName: 'tool1',
          toolCallId: 'call-1',
          input: { param: 'value' },
        },
        {
          type: 'tool-call',
          toolName: 'tool1',
          toolCallId: 'call-2',
          input: { param: 'value' },
        },
      ];

      const result = removeDuplicateToolUse(results);

      expect(result).toHaveLength(2);
      expect(result.filter((r: any) => r.type === 'tool-call')).toHaveLength(1);
    });

    test('should keep tool calls with different inputs', () => {
      const results: any[] = [
        {
          type: 'tool-call',
          toolName: 'tool1',
          toolCallId: 'call-1',
          input: { param: 'value1' },
        },
        {
          type: 'tool-call',
          toolName: 'tool1',
          toolCallId: 'call-2',
          input: { param: 'value2' },
        },
      ];

      const result = removeDuplicateToolUse(results);

      expect(result).toHaveLength(2);
      expect(result.every((r: any) => r.type === 'tool-call')).toBe(true);
    });

    test('should keep tool calls with different names', () => {
      const results: any[] = [
        {
          type: 'tool-call',
          toolName: 'tool1',
          toolCallId: 'call-1',
          input: { param: 'value' },
        },
        {
          type: 'tool-call',
          toolName: 'tool2',
          toolCallId: 'call-2',
          input: { param: 'value' },
        },
      ];

      const result = removeDuplicateToolUse(results);

      expect(result).toHaveLength(2);
    });

    test('should handle empty results', () => {
      const results: any[] = [];
      const result = removeDuplicateToolUse(results);
      expect(result).toHaveLength(0);
    });

    test('should preserve non-tool-call results', () => {
      const results: any[] = [
        { type: 'text', text: 'Before' },
        {
          type: 'tool-call',
          toolName: 'tool1',
          toolCallId: 'call-1',
          input: { param: 'value' },
        },
        { type: 'text', text: 'After' },
        {
          type: 'tool-call',
          toolName: 'tool1',
          toolCallId: 'call-2',
          input: { param: 'value' },
        },
        { type: 'text', text: 'End' },
      ];

      const result = removeDuplicateToolUse(results);

      expect(result).toHaveLength(4);
      expect(result[0].text).toBe('Before');
      expect(result[result.length - 1].text).toBe('End');
    });
  });

  describe('handleLargeContextMessages', () => {
    test('should handle empty messages', () => {
      const messages: LanguageModelV2Prompt = [];
      expect(() => handleLargeContextMessages(messages)).not.toThrow();
    });

    test('should handle messages without user or tool roles', () => {
      const messages: LanguageModelV2Prompt = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Response' }],
        },
      ];

      expect(() => handleLargeContextMessages(messages)).not.toThrow();
    });

    test('should process file content in user messages', () => {
      // The function processes messages but only replaces files beyond maxNum limit
      const messages: any[] = [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'image/png',
              data: 'base64data',
            },
          ],
        },
      ];

      expect(() => handleLargeContextMessages(messages)).not.toThrow();
      expect(messages[0].content).toBeDefined();
    });

    test('should process non-image file content in user messages', () => {
      const messages: any[] = [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'application/pdf',
              data: 'base64data',
            },
          ],
        },
      ];

      expect(() => handleLargeContextMessages(messages)).not.toThrow();
      expect(messages[0].content).toBeDefined();
    });

    test('should process long text content in assistant messages', () => {
      const longText = 'x'.repeat(10000);
      const messages: any[] = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: longText }],
        },
      ];

      expect(() => handleLargeContextMessages(messages)).not.toThrow();
      expect(messages[0].content[0]).toBeDefined();
    });

    test('should process long text content in user messages', () => {
      const longText = 'x'.repeat(10000);
      const messages: any[] = [
        {
          role: 'user',
          content: [{ type: 'text', text: longText }],
        },
      ];

      expect(() => handleLargeContextMessages(messages)).not.toThrow();
      expect(messages[0].content[0]).toBeDefined();
    });

    test('should not modify short text content', () => {
      const shortText = 'Short text';
      const messages: any[] = [
        {
          role: 'user',
          content: [{ type: 'text', text: shortText }],
        },
      ];

      handleLargeContextMessages(messages);

      expect(messages[0].content[0].text).toBe(shortText);
    });
  });
});
