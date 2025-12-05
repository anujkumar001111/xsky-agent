import { AgentContext, BaseBrowserLabelsAgent } from "@xsky/ai-agent-core";

/**
 * A browser agent that runs in a browser extension.
 */
export default class BrowserAgent extends BaseBrowserLabelsAgent {
  /**
   * Takes a screenshot of the current tab.
   * @param agentContext - The context for the agent.
   * @returns A promise that resolves to the screenshot data.
   */
  protected async screenshot(
    agentContext: AgentContext
  ): Promise<{ imageBase64: string; imageType: "image/jpeg" | "image/png" }> {
    let windowId = await this.getWindowId(agentContext);
    let dataUrl;
    try {
      dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: "jpeg",
        quality: 60,
      });
    } catch (e) {
      await this.sleep(1000);
      dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: "jpeg",
        quality: 60,
      });
    }
    let data = dataUrl.substring(dataUrl.indexOf("base64,") + 7);
    return {
      imageBase64: data,
      imageType: "image/jpeg",
    };
  }

  /**
   * Navigates to a new URL.
   * @param agentContext - The context for the agent.
   * @param url - The URL to navigate to.
   * @returns A promise that resolves to the new tab information.
   */
  protected async navigate_to(
    agentContext: AgentContext,
    url: string
  ): Promise<{
    url: string;
    title?: string;
    tabId?: number;
  }> {
    let windowId = await this.getWindowId(agentContext);
    let tab = await chrome.tabs.create({
      url: url,
      windowId: windowId,
    });
    tab = await this.waitForTabComplete(tab.id);
    await this.sleep(200);
    agentContext.variables.set("windowId", tab.windowId);
    let navigateTabIds = agentContext.variables.get("navigateTabIds") || [];
    navigateTabIds.push(tab.id);
    agentContext.variables.set("navigateTabIds", navigateTabIds);
    return {
      url: url,
      title: tab.title,
      tabId: tab.id
    };
  }

  /**
   * Gets a list of all open tabs.
   * @param agentContext - The context for the agent.
   * @returns A promise that resolves to a list of tabs.
   */
  protected async get_all_tabs(
    agentContext: AgentContext
  ): Promise<Array<{ tabId: number; url: string; title: string }>> {
    let windowId = await this.getWindowId(agentContext);
    let tabs = await chrome.tabs.query({
      windowId: windowId,
    });
    let result: Array<{ tabId: number; url: string; title: string }> = [];
    for (let i = 0; i < tabs.length; i++) {
      let tab = tabs[i];
      result.push({
        tabId: tab.id,
        url: tab.url,
        title: tab.title,
      });
    }
    return result;
  }

  /**
   * Switches to a specific tab.
   * @param agentContext - The context for the agent.
   * @param tabId - The ID of the tab to switch to.
   * @returns A promise that resolves to the new tab information.
   */
  protected async switch_tab(
    agentContext: AgentContext,
    tabId: number
  ): Promise<{ tabId: number; url: string; title: string }> {
    let tab = await chrome.tabs.update(tabId, { active: true });
    if (!tab) {
      throw new Error("tabId does not exist: " + tabId);
    }
    agentContext.variables.set("windowId", tab.windowId);
    return {
      tabId: tab.id,
      url: tab.url,
      title: tab.title,
    };
  }

  /**
   * Goes back to the previous page in the browser history.
   * @param agentContext - The context for the agent.
   */
  protected async go_back(agentContext: AgentContext): Promise<any> {
    try {
      let canGoBack = await this.execute_script(
        agentContext,
        () => {
          return (window as any).navigation.canGoBack;
        },
        []
      );
      if (canGoBack + "" == "true") {
        await this.execute_script(
          agentContext,
          () => {
            (window as any).navigation.back();
          },
          []
        );
        await this.sleep(100);
        return;
      }
      let history_length = await this.execute_script(
        agentContext,
        () => {
          return (window as any).history.length;
        },
        []
      );
      if (history_length > 1) {
        await this.execute_script(
          agentContext,
          () => {
            (window as any).history.back();
          },
          []
        );
      } else {
        let navigateTabIds = agentContext.variables.get("navigateTabIds");
        if (navigateTabIds && navigateTabIds.length > 0) {
          return await this.switch_tab(
            agentContext,
            navigateTabIds[navigateTabIds.length - 1]
          );
        }
      }
      await this.sleep(100);
    } catch (e) {
      console.error("BrowserAgent, go_back, error: ", e);
    }
  }

  /**
   * Executes a script in the browser.
   * @param agentContext - The context for the agent.
   * @param func - The function to execute.
   * @param args - The arguments to pass to the function.
   * @returns A promise that resolves to the result of the script.
   */
  protected async execute_script(
    agentContext: AgentContext,
    func: (...args: any[]) => void,
    args: any[]
  ): Promise<any> {
    let tabId = await this.getTabId(agentContext);
    let frameResults = await chrome.scripting.executeScript({
      target: { tabId: tabId as number },
      func: func,
      args: args,
    });
    return frameResults[0].result;
  }

  /**
   * Helper method to get the ID of the active tab in the target window.
   * Falls back to normal window types if no active tab is found.
   * @param agentContext - The agent context.
   * @returns A promise that resolves to the tab ID or null.
   */
  private async getTabId(agentContext: AgentContext): Promise<number | null> {
    let windowId = await this.getWindowId(agentContext);
    let tabs = (await chrome.tabs.query({
      windowId,
      active: true,
      windowType: "normal",
    })) as any[];
    if (tabs.length == 0) {
      tabs = (await chrome.tabs.query({
        windowId,
        windowType: "normal",
      })) as any[];
    }
    return tabs[tabs.length - 1].id as number;
  }

  /**
   * Helper method to get the target window ID.
   * Tries to use the window ID from the context variables, otherwise finds the last focused or current window.
   * @param agentContext - The agent context.
   * @returns A promise that resolves to the window ID or null.
   */
  private async getWindowId(
    agentContext: AgentContext
  ): Promise<number | null> {
    let windowId = agentContext.variables.get("windowId") as number;
    if (windowId) {
      return windowId;
    }
    let window = await chrome.windows.getLastFocused({
      windowTypes: ["normal"],
    });
    if (!window) {
      window = await chrome.windows.getCurrent({
        windowTypes: ["normal"],
      });
    }
    if (window) {
      return window.id;
    }
    let tabs = (await chrome.tabs.query({
      windowType: "normal",
      currentWindow: true,
    })) as any[];
    if (tabs.length == 0) {
      tabs = (await chrome.tabs.query({
        windowType: "normal",
        lastFocusedWindow: true,
      })) as any[];
    }
    return tabs[tabs.length - 1].windowId as number;
  }

  /**
   * Waits for a tab to complete loading.
   * @param tabId - The ID of the tab to wait for.
   * @param timeout - The maximum time to wait in milliseconds (default: 8000ms).
   * @returns A promise that resolves to the tab object when loading is complete or timeout occurs.
   */
  private async waitForTabComplete(
    tabId: number,
    timeout: number = 8000
  ): Promise<chrome.tabs.Tab> {
    return new Promise(async (resolve, reject) => {
      const time = setTimeout(async () => {
        chrome.tabs.onUpdated.removeListener(listener);
        let tab = await chrome.tabs.get(tabId);
        if (tab.status === "complete") {
          resolve(tab);
        } else {
          resolve(tab);
        }
      }, timeout);
      const listener = async (updatedTabId: any, changeInfo: any, tab: any) => {
        if (updatedTabId == tabId && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(time);
          resolve(tab);
        }
      };
      let tab = await chrome.tabs.get(tabId);
      if (tab.status === "complete") {
        resolve(tab);
        clearTimeout(time);
        return;
      }
      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  /**
   * Pauses execution for a specified amount of time.
   * @param time - The duration to sleep in milliseconds.
   * @returns A promise that resolves after the specified time.
   */
  private sleep(time: number): Promise<void> {
    return new Promise((resolve) => setTimeout(() => resolve(), time));
  }
}

export { BrowserAgent };