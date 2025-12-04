export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/test"],
  setupFiles: ['dotenv/config', '<rootDir>/test/jest.polyfills.ts'],
  testMatch: ["**/*.test.ts"],
  testTimeout: 60000,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@xsky/ai-agent-core/(.*)$": "<rootDir>/../ai-agent-core/src/$1",
    "^@xsky/ai-agent-core$": "<rootDir>/../ai-agent-core/src/index.ts"
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json'
    }
  }
};
