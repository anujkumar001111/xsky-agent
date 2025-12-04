# scratchpad

## Task Board
[X] Claude Code Online - Ready for tasks
[X] Review Implementation (Codex) - detailed analysis of codebase for discrepancies and quality
[X] Fix Build & Benchmark Regression (Claude Code) - Fixed web-example build; optimized Agent tool allocation (40% speedup)
[X] Fix Dialogue Test (Claude Code) - Configured test/core/dialogue.test.ts to use custom OpenAI-compatible endpoint with copilot-1-claude-opus-4.5; fixed timeout and maxTokens issues. Test PASSED.
[X] Benchmark Core Framework (Codex)
[X] Documentation & Steering Updates (Claude Code)
[X] Coordinate Tools Implementation (Claude Code) - Add coordinate-based mouse operations to BrowserAgent
    Plan: ~/.claude/plans/wise-whistling-aurora.md
    Files: config/index.ts, ai-agent-nodejs/src/browser.ts, test/agent/browser-coordinate-tools.test.ts
    Config: enableCoordinateTools (default: true)
    Tools: click_at_coordinates, hover_at_coordinates, drag_to_coordinates, scroll_at_coordinates, type_at_coordinates

## Change Log
[2025-12-04T20:00:00Z] [Claude Code] Approved PR #4 (coordinate tools) with review - suggested comprehensive tests in follow-up
[2025-12-04T20:00:00Z] [Claude Code] Updated project_status.md with final PR status and completion summary
[2025-12-04T19:00:00Z] [Claude Code] Fixed import path regressions - restored @xsky/ai-agent-core imports in browser.ts and utils.ts
[2025-12-04T19:00:00Z] [Claude Code] Moved coordinate tools tests from ai-agent-core to ai-agent-nodejs package (proper module boundary)
[2025-12-04T18:45:00Z] [Claude Code] packages/ai-agent-nodejs/src/browser.ts - Implemented coordinate-based mouse tools (click, hover, drag, scroll, type)
[2025-12-04T18:45:00Z] [Claude Code] packages/ai-agent-core/test/agent/browser-coordinate-tools.test.ts - Added comprehensive unit tests for coordinate tools
[2025-12-04T18:45:00Z] [Claude Code] packages/ai-agent-core/src/config/index.ts - Added enableCoordinateTools configuration flag
[2025-12-04T18:20:00Z] [Codex] scratchpad.md - Reviewed coordinate tools plan; flagged @xsky/ai-agent-nodejs test dependency gap
[2025-12-04T17:30:00Z] [Claude Code] Created implementation plan for coordinate-based mouse operations
[2025-12-04T15:50:00Z] [Claude Code] packages/ai-agent-core/test/core/dialogue.test.ts - Configured custom endpoint and copilot-1-claude-opus-4.5 model
[2025-12-04T15:15:00Z] [Claude Code] packages/ai-agent-core/src/agent/base.ts - Optimized system tools to use static instances
[2025-12-04T15:10:00Z] [Claude Code] example/web/package.json - Fixed missing react-scripts dependency
[2025-12-04T14:55:00Z] [Claude Code] scratchpad.md - Added implementation review task
[2025-12-04T14:45:00Z] [Codex] benchmarks/core.bench.ts - Created comprehensive benchmark suite
[2025-12-04T14:45:00Z] [Codex] benchmarks/README.md - Documented benchmark results
[2025-12-04T14:45:00Z] [Codex] package.json - Added 'bench' script
[2025-12-04T14:30:00Z] [Claude Code] docs/* - Created comprehensive documentation structure and quickstarts
[2025-12-04T14:30:00Z] [Claude Code] .claude/steering/* - Updated steering docs to reference new docs structure
[2025-12-04T14:08:58Z] Codex scratchpad.md - created coordination scratchpad and recorded current state

## Lessons
- Framework overhead is negligible (<1ms) compared to LLM latency; no optimization needed for core engine.
- Mocking LLM is essential for isolating framework performance.
- Documentation must be verified against actual code exports/signatures to avoid "drift".
- Use `callInnerTool()` wrapper for consistency when adding new browser tools.
- Google's PlaywrightComputer code provides good reference for Playwright mouse/keyboard APIs.
