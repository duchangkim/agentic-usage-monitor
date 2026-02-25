#!/bin/bash
set -uo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Early exit: no path or file gone
[ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ] && exit 0

# Only biome-supported extensions
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.jsonc|*.css) ;;
  *) exit 0 ;;
esac

# Format + lint (single file)
cd "$CLAUDE_PROJECT_DIR" && bunx biome check --write "$FILE_PATH" > /dev/null 2>&1
exit 0
