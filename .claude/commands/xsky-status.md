---
name: xsky-status
description: Show XSky project status - build, tests, coverage
allowed-tools: ["Bash", "Read"]
---

# XSky Project Status

Running project health checks...

## Build Status

```bash
cd /Users/roshansharma/Desktop/Vscode/deepbrowser/ai-browser-backup-20251117-145426/xsky
pnpm build 2>&1 | tail -20
```

## Test Status

```bash
pnpm test 2>&1 | tail -30
```

## Package Versions

```bash
echo "=== Package Versions ==="
for pkg in packages/*/; do
  name=$(jq -r '.name' "$pkg/package.json" 2>/dev/null)
  version=$(jq -r '.version' "$pkg/package.json" 2>/dev/null)
  echo "$name@$version"
done
```

## Dependencies Check

```bash
echo "=== Dependency Issues ==="
pnpm outdated 2>&1 | head -20
```

## Git Status

```bash
echo "=== Git Status ==="
git status --short
```

Report the status to the user with any issues found.
