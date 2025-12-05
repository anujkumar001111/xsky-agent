import {
  WorkflowAgent,
  AgentNode,
  NormalAgentNode,
  ParallelAgentNode,
} from "../types/core.types";

/**
 * @file tree.ts
 * @description Implements the logic for converting a flat list of agents with dependencies
 * into a structured execution tree (serial/parallel).
 * Handles topological sorting and circular dependency resolution.
 */

/**
 * Transforms a list of WorkflowAgent definitions into an executable AgentNode tree.
 * This is the core logic that determines "what runs next" and "what runs in parallel".
 *
 * Steps:
 * 1. Cycle detection and resolution (DAG enforcement).
 * 2. Dependency mapping.
 * 3. Recursive tree construction starting from root nodes (no dependencies).
 * 4. Grouping of independent nodes into ParallelAgentNodes.
 *
 * @param agents - Flat list of agents from the parsed workflow.
 * @returns The root node of the execution tree.
 * @throws If no executable agents are found or tree cannot be built.
 */
export function buildAgentTree(agents: WorkflowAgent[]): AgentNode {
  // Detect and handle circular dependencies to ensure DAG property
  const safeAgents = detectAndBreakCycles(agents);

  if (safeAgents.length === 0) {
    throw new Error("No executable agent");
  }

  // Establish dependency relationship mapping
  const agentMap = new Map<string, WorkflowAgent>();
  const dependents = new Map<string, WorkflowAgent[]>();

  // Initialize maps
  for (const agent of safeAgents) {
    agentMap.set(agent.id, agent);
    dependents.set(agent.id, []);
  }

  // Populate dependents (reverse dependency map)
  for (const agent of safeAgents) {
    for (const depId of agent.dependsOn) {
      if (dependents.has(depId)) {
        dependents.get(depId)!.push(agent);
      }
    }
  }

  // Identify entry points (nodes with no dependencies)
  let entryAgents = safeAgents.filter((agent) => agent.dependsOn.length === 0);

  // Fallback: If no pure roots, look for agents depending on virtual root '00'
  if (entryAgents.length === 0) {
    entryAgents = safeAgents.filter(
      (agent) =>
        agent.dependsOn.length == 1 && agent.dependsOn[0].endsWith("00")
    );
  }

  const processedAgents = new Set<string>();

  /**
   * Recursive function to build the tree level by level.
   * Identifies all agents that become executable once the current level completes.
   */
  function buildNodeRecursive(
    currentAgents: WorkflowAgent[]
  ): AgentNode | undefined {
    if (currentAgents.length === 0) {
      return undefined;
    }

    // Mark current level as processed
    for (const agent of currentAgents) {
      processedAgents.add(agent.id);
    }

    const nextLevelAgents: WorkflowAgent[] = [];
    const nextLevelSet = new Set<string>();

    // Find next set of runnable agents
    for (const agent of currentAgents) {
      const dependentAgents = dependents.get(agent.id) || [];
      for (const dependentAgent of dependentAgents) {
        // Check if ALL dependencies of the candidate agent are met
        const allDependenciesProcessed = dependentAgent.dependsOn.every(
          (depId) => processedAgents.has(depId)
        );

        if (allDependenciesProcessed && !nextLevelSet.has(dependentAgent.id)) {
          nextLevelAgents.push(dependentAgent);
          nextLevelSet.add(dependentAgent.id);
        }
      }
    }

    const nextNode = buildNodeRecursive(nextLevelAgents);

    // Construct the node for current level
    if (currentAgents.length === 1) {
      // Single agent -> Normal Node
      return {
        type: "normal",
        agent: currentAgents[0],
        nextAgent: nextNode,
      } as NormalAgentNode;
    } else {
      // Multiple agents -> Parallel Node
      const parallelNodes: NormalAgentNode[] = currentAgents.map(
        (agent) =>
          ({
            type: "normal",
            agent: agent,
            nextAgent: undefined,
          } as NormalAgentNode)
      );
      return {
        type: "parallel",
        agents: parallelNodes,
        nextAgent: nextNode,
      } as ParallelAgentNode;
    }
  }

  const rootNode = buildNodeRecursive(entryAgents);
  if (!rootNode) {
    throw new Error("Unable to build execution tree");
  }

  return rootNode;
}

/**
 * Detects and breaks cycles in the dependency graph to prevent infinite loops.
 * Uses Kahn's algorithm (Topological Sort) to detect cycles.
 * If a cycle is found, it heuristically breaks links to allow execution to proceed (best-effort recovery).
 *
 * @param agents - The list of agents to check.
 * @returns A sanitized list of agents with guaranteed DAG structure.
 */
function detectAndBreakCycles(agents: WorkflowAgent[]): WorkflowAgent[] {
  // Data structures for topological sort
  const agentMap = new Map<string, WorkflowAgent>();
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  // Initialize graph
  for (const agent of agents) {
    agentMap.set(agent.id, agent);
    inDegree.set(agent.id, 0);
    adjList.set(agent.id, []);
  }

  // Build graph edges
  for (const agent of agents) {
    for (const depId of agent.dependsOn) {
      if (agentMap.has(depId)) {
        // depId -> agent.id indicates that the agent depends on depId.
        adjList.get(depId)!.push(agent.id);
        inDegree.set(agent.id, inDegree.get(agent.id)! + 1);
      }
    }
  }

  // Topological Sorting (Kahn's Algorithm)
  const queue: string[] = [];
  const processedCount = new Map<string, number>();

  // Start with nodes having 0 in-degree
  for (const [agentId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(agentId);
    }
    processedCount.set(agentId, 0);
  }

  let processedNodes = 0;
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    processedNodes++;

    for (const neighborId of adjList.get(currentId)!) {
      const newInDegree = inDegree.get(neighborId)! - 1;
      inDegree.set(neighborId, newInDegree);
      if (newInDegree === 0) {
        queue.push(neighborId);
      }
    }
  }

  // Cycle Detected
  if (processedNodes < agents.length) {
    console.warn(
      "Detected a circular dependency, automatically disconnecting the circular link..."
    );

    // Identify nodes involved in the cycle (in-degree never reached 0)
    const cyclicNodes = new Set<string>();
    for (const [agentId, degree] of inDegree.entries()) {
      if (degree > 0) {
        cyclicNodes.add(agentId);
      }
    }

    const fixedAgents: WorkflowAgent[] = [];

    // Attempt to break the cycle by removing dependencies on other cyclic nodes
    for (const agent of agents) {
      if (cyclicNodes.has(agent.id)) {
        const filteredDependsOn = agent.dependsOn.filter(
          (depId) => !cyclicNodes.has(depId) || !agentMap.has(depId)
        );

        // Heuristic: Try to preserve at least one valid dependency if possible
        if (filteredDependsOn.length === 0 && agent.dependsOn.length > 0) {
          const firstValidDep = agent.dependsOn.find((depId) =>
            agentMap.has(depId)
          );
          if (firstValidDep && !cyclicNodes.has(firstValidDep)) {
            filteredDependsOn.push(firstValidDep);
          }
        }

        agent.dependsOn = filteredDependsOn;
        fixedAgents.push(agent);

        if (filteredDependsOn.length !== agent.dependsOn.length) {
          console.warn(
            `The partial cyclic dependency of agent ${agent.id} has been disconnected.`
          );
        }
      } else {
        // Non-cyclic node, just sanitize non-existent dependencies
        const validDependsOn = agent.dependsOn.filter((depId) =>
          agentMap.has(depId)
        );
        agent.dependsOn = validDependsOn;
        fixedAgents.push(agent);
      }
    }

    return fixedAgents;
  }

  // No loops found, just cleanup phantom dependencies
  return agents.map((agent) => {
    agent.dependsOn = agent.dependsOn.filter((depId) => agentMap.has(depId));
    return agent;
  });
}
