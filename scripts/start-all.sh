#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
LOG_DIR="$PROJECT_DIR/logs"

# .env 로드
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env 파일이 없습니다: $ENV_FILE"
  exit 1
fi
source "$ENV_FILE"

# 로그 디렉토리 생성
mkdir -p "$LOG_DIR"

# 에이전트 정의: name|agent_file|bot_token|app_token
AGENTS=(
  "pm|.claude/agents/pm.md|$SLACK_BOT_TOKEN_PM|$SLACK_APP_TOKEN_PM"
  "designer|.claude/agents/designer.md|$SLACK_BOT_TOKEN_DESIGNER|$SLACK_APP_TOKEN_DESIGNER"
  "frontend|.claude/agents/frontend.md|$SLACK_BOT_TOKEN_FRONTEND|$SLACK_APP_TOKEN_FRONTEND"
  "backend|.claude/agents/backend.md|$SLACK_BOT_TOKEN_BACKEND|$SLACK_APP_TOKEN_BACKEND"
  "researcher|.claude/agents/researcher.md|$SLACK_BOT_TOKEN_RESEARCHER|$SLACK_APP_TOKEN_RESEARCHER"
  "secops|.claude/agents/secops.md|$SLACK_BOT_TOKEN_SECOPS|$SLACK_APP_TOKEN_SECOPS"
)

PIDS=()

cleanup() {
  echo ""
  echo "🛑 모든 에이전트 종료 중..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
    fi
  done
  wait
  echo "✅ 전체 종료 완료"
  exit 0
}

trap cleanup SIGINT SIGTERM

echo "🚀 AI Team 에이전트 시작 ($(date '+%Y-%m-%d %H:%M:%S'))"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for agent_config in "${AGENTS[@]}"; do
  IFS='|' read -r name agent_file bot_token app_token <<< "$agent_config"

  echo "  ▶ $name 시작 중... (로그: logs/$name.log)"

  SLACK_BOT_TOKEN="$bot_token" \
  SLACK_APP_TOKEN="$app_token" \
  SLACK_TEAM_ID="$SLACK_TEAM_ID" \
  claude --agent "$PROJECT_DIR/$agent_file" \
    > "$LOG_DIR/$name.log" 2>&1 &

  PIDS+=($!)
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 에이전트 ${#PIDS[@]}개 실행 중"
echo "   PID: ${PIDS[*]}"
echo "   종료: Ctrl+C"
echo ""

# 모든 프로세스 대기
wait
