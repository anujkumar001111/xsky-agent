// Browser agent framework imports - base classes for web automation
import { BaseBrowserAgent, AGENT_NAME } from "./browser_base";  // Core browser automation base
import BaseBrowserLabelsAgent from "./browser_labels";              // Label-based interaction agent
import BaseBrowserScreenAgent from "./browser_screen";              // Screen-based interaction agent

// Export browser agent classes for creating specialized web automation agents
export { 
  AGENT_NAME,              // Browser agent type identifier
  BaseBrowserAgent,        // Core browser automation base class
  BaseBrowserScreenAgent,   // Screen-based browser interaction agent
  BaseBrowserLabelsAgent    // Label-based browser interaction agent
};
