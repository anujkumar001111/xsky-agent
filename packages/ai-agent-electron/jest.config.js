// Jest configuration for ai-agent-electron package

export default {
  preset: 'ts-jest',
  testEnvironment: 'node', // Use node environment for electron tests (mocking electron)
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@xsky/ai-agent-core$': '<rootDir>/../ai-agent-core/src/index.ts',
    '^@xsky/ai-agent-core/(.*)$': '<rootDir>/../ai-agent-core/src/$1'
  },
  setupFiles: ['<rootDir>/test/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  }
};