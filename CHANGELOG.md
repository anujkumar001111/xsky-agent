# Changelog

## [0.2.0] - 2025-12-08

### ✨ Added
- **Security Validators**: Exported `validateUrl()`, `validateFilePath()`, and `sanitizeSessionData()` for public use
- **Circuit Breaker**: LLM provider health tracking with automatic failover
- **Production Telemetry**: Configurable metrics collection and monitoring hooks

### 🔧 Changed
- **Code Quality**: Migrated 16 instances of loose equality (`==`) to strict equality (`===`) in LLM module
- **Refactoring**: Replaced `getMimeType()` if/else chain with declarative map-based lookup
- **Refactoring**: Simplified `getTool()` from 5-line loop to single-line `Array.find()`
- **Documentation**: Added comprehensive Unicode range documentation for CJK character detection

### 🐛 Fixed
- **Jest Configuration**: Removed unused imports from 3 jest.config.js files (0 ESLint warnings)
- **Type Safety**: All string comparisons now use strict equality for improved type safety

### ✅ Validation
- **Tests**: 832 tests passing across all packages (ai-agent-core: 679, ai-agent-nodejs: 105, ai-agent-electron: 40, ai-agent-web: 4, ai-agent-extension: 4)
- **Build**: All 9 build targets successful
- **Lint**: 0 errors, 0 warnings
- **Security**: 3 validators actively protecting against path traversal, null bytes, and dangerous URL schemes

---

## [0.1.6] - 2025-12-07

### 🔒 Critical Production Fixes (P0)

#### Memory Management
- **Fixed**: Task map memory leak - tasks are now automatically cleaned up after completion (default 5-minute TTL)
- **Fixed**: DOM intelligence cache now expires after 30 seconds to prevent unbounded memory growth
- **Added**: `cleanupTask()` method in `XSky` class for automatic task cleanup
- **Added**: `clear()` and `getCachedIntelligence()` methods in `DomIntelligenceAgent` for cache management

#### Security Enhancements
- **Integrated**: `validateUrl()` into `BrowserAgent.navigate_to` to prevent navigation to dangerous URLs
- **Integrated**: `validateFilePath()` into all `FileAgent` operations (read, write, list, find, replace)
- **Enhanced**: Security validators now actively protect against path traversal, null bytes, and malicious schemes

#### LLM Resilience
- **Added**: `CircuitBreaker` class to prevent cascading failures when LLM providers are down
- **Integrated**: Circuit breaker into `RetryLanguageModel` with configurable failure threshold (default: 3) and cooldown (default: 60s)
- **Improved**: LLM error handling now tracks provider health and skips unavailable providers

#### Observability
- **Added**: `TelemetryConfig` interface for basic telemetry and observability
- **Integrated**: Metric tracking in `XSky.execute()` for task duration and success/failure rates
- **Added**: Telemetry callbacks for custom metric collection and monitoring

### 🎯 Important Improvements (P1)

#### Developer Experience
- **Fixed**: Example code now uses `Log` utility instead of `console.log` for consistency
- **Added**: Runtime warning when agent approaches `maxReactNum` limit (at 80%)
- **Improved**: Error message when `maxReactNum` limit is hit now includes configuration guidance
- **Fixed**: Platform auto-detection replaces hardcoded "mac" default (supports macOS, Windows, Linux)

### 🏗️ Architecture Improvements (P2)

#### Circular Dependency Resolution
- **Fixed**: Eliminated circular dependencies between `agent/llm.ts`, `memory/index.ts`, and `llm/index.ts`
- **Added**: `llm/provider-options.ts` - Extracted shared provider options to break import cycle
- **Improved**: Cleaner module initialization order, better testability with experimental VM modules

### 📝 Technical Details

**Files Modified:**
- `packages/ai-agent-core/src/core/xsky.ts` - Task cleanup and telemetry
- `packages/ai-agent-core/src/agent/browser/dom_intelligence.ts` - Cache management
- `packages/ai-agent-core/src/agent/browser/browser_labels.ts` - URL validation
- `packages/ai-agent-nodejs/src/file.ts` - File path validation
- `packages/ai-agent-core/src/llm/circuit-breaker.ts` - New circuit breaker implementation
- `packages/ai-agent-core/src/llm/index.ts` - Circuit breaker integration
- `packages/ai-agent-core/src/llm/provider-options.ts` - New shared provider options (breaks circular deps)
- `packages/ai-agent-core/src/agent/llm.ts` - Lazy import pattern for memory module
- `packages/ai-agent-core/src/types/core.types.ts` - Telemetry configuration
- `packages/ai-agent-core/src/config/index.ts` - Platform auto-detection
- `packages/ai-agent-core/src/agent/base.ts` - Loop limit warnings
- `example/nodejs/src/index.ts` - Logging improvements

**Breaking Changes:** None

**Migration Guide:** No migration required. All changes are backward compatible.

## [0.1.5] - 2025-12-07

### 🔒 Security & Safety

-**[BREAKING]** `maxReactNum` default **reduced from 500 to 50** to prevent runaway loops and excessive LLM costs
  - Users can override: `new XSky({ config: { maxReactNum: 500 } })`
- **Added** Security validation utilities (`validateUrl`, `validateFilePath`, `sanitizeSessionData`)
  - Blocks dangerous URL schemes: `file://`, `javascript:`, `data:`, `vbscript:`
  - Prevents path traversal attacks
  - Prevents prototype pollution in session data
- **Exported** security validators from `@xsky/ai-agent-core` for user integration

### 🐛 Bug Fixes & Quality

- **Fixed** Inconsistent logging by replacing all `console.log/warn/error` with `Log.*` utility
  - Updated files: `core/context.ts`, `common/tree.ts`, `tools/human_interact.ts`, `tools/watch_trigger.ts`, `agent/browser/browser_labels.ts`, `agent/browser/dom_intelligence.ts`
  - Enables centralized log control and filtering in production
  
### 📝 Files Changed

#### Modified
- `packages/ai-agent-core/src/config/index.ts` - Reduced maxReactNum default
- `packages/ai-agent-core/src/core/context.ts` - Fixed logging
- `packages/ai-agent-core/src/common/tree.ts` - Fixed logging
- `packages/ai-agent-core/src/tools/human_interact.ts` - Fixed logging
- `packages/ai-agent-core/src/tools/watch_trigger.ts` - Fixed logging
- `packages/ai-agent-core/src/agent/browser/browser_labels.ts` - Fixed logging
- `packages/ai-agent-core/src/agent/browser/dom_intelligence.ts` - Fixed logging
- `packages/ai-agent-core/src/index.ts` - Exported security validators

#### Added
- `packages/ai-agent-core/src/common/security-validators.ts` - New security validation module

### ⚠️ Breaking Changes

**`maxReactNum` Default Change**
```typescript
// Before (v0.1.4)
maxReactNum: 500  // Could loop 500 times - dangerous!

// After (v0.1.5)
maxReactNum: 50   // More reasonable default

// Override if needed:
const xsky = new XSky({
  llms: { /* ... */ },
  config: { maxReactNum: 200 }  // Custom value
});
```

### 🔄 Migration Guide

**For users upgrading from v0.1.4:**

1. **Check loop counts**: If your workflows legitimately need >50 reactions, explicitly set `maxReactNum`
2. **No action needed** for most users - this is a safety improvement

### 📊 Statistics

- **7 files** updated for logging consistency
- **1 new** security validation module
- **1 breaking** configuration change
- **3 security** validation functions added

### 🎯 Next Release (v0.1.6 - Planned)

Priority items for next release:
- URL validation in `browser.ts` navigate_to method
- Session file validation in `load_session`
- Task cleanup with TTL to fix memory leaks
- Circuit breaker pattern for LLM calls
- Production deployment documentation
