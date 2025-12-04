---
description: Start or manage an async task with Google Jules
---

# Jules Session Manager

## Command: /jules {{arguments}}

### Step 1: Parse Arguments

| Input | Action |
|-------|--------|
| `status` | Show account usage and active sessions |
| `<feature-name>` | Start implementation for approved spec |
| `"<task description>"` | Start custom task |
| (empty) | Show status |

### Step 2: Load Session State

Read `.claude/jules-sessions.json`:
- Check if date changed from `last_reset` → reset `used_today` counter to 0
- Load active sessions list

### Step 3: Determine Repository

Run `git config --get remote.origin.url` and parse to source format:
- Input: `https://github.com/owner/repo.git` or `git@github.com:owner/repo.git`
- Output: `sources/github/owner/repo`

If unavailable, ask user for the repo in `owner/repo` format, then prefix with `sources/github/`.

### Step 4: Check Capacity

1. Check if `used_today < limit` (default limit: 100)
2. If account full → report: "Account exhausted (100/100 used today). Wait for daily reset."

### Step 5: Check for Existing Session

Before creating new session:
1. If feature name provided, check `.claude/specs/{feature}/feature_status.md` for existing `sessionId`
2. If found, use `get_session` to check status and reuse if active
3. Otherwise, search `active_sessions` in jules-sessions.json for matching task

### Step 6: Create Session

Use MCP server `google-jules` → `mcp__google-jules__create_session`

**Pre-Session Skill Enhancement**:
Before creating the session, detect feature domain and include relevant skill guidance in the prompt:

```
SKILL CONTEXT DETECTION:

1. If feature involves XSky framework:
   → Include xsky-core patterns in prompt
   → Add workflow-xml guidance if needed

2. If feature involves browser automation:
   → Include browser-automation patterns

3. If feature involves Electron:
   → Include electron-integration patterns

4. If feature involves LLM/MCP:
   → Include llm-integration or mcp-development patterns
```

**Session parameters:**
```javascript
{
  source: "sources/github/<org>/<repo>",  // From git remote
  prompt: `
CONTEXT DOCUMENTS:
- Implementation Guide: AGENTS.md
- Steering: .claude/steering/product.md, tech.md, structure.md
- Spec: .claude/specs/{feature}/requirements.md, design.md, tasks.md
- Skills: [List relevant .claude/skills/*/SKILL.md based on feature domain]

TASK: {{arguments}}

SKILL-ENHANCED GUIDANCE:
[Include domain-specific patterns from relevant skills]
- XSky: Agent registration, tool exports, workflow XML patterns
- Electron: IPC validation, preload security, context isolation
- Browser: DOM labeling, screenshot patterns, element extraction
- LLM: Provider abstraction, streaming, error recovery
- MCP: Protocol compliance, tool registration, schema validation

EXECUTION PROTOCOL:
1. Read all context documents first
2. Read relevant skill files for domain patterns
3. Follow conventions in tech.md strictly
4. Execute tasks in dependency order from tasks.md
5. Apply skill-specific patterns to implementation
6. Update .claude/specs/{feature}/feature_status.md after each milestone
7. Run tests after implementation
8. Create PR when complete

QUALITY GATES:
- Code compiles without errors
- All tests pass
- Follows project conventions
- Follows domain-specific skill patterns
- Exports added to barrel files

OUTPUT: Pull Request URL
  `,
  requirePlanApproval: true  // Set false for simple tasks
}
```

### Step 7: Update Session Tracking

After creating session, update `.claude/jules-sessions.json`:
1. Increment `used_today`
2. Update `last_reset` date if changed
3. Add to `active_sessions` array:
   ```json
   {
     "session_id": "<returned-session-id>",
     "feature": "<feature-name-or-null>",
     "task": "<task-description>",
     "status": "pending",
     "created_at": "<ISO-timestamp>",
     "pr_url": null
   }
   ```
4. If feature-based, also update `.claude/specs/{feature}/feature_status.md` with sessionId

### Step 8: Display Results

**For status command:**
```
Jules Session Status
══════════════════════════════════════════════════════════════════
Usage: 45/100 today  ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░
Remaining: 55 sessions
══════════════════════════════════════════════════════════════════

Active Sessions:
┌─────────────────┬─────────────────────┬────────────────┐
│ Session ID      │ Feature/Task        │ Status         │
├─────────────────┼─────────────────────┼────────────────┤
│ sess_abc123...  │ auth-system         │ Working        │
│ sess_def456...  │ bug-fix-navbar      │ PR #789        │
└─────────────────┴─────────────────────┴────────────────┘

Commands:
• /jules status        - This view
• /jules <feature>     - Start from approved spec
• /jules "<task>"      - Custom task
```

**For new session:**
```
✓ Created Jules session

Session ID: sess_xyz789
Feature: auth-system
Status: Pending plan approval

Usage: 46/100 today (54 remaining)

Next Steps:
1. Jules will analyze the task and create a plan
2. Approve plan with: /jules approve sess_xyz789
3. Monitor progress: /jules status
```

### Step 9: Additional Commands

**Approve plan:**
- Parse: `/jules approve <session-id>`
- Call: `mcp__google-jules__approve_plan({ sessionId })`

**Send message:**
- Parse: `/jules message <session-id> "<message>"`
- Call: `mcp__google-jules__send_message({ sessionId, prompt })`

**Check specific session:**
- Parse: `/jules check <session-id>`
- Call: `mcp__google-jules__get_session({ sessionId })`
- Show detailed status and recent activity

**List activities:**
- Parse: `/jules activities <session-id>`
- Call: `mcp__google-jules__list_activities({ sessionId })`

---

## Preconditions

- Ensure `JULES_API_KEY` is set in `.env`
- Do not modify any user-level settings files
- For feature-based tasks, verify spec files exist and are committed/pushed

---

## Error Handling

**Account exhausted:**
```
⚠️ Jules account exhausted for today

Usage: 100/100

Options:
1. Wait for daily reset (resets at midnight UTC)
2. Run task locally with /spec-impl (if lightweight)
```

**MCP server not responding:**
```
⚠️ Cannot connect to google-jules MCP server

Troubleshooting:
1. Check JULES_API_KEY is set in .env
2. Restart Claude Code to reload MCP servers
3. Verify network connectivity
```

**Spec files not found:**
```
⚠️ Spec files not found for feature: auth-system

Expected files:
- .claude/specs/auth-system/requirements.md
- .claude/specs/auth-system/design.md
- .claude/specs/auth-system/tasks.md

Create specs first with: /spec auth-system
```
