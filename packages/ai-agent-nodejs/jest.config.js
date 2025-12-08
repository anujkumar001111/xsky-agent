export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/test"],
  setupFiles: ['dotenv/config', '<rootDir>/test/jest.polyfills.ts'],
  globalTeardown: '<rootDir>/test/jest.teardown.ts',
  testMatch: ["**/*.test.ts"],
  testTimeout: 60000,
  // Disable cache to prevent flaky test issues
  cache: false,
  // Run tests sequentially (one at a time) to avoid launching multiple browser instances
  maxWorkers: 1,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }],
  },
  // Note: forceExit is NOT needed. Tests exit cleanly due to proper resource cleanup:
  // - Shared browser pattern (shared-browser.ts) ensures single browser instance
  // - afterAll hooks in all test files call releaseSharedBrowser() and cleanupTestContext()
  // - These functions explicitly close all contexts before browser.close()
  // - This follows Playwright best practice: close contexts first, then browser
  // Per Playwright docs: "Explicitly close contexts with context.close() before browser.close()"
};
