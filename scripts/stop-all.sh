#!/bin/bash
set -euo pipefail

SESSION_PREFIX="ai-team"
AGENTS=("pm" "designer" "frontend" "backend" "researcher" "secops")
BRIDGE_SESSION="ai-team-bridge"

echo "🛑 AI Team 종료 중..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

STOPPED=0

for name in "${AGENTS[@]}"; do
  session_name="${SESSION_PREFIX}-${name}"
  if tmux has-session -t "$session_name" 2>/dev/null; then
    tmux kill-session -t "$session_name"
    echo "  ✅ $name 종료"
    STOPPED=$((STOPPED + 1))
  else
    echo "  ⏭ $name 실행 중 아님"
  fi
done

# Socket Bridge 종료
if tmux has-session -t "$BRIDGE_SESSION" 2>/dev/null; then
  tmux kill-session -t "$BRIDGE_SESSION"
  echo "  🌉 bridge 종료"
  STOPPED=$((STOPPED + 1))
else
  echo "  ⏭ bridge 실행 중 아님"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ${STOPPED}개 프로세스 종료 완료"
