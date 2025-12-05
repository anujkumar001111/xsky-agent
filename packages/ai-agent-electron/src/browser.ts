import { LanguageModelV2Prompt, Tool } from "@xsky/ai-agent-core/types";
import { AgentContext, BaseBrowserLabelsAgent, config } from "@xsky/ai-agent-core";
import { BrowserView, WebContentsView, NativeImage } from "electron";
import * as path from "path";
// import { store } from "../../electron/main/utils/store"; // External dependency - should be injected

/**
 * Configuration options for BrowserAgent security settings.
 */
export interface BrowserAgentSecurityOptions {
  /**
   * Enable contextIsolation for enhanced security.
   * When true, uses IPC communication via preload script instead of direct executeJavaScript.
   * Recommended for production use.
   * @default false (for backward compatibility)
   */
  useContextIsolation?: boolean;

  /**
   * Path to the preload script.
   * Required when useContextIsolation is true.
   * The preload script should expose a secure API via contextBridge.
   */
  preloadPath?: string;
}

/**
 * A browser agent that runs in an Electron environment.
 *
 * ## Security Considerations
 *
 * By default, this agent uses `executeJavaScript` for backward compatibility.
 * For production deployments, it is **strongly recommended** to enable
 * `useContextIsolation` in the security options.
 *
 * ### Setting up secure mode:
 *
 * 1. Create your WebContentsView with security options:
 * ```typescript
 * const view = new WebContentsView({
 *   webPreferences: {
 *     contextIsolation: true,
 *     nodeIntegration: false,
 *     sandbox: true,
 *     preload: path.join(__dirname, 'preload.js')
 *   }
 * });
 * ```
 *
 * 2. Initialize the agent with security options:
 * ```typescript
 * const agent = new BrowserAgent(view, mcpClient, customPrompt, {
 *   useContextIsolation: true,
 *   preloadPath: path.join(__dirname, 'preload.js')
 * });
 * ```
 *
 * @see https://www.electronjs.org/docs/latest/tutorial/security
 */
export default class BrowserAgent extends BaseBrowserLabelsAgent {

  private detailView: WebContentsView;
  private customPrompt?: string;
  private securityOptions: BrowserAgentSecurityOptions;
  /** Scale factor from last screenshot operation for coordinate mapping */
  public lastScaleFactor: number = 1;

  /**
   * Creates an instance of the BrowserAgent.
   * @param detailView - The Electron WebContentsView to use.
   * @param mcpClient - The MCP client to use.
   * @param customPrompt - A custom prompt to use.
   * @param securityOptions - Security configuration options.
   */
  constructor(
    detailView: WebContentsView,
    mcpClient?: any,
    customPrompt?: string,
    securityOptions?: BrowserAgentSecurityOptions
  ) {
    super(['default'], [], mcpClient);
    this.detailView = detailView;
    this.customPrompt = customPrompt;
    this.securityOptions = securityOptions || { useContextIsolation: false };

    // Warn if using insecure mode in production
    if (!this.securityOptions.useContextIsolation && process.env.NODE_ENV === 'production') {
      console.warn(
        '[BrowserAgent] WARNING: Running without contextIsolation in production. ' +
        'This is a security risk. Consider enabling useContextIsolation option.'
      );
    }
  }

  protected async double_screenshots(
    agentContext: AgentContext,
    messages: LanguageModelV2Prompt,
    tools: Tool[]
  ): Promise<boolean> {
    return false;
  }

  /**
   * Captures a screenshot of the current page in the Electron view.
   * Handles optional resolution normalization based on configuration.
   * @param agentContext - The current agent context containing execution state.
   * @returns A promise that resolves to an object containing the base64-encoded image and image type.
   */
  protected async screenshot(
    agentContext: AgentContext
  ): Promise<{ imageBase64: string; imageType: "image/jpeg" | "image/png" }> {
    let image = await this.detailView.webContents.capturePage();

    // Apply resolution normalization if enabled
    if (config.screenshotScaling?.enabled) {
      const { maxWidth, maxHeight } = config.screenshotScaling;
      const originalSize = image.getSize();

      // Calculate scale factor to fit within max dimensions while preserving aspect ratio
      const widthRatio = maxWidth / originalSize.width;
      const heightRatio = maxHeight / originalSize.height;
      const scaleFactor = Math.min(widthRatio, heightRatio, 1); // Never upscale

      if (scaleFactor < 1) {
        // Resize needed
        const newWidth = Math.round(originalSize.width * scaleFactor);
        const newHeight = Math.round(originalSize.height * scaleFactor);

        image = image.resize({ width: newWidth, height: newHeight });
        this.lastScaleFactor = scaleFactor;
      } else {
        // No scaling needed
        this.lastScaleFactor = 1;
      }
    } else {
      this.lastScaleFactor = 1;
    }

    return { imageBase64: image.toDataURL(), imageType: "image/jpeg" };
  }

  /**
   * Navigates the browser view to a specified URL.
   * @param agentContext - The current agent context containing execution state.
   * @param url - The URL to navigate to.
   * @returns A promise that resolves to an object containing the loaded URL and page title.
   */
  protected async navigate_to(
    agentContext: AgentContext,
    url: string
  ): Promise<{ url: string; title?: string }> {
    await this.detailView.webContents.loadURL(url);
    await this.sleep(200);
    return {
      url: this.detailView.webContents.getURL(),
      title: this.detailView.webContents.getTitle(),
    };
  }

  /**
   * Executes a JavaScript function within the page context.
   * Supports both legacy execution and secure context-isolated execution via IPC.
   * @param agentContext - The current agent context.
   * @param func - The function to execute.
   * @param args - Arguments to pass to the function.
   * @returns A promise that resolves to the result of the function execution.
   */
  protected async execute_script(
    agentContext: AgentContext,
    func: (...args: any[]) => void,
    args: any[]
  ): Promise<any> {
    const viewWebContents = this.detailView.webContents;

    if (this.securityOptions.useContextIsolation) {
      // Secure mode: Use IPC communication via preload script
      // The preload script exposes a limited API via contextBridge
      const serializedFunc = func.toString();
      const code = `
        (async () => {
          if (window.xskyAgent && window.xskyAgent.executeScript) {
            return await window.xskyAgent.executeScript(${JSON.stringify(serializedFunc)}, ${JSON.stringify(args)});
          } else {
            throw new Error('xskyAgent API not available. Ensure preload script is configured correctly.');
          }
        })()
      `;
      console.log("[BrowserAgent] Executing script via secure preload API");
      const result = await viewWebContents.executeJavaScript(code, true);
      if (result && result.error) {
        throw new Error(result.error);
      }
      return result;
    } else {
      // Legacy mode: Direct executeJavaScript (less secure, but backward compatible)
      const code = `(async() => {
    const func = ${func};
    const result = await func(...${JSON.stringify(args)});
    return result;
})()`;

      console.log("invoke-view-func code", code);
      const result = await viewWebContents.executeJavaScript(code, true);

      console.log("invoke-view-func result", result);
      return result;
    }
  }

  /**
   * Gets the dimensions of the browser view.
   * @returns A promise that resolves to a tuple [width, height].
   */
  private async size(): Promise<[number, number]> {
    const width = this.detailView.getBounds().width;
    const height = this.detailView.getBounds().height;
    return [width, height]
  }

  /**
   * Pauses execution for a specified duration.
   * @param time - Duration in milliseconds.
   */
  private sleep(time: number): Promise<void> {
    return new Promise((resolve) => setTimeout(() => resolve(), time));
  }

  /**
   * Retrieves the single active tab information (Electron agent currently supports single view).
   * @param agentContext - The current agent context.
   * @returns A promise that resolves to an array containing the single active tab.
   */
  protected async get_all_tabs(
    agentContext: AgentContext
  ): Promise<Array<{ tabId: number; url: string; title: string }>> {
    const url = this.detailView.webContents.getURL();
    const title = this.detailView.webContents.getTitle();
    return [
      {
        tabId: 0,
        url,
        title,
      },
    ];
  }

  /**
   * Switches to a specific tab (noop for single-view Electron agent).
   * @param agentContext - The current agent context.
   * @param tabId - The ID of the tab to switch to.
   * @returns A promise that resolves to the active tab info.
   */
  protected async switch_tab(
    agentContext: AgentContext,
    tabId: number
  ): Promise<{ tabId: number; url: string; title: string }> {
    return (await this.get_all_tabs(agentContext))[0];
  }

  /**
   * Navigates back in the browser history.
   * @param agentContext - The current agent context.
   */
  protected async go_back(agentContext: AgentContext): Promise<void> {
    if (this.detailView.webContents.navigationHistory.canGoBack()) {
      this.detailView.webContents.navigationHistory.goBack();
      await this.sleep(200);
    }
  }

  // NOTE: This method requires external store dependency - commented out for npm package
  // protected async get_xiaohongshu_video_url(xiaohongshuUrl: string): Promise<string> {
  //   try {
  //     // Get video URL from Electron store
  //     const videoUrlMap = store.get('videoUrlMap', {});
  //     const videoInfo = videoUrlMap[xiaohongshuUrl];

  //     if (videoInfo && videoInfo.platform === 'xiaohongshu' && videoInfo.videoUrl) {
  //       console.log('Retrieved Xiaohongshu video URL from store:', videoInfo.videoUrl);
  //       return videoInfo.videoUrl;
  //     } else {
  //       throw new Error('Video URL not found for this Xiaohongshu page, please open the page in detailView first');
  //     }
  //   } catch (error) {
  //     console.error('Failed to get Xiaohongshu video URL:', error);
  //     throw new Error(`Failed to get video URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  //   }
  // }

  // Override extSysPrompt to support custom prompt
  protected async extSysPrompt(
    agentContext: AgentContext,
    tools: Tool[]
  ): Promise<string> {
    return this.customPrompt || "";
  }

  // Override extract_page_content method to support PDF
  protected async extract_page_content(agentContext: AgentContext): Promise<any> {
    const currentUrl = this.detailView.webContents.getURL();

    // Detect if this is a PDF page
    if (this.isPdfUrl(currentUrl) || await this.isPdfPage(agentContext)) {
      return await this.extractPdfContent(agentContext);
    }

    // Call parent class HTML content extraction
    return await super.extract_page_content(agentContext);
  }

  /**
   * Checks if a URL points to a PDF file based on extensions and common patterns.
   * @param url - The URL to check.
   * @returns True if the URL is likely a PDF.
   */
  private isPdfUrl(url: string): boolean {
    return url.toLowerCase().includes('.pdf') ||
           url.includes('application/pdf') ||
           url.includes('viewer.html') || // Chrome PDF viewer
           url.includes('#page='); // PDF page anchor
  }

  /**
   * Detects if the currently loaded page is displaying a PDF.
   * Checks for PDF viewers (embeds, iframes, specific viewer classes).
   * @param agentContext - The current agent context.
   * @returns A promise that resolves to true if the page is a PDF viewer.
   */
  private async isPdfPage(agentContext: AgentContext): Promise<boolean> {
    try {
      return await this.execute_script(agentContext, () => {
        // Detect PDF viewer characteristics
        return document.querySelector('embed[type="application/pdf"]') !== null ||
               document.querySelector('iframe[src*=".pdf"]') !== null ||
               document.querySelector('#viewer') !== null || // Chrome PDF viewer
               document.querySelector('.pdfViewer') !== null || // Firefox PDF viewer
               document.contentType === 'application/pdf' ||
               window.location.href.includes('viewer.html');
      }, []);
    } catch (error) {
      console.warn('PDF detection failed:', error);
      return false;
    }
  }

  /**
   * Extracts text content from a PDF file using PDF.js.
   * Dynamically loads PDF.js if not present and parses all pages.
   * @param agentContext - The current agent context.
   * @returns A promise that resolves to an object containing PDF metadata and extracted text.
   */
  private async extractPdfContent(agentContext: AgentContext): Promise<any> {
    try {
      return await this.execute_script(agentContext, () => {
        return new Promise(async (resolve) => {
          try {
            // Dynamically load PDF.js
            if (!(window as any).pdfjsLib) {
              console.log('Starting to load PDF.js library...');

              // Load PDF.js main file
              const script = document.createElement('script');
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
              script.crossOrigin = 'anonymous';

              await new Promise((scriptResolve, scriptReject) => {
                script.onload = () => {
                  console.log('PDF.js main file loaded successfully');
                  scriptResolve(true);
                };
                script.onerror = () => {
                  console.error('Failed to load PDF.js main file');
                  scriptReject(new Error('Failed to load PDF.js'));
                };
                document.head.appendChild(script);
              });

              // Configure worker
              (window as any).pdfjsLib!.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

              console.log('PDF.js configuration completed');
            }

            // Get PDF URL
            let pdfUrl = window.location.href;

            // Try to get actual PDF URL from various PDF containers
            const embedEl = document.querySelector('embed[type="application/pdf"]') as HTMLEmbedElement;
            const iframeEl = document.querySelector('iframe[src*=".pdf"]') as HTMLIFrameElement;

            if (embedEl && embedEl.src && embedEl.src !== 'about:blank' && !embedEl.src.startsWith('about:')) {
              pdfUrl = embedEl.src;
            } else if (iframeEl && iframeEl.src && iframeEl.src !== 'about:blank' && !iframeEl.src.startsWith('about:')) {
              pdfUrl = iframeEl.src;
            } else if (window.location.href.includes('viewer.html')) {
              // Chrome PDF viewer format: chrome://pdf-viewer/index.html?src=URL
              const urlParams = new URLSearchParams(window.location.search);
              const srcParam = urlParams.get('src') || urlParams.get('file');
              if (srcParam) {
                pdfUrl = decodeURIComponent(srcParam);
              }
            } else if (pdfUrl === window.location.href && (pdfUrl === 'about:blank' || pdfUrl.startsWith('about:'))) {
              // If current URL is also about:blank, try other methods to get real PDF URL
              // Check if page has other clues containing PDF URL
              const allEmbeds = document.querySelectorAll('embed');
              const allIframes = document.querySelectorAll('iframe');

              for (const embed of Array.from(allEmbeds)) {
                const src = (embed as HTMLEmbedElement).src;
                if (src && src.includes('.pdf') && !src.startsWith('about:')) {
                  pdfUrl = src;
                  break;
                }
              }

              if (pdfUrl === window.location.href || pdfUrl.startsWith('about:')) {
                for (const iframe of Array.from(allIframes)) {
                  const src = (iframe as HTMLIFrameElement).src;
                  if (src && src.includes('.pdf') && !src.startsWith('about:')) {
                    pdfUrl = src;
                    break;
                  }
                }
              }
            }

            console.log('Parsing PDF:', pdfUrl);

            // Validate if PDF URL is valid
            if (!pdfUrl || pdfUrl === 'about:blank' || pdfUrl.startsWith('about:') || (pdfUrl === window.location.href && !pdfUrl.includes('.pdf'))) {
              console.warn('Unable to get valid PDF URL:', pdfUrl);
              resolve({
                title: document.title || 'PDF Document',
                page_url: window.location.href,
                page_content: 'Current page cannot be parsed as a PDF file. The page may not be fully loaded or does not contain PDF content. Please try again later or check if the page displays the PDF correctly.',
                error: false,
                content_type: 'pdf'
              });
              return;
            }

            // Load PDF document
            const loadingTask = (window as any).pdfjsLib!.getDocument({
              url: pdfUrl,
              cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
              cMapPacked: true
            });

            const pdf = await loadingTask.promise;
            console.log('PDF document loaded successfully, total pages:', pdf.numPages);

            let fullText = '';
            const numPages = pdf.numPages;
            // TODO: Implement page extraction splitting in the future
            const maxPages = numPages;

            // Extract text from all pages
            for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
              try {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                  .filter((item: any) => item.str && item.str.trim())
                  .map((item: any) => item.str)
                  .join(' ');

                if (pageText.trim()) {
                  fullText += `\n--- Page ${pageNum} ---\n${pageText.trim()}\n`;
                }

                console.log(`Page ${pageNum} text extraction completed`);
              } catch (pageError: any) {
                console.error(`Page ${pageNum} extraction failed:`, pageError);
                fullText += `\n--- Page ${pageNum} ---\n[Page content extraction failed: ${pageError.message}]\n`;
              }
            }

            const result = {
              title: document.title || 'PDF Document',
              page_url: pdfUrl,
              page_content: fullText.trim() || 'Failed to extract PDF text content',
              total_pages: numPages,
              extracted_pages: maxPages,
              content_type: 'pdf'
            };

            console.log('PDF content extraction completed:', {
              totalPages: numPages,
              extractedPages: maxPages,
              contentLength: fullText.length
            });

            resolve(result);

          } catch (error: any) {
            console.error('Error occurred during PDF processing:', error);
            resolve({
              title: document.title || 'PDF Document',
              page_url: window.location.href,
              page_content: `PDF content extraction failed: ${error.message}`,
              error: true,
              content_type: 'pdf'
            });
          }
        });
      }, []);
    } catch (error: any) {
      console.error('PDF content extraction failed:', error);
      return {
        title: this.detailView.webContents.getTitle() || 'PDF Document',
        page_url: this.detailView.webContents.getURL(),
        page_content: `PDF content extraction failed: ${error.message}`,
        error: true,
        content_type: 'pdf'
      };
    }
  }
}

export { BrowserAgent };