import { Agent } from "./base";

/**
 * Interface for the A2A client.
 */
export interface IA2aClient {
  /**
   * Lists the available agents for a given task prompt.
   * @param taskPrompt - The task prompt to search for agents.
   * @returns A promise that resolves to a list of agents.
   */
  listAgents(taskPrompt: string): Promise<Agent[]>;
}

/**
 * A client for the A2A protocol.
 */
export class A2aClient {
  // TODO A2A: https://www.a2aprotocol.net/zh
}