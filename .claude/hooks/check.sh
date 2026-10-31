#!/usr/bin/env bash
# Stop: the agent may only finish when typecheck + unit tests (with 100 % coverage) pass.
# Skipped when nothing under src/, tests/ or config changed, to keep pure Q&A turns fast.
set -uo pipefail
cd "$CLAUDE_PROJECT_DIR" || exit 0
changed=$(git status --porcelain -- src tests vitest.config.ts tsconfig.json wxt.config.ts 2>/dev/null)
[[ -z "$changed" ]] && exit 0

if ! out=$(pnpm typecheck 2>&1); then
  echo "Typecheck failed – fix before finishing:" >&2
  echo "$out" | tail -40 >&2
  exit 2
fi
if ! out=$(pnpm test:coverage 2>&1); then
  echo "Unit tests or coverage thresholds failed – fix before finishing:" >&2
  echo "$out" | grep -vE '^\s*(✓|$)' | tail -60 >&2
  exit 2
fi
exit 0
