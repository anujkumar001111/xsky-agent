import BrowserAgent from '../src/browser';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

describe('BrowserAgent.close() method', () => {
  let agent: BrowserAgent;
  const testSessionDir = path.join(__dirname, 'test-session-close');

  beforeEach(() => {
    agent = new BrowserAgent();
  });

  afterEach(async () => {
    // Cleanup test directory
    if (fs.existsSync(testSessionDir)) {
      fs.rmSync(testSessionDir, { recursive: true, force: true });
    }
  });

  describe('Basic close functionality', () => {
    test('close() method exists and is callable', () => {
      expect(typeof agent.close).toBe('function');
    });

    test('close() can be called on uninitialized agent without error', async () => {
      await expect(agent.close()).resolves.toBeUndefined();
    });

    test('close() is idempotent - can be called multiple times', async () => {
      await agent.close();
      await agent.close(); // Should not throw
      await expect(agent.close()).resolves.toBeUndefined();
    });
  });

  describe('Close with initialized browser', () => {
    let browser: any;
    let context: any;
    let page: any;

    beforeEach(async () => {
      // Set up a real browser context for testing
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext();
      page = await context.newPage();

      // Manually set up the agent with the browser resources
      // @ts-ignore - accessing private properties for testing
      agent.browser = browser;
      // @ts-ignore
      agent.browser_context = context;
      // @ts-ignore
      agent.current_page = page;
    });

    afterEach(async () => {
      // Clean up any remaining resources
      try {
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
      } catch (error) {
        // Ignore cleanup errors in afterEach
      }
    });

    test('close() properly closes browser context and resets state', async () => {
      // Verify initial state
      // @ts-ignore
      expect(agent.browser_context).toBeTruthy();
      // @ts-ignore
      expect(agent.current_page).toBeTruthy();

      // Close agent
      await agent.close();

      // Verify cleanup
      // @ts-ignore
      expect(agent.browser_context).toBeNull();
      // @ts-ignore
      expect(agent.current_page).toBeNull();
      // @ts-ignore
      expect(agent.browser).toBeNull();
    });

    test('close() handles multiple pages correctly', async () => {
      // Create additional page
      const newPage = await context.newPage();
      await newPage.goto('about:blank');

      // Verify we have multiple pages
      const pages = context.pages();
      expect(pages.length).toBeGreaterThan(1);

      // Close agent
      await agent.close();

      // Verify context is closed by trying to create a new page (should throw)
      await expect(context.newPage()).rejects.toThrow();
    });

    test('close() handles page close errors gracefully', async () => {
      // Create additional page and mock its close method
      const newPage = await context.newPage();
      const originalClose = newPage.close;
      newPage.close = jest.fn().mockRejectedValue(new Error('Page close error'));

      // Spy on console.warn
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Close agent (should log warning but continue)
      await agent.close();

      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to close page: Page close error')
      );

      // Restore spies
      consoleWarnSpy.mockRestore();
      newPage.close = originalClose;
    });
  });

  describe('Error handling', () => {
    test('close() handles browser context close errors and still cleans up state', async () => {
      // Set up mock browser context
      const mockContext = {
        pages: jest.fn().mockReturnValue([]),
        close: jest.fn().mockRejectedValue(new Error('Context close error'))
      };

      // @ts-ignore
      agent.browser_context = mockContext;

      // Attempt to close (should throw but still cleanup state)
      await expect(agent.close()).rejects.toThrow('Context close error');

      // Verify state is still cleaned up despite error
      // @ts-ignore
      expect(agent.browser_context).toBeNull();
      // @ts-ignore
      expect(agent.current_page).toBeNull();
    });
  });

  describe('CDP connection handling', () => {
    test('close() does not close browser when using CDP connection', async () => {
      // Create agent with CDP endpoint
      // @ts-ignore
      agent.cdpWsEndpoint = 'ws://localhost:9222/devtools/browser';
      // @ts-ignore
      agent.browser = { mock: 'browser' };

      // Close agent
      await agent.close();

      // Verify browser was NOT closed (still exists)
      // @ts-ignore
      expect(agent.browser).toEqual({ mock: 'browser' });
    });
  });
});