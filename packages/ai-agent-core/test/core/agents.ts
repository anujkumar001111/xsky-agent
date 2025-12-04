import { AgentContext } from "../../src";
import { BaseBrowserLabelsAgent, BaseComputerAgent, BaseFileAgent } from "../../src/agent";

export class SimpleBrowserAgent extends BaseBrowserLabelsAgent {
  protected screenshot(agentContext: AgentContext): Promise<{ imageBase64: string; imageType: "image/jpeg" | "image/png"; }> {
    return Promise.resolve({ imageBase64: '', imageType: 'image/png' });
  }
  protected navigate_to(agentContext: AgentContext, url: string): Promise<any> {
    return Promise.resolve('success');
  }
  protected execute_script(agentContext: AgentContext, func: (...args: any[]) => void, args: any[]): Promise<any> {
    return Promise.resolve('success');
  }
  protected get_all_tabs(agentContext: AgentContext): Promise<Array<{ tabId: number; url: string; title: string; }>> {
    return Promise.resolve([]);
  }
  protected switch_tab(agentContext: AgentContext, tabId: number): Promise<{ tabId: number; url: string; title: string; }> {
    return Promise.resolve({ tabId: 0, url: '', title: '' });
  }
}

export class SimpleComputerAgent extends BaseComputerAgent {
  protected screenshot(agentContext: AgentContext): Promise<{ imageBase64: string; imageType: "image/jpeg" | "image/png"; }> {
    return Promise.resolve({ imageBase64: '', imageType: 'image/png' });
  }
  protected typing(agentContext: AgentContext, text: string): Promise<void> {
    return Promise.resolve();
  }
  protected click(agentContext: AgentContext, x: number, y: number, num_clicks: number, button_type: "left" | "right" | "middle"): Promise<void> {
    return Promise.resolve();
  }
  protected scroll(agentContext: AgentContext, amount: number): Promise<void> {
    return Promise.resolve();
  }
  protected move_to(agentContext: AgentContext, x: number, y: number): Promise<void> {
    return Promise.resolve();
  }
  protected press(agentContext: AgentContext, key: string): Promise<void> {
    return Promise.resolve();
  }
  protected hotkey(agentContext: AgentContext, keys: string): Promise<void> {
    return Promise.resolve();
  }
  protected drag_and_drop(agentContext: AgentContext, x1: number, y1: number, x2: number, y2: number): Promise<void> {
    return Promise.resolve();
  }
}

export class SimpleFileAgent extends BaseFileAgent {
  protected file_list(agentContext: AgentContext, path: string): Promise<Array<{ path: string; name?: string; isDirectory?: boolean; size?: string; modified?: string; }>> {
    return Promise.resolve([]);
  }
  protected file_read(agentContext: AgentContext, path: string): Promise<string> {
    return Promise.resolve('');
  }
  protected file_write(agentContext: AgentContext, path: string, content: string, append: boolean): Promise<any> {
    return Promise.resolve('success');
  }
  protected file_str_replace(agentContext: AgentContext, path: string, old_str: string, new_str: string): Promise<any> {
    return Promise.resolve('success');
  }
  protected file_find_by_name(agentContext: AgentContext, path: string, glob: string): Promise<Array<{ path: string; name?: string; isDirectory?: boolean; size?: string; modified?: string; }>> {
    return Promise.resolve([]);
  }
}