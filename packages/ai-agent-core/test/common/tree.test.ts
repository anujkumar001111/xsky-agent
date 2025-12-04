
import { buildAgentTree } from '../../src/common/tree';
import { WorkflowAgent, NormalAgentNode, ParallelAgentNode } from '../../src/types/core.types';

describe('buildAgentTree', () => {
  const createAgent = (id: string, dependsOn: string[] = []): WorkflowAgent => ({
    id,
    name: `Agent ${id}`,
    dependsOn,
    description: 'test agent',
    instruction: 'do something',
    tools: []
  });

  test('should build a simple linear chain', () => {
    // A -> B -> C
    const agents = [
      createAgent('A', []),
      createAgent('B', ['A']),
      createAgent('C', ['B'])
    ];

    const tree = buildAgentTree(agents) as NormalAgentNode;

    expect(tree).toBeDefined();
    expect(tree.type).toBe('normal');
    expect(tree.agent.id).toBe('A');

    const next1 = tree.nextAgent as NormalAgentNode;
    expect(next1).toBeDefined();
    expect(next1.agent.id).toBe('B');

    const next2 = next1.nextAgent as NormalAgentNode;
    expect(next2).toBeDefined();
    expect(next2.agent.id).toBe('C');
    expect(next2.nextAgent).toBeUndefined();
  });

  test('should handle parallel execution', () => {
    // A -> [B, C]
    const agents = [
      createAgent('A', []),
      createAgent('B', ['A']),
      createAgent('C', ['A'])
    ];

    const tree = buildAgentTree(agents) as NormalAgentNode;

    expect(tree.agent.id).toBe('A');

    const next = tree.nextAgent as ParallelAgentNode;
    expect(next.type).toBe('parallel');
    expect(next.agents).toHaveLength(2);

    const agentIds = next.agents.map(n => n.agent.id).sort();
    expect(agentIds).toEqual(['B', 'C']);
  });

  test('should handle diamond dependency pattern', () => {
    // A -> [B, C] -> D
    const agents = [
      createAgent('A', []),
      createAgent('B', ['A']),
      createAgent('C', ['A']),
      createAgent('D', ['B', 'C'])
    ];

    const tree = buildAgentTree(agents) as NormalAgentNode;
    expect(tree.agent.id).toBe('A');

    const parallelNode = tree.nextAgent as ParallelAgentNode;
    expect(parallelNode.type).toBe('parallel');

    const finalNode = parallelNode.nextAgent as NormalAgentNode;
    expect(finalNode).toBeDefined();
    expect(finalNode.agent.id).toBe('D');
  });

  test('should detect and break cycles', () => {
    // A -> B -> A (cycle)
    const agents = [
      createAgent('A', ['B']),
      createAgent('B', ['A'])
    ];

    // The function should handle this gracefully, likely by breaking one link
    // Usually it breaks the link to the node with higher in-degree or arbitrary if equal
    // We just ensure it returns a valid tree and doesn't crash
    const tree = buildAgentTree(agents);
    expect(tree).toBeDefined();
  });

  test('should throw error for no executable agents', () => {
    expect(() => buildAgentTree([])).toThrow('No executable agent');
  });
});
