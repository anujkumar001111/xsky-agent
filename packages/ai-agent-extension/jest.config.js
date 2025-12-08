// Jest configuration for ai-agent-extension package

export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
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
      tsconfig: 'tsconfig.test.json',
      diagnostics: false,
      isolatedModules: true
    }]
  }
};