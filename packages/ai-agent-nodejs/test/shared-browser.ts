import { chromium, Browser, Page, BrowserContext } from "playwright";
import { BrowserAgent } from "../src/browser";

let sharedBrowser: Browser | null = null;
let useCount = 0;
let contexts: BrowserContext[] = [];

export async function getSharedBrowser(): Promise<Browser> {
    if (!sharedBrowser) {
        console.log('Launching browser instance...');
        sharedBrowser = await chromium.launch({ headless: true });
        console.log('Browser launched successfully');
    }
    useCount++;
    return sharedBrowser;
}

export async function releaseSharedBrowser(force: boolean = false): Promise<void> {
    useCount--;

    if ((useCount <= 0 || force) && sharedBrowser) {
        console.log('Closing browser...');
        try {
            // Close all contexts and their pages
            for (const context of contexts) {
                try {
                    const pages = context.pages();
                    await Promise.all(pages.map(page => page.close().catch(() => { })));
                    await context.close();
                } catch (error) {
                    console.error('Error closing context:', error);
                }
            }
            contexts = [];

            // Close browser
            await sharedBrowser.close();
        } catch (error) {
            console.error('Error closing browser:', error);
        } finally {
            sharedBrowser = null;
            useCount = 0;
        }
    }
}

export async function createTestPage(browser: Browser): Promise<Page> {
    const context = await browser.newContext();
    contexts.push(context);
    return await context.newPage();
}

export async function cleanupTestContext(page: Page): Promise<void> {
    try {
        console.log('Cleaning up test context...');
        await page.close();
        const context = page.context();
        await context.close();
        // Remove from tracked contexts
        const index = contexts.indexOf(context);
        if (index > -1) {
            contexts.splice(index, 1);
            console.log('Context removed from tracking');
        }
        console.log('Test context cleaned up');
    } catch (error) {
        console.error('Error cleaning up test context:', error);
    }
}

export function setupAgent(page: Page): any {
    const agent = new BrowserAgent();
    // @ts-ignore - accessing for testing
    agent.currentPage = async () => page;
    // @ts-ignore - mock callInnerTool
    agent.callInnerTool = async (callback: Function) => callback();
    // @ts-ignore - set scale factor
    agent.lastScaleFactor = 1;
    return agent;
}
