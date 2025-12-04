# Feature: {feature-name}

## Overview

This directory contains the specification for the **{feature-name}** feature.

## Spec Files

| File | Description | Created By |
|------|-------------|------------|
| `requirements.md` | EARS format requirements | spec-requirements agent |
| `design.md` | Technical design | spec-design agent |
| `tasks.md` | Implementation tasks with dependencies | spec-tasks agent |
| `feature_status.md` | Progress tracking | Manual/Jules |

## Status

| Phase | Status | Approved |
|-------|--------|----------|
| Requirements | pending | [ ] |
| Design | pending | [ ] |
| Tasks | pending | [ ] |
| Implementation | pending | [ ] |

## Workflow

```
/spec {feature-name}
       │
       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Requirements   │───►│     Design      │───►│     Tasks       │
│  (approval)     │    │  (approval)     │    │  (approval)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                      │
                                                      ▼
                              ┌─────────────────────────────────┐
                              │  Implementation                  │
                              │  - /jules or spec-impl          │
                              │  - Track in feature_status.md   │
                              └─────────────────────────────────┘
```

## Jules Session

- **Session ID**: _(filled after handoff)_
- **PR URL**: _(filled after completion)_

## Notes

_Add implementation notes, decisions, or blockers here._
