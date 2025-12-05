# Requirements Document

## Introduction

This requirements document outlines the integration testing needs for keyboard mappings and coordinate tools within the XSky AI Agent framework. The tests will **extend existing test suites** to validate keyboard utilities, coordinate-based interactions with web elements, edge cases for viewport scaling, combined keyboard and coordinate workflows, error handling, and performance benchmarks.

**Existing Test Coverage:**
- `packages/ai-agent-nodejs/test/browser-coordinate-tools.test.ts` (455 lines) - Mocked unit tests for coordinate tools
- `packages/ai-agent-nodejs/test/browser-keyboard-integration.test.ts` (125 lines) - Real browser integration tests for keyboard
- `packages/ai-agent-core/test/common/coordinate-scaling.test.ts` - Coordinate scaling math tests
- `packages/ai-agent-electron/test/screenshot-scaling.test.ts` - Electron screenshot scaling tests

## Requirements

### Requirement 1: Keyboard Mapping Integration Tests

**User Story:** As a QA engineer, I want comprehensive integration tests for keyboard mappings, so that I can ensure special keys, modifiers, and key combinations work correctly across different browser environments.

**Extends:** `packages/ai-agent-nodejs/test/browser-keyboard-integration.test.ts`

#### Acceptance Criteria

1. WHEN keyboard mapping tests are executed THEN the system SHALL validate special key handling (Enter, Tab, Escape, Arrow keys) using real browser instances
2. WHEN modifier key combinations are tested THEN the system SHALL verify Ctrl+C, Ctrl+V, Shift+Click, and Alt+Tab work as expected in browser automation scenarios
3. WHEN key normalization is tested THEN the system SHALL verify case-insensitive mapping of special keys (e.g., "enter" → "Enter", "ESCAPE" → "Escape")
4. IF keyboard utilities encounter unknown multi-character keys THEN the system SHALL throw descriptive errors with guidance
5. WHILE running keyboard tests THEN the system SHALL validate event dispatch timing and sequence accuracy

**Out of Scope:** International keyboard layout testing (US/UK/German) requires OS-level layout switching not manageable in automated tests. Testing is limited to verifying international key code mappings (IntlYen, Lang1, etc.) exist in `PLAYWRIGHT_KEY_MAP`.

### Requirement 2: Coordinate Tool Integration Tests

**User Story:** As a developer, I want integration tests for coordinate tools, so that I can validate click, hover, drag, scroll, and type operations work reliably on real web pages.

**Extends:** `packages/ai-agent-nodejs/test/browser-coordinate-tools.test.ts`

#### Acceptance Criteria

1. WHEN coordinate-based click operations are tested THEN the system SHALL validate mouse positioning and click event generation on actual web elements
2. WHEN hover operations are executed THEN the system SHALL verify mouse movement coordinates and hover event triggers work correctly
3. WHEN drag operations are performed THEN the system SHALL test drag start, drag over, and drop event sequences with accurate coordinate tracking
4. WHERE scroll operations are involved THEN the system SHALL validate scroll position calculations and viewport coordinate mapping
5. IF coordinate operations exceed viewport boundaries THEN the system SHALL handle errors gracefully without crashing the automation

### Requirement 3: Viewport Scaling Tests

**User Story:** As a QA engineer, I want edge case tests for coordinate scaling, so that I can ensure the system handles different viewport sizes correctly.

**Extends:** `packages/ai-agent-core/test/common/coordinate-scaling.test.ts`

#### Acceptance Criteria

1. WHEN viewport sizes change THEN the system SHALL recalculate coordinate scaling accurately across different screen resolutions
2. WHEN screenshot scaling is applied THEN the system SHALL correctly inverse-scale coordinates from screenshot space to viewport space
3. WHERE `lastScaleFactor` is tracked THEN the system SHALL use it consistently across coordinate tool operations
4. IF scale factor is invalid (≤0 or undefined) THEN the system SHALL return original coordinates unchanged
5. WHILE testing modal and dropdown interactions THEN the system SHALL validate coordinate calculations for overlay elements

**Out of Scope:** Device pixel ratio (DPR) handling is not currently implemented in `scaleCoordinates()`. Nested iframe and shadow DOM coordinate transformations are not implemented for coordinate input tools (though DOM extraction does handle iframe offsets for highlighting).

### Requirement 4: Combined Keyboard and Coordinate Workflow Tests

**User Story:** As a developer, I want integration tests combining keyboard shortcuts with coordinate actions, so that I can validate realistic automation workflows function properly.

#### Acceptance Criteria

1. WHEN keyboard shortcuts trigger coordinate operations THEN the system SHALL sequence events in the correct temporal order
2. WHERE workflows involve copy-paste with mouse selection THEN the system SHALL coordinate between keyboard utilities and coordinate tools seamlessly
3. IF complex interactions require both input types THEN the system SHALL maintain state consistency across the workflow
4. WHILE executing workflow tests THEN the system SHALL validate timing between keyboard and mouse events
5. WHEN workflows span multiple browser tabs THEN the system SHALL handle focus switching correctly

### Requirement 5: Validation and Error Handling Tests

**User Story:** As a QA engineer, I want validation for coordinate boundaries and error handling, so that I can ensure the system fails gracefully when invalid coordinates are provided.

#### Acceptance Criteria

1. WHEN modifier-only key combinations are provided THEN the system SHALL throw error "requires at least one action key"
2. IF unknown multi-character keys are passed THEN the system SHALL throw descriptive "Unknown key" errors
3. WHERE coordinate transformations fail THEN the system SHALL provide detailed logging for troubleshooting
4. WHEN keyboard input validation fails THEN the system SHALL return clear error messages about invalid key combinations
5. WHILE error conditions occur THEN the system SHALL maintain test isolation without affecting other test cases

### Requirement 6: Performance Baseline Tests

**User Story:** As a performance engineer, I want benchmark tests for coordinate scaling and keyboard event latency, so that I can establish baselines and detect regressions.

#### Acceptance Criteria

1. WHEN coordinate scaling operations are benchmarked THEN the system SHALL measure and log latency using `performance.now()`
2. WHEN keyboard event dispatch latency is tested THEN the system SHALL measure response times for key combinations
3. WHERE performance tests run THEN the system SHALL establish baseline metrics in test output for future comparison
4. IF performance degrades significantly THEN the system SHALL log warnings (threshold TBD after baseline established)
5. WHILE benchmarking continues THEN the system SHALL optionally collect memory usage via `process.memoryUsage()`

**Note:** Specific thresholds (e.g., <100ms latency) will be set after running baseline tests to establish realistic expectations.

### Requirement 7: Electron Screenshot Scaling Tests

**User Story:** As a developer, I want tests for Electron screenshot scaling, so that I can validate coordinate mapping works correctly in the Electron environment.

**Extends:** `packages/ai-agent-electron/test/screenshot-scaling.test.ts`

#### Acceptance Criteria

1. WHEN Electron runtime captures screenshots THEN the system SHALL correctly calculate and store `lastScaleFactor`
2. WHERE screenshot scaling is enabled THEN the system SHALL resize images to fit within `maxWidth`/`maxHeight` while preserving aspect ratio
3. IF screenshot fits within bounds THEN the system SHALL set `lastScaleFactor` to 1 (no scaling)
4. WHILE testing various resolutions THEN the system SHALL validate scale factor calculations for common sizes (1080p, 4K, portrait)
5. WHEN window decorations affect bounds THEN the system SHALL account for `getBounds()` dimensions correctly

**Out of Scope:** Electron coordinate tools and keyboard tools are not implemented in `packages/ai-agent-electron/src/browser.ts`. Testing those requires feature implementation first.

### Requirement 8: Test Fixtures for UI Patterns

**User Story:** As a QA engineer, I want test fixtures for common UI patterns, so that I can ensure automation works reliably across different web application designs.

#### Acceptance Criteria

1. WHEN testing modal dialogs THEN the system SHALL validate coordinate calculations for overlay positioning
2. WHEN testing dropdown menus THEN the system SHALL handle dynamic element appearance and coordinate updates
3. WHERE form inputs exist THEN the system SHALL validate click-to-focus and type operations
4. IF buttons with various states exist THEN the system SHALL validate click operations trigger expected handlers
5. WHILE testing responsive designs THEN the system SHALL adapt coordinate calculations to layout changes

**Note:** Shadow DOM and nested iframe coordinate transformations are not implemented for input tools. Fixtures can test DOM extraction (which handles these) but not coordinate-based clicking within shadow/iframe boundaries.
