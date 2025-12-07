import { XSkyMemory, MemoryConfig } from '../../src/memory/memory';
import { XSkyMessage } from '../../src/types';

describe('XSkyMemory', () => {
  const createUserMessage = (text: string, id?: string): XSkyMessage => ({
    id: id || `user-${Date.now()}-${Math.random()}`,
    role: 'user',
    content: [{ type: 'text', text }],
    timestamp: Date.now()
  });

  const createAssistantMessage = (text: string, id?: string): XSkyMessage => ({
    id: id || `assistant-${Date.now()}-${Math.random()}`,
    role: 'assistant',
    content: [{ type: 'text', text }],
    timestamp: Date.now()
  });

  const createToolCallMessage = (toolName: string, toolCallId: string, id?: string): XSkyMessage => ({
    id: id || `assistant-tool-${Date.now()}`,
    role: 'assistant',
    content: [{
      type: 'tool-call',
      toolCallId,
      toolName,
      args: {}
    }],
    timestamp: Date.now()
  });

  const createToolResultMessage = (toolName: string, toolCallId: string, result: string, id?: string): XSkyMessage => ({
    id: id || `tool-${Date.now()}`,
    role: 'tool',
    content: [{
      type: 'tool-result',
      toolCallId,
      toolName,
      result
    }],
    timestamp: Date.now()
  });

  describe('constructor', () => {
    test('should initialize with default config', () => {
      const memory = new XSkyMemory('System prompt');
      expect(memory.getSystemPrompt()).toBe('System prompt');
      expect(memory.getMessages()).toEqual([]);
    });

    test('should initialize with provided messages', () => {
      const messages = [createUserMessage('Hello')];
      const memory = new XSkyMemory('System', messages);
      expect(memory.getMessages()).toHaveLength(1);
    });
  });

  describe('message management', () => {
    test('should add messages', async () => {
      const memory = new XSkyMemory('System');
      const msg = createUserMessage('Hello');
      await memory.addMessages([msg]);
      expect(memory.getMessages()).toHaveLength(1);
    });

    test('should find message by id', async () => {
      const memory = new XSkyMemory('System');
      const msg = createUserMessage('Hello', 'test-id-123');
      await memory.addMessages([msg]);

      const found = memory.getMessageById('test-id-123');
      expect(found).toBeDefined();
      expect(found?.content).toEqual([{ type: 'text', text: 'Hello' }]);
    });

    test('should return undefined for non-existent message', () => {
      const memory = new XSkyMemory('System');
      expect(memory.getMessageById('non-existent')).toBeUndefined();
    });

    test('should remove message by id', async () => {
      const memory = new XSkyMemory('System');
      const msg1 = createUserMessage('First', 'msg-1');
      const msg2 = createUserMessage('Second', 'msg-2');
      await memory.addMessages([msg1, msg2]);

      const removed = memory.removeMessageById('msg-1', false);
      expect(removed).toEqual(['msg-1']);
      expect(memory.getMessages()).toHaveLength(1);
      expect(memory.getMessages()[0].id).toBe('msg-2');
    });

    test('should check message existence', async () => {
      const memory = new XSkyMemory('System');
      const msg = createUserMessage('Hello', 'exists-id');
      await memory.addMessages([msg]);

      expect(memory.hasMessage('exists-id')).toBe(true);
      expect(memory.hasMessage('not-exists')).toBe(false);
    });

    test('should clear all messages', async () => {
      const memory = new XSkyMemory('System');
      await memory.addMessages([createUserMessage('Hello')]);
      memory.clear();
      expect(memory.getMessages()).toHaveLength(0);
    });
  });

  describe('user message retrieval', () => {
    test('should get first user message', async () => {
      const memory = new XSkyMemory('System');
      await memory.addMessages([
        createUserMessage('First', 'first'),
        createAssistantMessage('Response'),
        createUserMessage('Second', 'second')
      ]);

      const first = memory.getFirstUserMessage();
      expect(first?.id).toBe('first');
    });

    test('should get last user message', async () => {
      const memory = new XSkyMemory('System');
      await memory.addMessages([
        createUserMessage('First', 'first'),
        createAssistantMessage('Response'),
        createUserMessage('Second', 'second')
      ]);

      const last = memory.getLastUserMessage();
      expect(last?.id).toBe('second');
    });
  });

  describe('token estimation', () => {
    test('should estimate tokens for English text', () => {
      const memory = new XSkyMemory('System prompt');
      // System prompt: ~4 tokens (16 chars / 4)
      expect(memory.getEstimatedTokens(true)).toBeGreaterThan(0);
    });

    test('should count Chinese characters as 1 token each', async () => {
      const memory = new XSkyMemory('');
      await memory.addMessages([createUserMessage('你好世界')]); // 4 Chinese chars
      // Without system prompt, token count includes message structure overhead
      expect(memory.getEstimatedTokens(false)).toBeGreaterThan(4);
    });
  });

  describe('capacity management', () => {
    test('should trim messages when exceeding maxMessages', async () => {
      const memory = new XSkyMemory('System', [], { maxMessages: 3 });
      await memory.addMessages([
        createUserMessage('One'),
        createAssistantMessage('Reply 1'),
        createUserMessage('Two'),
        createAssistantMessage('Reply 2'),
        createUserMessage('Three') // 5 messages, exceeds limit of 3
      ]);

      expect(memory.getMessages().length).toBeLessThanOrEqual(3);
    });

    test('should trim messages when exceeding maxTokens', async () => {
      const memory = new XSkyMemory('System', [], { maxTokens: 50, maxMessages: 100 });
      // Add many messages to exceed token limit
      const messages = [];
      for (let i = 0; i < 20; i++) {
        messages.push(createUserMessage('This is a test message number ' + i));
      }
      await memory.addMessages(messages);

      // Should have trimmed some messages
      expect(memory.getMessages().length).toBeLessThan(20);
    });
  });

  describe('configuration updates', () => {
    test('should update config values', async () => {
      const memory = new XSkyMemory('System');
      // Need at least one message before updating config
      await memory.addMessages([createUserMessage('Initial')]);

      await memory.updateConfig({
        maxMessages: 5,
        maxTokens: 1000,
        enableCompression: true,
        compressionThreshold: 3,
        compressionMaxLength: 100
      });

      // Config is private, so we test indirectly by adding many messages
      // and checking capacity management kicks in
      const messages = [];
      for (let i = 0; i < 10; i++) {
        messages.push(createUserMessage('Message ' + i));
      }
      await memory.addMessages(messages);
      expect(memory.getMessages().length).toBeLessThanOrEqual(5);
    });
  });

  describe('import/export', () => {
    test('should import messages', async () => {
      const memory = new XSkyMemory('System');
      await memory.import({
        messages: [
          createUserMessage('Imported'),
          createAssistantMessage('Response')
        ]
      });

      expect(memory.getMessages()).toHaveLength(2);
    });

    test('should import with config', async () => {
      const memory = new XSkyMemory('System');
      await memory.import({
        messages: Array(10).fill(null).map((_, i) => createUserMessage('Msg ' + i)),
        config: { maxMessages: 3 }
      });

      expect(memory.getMessages().length).toBeLessThanOrEqual(3);
    });
  });

  describe('message ID generation', () => {
    test('should generate unique message IDs', () => {
      const memory = new XSkyMemory('System');
      const id1 = memory.genMessageId();
      const id2 = memory.genMessageId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[0-9a-f-]+$/i);
    });
  });

  describe('buildMessages', () => {
    test('should build LLM-compatible message array', async () => {
      const memory = new XSkyMemory('You are a helpful assistant.');
      await memory.addMessages([
        createUserMessage('Hello'),
        createAssistantMessage('Hi there!')
      ]);

      const built = memory.buildMessages();

      expect(built[0].role).toBe('system');
      expect(built[0].content).toBe('You are a helpful assistant.');
      expect(built[1].role).toBe('user');
      expect(built[2].role).toBe('assistant');
    });

    test('should handle tool call messages', async () => {
      const memory = new XSkyMemory('System');
      await memory.addMessages([
        createUserMessage('Search for something'),
        createToolCallMessage('search', 'call-123'),
        createToolResultMessage('search', 'call-123', 'Found results')
      ]);

      const built = memory.buildMessages();
      expect(built).toHaveLength(4); // system + 3 messages
    });
  });

  describe('fixDiscontinuousMessages', () => {
    test('should ensure messages start with user message', async () => {
      const memory = new XSkyMemory('System', [
        createAssistantMessage('I start first'), // Invalid - should be trimmed
        createUserMessage('Hello'),
        createAssistantMessage('Hi')
      ]);

      memory.fixDiscontinuousMessages();

      const messages = memory.getMessages();
      expect(messages[0].role).toBe('user');
    });
  });
});
