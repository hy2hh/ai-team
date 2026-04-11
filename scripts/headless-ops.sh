#!/bin/bash
# headless-ops.sh — Claude 세션 없이 긴급 인프라 작업 실행
# Rate limit 걸렸을 때 또는 빠른 반복 작업용
# 사용법: bash scripts/headless-ops.sh <command> [options]

set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

usage() {
  echo "사용법: bash scripts/headless-ops.sh <command> [options]"
  echo ""
  echo "Commands:"
  echo "  restart [local] [force]  — Bridge 재시작"
  echo "  status                   — Bridge 상태 확인"
  echo "  logs [N]                 — Bridge 최근 로그 (기본 30줄)"
  echo ""
  echo "예시:"
  echo "  bash scripts/headless-ops.sh restart"
  echo "  bash scripts/headless-ops.sh restart local force"
  echo "  bash scripts/headless-ops.sh status"
  echo "  bash scripts/headless-ops.sh logs 50"
  exit 1
}

cmd_restart() {
  bash "$PROJECT_DIR/.claude/skills/restart-bridge/scripts/restart.sh" "$@"
}

cmd_status() {
  local SESSION="ai-team-bridge"
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    CONNECTED=$(tmux capture-pane -t "$SESSION" -p 2>/dev/null | grep -c '연결 완료' || true)
    echo "✅ Bridge 세션 활성 — ${CONNECTED}/7 연결"
  else
    echo "❌ Bridge 세션 없음"
    exit 1
  fi
}

cmd_logs() {
  local LINES="${1:-30}"
  local SESSION="ai-team-bridge"
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux capture-pane -t "$SESSION" -p | tail -"$LINES"
  else
    echo "❌ Bridge 세션 없음"
    exit 1
  fi
}

[ $# -eq 0 ] && usage

COMMAND="$1"
shift

case "$COMMAND" in
  restart) cmd_restart "$@" ;;
  status)  cmd_status ;;
  logs)    cmd_logs "$@" ;;
  *)       echo "알 수 없는 명령: $COMMAND"; usage ;;
esac
