#!/usr/bin/env bash
# PreToolUse(Edit|Write): block edits to files agents must not touch directly.
set -uo pipefail
file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  *.env|*.env.*|*/pnpm-lock.yaml|*/.git/*|*/tests/fixtures/csfd/anubis-reject.html)
    echo "Blocked: $file is protected. Lockfile changes go through pnpm; .env is secret; the Anubis fixture is a real captured page." >&2
    exit 2
    ;;
esac
exit 0
