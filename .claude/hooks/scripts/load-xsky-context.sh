#!/bin/bash
# XSky Context Loader
# Loads project context at session start

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Check if we're in XSky project
if [ ! -f "$PROJECT_DIR/packages/ai-agent-core/package.json" ]; then
  echo "Not in XSky project directory"
  exit 0
fi

# Output context for Claude
cat << EOF
## XSky AI Agent Framework

You are working on the XSky AI Agent framework - a multi-platform JavaScript/TypeScript framework for AI-powered automation.

### Package Structure
- **ai-agent-core**: Core framework (Eko, Planner, Chain, Memory, Agents)
- **ai-agent-electron**: Electron desktop adapter
- **ai-agent-nodejs**: Node.js + Playwright adapter
- **ai-agent-web**: Browser adapter
- **ai-agent-extension**: Chrome extension adapter

### Key Commands
\`\`\`bash
pnpm install    # Install dependencies
pnpm build      # Build all packages
pnpm test       # Run all tests
pnpm --filter @xsky/ai-agent-core build  # Build specific package
\`\`\`

### Development Conventions
- Use TypeScript strict mode
- No \`any\` types without justification
- Use Log class instead of console.log
- Named exports (no default exports)
- JSDoc comments on public APIs
- Tests in \`test/\` directory

### Available Agents
Use /xsky-dev to start development workflow with specialized agents:
- xsky-architect: Architecture and design
- xsky-implementer: Code implementation
- xsky-reviewer: Code review
- browser-tools-specialist: Browser automation
- llm-integration-specialist: LLM providers
- xsky-test-engineer: Testing

EOF

# Persist environment if CLAUDE_ENV_FILE is set
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export XSKY_PROJECT=true" >> "$CLAUDE_ENV_FILE"
fi
