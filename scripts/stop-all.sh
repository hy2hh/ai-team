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

# 좀비 bridge 프로세스 정리 (tmux kill로 안 죽은 경우)
ZOMBIE_COUNT=$(pgrep -f "tsx src/index.ts" 2>/dev/null | wc -l | tr -d ' ')
if [ "$ZOMBIE_COUNT" -gt 0 ]; then
  pkill -f "tsx src/index.ts" 2>/dev/null || true
  echo "  🧹 좀비 bridge 프로세스 ${ZOMBIE_COUNT}개 정리"
  STOPPED=$((STOPPED + ZOMBIE_COUNT))
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ${STOPPED}개 프로세스 종료 완료"
