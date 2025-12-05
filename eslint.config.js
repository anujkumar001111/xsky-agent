// ESLint configuration for the XSky AI Agent framework
// Provides consistent code quality and style enforcement across the monorepo
import js from '@eslint/js';

export default [
  // Base JavaScript recommended configuration
  js.configs.recommended,
  
  // Global ignore patterns for build artifacts and dependencies
  {
    ignores: [
      "**/dist/**",      // Build output directories
      "**/build/**",     // Build output directories
      "**/node_modules/**", // Dependency directories
      "**/coverage/**"   // Test coverage reports
    ]
  },
  
  // Main configuration for ES modules (most of the codebase)
  {
    languageOptions: {
      ecmaVersion: 2022,           // Use modern JavaScript features
      sourceType: 'module',           // ES module import/export syntax
      globals: {
        // Node.js and browser globals that should be available
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        window: 'readonly',
        document: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn',    // Warn about unused variables but don't fail
      'no-console': 'off',        // Allow console.log for debugging and examples
      'no-undef': 'error'         // Error on undefined variables
    }
  },
  
  // Special configuration for CommonJS files (webpack config in extension example)
  {
    files: ["example/extension/webpack.config.js"],
    languageOptions: {
      ecmaVersion: 2022,           // Modern JavaScript features
      sourceType: 'script',          // CommonJS environment
      globals: {
        // CommonJS-specific globals
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly'
      }
    }
  }
];