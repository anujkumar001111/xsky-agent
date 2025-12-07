import BrowserAgent from "../src/browser";
import * as fs from "fs";
import * as path from "path";
import { chromium } from "playwright-core";

describe("BrowserAgent - Session Management", () => {
    let agent: BrowserAgent;
    const testSessionDir = path.join(__dirname, ".test-sessions");

    beforeAll(() => {
        // Create test sessions directory
        if (!fs.existsSync(testSessionDir)) {
            fs.mkdirSync(testSessionDir, { recursive: true });
        }
    });

    beforeEach(() => {
        agent = new BrowserAgent();
    });

    afterEach(async () => {
        // Cleanup
        try {
            await agent.close();
        } catch (error) {
            // Log cleanup errors instead of silently ignoring
            console.error('Failed to close agent in afterEach:', error);
        }
    });

    afterAll(async () => {
        // Clean up test directory
        if (fs.existsSync(testSessionDir)) {
            fs.rmSync(testSessionDir, { recursive: true, force: true });
        }
        // Wait for agent cleanup to fully complete
        await new Promise(resolve => setTimeout(resolve, 500));
    }, 10000);

    describe("load_session", () => {
        it("should return error when session file does not exist", async () => {
            const nonExistentFile = path.join(testSessionDir, "non-existent.json");

            // @ts-ignore - accessing protected method for testing
            const result = await agent.load_session(nonExistentFile);

            expect(result.success).toBe(false);
            expect(result.message).toContain("Session file not found");
        });

        it("should return error when session file is malformed", async () => {
            const malformedFile = path.join(testSessionDir, "malformed.json");

            // Create a malformed session file (invalid JSON)
            fs.writeFileSync(malformedFile, "{ invalid json }", "utf-8");

            // @ts-ignore - accessing protected method for testing
            const result = await agent.load_session(malformedFile);

            expect(result.success).toBe(false);
            expect(result.message).toContain("Failed to create context with session");

            // Cleanup
            fs.unlinkSync(malformedFile);
        });

        it("should return error when trying to load session with persistent context", async () => {
            const validSessionFile = path.join(testSessionDir, "valid.json");

            // Create a valid session file
            const validSession = {
                cookies: [],
                origins: []
            };
            fs.writeFileSync(validSessionFile, JSON.stringify(validSession), "utf-8");

            // Set userDataDir to simulate persistent context
            // @ts-ignore - accessing private property for testing
            agent.userDataDir = "/some/path";

            // @ts-ignore - accessing protected method for testing
            const result = await agent.load_session(validSessionFile);

            expect(result.success).toBe(false);
            expect(result.message).toContain("Cannot load session when using persistent context");

            // Cleanup
            fs.unlinkSync(validSessionFile);
        });

        it("should successfully load valid session file", async () => {
            const validSessionFile = path.join(testSessionDir, "valid-load.json");

            // Create a valid session file
            const validSession = {
                cookies: [],
                origins: [
                    {
                        origin: "https://example.com",
                        localStorage: []
                    }
                ]
            };
            fs.writeFileSync(validSessionFile, JSON.stringify(validSession), "utf-8");

            // @ts-ignore - accessing protected method for testing
            const result = await agent.load_session(validSessionFile);

            expect(result.success).toBe(true);
            expect(result.message).toBe("Session loaded successfully");
            expect(result.path).toBe(validSessionFile);

            // Cleanup
            fs.unlinkSync(validSessionFile);
        });
    });

    describe("save_session", () => {
        it("should create directory and save session", async () => {
            const sessionFile = path.join(testSessionDir, "subdir", "saved.json");

            // Initialize browser context
            // @ts-ignore - accessing protected method
            await agent.getBrowserContext();

            // @ts-ignore - accessing protected method for testing
            const result = await agent.save_session(sessionFile);

            expect(result.success).toBe(true);
            expect(fs.existsSync(sessionFile)).toBe(true);

            // Verify it's valid JSON
            const content = fs.readFileSync(sessionFile, "utf-8");
            expect(() => JSON.parse(content)).not.toThrow();

            // Cleanup
            fs.rmSync(path.join(testSessionDir, "subdir"), { recursive: true, force: true });
        });
    });
});
