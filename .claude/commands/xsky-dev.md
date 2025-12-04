---
name: xsky-dev
description: Start XSky development workflow - analyze task and delegate to appropriate agents
allowed-tools: ["Read", "Grep", "Glob", "Task"]
---

# XSky Development Workflow

You are starting a development task for the XSky AI Agent framework.

## Step 1: Understand the Request

First, analyze what the user wants to accomplish:
- Is this a new feature? → Use xsky-architect first
- Is this a bug fix? → Use xsky-implementer directly
- Is this a code review? → Use xsky-reviewer
- Is this about browser tools? → Use browser-tools-specialist
- Is this about LLM/prompts? → Use llm-integration-specialist
- Is this about testing? → Use xsky-test-engineer
- Is this about workflows? → Use workflow-xml-specialist
- Is this about MCP? → Use mcp-integration-specialist

## Step 2: Read Relevant Context

Before delegating, read the steering documents:
1. `.claude/steering/product.md` - Product goals
2. `.claude/steering/tech.md` - Technical conventions
3. `.claude/steering/structure.md` - Project structure

## Step 3: Delegate to Appropriate Agent

Use the Task tool to invoke the right agent with a clear prompt.

For complex features, follow this sequence:
1. **xsky-architect** → Design the architecture
2. **xsky-implementer** → Write the code
3. **xsky-test-engineer** → Write tests
4. **xsky-reviewer** → Review the implementation

## Step 4: Verify and Report

After the agent completes:
1. Run `pnpm build` to verify compilation
2. Run `pnpm test` to verify tests pass
3. Summarize what was accomplished

## Available Agents

| Agent | Use For |
|-------|---------|
| xsky-architect | Architecture, design, technical decisions |
| xsky-implementer | Writing code, bug fixes, features |
| xsky-reviewer | Code review, PR review |
| browser-tools-specialist | Browser automation, DOM tools |
| llm-integration-specialist | LLM providers, prompts, streaming |
| xsky-test-engineer | Tests, coverage, debugging tests |
| workflow-xml-specialist | Workflow XML, planning, execution |
| mcp-integration-specialist | MCP clients, external tools |

Now analyze the user's request and proceed with the appropriate workflow.
