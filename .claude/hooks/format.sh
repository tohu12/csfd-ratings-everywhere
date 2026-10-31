#!/usr/bin/env bash
# PostToolUse(Edit|Write): format + autofix the edited file with Biome.
# Remaining lint errors are fed back to Claude (exit 2 on PostToolUse = stderr shown to the model).
set -uo pipefail
file=$(jq -r '.tool_input.file_path // empty')
[[ -z "$file" || ! -f "$file" ]] && exit 0
case "$file" in
  *.ts|*.js|*.json|*.jsonc|*.css) ;;
  *) exit 0 ;;
esac
cd "$CLAUDE_PROJECT_DIR" || exit 0
if ! out=$(pnpm exec biome check --write --no-errors-on-unmatched --files-ignore-unknown=true "$file" 2>&1); then
  echo "Biome found problems in $file:" >&2
  echo "$out" | tail -40 >&2
  exit 2
fi
exit 0
