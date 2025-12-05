// Agent framework imports - base classes and interfaces for creating specialized agents
import { Agent, AgentParams } from "./base";                    // Base agent interface and parameters
import BaseFileAgent from "./file";                            // Base class for file system operations
import BaseShellAgent from "./shell";                          // Base class for shell/command operations
import BaseComputerAgent from "./computer";                    // Base class for computer control operations
import {
  BaseBrowserAgent,          // Base class for browser automation
  BaseBrowserLabelsAgent,    // Base class for label-based browser interaction
  BaseBrowserScreenAgent,    // Base class for screen-based browser automation
} from "./browser";

// Export all agent base classes for extensibility
export {
  Agent,                      // Core agent interface
  BaseFileAgent,             // File system agent base class
  BaseShellAgent,            // Shell/command agent base class
  BaseComputerAgent,         // Computer control agent base class
  BaseBrowserAgent,          // Browser automation base class
  BaseBrowserLabelsAgent,    // Label-based browser agent base class
  BaseBrowserScreenAgent,    // Screen-based browser agent base class
  type AgentParams,          // Type definition for agent initialization parameters
};
