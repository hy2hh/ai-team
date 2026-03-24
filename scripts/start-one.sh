#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env 파일이 없습니다: $ENV_FILE"
  exit 1
fi
source "$ENV_FILE"

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

echo "🚀 $AGENT_NAME 에이전트 시작"

SLACK_BOT_TOKEN="$BOT_TOKEN" \
SLACK_APP_TOKEN="$APP_TOKEN" \
SLACK_TEAM_ID="$SLACK_TEAM_ID" \
claude --agent "$PROJECT_DIR/$AGENT_FILE"
