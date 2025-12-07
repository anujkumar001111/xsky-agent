import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from "@jest/globals";
import { config } from "@xsky/ai-agent-core";
import { BrowserAgent } from "../src/browser";
import { getSharedBrowser, releaseSharedBrowser, createTestPage, setupAgent, cleanupTestContext } from "./shared-browser";

/**
 * Tests for BrowserAgent element methods.
 * 
 * These tests specifically validate browser element interaction methods,
 * including critical fixes for async operations.
 */
describe("BrowserAgent Element Methods", () => {
    /**
     * Unit Tests for hover_to_element
     * 
     * These tests verify that the hover_to_element method properly awaits
     * the hover operation before returning. This is a regression test for
     * a bug where the await keyword was missing.
     */
    describe("hover_to_element - await fix regression test", () => {
        let agent: any;
        let mockPage: any;
        let mockElementHandle: any;
        let hoverPromiseResolved: boolean;

        beforeEach(() => {
            hoverPromiseResolved = false;

            // Create a mock hover function that tracks when it resolves
            const hoverMock = jest.fn().mockImplementation(() => {
                return new Promise<void>((resolve) => {
                    // Simulate a small delay to make the async behavior observable
                    setTimeout(() => {
                        hoverPromiseResolved = true;
                        resolve();
                    }, 10);
                });
            });

            mockElementHandle = {
                hover: hoverMock,
            };

            mockPage = {
                evaluateHandle: jest.fn().mockResolvedValue(mockElementHandle),
                url: () => "about:blank",
                title: async () => "Test",
                waitForLoadState: jest.fn().mockResolvedValue(undefined),
            };

            agent = new BrowserAgent();
            // Override protected methods for testing
            (agent as any).current_page = mockPage;
            (agent as any).browser_context = { pages: () => [] };
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it("REGRESSION: should await the hover operation before returning", async () => {
            // This test specifically validates the fix for missing await on hover()
            // Before the fix: hoverPromiseResolved would be false when hover_to_element returns
            // After the fix: hoverPromiseResolved should be true when hover_to_element returns

            await (agent as any).hover_to_element({} as any, 0);

            // If await is properly used, the promise should have resolved before we get here
            expect(hoverPromiseResolved).toBe(true);
            expect(mockElementHandle.hover).toHaveBeenCalledWith({ force: true });
        });

        it("REGRESSION: should make subsequent operations wait for hover to complete", async () => {
            const operationOrder: string[] = [];

            // Override hover to track operation order
            mockElementHandle.hover = jest.fn().mockImplementation(() => {
                return new Promise<void>((resolve) => {
                    setTimeout(() => {
                        operationOrder.push("hover_completed");
                        resolve();
                    }, 10);
                });
            });

            // Start hover operation and add a marker after it completes
            await (agent as any).hover_to_element({} as any, 0);
            operationOrder.push("after_hover_call");

            // If await is properly used, "hover_completed" should come before "after_hover_call"
            expect(operationOrder).toEqual(["hover_completed", "after_hover_call"]);
        });

        it("should fallback to super.hover_to_element on error", async () => {
            // Make get_element throw an error
            (agent as any).get_element = jest.fn().mockRejectedValue(new Error("Element not found"));

            // Mock the parent class method
            const superHoverMock = jest.fn().mockResolvedValue(undefined);
            // We need to set it on the prototype chain where BaseBrowserLabelsAgent would be
            // BrowserAgent -> BaseBrowserLabelsAgent -> BaseBrowserAgent
            const prototype = Object.getPrototypeOf(agent); // BrowserAgent.prototype
            const parentPrototype = Object.getPrototypeOf(prototype); // BaseBrowserLabelsAgent.prototype

            // Save original method
            const originalMethod = parentPrototype.hover_to_element;
            parentPrototype.hover_to_element = superHoverMock;

            try {
                // Should not throw, should call super
                await (agent as any).hover_to_element({} as any, 0);
                expect(superHoverMock).toHaveBeenCalledWith(expect.anything(), 0);
            } finally {
                // Restore original method
                if (parentPrototype) {
                    parentPrototype.hover_to_element = originalMethod;
                }
            }
        });
    });

    /**
     * Integration Tests with Real Browser
     */
    describe("INTEGRATION: Element Hover with Real Browser", () => {
        let agent: any;
        let page: any;

        beforeAll(async () => {
            const browser = await getSharedBrowser();
            page = await createTestPage(browser);
            agent = setupAgent(page);
        }, 30000);

        afterAll(async () => {
            if (page) {
                await cleanupTestContext(page);
            }
            await releaseSharedBrowser();
        }, 10000);

        beforeEach(async () => {
            // Reset page content and inject helper
            await page.setContent(`
        <html>
          <head>
            <style>
              #hover-target {
                width: 100px;
                height: 50px;
                background: blue;
              }
              #hover-target:hover {
                background: red;
              }
            </style>
          </head>
          <body style="margin: 0; padding: 0;">
            <div id="hover-target" style="position: absolute; left: 100px; top: 100px;">
              Hover Me
            </div>
          </body>
        </html>
      `);

            // Inject the global function that BrowserAgent.get_element expects
            await page.evaluate(() => {
                (window as any).get_highlight_element = (index: number) => {
                    // For testing purposes, we simply return the target element regardless of index
                    // In a real scenario, this would look up from a cache of labeled elements
                    return document.getElementById("hover-target");
                };
            });
        });

        it("INTEGRATION: should trigger mouseenter event on hover", async () => {
            await page.evaluate(() => {
                const target = document.getElementById("hover-target");
                target?.addEventListener("mouseenter", () => {
                    (window as any).hoverEntered = true;
                });
            });

            // Move mouse away first (0,0)
            await page.mouse.move(0, 0);

            // Use the actual element-based method we fixed
            // Passing dummy context and index 0 (which our mock resolves to the target)
            await (agent as any).hover_to_element({} as any, 0);

            const hovered = await page.evaluate(() => (window as any).hoverEntered);
            expect(hovered).toBe(true);
        });

        it("INTEGRATION: should complete hover before subsequent operations", async () => {
            // This test verifies the async behavior is correct in a real environment
            const events: string[] = [];

            await page.evaluate(() => {
                (window as any).events = [];
                const target = document.getElementById("hover-target");
                target?.addEventListener("mouseenter", () => {
                    (window as any).events.push("mouseenter");
                });
            });

            // Move mouse away first
            await page.mouse.move(0, 0);

            // Perform hover using the element method
            await (agent as any).hover_to_element({} as any, 0);

            // Add a marker event after hover returns
            await page.evaluate(() => {
                (window as any).events.push("after_hover");
            });

            const recordedEvents = await page.evaluate(() => (window as any).events);

            // The 'mouseenter' event (triggered by hover) must happen BEFORE 'after_hover'
            expect(recordedEvents).toEqual(["mouseenter", "after_hover"]);
        });
    });
});
