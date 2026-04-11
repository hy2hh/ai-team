#!/bin/bash
# watch-bridge.sh — Bridge 상태 감시 + 자동 복구
# 실행 방식: cron (5분마다) — 상주 프로세스 아님
# cron 등록: bash scripts/setup-aliases.sh watch:install

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
BRIDGE_SESSION="ai-team-bridge"
INCIDENT_LOG="$PROJECT_DIR/scripts/incidents.log"
BRIDGE_LOG="$PROJECT_DIR/socket-bridge/bridge.log"
RESTART_SCRIPT="$PROJECT_DIR/.claude/skills/restart-bridge/scripts/restart.sh"
LOG_ROTATE_LINES=1000   # 이 줄 수 초과 시 rotate

# .env 로드
if [ -f "$ENV_FILE" ]; then
  set -a && source "$ENV_FILE" && set +a
fi

# ─── Slack 알림 ────────────────────────────────────────────────
slack_notify() {
  local message="$1"
  local token="${SLACK_BOT_TOKEN_PM:-}"
  local channel="${SLACK_CHANNEL_AI_TEAM:-${SLACK_NOTIFY_CHANNEL:-}}"

  if [ -z "$token" ] || [ -z "$channel" ]; then
    echo "  ⚠️  Slack 알림 스킵 (SLACK_BOT_TOKEN_PM 또는 SLACK_CHANNEL_AI_TEAM 미설정)"
    return
  fi

  curl -s -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "{\"channel\":\"$channel\",\"text\":\"$message\"}" \
    > /dev/null
}

# ─── 인시던트 로그 ─────────────────────────────────────────────
log_incident() {
  local status="$1"
  local detail="$2"
  echo "$(date '+%Y-%m-%d %H:%M:%S') [$status] $detail" >> "$INCIDENT_LOG"
}

# ─── 상태 확인 ─────────────────────────────────────────────────
check_bridge() {
  if ! tmux has-session -t "$BRIDGE_SESSION" 2>/dev/null; then
    echo "DOWN_NO_SESSION"
    return
  fi

  local connected
  connected=$(tmux capture-pane -t "$BRIDGE_SESSION" -p 2>/dev/null | grep -c '연결 완료' || true)

  if [ "$connected" -ge 7 ]; then
    echo "OK:$connected"
  elif [ "$connected" -ge 1 ]; then
    echo "PARTIAL:$connected"
  else
    echo "DOWN_NO_AGENTS"
  fi
}

# ─── Bridge 로그 로테이션 ──────────────────────────────────────
rotate_bridge_log() {
  if [ ! -f "$BRIDGE_LOG" ]; then return; fi

  local line_count
  line_count=$(wc -l < "$BRIDGE_LOG")

  if [ "$line_count" -gt "$LOG_ROTATE_LINES" ]; then
    local archive_path="${BRIDGE_LOG%.log}.$(date '+%Y%m%d-%H%M%S').log.gz"
    gzip -c "$BRIDGE_LOG" > "$archive_path"
    > "$BRIDGE_LOG"   # 파일 초기화 (inode 유지)
    log_incident "LOG_ROTATED" "bridge.log ${line_count}줄 → $(basename "$archive_path")"
    echo "  📦 bridge.log 로테이션: ${line_count}줄 → $(basename "$archive_path")"
  fi
}

# ─── 메인 ──────────────────────────────────────────────────────
main() {
  rotate_bridge_log

  local status
  status=$(check_bridge)

  case "$status" in
    OK:*)
      # 정상 — 아무것도 안 함
      exit 0
      ;;

    PARTIAL:*)
      local count="${status#PARTIAL:}"
      local msg="⚠️ [Bridge] ${count}/7 에이전트 연결됨 — 부분 장애 감지"
      echo "$msg"
      log_incident "PARTIAL" "${count}/7 connected"
      slack_notify "$msg"
      ;;

    DOWN_NO_SESSION)
      local msg="🔴 [Bridge] 세션 없음 — 자동 재시작 중..."
      echo "$msg"
      log_incident "DOWN" "no tmux session"
      slack_notify "$msg"

      if bash "$RESTART_SCRIPT" 2>&1; then
        local recover_msg="✅ [Bridge] 자동 복구 완료 — 7/7 연결"
        log_incident "RECOVERED" "auto-restart success"
        slack_notify "$recover_msg"
      else
        local fail_msg="❌ [Bridge] 자동 재시작 실패 — 수동 확인 필요"
        log_incident "RESTART_FAILED" "auto-restart failed"
        slack_notify "$fail_msg"
      fi
      ;;

    DOWN_NO_AGENTS)
      local msg="🔴 [Bridge] 세션은 있으나 에이전트 0개 연결 — 자동 재시작 중..."
      echo "$msg"
      log_incident "DOWN" "session alive but 0 agents"
      slack_notify "$msg"

      if bash "$RESTART_SCRIPT" "force" 2>&1; then
        local recover_msg="✅ [Bridge] 자동 복구 완료 — 7/7 연결"
        log_incident "RECOVERED" "force-restart success"
        slack_notify "$recover_msg"
      else
        local fail_msg="❌ [Bridge] 자동 재시작 실패 — 수동 확인 필요"
        log_incident "RESTART_FAILED" "force-restart failed"
        slack_notify "$fail_msg"
      fi
      ;;
  esac
}

main "$@"
