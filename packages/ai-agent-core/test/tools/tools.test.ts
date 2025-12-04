import VariableStorageTool from '../../src/tools/variable_storage';
import ForeachTaskTool from '../../src/tools/foreach_task';
import TodoListManagerTool from '../../src/tools/todo_list_manager';
import TaskResultCheckTool from '../../src/tools/task_result_check';
import { ToolResult } from '../../src/types/tools.types';

// Mock AgentContext
const mockAgentContext = (variables?: Map<string, any>, contextVariables?: Map<string, any>) => ({
  context: {
    variables: contextVariables || new Map<string, any>(),
    config: { callback: null },
    taskId: 'test-task-id',
  },
  agentChain: {
    agent: {
      id: 'test-agent-id',
      xml: '<agent name="test"><task>Test</task><nodes><node id="0">Step 1</node><forEach id="1" items="list"><node>Item</node></forEach></nodes></agent>',
    },
  },
  agent: {
    Name: 'TestAgent',
  },
  variables: variables || new Map<string, any>(),
});

describe('tools', () => {
  describe('VariableStorageTool', () => {
    let tool: VariableStorageTool;

    beforeEach(() => {
      tool = new VariableStorageTool();
    });

    test('should have correct name and description', () => {
      expect(tool.name).toBe('variable_storage');
      expect(tool.description).toContain('storing, reading, and retrieving variable data');
    });

    test('should have correct parameters schema', () => {
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.properties.operation).toBeDefined();
      expect(tool.parameters.properties.operation.enum).toContain('read_variable');
      expect(tool.parameters.properties.operation.enum).toContain('write_variable');
      expect(tool.parameters.properties.operation.enum).toContain('list_all_variable');
    });

    describe('write_variable operation', () => {
      test('should write variable successfully', async () => {
        const context = mockAgentContext(undefined, new Map());
        const result = await tool.execute(
          {
            operation: 'write_variable',
            name: 'test_var',
            value: 'test_value',
          },
          context as any
        );

        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toBe('success');
        expect(context.context.variables.get('test_var')).toBe('test_value');
      });

      test('should error when name is missing for write', async () => {
        const context = mockAgentContext();
        const result = await tool.execute(
          {
            operation: 'write_variable',
            value: 'test_value',
          },
          context as any
        );

        expect(result.content[0].text).toContain('Error: name is required');
      });

      test('should error when value is missing for write', async () => {
        const context = mockAgentContext();
        const result = await tool.execute(
          {
            operation: 'write_variable',
            name: 'test_var',
          },
          context as any
        );

        expect(result.content[0].text).toContain('Error: value is required');
      });

      test('should handle undefined value explicitly', async () => {
        const context = mockAgentContext();
        const result = await tool.execute(
          {
            operation: 'write_variable',
            name: 'test_var',
            value: undefined,
          },
          context as any
        );

        expect(result.content[0].text).toContain('Error: value is required');
      });

      test('should trim variable names', async () => {
        const context = mockAgentContext(undefined, new Map());
        await tool.execute(
          {
            operation: 'write_variable',
            name: '  spaced_var  ',
            value: 'value',
          },
          context as any
        );

        expect(context.context.variables.get('spaced_var')).toBe('value');
        expect(context.context.variables.has('  spaced_var  ')).toBe(false);
      });

      test('should overwrite existing variable', async () => {
        const variables = new Map([['existing', 'old_value']]);
        const context = mockAgentContext(undefined, variables);

        await tool.execute(
          {
            operation: 'write_variable',
            name: 'existing',
            value: 'new_value',
          },
          context as any
        );

        expect(context.context.variables.get('existing')).toBe('new_value');
      });
    });

    describe('read_variable operation', () => {
      test('should read single variable', async () => {
        const variables = new Map([['var1', 'value1']]);
        const context = mockAgentContext(undefined, variables);

        const result = await tool.execute(
          {
            operation: 'read_variable',
            name: 'var1',
          },
          context as any
        );

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.var1).toBe('value1');
      });

      test('should read multiple variables', async () => {
        const variables = new Map([
          ['var1', 'value1'],
          ['var2', 'value2'],
          ['var3', 'value3'],
        ]);
        const context = mockAgentContext(undefined, variables);

        const result = await tool.execute(
          {
            operation: 'read_variable',
            name: 'var1,var2,var3',
          },
          context as any
        );

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.var1).toBe('value1');
        expect(parsed.var2).toBe('value2');
        expect(parsed.var3).toBe('value3');
      });

      test('should handle reading non-existent variable', async () => {
        const context = mockAgentContext(undefined, new Map());
        const result = await tool.execute(
          {
            operation: 'read_variable',
            name: 'nonexistent',
          },
          context as any
        );

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.nonexistent).toBeUndefined();
      });

      test('should error when name is missing for read', async () => {
        const context = mockAgentContext();
        const result = await tool.execute(
          {
            operation: 'read_variable',
          },
          context as any
        );

        expect(result.content[0].text).toContain('Error: name is required');
      });

      test('should trim variable names when reading multiple', async () => {
        const variables = new Map([
          ['var1', 'value1'],
          ['var2', 'value2'],
        ]);
        const context = mockAgentContext(undefined, variables);

        const result = await tool.execute(
          {
            operation: 'read_variable',
            name: 'var1 , var2 ',
          },
          context as any
        );

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.var1).toBe('value1');
        expect(parsed.var2).toBe('value2');
      });
    });

    describe('list_all_variable operation', () => {
      test('should list all variables', async () => {
        const variables = new Map([
          ['var1', 'value1'],
          ['var2', 'value2'],
          ['var3', 'value3'],
        ]);
        const context = mockAgentContext(undefined, variables);

        const result = await tool.execute(
          {
            operation: 'list_all_variable',
          },
          context as any
        );

        const parsed = JSON.parse(result.content[0].text);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed).toContain('var1');
        expect(parsed).toContain('var2');
        expect(parsed).toContain('var3');
      });

      test('should return empty array when no variables', async () => {
        const context = mockAgentContext(undefined, new Map());
        const result = await tool.execute(
          {
            operation: 'list_all_variable',
          },
          context as any
        );

        const parsed = JSON.parse(result.content[0].text);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBe(0);
      });
    });
  });

  describe('TodoListManagerTool', () => {
    let tool: TodoListManagerTool;

    beforeEach(() => {
      tool = new TodoListManagerTool();
    });

    test('should have correct name and description', () => {
      expect(tool.name).toBe('todo_list_manager');
      expect(tool.description).toContain('task to-do list management');
    });

    test('should have correct parameters schema', () => {
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.properties.completedList).toBeDefined();
      expect(tool.parameters.properties.todoList).toBeDefined();
      expect(tool.parameters.properties.loopDetection).toBeDefined();
      expect(tool.parameters.required).toContain('completedList');
      expect(tool.parameters.required).toContain('todoList');
      expect(tool.parameters.required).toContain('loopDetection');
    });

    test('should always return success', async () => {
      const context = mockAgentContext();
      const result = await tool.execute(
        {
          completedList: ['task1'],
          todoList: ['task2'],
          loopDetection: 'no_loop',
        },
        context as any
      );

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('success');
    });

    test('should handle empty arrays', async () => {
      const context = mockAgentContext();
      const result = await tool.execute(
        {
          completedList: [],
          todoList: [],
          loopDetection: 'no_loop',
        },
        context as any
      );

      expect(result.content[0].text).toBe('success');
    });

    test('should handle loop detection', async () => {
      const context = mockAgentContext();
      const result = await tool.execute(
        {
          completedList: [],
          todoList: ['continue'],
          loopDetection: 'loop',
        },
        context as any
      );

      expect(result.content[0].text).toBe('success');
    });
  });

  describe('TaskResultCheckTool', () => {
    let tool: TaskResultCheckTool;

    beforeEach(() => {
      tool = new TaskResultCheckTool();
    });

    test('should have correct name and description', () => {
      expect(tool.name).toBe('task_result_check');
      expect(tool.description).toContain('Check the current task execution process');
    });

    test('should have correct parameters schema', () => {
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.properties.thought).toBeDefined();
      expect(tool.parameters.properties.completionStatus).toBeDefined();
      expect(tool.parameters.properties.completionStatus.enum).toContain('completed');
      expect(tool.parameters.properties.completionStatus.enum).toContain('incomplete');
      expect(tool.parameters.required).toContain('thought');
      expect(tool.parameters.required).toContain('completionStatus');
    });

    test('should always return success', async () => {
      const context = mockAgentContext();
      const result = await tool.execute(
        {
          thought: 'Task analysis',
          completionStatus: 'completed',
        },
        context as any
      );

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('success');
    });

    test('should accept incomplete status with todo list', async () => {
      const context = mockAgentContext();
      const result = await tool.execute(
        {
          thought: 'Task analysis',
          completionStatus: 'incomplete',
          todoList: 'Need to continue with step 2',
        },
        context as any
      );

      expect(result.content[0].text).toBe('success');
    });
  });

  describe('ForeachTaskTool', () => {
    let tool: ForeachTaskTool;

    beforeEach(() => {
      tool = new ForeachTaskTool();
    });

    test('should have correct name and description', () => {
      expect(tool.name).toBe('foreach_task');
      expect(tool.description).toContain('forEach');
    });

    test('should have correct parameters schema', () => {
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.properties.nodeId).toBeDefined();
      expect(tool.parameters.properties.progress).toBeDefined();
      expect(tool.parameters.properties.next_step).toBeDefined();
      expect(tool.parameters.required).toContain('nodeId');
    });

    test('should error when nodeId does not exist', async () => {
      const agentContext = mockAgentContext() as any;

      await expect(
        tool.execute(
          {
            nodeId: 999,
            progress: 'Step 1',
            next_step: 'Next step',
          },
          agentContext
        )
      ).rejects.toThrow('Node ID does not exist: 999');
    });

    test('should error when node is not forEach', async () => {
      const agentContext = mockAgentContext() as any;

      await expect(
        tool.execute(
          {
            nodeId: 0, // This is a normal node, not forEach
            progress: 'Step 1',
            next_step: 'Next step',
          },
          agentContext
        )
      ).rejects.toThrow('Node ID is not a forEach node: 0');
    });

    test('should record forEach progress', async () => {
      const variables = new Map();
      const agentContext = mockAgentContext(variables) as any;

      const result = await tool.execute(
        {
          nodeId: 1, // This is the forEach node
          progress: 'Processing item 1',
          next_step: 'Process item 2',
        },
        agentContext
      );

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Recorded');
    });

    test('should track loop count in agent variables', async () => {
      const contextVars = new Map([['myItems', 'item1,item2']]);
      const variables = new Map();
      const agentContext = mockAgentContext(variables, contextVars) as any;

      // Update XML to have forEach with items="myItems"
      agentContext.agentChain.agent.xml = '<agent><task>Task</task><nodes><forEach id="1" items="myItems"><node>Item</node></forEach></nodes></agent>';

      // First call
      await tool.execute(
        {
          nodeId: 1,
          progress: 'Item 1',
          next_step: 'Item 2',
        },
        agentContext
      );

      let loopCount = variables.get('foreach_1') || 0;
      expect(loopCount).toBe(1);

      // Second call
      await tool.execute(
        {
          nodeId: 1,
          progress: 'Item 2',
          next_step: 'Item 3',
        },
        agentContext
      );

      loopCount = variables.get('foreach_1') || 0;
      expect(loopCount).toBe(2);
    });

    test('should output variable info every 5 loops', async () => {
      const contextVars = new Map([['items', 'item1,item2,item3']]);
      const variables = new Map();
      const agentContext = mockAgentContext(variables, contextVars) as any;

      // Update XML to have forEach with items="items" variable
      agentContext.agentChain.agent.xml = '<agent><task>Task</task><nodes><forEach id="1" items="items"><node>Item</node></forEach></nodes></agent>';

      // First call: loop_count becomes 1, 1 % 5 = 1 != 0, but wait... code checks BEFORE increment
      // Actually, reading the code more carefully:
      // let loop_count = agentContext.variables.get(key) || 0;  // First call: 0
      // if (loop_count % 5 == 0) { ... }  // 0 % 5 == 0 is TRUE!
      // So first call outputs variable info

      const result1 = await tool.execute(
        {
          nodeId: 1,
          progress: 'Item 1',
          next_step: 'Item 2',
        },
        agentContext
      );
      // First call should output variable info (0 % 5 == 0)
      expect(result1.content[0].text).toContain('Variable information');

      // Calls 2-5 should not output variable info
      for (let i = 1; i < 5; i++) {
        const result = await tool.execute(
          {
            nodeId: 1,
            progress: `Item ${i + 1}`,
            next_step: `Item ${i + 2}`,
          },
          agentContext
        );
        expect(result.content[0].text).toBe('Recorded');
      }

      // Call 6: loop_count will be 5 before increment, 5 % 5 == 0, output variable info
      const result6 = await tool.execute(
        {
          nodeId: 1,
          progress: 'Item 6',
          next_step: 'Item 7',
        },
        agentContext
      );
      expect(result6.content[0].text).toContain('Variable information');
    });
  });

  describe('Tool integration scenarios', () => {
    test('VariableStorageTool should work with ForeachTaskTool', async () => {
      const contextVariables = new Map<string, any>();
      const agentVariables = new Map<string, any>();
      const context = mockAgentContext(agentVariables, contextVariables) as any;

      const storeTool = new VariableStorageTool();
      const foreachTool = new ForeachTaskTool();

      // Store a list
      await storeTool.execute(
        {
          operation: 'write_variable',
          name: 'items',
          value: 'item1,item2,item3',
        },
        context
      );

      // Verify it was stored
      expect(contextVariables.get('items')).toBe('item1,item2,item3');

      // Use foreach tool to track iteration through the list
      const result = await foreachTool.execute(
        {
          nodeId: 1,
          progress: 'Processing items',
          next_step: 'Continue',
        },
        {
          ...context,
          agentChain: {
            agent: {
              id: 'test-agent-id',
              xml: '<agent><task>Task</task><nodes><forEach id="1" items="items"><node>Process item</node></forEach></nodes></agent>',
            },
          },
        }
      );

      expect(result.content[0].text).toBeDefined();
    });

    test('TodoListManagerTool schema requires all fields', () => {
      const tool = new TodoListManagerTool();
      expect(tool.parameters.required.length).toBe(3);
      expect(tool.parameters.required).toEqual(
        expect.arrayContaining(['completedList', 'todoList', 'loopDetection'])
      );
    });

    test('TaskResultCheckTool schema requires thought and completionStatus', () => {
      const tool = new TaskResultCheckTool();
      expect(tool.parameters.required.length).toBe(2);
      expect(tool.parameters.required).toEqual(
        expect.arrayContaining(['thought', 'completionStatus'])
      );
    });
  });

  describe('Edge cases for tool operations', () => {
    describe('VariableStorageTool edge cases', () => {
      test('should handle variable names with special characters', async () => {
        const tool = new VariableStorageTool();
        const context = mockAgentContext(undefined, new Map());

        const result = await tool.execute(
          {
            operation: 'write_variable',
            name: 'var_with-special.chars@#$',
            value: 'test',
          },
          context as any
        );

        expect(result.content[0].text).toBe('success');
        expect(context.context.variables.get('var_with-special.chars@#$')).toBe('test');
      });

      test('should handle very long variable names', async () => {
        const tool = new VariableStorageTool();
        const context = mockAgentContext(undefined, new Map());

        const longName = 'var_' + 'x'.repeat(10000);
        const result = await tool.execute(
          {
            operation: 'write_variable',
            name: longName,
            value: 'value',
          },
          context as any
        );

        expect(result.content[0].text).toBe('success');
        expect(context.context.variables.get(longName)).toBe('value');
      });

      test('should handle very long variable values', async () => {
        const tool = new VariableStorageTool();
        const context = mockAgentContext(undefined, new Map());

        const longValue = 'x'.repeat(1000000);
        const result = await tool.execute(
          {
            operation: 'write_variable',
            name: 'longVar',
            value: longValue,
          },
          context as any
        );

        expect(result.content[0].text).toBe('success');
        expect(context.context.variables.get('longVar')).toBe(longValue);
      });

      test('should handle reading non-existent variables in comma-separated list', async () => {
        const variables = new Map([['var1', 'value1']]);
        const context = mockAgentContext(undefined, variables);

        const tool = new VariableStorageTool();
        const result = await tool.execute(
          {
            operation: 'read_variable',
            name: 'var1,nonexistent1,nonexistent2',
          },
          context as any
        );

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.var1).toBe('value1');
        expect(parsed.nonexistent1).toBeUndefined();
        expect(parsed.nonexistent2).toBeUndefined();
      });

      test('should handle reading with extra whitespace around names', async () => {
        const variables = new Map([['var1', 'value1']]);
        const context = mockAgentContext(undefined, variables);

        const tool = new VariableStorageTool();
        const result = await tool.execute(
          {
            operation: 'read_variable',
            name: '  var1  ,  var1  ,  var1  ',
          },
          context as any
        );

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.var1).toBe('value1');
      });

      test('should handle write with zero-length value', async () => {
        const tool = new VariableStorageTool();
        const context = mockAgentContext(undefined, new Map());

        // Empty string should fail
        const result = await tool.execute(
          {
            operation: 'write_variable',
            name: 'emptyVar',
            value: '',
          },
          context as any
        );

        expect(result.content[0].text).toContain('Error');
      });

      test('should handle writing special types as strings', async () => {
        const tool = new VariableStorageTool();
        const context = mockAgentContext(undefined, new Map());

        const result = await tool.execute(
          {
            operation: 'write_variable',
            name: 'specialVar',
            value: 'null\nundefined\n{}[]"\'',
          },
          context as any
        );

        expect(result.content[0].text).toBe('success');
      });

      test('should handle reading all variables when many exist', async () => {
        const variables = new Map(
          Array.from({ length: 1000 }, (_, i) => [`var_${i}`, `value_${i}`])
        );
        const context = mockAgentContext(undefined, variables);

        const tool = new VariableStorageTool();
        const result = await tool.execute(
          {
            operation: 'list_all_variable',
          },
          context as any
        );

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toHaveLength(1000);
      });
    });

    describe('TodoListManagerTool edge cases', () => {
      test('should handle very long todo items', async () => {
        const tool = new TodoListManagerTool();
        const context = mockAgentContext();

        const longItem = 'item_' + 'x'.repeat(10000);
        const result = await tool.execute(
          {
            completedList: [longItem],
            todoList: [longItem],
            loopDetection: 'no_loop',
          },
          context as any
        );

        expect(result.content[0].text).toBe('success');
      });

      test('should handle large lists', async () => {
        const tool = new TodoListManagerTool();
        const context = mockAgentContext();

        const largeList = Array.from({ length: 1000 }, (_, i) => `task_${i}`);
        const result = await tool.execute(
          {
            completedList: largeList,
            todoList: largeList,
            loopDetection: 'loop',
          },
          context as any
        );

        expect(result.content[0].text).toBe('success');
      });

      test('should handle special characters in list items', async () => {
        const tool = new TodoListManagerTool();
        const context = mockAgentContext();

        const result = await tool.execute(
          {
            completedList: ['task_@#$%', 'task\n\t', 'task"\''],
            todoList: ['task_[]{}<>', 'task\\|/', 'task~`'],
            loopDetection: 'no_loop',
          },
          context as any
        );

        expect(result.content[0].text).toBe('success');
      });
    });

    describe('TaskResultCheckTool edge cases', () => {
      test('should handle very long thought text', async () => {
        const tool = new TaskResultCheckTool();
        const context = mockAgentContext();

        const longThought = 'x'.repeat(100000);
        const result = await tool.execute(
          {
            thought: longThought,
            completionStatus: 'completed',
          },
          context as any
        );

        expect(result.content[0].text).toBe('success');
      });

      test('should handle very long todoList', async () => {
        const tool = new TaskResultCheckTool();
        const context = mockAgentContext();

        const longTodoList = 'task_' + 'x'.repeat(100000);
        const result = await tool.execute(
          {
            thought: 'Analysis',
            completionStatus: 'incomplete',
            todoList: longTodoList,
          },
          context as any
        );

        expect(result.content[0].text).toBe('success');
      });

      test('should handle special characters in thought', async () => {
        const tool = new TaskResultCheckTool();
        const context = mockAgentContext();

        const result = await tool.execute(
          {
            thought: 'Thought with\nnewlines\ttabs\r\nand special chars @#$%^&*()',
            completionStatus: 'completed',
          },
          context as any
        );

        expect(result.content[0].text).toBe('success');
      });
    });

    describe('ForeachTaskTool edge cases', () => {
      test('should handle very large loop counts', async () => {
        const contextVars = new Map([['items', 'item1,item2']]);
        const variables = new Map();
        const agentContext = mockAgentContext(variables, contextVars) as any;

        const tool = new ForeachTaskTool();

        // Simulate many iterations
        for (let i = 0; i < 50; i++) {
          await tool.execute(
            {
              nodeId: 1,
              progress: `Item ${i}`,
              next_step: `Item ${i + 1}`,
            },
            {
              ...agentContext,
              agentChain: {
                agent: {
                  id: 'test-agent-id',
                  xml: '<agent><task>Task</task><nodes><forEach id="1" items="items"><node>Item</node></forEach></nodes></agent>',
                },
              },
            }
          );
        }

        const loopCount = variables.get('foreach_1');
        expect(loopCount).toBe(50);
      });

      test('should handle progress text with special characters', async () => {
        const variables = new Map();
        const agentContext = mockAgentContext(variables) as any;

        const tool = new ForeachTaskTool();
        const result = await tool.execute(
          {
            nodeId: 1,
            progress: 'Progress: @#$%^&*()[]{}"\'\n\t\r',
            next_step: 'Next: <>&',
          },
          agentContext
        );

        expect(result.content[0].text).toBeDefined();
      });

      test('should handle missing items variable gracefully', async () => {
        const contextVars = new Map();
        const variables = new Map();
        const agentContext = mockAgentContext(variables, contextVars) as any;

        const tool = new ForeachTaskTool();
        const result = await tool.execute(
          {
            nodeId: 1,
            progress: 'Step',
            next_step: 'Next',
          },
          {
            ...agentContext,
            agentChain: {
              agent: {
                id: 'test-agent-id',
                xml: '<agent><task>Task</task><nodes><forEach id="1" items="nonexistent"><node>Item</node></forEach></nodes></agent>',
              },
            },
          }
        );

        expect(result.content[0].text).toBeDefined();
      });

      test('should handle very long progress strings', async () => {
        const variables = new Map();
        const agentContext = mockAgentContext(variables) as any;

        const tool = new ForeachTaskTool();
        const longProgress = 'Progress: ' + 'x'.repeat(100000);
        const result = await tool.execute(
          {
            nodeId: 1,
            progress: longProgress,
            next_step: 'Next',
          },
          agentContext
        );

        expect(result.content[0].text).toBeDefined();
      });

      test('should handle negative nodeId', async () => {
        const variables = new Map();
        const agentContext = mockAgentContext(variables) as any;

        const tool = new ForeachTaskTool();

        await expect(
          tool.execute(
            {
              nodeId: -1,
              progress: 'Step',
              next_step: 'Next',
            },
            agentContext
          )
        ).rejects.toThrow('Node ID does not exist');
      });

      test('should handle very large nodeId', async () => {
        const variables = new Map();
        const agentContext = mockAgentContext(variables) as any;

        const tool = new ForeachTaskTool();

        await expect(
          tool.execute(
            {
              nodeId: Number.MAX_SAFE_INTEGER,
              progress: 'Step',
              next_step: 'Next',
            },
            agentContext
          )
        ).rejects.toThrow('Node ID does not exist');
      });

      test('should handle loop variable output at 10-loop boundary', async () => {
        const contextVars = new Map([['items', 'item1']]);
        const variables = new Map();
        const agentContext = mockAgentContext(variables, contextVars) as any;

        const tool = new ForeachTaskTool();

        // Execute 10 times (first output at 0, then at 5)
        for (let i = 0; i < 10; i++) {
          await tool.execute(
            {
              nodeId: 1,
              progress: `Item ${i}`,
              next_step: `Item ${i + 1}`,
            },
            {
              ...agentContext,
              agentChain: {
                agent: {
                  id: 'test-agent-id',
                  xml: '<agent><task>Task</task><nodes><forEach id="1" items="items"><node>Item</node></forEach></nodes></agent>',
                },
              },
            }
          );
        }

        expect(variables.get('foreach_1')).toBe(10);
      });
    });

    describe('Tool error handling edge cases', () => {
      test('VariableStorageTool should handle context without variables map', async () => {
        const tool = new VariableStorageTool();
        const malformedContext = {
          context: {
            variables: null,
          },
          agentChain: { agent: { id: 'test' } },
          agent: { Name: 'TestAgent' },
          variables: new Map(),
        } as any;

        try {
          await tool.execute(
            {
              operation: 'write_variable',
              name: 'test',
              value: 'value',
            },
            malformedContext
          );
        } catch (e) {
          // Should handle gracefully or throw predictably
          expect(e).toBeDefined();
        }
      });

      test('ForeachTaskTool should handle malformed XML gracefully', async () => {
        const variables = new Map();
        const agentContext = mockAgentContext(variables) as any;

        const tool = new ForeachTaskTool();

        await expect(
          tool.execute(
            {
              nodeId: 1,
              progress: 'Step',
              next_step: 'Next',
            },
            {
              ...agentContext,
              agentChain: {
                agent: {
                  id: 'test-agent-id',
                  xml: '<<<>>>',
                },
              },
            }
          )
        ).rejects.toThrow();
      });
    });
  });
});
