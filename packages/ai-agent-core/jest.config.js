import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Ensure root .env is loaded for tests when present
process.env.DOTENV_CONFIG_PATH = process.env.DOTENV_CONFIG_PATH || path.resolve(__dirname, '../../.env');

export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/test"],
  setupFiles: ['dotenv/config', '<rootDir>/test/jest.polyfills.ts'],
  testMatch: ["**/*.test.ts"],
  testTimeout: 60000,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: 'tsconfig.test.json'
    }]
  }
};
