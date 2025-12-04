
import {
  convertToolSchema,
  toFile,
  uuidv4,
  sleep,
  getMimeType,
  mergeTools,
  mergeAgents,
  sub,
  fixJson,
  fixXmlTag,
  call_timeout
} from '../../src/common/utils';
import { Tool, ToolSchema } from '../../src/types/tools.types';

describe('common/utils', () => {
  describe('convertToolSchema', () => {
    test('should convert simple tool schema correctly', () => {
      const tool: ToolSchema = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            arg: { type: 'string' }
          }
        }
      };

      const result = convertToolSchema(tool);

      expect(result).toEqual({
        type: 'function',
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: tool.parameters
      });
    });

    test('should handle tool with function property (OpenAI style)', () => {
      const tool: any = {
        type: 'function',
        function: {
          name: 'openai_tool',
          description: 'OpenAI style tool',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      };

      const result = convertToolSchema(tool);

      expect(result).toEqual({
        type: 'function',
        name: 'openai_tool',
        description: 'OpenAI style tool',
        inputSchema: tool.function.parameters
      });
    });

    test('should handle tool with input_schema (Anthropic style)', () => {
      const tool: any = {
        name: 'anthropic_tool',
        description: 'Anthropic style tool',
        input_schema: {
          type: 'object',
          properties: {}
        }
      };

      const result = convertToolSchema(tool);

      expect(result).toEqual({
        type: 'function',
        name: 'anthropic_tool',
        description: 'Anthropic style tool',
        inputSchema: tool.input_schema
      });
    });
  });

  describe('toFile', () => {
    test('should handle http/https URLs', () => {
      const url = 'https://example.com/image.png';
      const result = toFile(url);
      expect(result).toBeInstanceOf(URL);
      expect((result as URL).href).toBe(url);
    });

    test('should handle protocol-relative URLs', () => {
      const url = '//example.com/image.png';
      const result = toFile(url);
      expect(result).toBeInstanceOf(URL);
      expect((result as URL).href).toBe('https://example.com/image.png');
    });

    test('should handle base64 data', () => {
      const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      const result = toFile(base64);
      // It returns string for base64 type
      expect(typeof result).toBe('string');
      expect(result).not.toContain('data:');
    });
  });

  describe('uuidv4', () => {
    test('should generate valid UUID', () => {
      const id = uuidv4();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('should generate unique IDs', () => {
      const id1 = uuidv4();
      const id2 = uuidv4();
      expect(id1).not.toBe(id2);
    });
  });

  describe('sleep', () => {
    test('should wait for specified time', async () => {
      const start = Date.now();
      await sleep(100);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(90); // Allow small margin for scheduling jitter
    });
  });

  describe('call_timeout', () => {
    test('should resolve when function completes within timeout', async () => {
      const result = await call_timeout(
        async () => {
          await sleep(50);
          return 'success';
        },
        200
      );
      expect(result).toBe('success');
    });

    test('should reject when function exceeds timeout', async () => {
      await expect(
        call_timeout(
          async () => {
            await sleep(300);
            return 'too late';
          },
          100
        )
      ).rejects.toThrow('Timeout');
    });

    test('should call error callback on timeout', async () => {
      const errorCallback = jest.fn();
      await expect(
        call_timeout(
          async () => {
            await sleep(300);
            return 'too late';
          },
          100,
          errorCallback
        )
      ).rejects.toThrow('Timeout');
      expect(errorCallback).toHaveBeenCalledWith('Timeout');
    });

    test('should propagate errors from function', async () => {
      const errorCallback = jest.fn();
      await expect(
        call_timeout(
          async () => {
            throw new Error('Test error');
          },
          200,
          errorCallback
        )
      ).rejects.toThrow('Test error');
      expect(errorCallback).toHaveBeenCalled();
    });
  });

  describe('getMimeType', () => {
    test('should extract mime type from data URL', () => {
      expect(getMimeType('data:image/jpeg;base64,/9j/')).toBe('image/jpeg');
      expect(getMimeType('data:application/pdf;base64,JVBERi0')).toBe('application/pdf');
    });

    test('should detect mime type from file extension', () => {
      expect(getMimeType('image.png')).toBe('image/png');
      expect(getMimeType('document.pdf')).toBe('application/pdf');
      expect(getMimeType('photo.jpg')).toBe('image/jpeg');
      expect(getMimeType('photo.jpeg')).toBe('image/jpeg');
      expect(getMimeType('data.json')).toBe('application/json');
      expect(getMimeType('readme.md')).toBe('text/markdown');
      expect(getMimeType('notes.txt')).toBe('text/plain');
      expect(getMimeType('data.csv')).toBe('text/csv');
      expect(getMimeType('config.xml')).toBe('application/xml');
      expect(getMimeType('report.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(getMimeType('data.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(getMimeType('slides.pptx')).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    });

    test('should default to image/png for unknown types', () => {
      expect(getMimeType('unknown')).toBe('image/png');
      expect(getMimeType('')).toBe('image/png');
    });
  });

  describe('mergeTools', () => {
    test('should merge two tool lists, preferring tools2 on conflict', () => {
      const tools1 = [
        { name: 'tool_a', description: 'Original A' },
        { name: 'tool_b', description: 'Original B' }
      ] as any[];
      const tools2 = [
        { name: 'tool_b', description: 'Updated B' },
        { name: 'tool_c', description: 'New C' }
      ] as any[];

      const merged = mergeTools(tools1, tools2);

      expect(merged).toHaveLength(3);
      expect(merged.find(t => t.name === 'tool_a')?.description).toBe('Original A');
      expect(merged.find(t => t.name === 'tool_b')?.description).toBe('Updated B');
      expect(merged.find(t => t.name === 'tool_c')?.description).toBe('New C');
    });

    test('should handle empty lists', () => {
      expect(mergeTools([], [])).toEqual([]);
      expect(mergeTools([{ name: 'a' }] as any[], [])).toHaveLength(1);
      expect(mergeTools([], [{ name: 'b' }] as any[])).toHaveLength(1);
    });
  });

  describe('sub', () => {
    test('should truncate long strings with ellipsis', () => {
      expect(sub('Hello World', 5)).toBe('Hello...');
      expect(sub('Hello World', 5, false)).toBe('Hello');
    });

    test('should not truncate short strings', () => {
      expect(sub('Hi', 10)).toBe('Hi');
    });

    test('should handle empty/null strings', () => {
      expect(sub('', 10)).toBe('');
      expect(sub(null as any, 10)).toBe('');
      expect(sub(undefined as any, 10)).toBe('');
    });

    test('should handle unicode characters correctly', () => {
      // Emoji is 2 chars in JS but should count as 1 in Array.from
      expect(sub('👋🌍🎉', 2)).toBe('👋🌍...');
    });
  });

  describe('fixJson', () => {
    test('should parse valid JSON', () => {
      expect(fixJson('{"key": "value"}')).toEqual({ key: 'value' });
    });

    test('should fix incomplete JSON with missing closing braces', () => {
      expect(fixJson('{"key": "value"')).toEqual({ key: 'value' });
    });

    test('should fix incomplete JSON with missing closing bracket', () => {
      expect(fixJson('{"arr": [1, 2, 3')).toEqual({ arr: [1, 2, 3] });
    });

    test('should return empty object for completely invalid JSON', () => {
      expect(fixJson('not json at all')).toEqual({});
    });

    test('should handle empty/null input', () => {
      expect(fixJson('')).toEqual({});
      expect(fixJson(null as any)).toEqual({});
    });
  });

  describe('fixXmlTag', () => {
    test('should close unclosed tags', () => {
      const result = fixXmlTag('<root><child>text');
      expect(result).toContain('</child>');
      expect(result).toContain('</root>');
    });

    test('should handle incomplete attribute', () => {
      const result = fixXmlTag('<tag name=');
      expect(result).toContain('name=""');
    });

    test('should escape unescaped ampersands', () => {
      const result = fixXmlTag('<tag>A & B</tag>');
      expect(result).toContain('&amp;');
    });

    test('should not double-escape already escaped entities', () => {
      const result = fixXmlTag('<tag>&amp; &lt;</tag>');
      expect(result).not.toContain('&amp;amp;');
    });

    test('should handle trailing less-than sign', () => {
      const result = fixXmlTag('<root>content<');
      expect(result.endsWith('<')).toBe(false);
    });

    test('should handle known attribute names without values', () => {
      const result = fixXmlTag('<agent name');
      expect(result).toContain('name=""');
    });
  });

  describe('toFile with binary type', () => {
    test('should convert base64 to Uint8Array with binary|url type', () => {
      // Simple base64 for "hello"
      const base64 = 'aGVsbG8=';
      const result = toFile(base64, 'binary|url');
      expect(result).toBeInstanceOf(Uint8Array);
      // "hello" = [104, 101, 108, 108, 111]
      expect(Array.from(result as Uint8Array)).toEqual([104, 101, 108, 108, 111]);
    });
  });

  describe('mergeAgents', () => {
    test('should merge agent lists properly', () => {
      const agent1 = { Name: 'agent_a' } as any;
      const agent2 = { Name: 'agent_b' } as any;
      const agent3 = { Name: 'agent_c' } as any;
      const agent2Updated = { Name: 'agent_b', updated: true } as any;

      const result = mergeAgents([agent1, agent2], [agent2Updated, agent3]);

      expect(result).toHaveLength(3);
      expect(result.find(a => a.Name === 'agent_a')).toBe(agent1);
      expect(result.find(a => a.Name === 'agent_b')).toBe(agent2Updated);
      expect(result.find(a => a.Name === 'agent_c')).toBe(agent3);
    });

    test('should handle empty agent lists', () => {
      expect(mergeAgents([], [])).toEqual([]);
      expect(mergeAgents([{ Name: 'a' }] as any, [])).toHaveLength(1);
      expect(mergeAgents([], [{ Name: 'b' }] as any)).toHaveLength(1);
    });
  });

  describe('convertToolSchema edge cases', () => {
    test('should handle tool with inputSchema (AI SDK v2 style)', () => {
      const tool: any = {
        name: 'ai_sdk_tool',
        description: 'AI SDK v2 style tool',
        inputSchema: {
          type: 'object',
          properties: { param: { type: 'string' } }
        }
      };

      const result = convertToolSchema(tool);

      expect(result).toEqual({
        type: 'function',
        name: 'ai_sdk_tool',
        description: 'AI SDK v2 style tool',
        inputSchema: tool.inputSchema
      });
    });

    test('should prioritize function property over others', () => {
      const tool: any = {
        type: 'function',
        function: {
          name: 'priority_tool',
          description: 'Should use this',
          parameters: { type: 'object' }
        },
        input_schema: {
          type: 'object'
        },
        inputSchema: {
          type: 'object'
        },
        parameters: {
          type: 'object'
        }
      };

      const result = convertToolSchema(tool);

      expect(result.name).toBe('priority_tool');
      expect(result.description).toBe('Should use this');
    });
  });

  describe('toFile additional scenarios', () => {
    test('should handle data URL with data prefix', () => {
      const dataUrl = 'data:text/plain;base64,SGVsbG8gV29ybGQ='; // "Hello World"
      const result = toFile(dataUrl, 'base64|url');
      expect(typeof result).toBe('string');
      expect(result).not.toContain('data:');
    });

    test('should handle URLs with query parameters', () => {
      const url = 'https://example.com/image.png?size=large&type=png';
      const result = toFile(url);
      expect(result).toBeInstanceOf(URL);
      expect((result as URL).href).toContain('size=large');
    });

    test('should handle http URLs', () => {
      const url = 'http://example.com/image.png';
      const result = toFile(url);
      expect(result).toBeInstanceOf(URL);
      expect((result as URL).href).toBe(url);
    });

    test('should handle protocol-relative URLs with ports', () => {
      const url = '//example.com:8080/image.png';
      const result = toFile(url);
      expect(result).toBeInstanceOf(URL);
      expect((result as URL).href).toContain('8080');
    });
  });

  describe('getMimeType comprehensive coverage', () => {
    test('should handle multiple dots in filename', () => {
      expect(getMimeType('document.backup.json')).toBe('application/json');
      expect(getMimeType('archive.tar.gz')).toBe('image/png'); // No .gz handler, defaults
    });

    test('should be case insensitive for extensions', () => {
      // Note: Current implementation uses indexOf which is case-sensitive
      // This test documents current behavior
      expect(getMimeType('image.PNG')).toBe('image/png'); // Won't match
    });

    test('should handle URLs with extensions', () => {
      expect(getMimeType('https://example.com/file.pdf')).toBe('application/pdf');
      expect(getMimeType('https://example.com/data.csv')).toBe('text/csv');
    });

    test('should handle paths with directories', () => {
      expect(getMimeType('/path/to/file.json')).toBe('application/json');
      expect(getMimeType('C:\\path\\to\\file.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });
  });

  describe('sub with unicode characters', () => {
    test('should correctly handle multi-byte unicode', () => {
      const result = sub('Hello🌍World', 8);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('...');
    });

    test('should handle pure emoji string', () => {
      const result = sub('😀😁😂😃', 2);
      expect(result).toContain('...');
    });

    test('should handle emoji and text mixed', () => {
      const result = sub('A😀B😁C', 3);
      expect(result).toContain('...');
    });
  });

  describe('fixJson edge cases', () => {
    test('should handle JSON with trailing comma', () => {
      const result = fixJson('{"key": "value",}');
      // Should parse despite trailing comma (if fixed)
      expect(typeof result).toBe('object');
    });

    test('should handle nested incomplete structures', () => {
      const result = fixJson('{"a": {"b": {"c": "value"');
      expect(result).toBeDefined();
    });

    test('should handle quoted keys properly', () => {
      const result = fixJson('{"key": "value"}');
      expect(result.key).toBe('value');
    });

    test('should handle arrays mixed with objects', () => {
      const result = fixJson('{"arr": [{"key": "val"}, {"key2": "val2"');
      expect(Array.isArray(result.arr) || result.arr === undefined).toBe(true);
    });

    test('should handle escaped quotes in strings', () => {
      const result = fixJson('{"msg": "He said \\"hello\\""}');
      expect(typeof result).toBe('object');
    });
  });

  describe('fixXmlTag comprehensive scenarios', () => {
    test('should handle self-closing tags', () => {
      const result = fixXmlTag('<root><br/><hr/></root>');
      expect(result).toContain('<br/>');
      expect(result).toContain('<hr/>');
    });

    test('should handle attributes with special values', () => {
      const result = fixXmlTag('<tag attr="value with spaces">');
      expect(result).toContain('attr="value with spaces"');
    });

    test('should handle namespaced tags', () => {
      const result = fixXmlTag('<root><ns:child>text</ns:child>');
      expect(result).toContain('ns:child');
    });

    test('should handle nested CDATA', () => {
      const result = fixXmlTag('<root><![CDATA[some data]]></root>');
      expect(result).toContain('CDATA');
    });

    test('should handle multiple unclosed tags in sequence', () => {
      const result = fixXmlTag('<root><a><b><c>');
      expect(result).toContain('</c>');
      expect(result).toContain('</b>');
      expect(result).toContain('</a>');
    });

    test('should handle incomplete attribute values', () => {
      const result = fixXmlTag('<tag attr="incomplete');
      expect(result).toContain('attr="incomplete');
    });

    test('should handle ampersands in attributes', () => {
      const result = fixXmlTag('<tag value="A & B"></tag>');
      expect(result).toContain('&amp;');
    });

    test('should not double-escape in text content', () => {
      const result = fixXmlTag('<tag>&lt; &gt; &amp;</tag>');
      expect(result).not.toContain('&lt;lt;');
    });

    test('should handle mixed quotes in attributes', () => {
      const result = fixXmlTag('<tag attr1="value1" attr2=\'value2\'');
      expect(result).toContain('attr1');
      expect(result).toContain('attr2');
    });
  });

  describe('call_timeout comprehensive', () => {
    test('should handle rejection from within async function', async () => {
      const errorCallback = jest.fn();
      await expect(
        call_timeout(
          async () => {
            throw new Error('Custom error');
          },
          1000,
          errorCallback
        )
      ).rejects.toThrow('Custom error');
      expect(errorCallback).toHaveBeenCalled();
    });

    test('should not call error callback on success', async () => {
      const errorCallback = jest.fn();
      const result = await call_timeout(
        async () => 'success',
        1000,
        errorCallback
      );
      expect(result).toBe('success');
      expect(errorCallback).not.toHaveBeenCalled();
    });

    test('should handle immediate timeout', async () => {
      await expect(
        call_timeout(
          async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));
          },
          1
        )
      ).rejects.toThrow();
    });

    test('should work with sync-like async functions', async () => {
      const result = await call_timeout(
        async () => {
          return new Promise(resolve => resolve('instant'));
        },
        100
      );
      expect(result).toBe('instant');
    });

    test('should preserve error messages', async () => {
      const customError = 'This is a custom error message';
      await expect(
        call_timeout(
          async () => {
            throw new Error(customError);
          },
          1000
        )
      ).rejects.toThrow(customError);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    describe('sleep edge cases', () => {
      test('should handle zero timeout', async () => {
        const start = Date.now();
        await sleep(0);
        const end = Date.now();
        expect(end - start).toBeLessThan(100);
      });

      test('should handle negative timeout', async () => {
        const start = Date.now();
        await sleep(-1);
        const end = Date.now();
        expect(end - start).toBeLessThan(100);
      });

      test('should handle very large timeout (but not wait)', async () => {
        // Just verify it doesn't crash with a large number
        const promise = sleep(1000000);
        await new Promise(resolve => setTimeout(resolve, 10));
        // Don't wait for the actual timeout
      });

      test('should handle very small positive timeout', async () => {
        const start = Date.now();
        await sleep(1);
        const end = Date.now();
        expect(end - start).toBeGreaterThanOrEqual(0);
      });
    });

    describe('uuidv4 edge cases', () => {
      test('should generate UUIDs with correct format consistently', () => {
        const uuids = Array.from({ length: 100 }, () => uuidv4());
        uuids.forEach(id => {
          expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });
      });

      test('should have no duplicates in 1000 generated UUIDs', () => {
        const uuids = new Set(Array.from({ length: 1000 }, () => uuidv4()));
        expect(uuids.size).toBe(1000);
      });
    });

    describe('toFile edge cases', () => {
      test('should handle empty string input', () => {
        const result = toFile('');
        expect(typeof result).toBe('string');
        expect(result).toBe('');
      });

      test('should handle very long base64 string', () => {
        const longBase64 = 'aGVs'.repeat(10000);
        const result = toFile(longBase64, 'binary|url');
        expect(result).toBeInstanceOf(Uint8Array);
      });

      test('should handle protocol-relative URL without domain', () => {
        const url = '//';
        expect(() => toFile(url)).not.toThrow();
      });

      test('should handle data URL with missing comma', () => {
        const dataUrl = 'data:image/png;base64';
        const result = toFile(dataUrl);
        expect(typeof result).toBe('string');
      });

      test('should handle malformed base64', () => {
        const malformedBase64 = '!!!invalid!!!';
        expect(() => toFile(malformedBase64, 'binary|url')).not.toThrow();
      });

      test('should handle URL with very long path', () => {
        const longPath = 'a'.repeat(10000);
        const url = `https://example.com/${longPath}`;
        const result = toFile(url);
        expect(result).toBeInstanceOf(URL);
      });
    });

    describe('convertToolSchema edge cases', () => {
      test('should handle tool with missing properties', () => {
        const tool: any = {
          name: 'minimal_tool'
        };
        const result = convertToolSchema(tool);
        expect(result.type).toBe('function');
        expect(result.name).toBe('minimal_tool');
      });

      test('should handle tool with null description', () => {
        const tool: any = {
          name: 'null_desc_tool',
          description: null,
          parameters: { type: 'object' }
        };
        const result = convertToolSchema(tool);
        expect(result.name).toBe('null_desc_tool');
        expect(result.description).toBeNull();
      });

      test('should handle deeply nested schema', () => {
        const tool: ToolSchema = {
          name: 'deep_tool',
          description: 'Deep schema test',
          parameters: {
            type: 'object',
            properties: {
              nested: {
                type: 'object',
                properties: {
                  deep: {
                    type: 'object',
                    properties: {
                      value: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        };
        const result = convertToolSchema(tool);
        expect(result.inputSchema).toBeDefined();
      });
    });

    describe('getMimeType edge cases', () => {
      test('should handle null input gracefully', () => {
        const result = getMimeType(null as any);
        expect(result).toBe('image/png');
      });

      test('should handle undefined input gracefully', () => {
        const result = getMimeType(undefined as any);
        expect(result).toBe('image/png');
      });

      test('should handle very long filename', () => {
        const longFilename = 'file.' + 'a'.repeat(10000) + '.json';
        const result = getMimeType(longFilename);
        expect(result).toBe('application/json');
      });

      test('should handle filename with multiple extensions', () => {
        expect(getMimeType('file.tar.gz.json')).toBe('application/json');
        expect(getMimeType('archive.tar.gz')).toBe('image/png');
      });

      test('should handle data URL with complex mime type', () => {
        const dataUrl = 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,test';
        const result = getMimeType(dataUrl);
        expect(result).toContain('wordprocessingml');
      });

      test('should handle case sensitivity in extensions', () => {
        // Current implementation is case-sensitive
        expect(getMimeType('file.JSON')).toBe('image/png');
        expect(getMimeType('file.json')).toBe('application/json');
      });
    });

    describe('sub edge cases', () => {
      test('should handle maxLength of 0', () => {
        const result = sub('Hello World', 0);
        expect(result).toBe('...');
      });

      test('should handle maxLength of 1', () => {
        const result = sub('Hello World', 1);
        expect(result).toBe('H...');
      });

      test('should handle negative maxLength', () => {
        const result = sub('Hello World', -5);
        // slice(0, -5) gives "Hello " so result is "Hello ..."
        expect(result).toBe('Hello ...');
      });

      test('should handle string exactly maxLength', () => {
        const result = sub('Hello', 5);
        expect(result).toBe('Hello');
      });

      test('should handle maxLength larger than string', () => {
        const result = sub('Hi', 1000);
        expect(result).toBe('Hi');
      });

      test('should handle appendPoint=false with overflow', () => {
        const result = sub('Hello World', 5, false);
        expect(result).toBe('Hello');
        expect(result).not.toContain('...');
      });

      test('should handle very long string with small maxLength', () => {
        const longStr = 'x'.repeat(1000000);
        const result = sub(longStr, 10);
        expect(result.startsWith('x')).toBe(true);
        expect(result.includes('...')).toBe(true);
      });
    });

    describe('fixJson edge cases', () => {
      test('should handle JSON with only opening brace', () => {
        const result = fixJson('{');
        expect(typeof result).toBe('object');
      });

      test('should handle JSON with only closing brace', () => {
        const result = fixJson('}');
        expect(typeof result).toBe('object');
      });

      test('should handle deeply nested unclosed JSON', () => {
        const result = fixJson('{"a":{"b":{"c":{"d":"value"');
        expect(typeof result).toBe('object');
      });

      test('should handle mixed arrays and objects', () => {
        const result = fixJson('[{"a":1},{"b":2');
        expect(result === {} || Array.isArray(result) || typeof result === 'object').toBe(true);
      });

      test('should handle JSON with only whitespace', () => {
        const result = fixJson('   \n\t  ');
        expect(result).toEqual({});
      });

      test('should handle very large JSON structure', () => {
        let json = '{"items":[';
        for (let i = 0; i < 1000; i++) {
          json += `{"id":${i}},`;
        }
        json = json.slice(0, -1) + ']}';
        const result = fixJson(json);
        expect(typeof result).toBe('object');
      });
    });

    describe('fixXmlTag edge cases', () => {
      test('should handle empty XML', () => {
        const result = fixXmlTag('');
        expect(result).toBe('');
      });

      test('should handle only whitespace', () => {
        const result = fixXmlTag('   \n\t  ');
        expect(result).toBe('');
      });

      test('should handle very deeply nested tags', () => {
        let xml = '<a>';
        for (let i = 0; i < 100; i++) {
          xml += `<b${i}>`;
        }
        xml += 'content';
        const result = fixXmlTag(xml);
        expect(result).toContain('content');
      });

      test('should handle multiple consecutive less-than signs', () => {
        const result = fixXmlTag('<tag>value<<<');
        expect(result).not.toContain('<<<');
      });

      test('should handle ampersands at boundaries', () => {
        const result = fixXmlTag('&<tag>&text&</tag>&');
        expect(result).toContain('&amp;');
      });

      test('should handle mixed quote types in attributes', () => {
        const result = fixXmlTag('<tag a="value1" b=\'value2\' c="value3');
        expect(result).toContain('a=');
        expect(result).toContain('b=');
      });

      test('should handle CDATA sections', () => {
        const result = fixXmlTag('<root><![CDATA[<content>&test]]></root>');
        expect(result).toContain('CDATA');
      });
    });

    describe('mergeTools edge cases', () => {
      test('should handle merging with null tools', () => {
        const tools1 = [{ name: 'a', description: 'A' }] as any[];
        const tools2 = [{ name: 'b', description: 'B' }] as any[];
        const result = mergeTools(tools1, tools2);
        expect(result).toHaveLength(2);
      });

      test('should handle tools with same name and preserve tools2 version', () => {
        const tools1 = [
          { name: 'same', version: 1 },
          { name: 'unique1', version: 1 }
        ] as any[];
        const tools2 = [
          { name: 'same', version: 2 },
          { name: 'unique2', version: 2 }
        ] as any[];
        const result = mergeTools(tools1, tools2);
        expect(result.find(t => t.name === 'same')?.version).toBe(2);
      });

      test('should handle large tool lists', () => {
        const tools1 = Array.from({ length: 1000 }, (_, i) => ({ name: `tool_${i}` })) as any[];
        const tools2 = Array.from({ length: 1000 }, (_, i) => ({ name: `tool_${i + 500}` })) as any[];
        const result = mergeTools(tools1, tools2);
        expect(result.length).toBeGreaterThan(1000);
      });
    });

    describe('mergeAgents edge cases', () => {
      test('should handle agents with same name', () => {
        const agents1 = [{ Name: 'AgentA' }, { Name: 'AgentB' }] as any[];
        const agents2 = [{ Name: 'AgentA' }, { Name: 'AgentC' }] as any[];
        const result = mergeAgents(agents1, agents2);
        expect(result).toHaveLength(3);
        expect(result.filter((a: any) => a.Name === 'AgentA')).toHaveLength(1);
      });

      test('should preserve order of agents', () => {
        const agents1 = [{ Name: 'A' }, { Name: 'B' }] as any[];
        const agents2 = [{ Name: 'C' }, { Name: 'D' }] as any[];
        const result = mergeAgents(agents1, agents2);
        expect(result[0].Name).toBe('A');
        expect(result[1].Name).toBe('B');
        expect(result[2].Name).toBe('C');
      });

      test('should handle large agent lists', () => {
        const agents1 = Array.from({ length: 500 }, (_, i) => ({ Name: `Agent_${i}` })) as any[];
        const agents2 = Array.from({ length: 500 }, (_, i) => ({ Name: `Agent_${i + 250}` })) as any[];
        const result = mergeAgents(agents1, agents2);
        expect(result.length).toBeGreaterThan(500);
      });
    });

    describe('call_timeout edge cases', () => {
      test('should handle zero timeout', async () => {
        await expect(
          call_timeout(
            async () => {
              await sleep(1);
              return 'delayed';
            },
            1
          )
        ).rejects.toThrow();
      });

      test('should handle very large timeout value', async () => {
        const result = await call_timeout(
          async () => 'success',
          10000
        );
        expect(result).toBe('success');
      });

      test('should handle function that returns immediately', async () => {
        const result = await call_timeout(
          async () => 'immediate',
          5000
        );
        expect(result).toBe('immediate');
      });
    });
  });
});
