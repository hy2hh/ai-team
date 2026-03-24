#!/bin/bash
set -euo pipefail

BRIDGE_SESSION="ai-team-bridge"

echo "🛑 AI Team 종료 중..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

STOPPED=0

# Phase 1 레거시 세션 정리 (있다면)
LEGACY_AGENTS=("pm" "designer" "frontend" "backend" "researcher" "secops")
for name in "${LEGACY_AGENTS[@]}"; do
  session_name="ai-team-${name}"
  if tmux has-session -t "$session_name" 2>/dev/null; then
    tmux kill-session -t "$session_name"
    echo "  ✅ $name (레거시) 종료"
    STOPPED=$((STOPPED + 1))
  fi
done

# Bridge + Agent Runtime 종료
if tmux has-session -t "$BRIDGE_SESSION" 2>/dev/null; then
  tmux kill-session -t "$BRIDGE_SESSION"
  echo "  🌉 bridge + agent-runtime 종료"
  STOPPED=$((STOPPED + 1))
else
  echo "  ⏭ bridge 실행 중 아님"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ${STOPPED}개 프로세스 종료 완료"
