#!/bin/bash
# socket-bridge/src/ 또는 .claude/agents/ 파일 수정 시 자동 재시작

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ "$FILE_PATH" == *"socket-bridge/src/"* ]] || [[ "$FILE_PATH" == *".claude/agents/"* ]]; then
  bash .claude/skills/restart-bridge/scripts/restart.sh >&2
fi

exit 0
