---
description: Start a new feature specification workflow (Requirements -> Design -> Tasks)
---

I want to start a new spec workflow for feature: "{{arguments}}"

## Step 0: Load Context (REQUIRED)

Before starting, invoke relevant skills based on feature description:

**If feature involves XSky framework:**
```
Skill: "xsky-core"
```

**If feature involves browser automation:**
```
Skill: "browser-automation"
```

**If feature involves Electron:**
```
Skill: "electron-integration"
```

**If feature involves LLM/AI:**
```
Skill: "llm-integration"
```

**If feature involves MCP:**
```
Skill: "mcp-development"
```

Also read steering documents:
- `.claude/steering/product.md` (business context)
- `.claude/steering/tech.md` (conventions)
- `.claude/steering/structure.md` (architecture)

## Step 1: Load Workflow Instructions

1. Try calling `spec-system-prompt-loader` agent via Task tool (subagent_type="spec-system-prompt-loader")

2. If unavailable, read `.claude/system-prompts/spec-workflow-starter.md` directly

## Step 2: Execute Workflow

Follow loaded instructions for: Requirements → Design → Tasks

**Each phase requires explicit user approval before proceeding.**

## Skill Context Usage

| Phase | How Skills Help |
|-------|-----------------|
| Requirements | Domain skills provide existing patterns to reference |
| Design | Architecture skills inform component design |
| Tasks | Tech stack skills ensure correct build/test ordering |
