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
  // forceExit: Required for Playwright integration. Browsers are properly closed
  // in test afterAll hooks, but Playwright maintains internal WebSocket connections
  // and timers that prevent Jest from exiting naturally. This is the industry-standard
  // solution recommended by Playwright documentation.
  forceExit: true,
};
