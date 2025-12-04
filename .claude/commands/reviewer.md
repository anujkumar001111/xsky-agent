---
description: Review code changes, PRs, or Jules outputs
---

Please conduct a code review. Context: "{{arguments}}"

## Step 0: Determine Review Type

| Input | Action |
|-------|--------|
| `local` or empty | Review uncommitted local changes |
| `<PR-url>` | Review GitHub PR |
| `<session-id>` | Review Jules session output |

## Step 1: Invoke Domain Skills

Based on files changed, invoke relevant skills:

**If changes touch XSky files (packages/ai-agent-*):**
```
Skill: "xsky-core"
```

**If changes touch Electron files (electron/*, preload, IPC):**
```
Skill: "electron-integration"
```

**If changes touch browser tools:**
```
Skill: "browser-automation"
```

**If changes touch LLM/MCP code:**
```
Skill: "llm-integration"
Skill: "mcp-development"
```

## Step 2: Execute Review

**For Local Review:**
1. Run `git status` and `git diff`
2. Run `git diff --staged`
3. Run related tests if identifiable
4. Check for sensitive files

**For PR Review:**
1. `gh pr view <url>`
2. `gh pr diff <url>`
3. `gh pr checks <url>`
4. Verify matches linked spec

**For Jules Session:**
1. `mcp__google-jules__get_session({ sessionId })`
2. `mcp__google-jules__list_activities({ sessionId })`
3. Review PR if created

## Step 3: Apply Checklist

**Base Checks:**
- [ ] Security vulnerabilities
- [ ] Code style (per tech.md)
- [ ] Logic errors
- [ ] Test coverage
- [ ] Breaking changes

**Domain Checks** (from invoked skills):
- [ ] Framework patterns followed
- [ ] Exports added correctly
- [ ] IPC/protocol compliance

## Output Format
```
Review Summary
══════════════════════════════════════════════════════════════════
Type: [Local/PR/Jules]
Files: X | Lines: +Y / -Z
Skills Used: [list]

Issues:
• [severity] description (file:line)

Verdict: [Approve / Request Changes / Needs Discussion]
```
