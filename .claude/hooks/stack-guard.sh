#!/bin/bash
INPUT=$(cat 2>/dev/null) || exit 0
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
WARNINGS=""

if echo "$CMD" | grep -qiE 'playwright|npx playwright|@playwright'; then
  WARNINGS="[Stack Guard] 이 프로젝트는 Playwright가 아닌 agent-browser를 사용합니다."
fi

if echo "$CMD" | grep -qiE 'npm install.*anthropic|pnpm add.*anthropic|pip install.*anthropic'; then
  if ! echo "$CMD" | grep -qiE 'claude-agent-sdk'; then
    WARNINGS="[Stack Guard] 이 프로젝트는 표준 anthropic SDK가 아닌 claude-agent-sdk를 사용합니다."
  fi
fi

if echo "$CMD" | grep -qE '^npm (install|add|remove|uninstall|ci)\b'; then
  WARNINGS="[Stack Guard] 이 프로젝트는 npm이 아닌 pnpm을 사용합니다."
fi

if [ -n "$WARNINGS" ]; then
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":\"$WARNINGS\"}}"
fi
exit 0
