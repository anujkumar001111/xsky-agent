import html2canvas from "html2canvas";
import { AgentContext, BaseBrowserLabelsAgent } from "@xsky/ai-agent-core";

/**
 * A browser agent that runs in a web browser.
 */
export default class BrowserAgent extends BaseBrowserLabelsAgent {
  /**
   * Takes a screenshot of the current page.
   * @param agentContext - The context for the agent.
   * @returns A promise that resolves to the screenshot data.
   */
  protected async screenshot(
    agentContext: AgentContext
  ): Promise<{ imageBase64: string; imageType: "image/jpeg" | "image/png" }> {
    const [width, height] = this.size();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    const canvas = await html2canvas(document.documentElement || document.body, {
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      x: scrollX,
      y: scrollY,
      scrollX: -scrollX,
      scrollY: -scrollY,
      useCORS: true,
      foreignObjectRendering: true,
      // backgroundColor: 'white',
      // scale: window.devicePixelRatio || 1,
    });
    let dataUrl = canvas.toDataURL("image/jpeg");
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
   * @returns A promise that resolves to the new URL and title.
   */
  protected async navigate_to(
    agentContext: AgentContext,
    url: string
  ): Promise<{ url: string; title?: string }> {
    let idx = location.href.indexOf("/", 10);
    let baseUrl = idx > -1 ? location.href.substring(0, idx) : location.href;
    if (url.startsWith("/")) {
      history.pushState(null, "", url);
    } else if (url.startsWith(baseUrl)) {
      history.pushState(null, "", url.substring(baseUrl.length));
    } else {
      throw new Error(
        "Unable to access other websites, can only access other subpages within the current website: " +
          baseUrl
      );
    }
    window.dispatchEvent(new PopStateEvent("popstate"));
    await this.sleep(200);
    return {
      url: location.href,
      title: document.title,
    };
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
    return func(args[0]);
  }

  /**
   * Helper method to get the size of the viewport.
   * Calculates width and height considering different browser properties.
   * @returns A tuple containing [width, height] in pixels.
   */
  private size(): [number, number] {
    return [
      window.innerWidth ||
        document.documentElement.clientWidth ||
        (document.documentElement || document.body).clientWidth,
      window.innerHeight ||
        document.documentElement.clientHeight ||
        (document.documentElement || document.body).clientHeight,
    ];
  }

  /**
   * Pauses execution for a specified amount of time.
   * @param time - The duration to sleep in milliseconds.
   * @returns A promise that resolves after the specified time.
   */
  private sleep(time: number): Promise<void> {
    return new Promise((resolve) => setTimeout(() => resolve(), time));
  }

  /**
   * Gets a list of all open tabs.
   * @param agentContext - The context for the agent.
   * @returns A promise that resolves to a list of tabs.
   */
  protected async get_all_tabs(
    agentContext: AgentContext
  ): Promise<Array<{ tabId: number; url: string; title: string }>> {
    return [
      {
        tabId: 0,
        url: location.href,
        title: document.title,
      },
    ];
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
    return (await this.get_all_tabs(agentContext))[0];
  }
}

export { BrowserAgent };