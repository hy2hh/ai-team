#!/bin/bash
# headless-ops.sh — Claude 세션 없이 긴급 인프라 작업 실행
# Rate limit 걸렸을 때 또는 빠른 반복 작업용
# 사용법: bash scripts/headless-ops.sh <command> [options]

set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

INCIDENT_LOG="$PROJECT_DIR/scripts/incidents.log"

usage() {
  echo "사용법: bash scripts/headless-ops.sh <command> [options]"
  echo ""
  echo "Commands:"
  echo "  restart [local] [force]  — Bridge 재시작"
  echo "  status                   — Bridge 상태 확인"
  echo "  logs [N]                 — Bridge 최근 로그 (기본 30줄)"
  echo "  daily-summary            — 전날 인시던트 요약 Slack 발송"
  echo ""
  echo "예시:"
  echo "  bash scripts/headless-ops.sh restart"
  echo "  bash scripts/headless-ops.sh restart local force"
  echo "  bash scripts/headless-ops.sh status"
  echo "  bash scripts/headless-ops.sh logs 50"
  echo "  bash scripts/headless-ops.sh daily-summary"
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

cmd_daily_summary() {
  # .env 로드 (Slack 토큰)
  local ENV_FILE="$PROJECT_DIR/.env"
  if [ -f "$ENV_FILE" ]; then
    set -a && source "$ENV_FILE" && set +a
  fi

  local token="${SLACK_BOT_TOKEN_PM:-}"
  local channel="${SLACK_CHANNEL_AI_TEAM:-${SLACK_NOTIFY_CHANNEL:-}}"

  if [ -z "$token" ] || [ -z "$channel" ]; then
    echo "❌ SLACK_BOT_TOKEN_PM 또는 SLACK_CHANNEL_AI_TEAM 미설정"
    exit 1
  fi

  local yesterday
  yesterday=$(date -v-1d '+%Y-%m-%d' 2>/dev/null || date -d 'yesterday' '+%Y-%m-%d')

  # incidents.log에서 전날 항목 추출
  local entries=""
  if [ -f "$INCIDENT_LOG" ]; then
    entries=$(grep "^${yesterday}" "$INCIDENT_LOG" 2>/dev/null || true)
  fi

  local down_count=0
  local recovered_count=0
  local failed_count=0
  local rotated_count=0

  if [ -n "$entries" ]; then
    down_count=$(echo "$entries" | grep -c '\[DOWN\]' || true)
    recovered_count=$(echo "$entries" | grep -c '\[RECOVERED\]' || true)
    failed_count=$(echo "$entries" | grep -c '\[RESTART_FAILED\]' || true)
    rotated_count=$(echo "$entries" | grep -c '\[LOG_ROTATED\]' || true)
  fi

  # 메시지 구성
  local status_emoji="✅"
  local status_text="정상 운영"
  if [ "$failed_count" -gt 0 ]; then
    status_emoji="🔴"
    status_text="장애 미복구 ${failed_count}건"
  elif [ "$down_count" -gt 0 ]; then
    status_emoji="🟡"
    status_text="장애 발생 후 복구됨"
  fi

  local message="${status_emoji} *[Bridge 일일 리포트] ${yesterday}*

상태: ${status_text}
• 장애 감지: ${down_count}회
• 자동 복구: ${recovered_count}회
• 복구 실패: ${failed_count}회
• 로그 로테이션: ${rotated_count}회"

  if [ -n "$entries" ] && [ "$down_count" -gt 0 ]; then
    message="${message}

\`\`\`
$(echo "$entries" | grep -E '\[DOWN\]|\[RESTART_FAILED\]' | head -5)
\`\`\`"
  fi

  local payload
  payload=$(printf '%s' "$message" | python3 -c "
import sys, json
text = sys.stdin.read()
print(json.dumps({'channel': '${channel}', 'text': text}))
")

  curl -s -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json; charset=utf-8" \
    -d "$payload" \
    > /dev/null

  echo "✅ 일일 요약 발송 완료 (${yesterday}): 장애 ${down_count}회, 복구 ${recovered_count}회"
}

[ $# -eq 0 ] && usage

COMMAND="$1"
shift

case "$COMMAND" in
  restart)       cmd_restart "$@" ;;
  status)        cmd_status ;;
  logs)          cmd_logs "$@" ;;
  daily-summary) cmd_daily_summary ;;
  *)             echo "알 수 없는 명령: $COMMAND"; usage ;;
esac
