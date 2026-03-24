#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
SESSION_PREFIX="ai-team"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env 파일이 없습니다: $ENV_FILE"
  exit 1
fi
source "$ENV_FILE"

if ! command -v tmux &>/dev/null; then
  echo "❌ tmux가 설치되어 있지 않습니다: brew install tmux"
  exit 1
fi

if [ $# -lt 1 ]; then
  echo "사용법: $0 <agent-name>"
  echo ""
  echo "사용 가능한 에이전트:"
  echo "  pm, designer, frontend, backend, researcher, secops"
  exit 1
fi

AGENT_NAME="$1"

case "$AGENT_NAME" in
  pm)
    BOT_TOKEN="$SLACK_BOT_TOKEN_PM"
    APP_TOKEN="$SLACK_APP_TOKEN_PM"
    AGENT_FILE=".claude/agents/pm.md"
    ;;
  designer)
    BOT_TOKEN="$SLACK_BOT_TOKEN_DESIGNER"
    APP_TOKEN="$SLACK_APP_TOKEN_DESIGNER"
    AGENT_FILE=".claude/agents/designer.md"
    ;;
  frontend)
    BOT_TOKEN="$SLACK_BOT_TOKEN_FRONTEND"
    APP_TOKEN="$SLACK_APP_TOKEN_FRONTEND"
    AGENT_FILE=".claude/agents/frontend.md"
    ;;
  backend)
    BOT_TOKEN="$SLACK_BOT_TOKEN_BACKEND"
    APP_TOKEN="$SLACK_APP_TOKEN_BACKEND"
    AGENT_FILE=".claude/agents/backend.md"
    ;;
  researcher)
    BOT_TOKEN="$SLACK_BOT_TOKEN_RESEARCHER"
    APP_TOKEN="$SLACK_APP_TOKEN_RESEARCHER"
    AGENT_FILE=".claude/agents/researcher.md"
    ;;
  secops)
    BOT_TOKEN="$SLACK_BOT_TOKEN_SECOPS"
    APP_TOKEN="$SLACK_APP_TOKEN_SECOPS"
    AGENT_FILE=".claude/agents/secops.md"
    ;;
  *)
    echo "❌ 알 수 없는 에이전트: $AGENT_NAME"
    echo "사용 가능: pm, designer, frontend, backend, researcher, secops"
    exit 1
    ;;
esac

SESSION_NAME="${SESSION_PREFIX}-${AGENT_NAME}"

# 이미 실행 중이면 attach
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "⏭ $AGENT_NAME 이미 실행 중 — 세션에 접속합니다"
  tmux attach -t "$SESSION_NAME"
  exit 0
fi

# 환경변수를 export 후 claude 실행 (MCP 서버가 프로세스 환경에서 ${VAR} 참조)
tmux new-session -d -s "$SESSION_NAME" -c "$PROJECT_DIR" \
  "export SLACK_BOT_TOKEN=\"$BOT_TOKEN\" SLACK_APP_TOKEN=\"$APP_TOKEN\" SLACK_TEAM_ID=\"$SLACK_TEAM_ID\" && claude --agent \"$PROJECT_DIR/$AGENT_FILE\""

# claude --agent 초기화 대기 후 이벤트 감시 프롬프트 전송
sleep 8
tmux send-keys -t "$SESSION_NAME" ".events/${AGENT_NAME}/ 디렉토리를 감시하세요. 새 JSON 파일이 생기면 읽고 처리한 뒤 삭제하세요. 파일이 없으면 5초 간격으로 확인하세요." Enter

echo "🚀 $AGENT_NAME 에이전트 시작 (세션: $SESSION_NAME)"
echo ""
echo "📋 명령어:"
echo "  tmux attach -t $SESSION_NAME   # 세션 접속"
echo "  Ctrl+B, D                      # 세션에서 빠져나오기"
echo ""
