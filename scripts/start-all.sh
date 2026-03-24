#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
SESSION_PREFIX="ai-team"

# .env 로드
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env 파일이 없습니다: $ENV_FILE"
  exit 1
fi
source "$ENV_FILE"

# tmux 필수
if ! command -v tmux &>/dev/null; then
  echo "❌ tmux가 설치되어 있지 않습니다: brew install tmux"
  exit 1
fi

# 에이전트 정의: name|agent_file|bot_token|app_token
AGENTS=(
  "pm|.claude/agents/pm.md|$SLACK_BOT_TOKEN_PM|$SLACK_APP_TOKEN_PM"
  "designer|.claude/agents/designer.md|$SLACK_BOT_TOKEN_DESIGNER|$SLACK_APP_TOKEN_DESIGNER"
  "frontend|.claude/agents/frontend.md|$SLACK_BOT_TOKEN_FRONTEND|$SLACK_APP_TOKEN_FRONTEND"
  "backend|.claude/agents/backend.md|$SLACK_BOT_TOKEN_BACKEND|$SLACK_APP_TOKEN_BACKEND"
  "researcher|.claude/agents/researcher.md|$SLACK_BOT_TOKEN_RESEARCHER|$SLACK_APP_TOKEN_RESEARCHER"
  "secops|.claude/agents/secops.md|$SLACK_BOT_TOKEN_SECOPS|$SLACK_APP_TOKEN_SECOPS"
)

echo "🚀 AI Team 시작 ($(date '+%Y-%m-%d %H:%M:%S'))"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Socket Bridge 먼저 시작
BRIDGE_SESSION="ai-team-bridge"
BRIDGE_DIR="$PROJECT_DIR/socket-bridge"

if tmux has-session -t "$BRIDGE_SESSION" 2>/dev/null; then
  echo "  ⏭ bridge 이미 실행 중 (세션: $BRIDGE_SESSION)"
else
  if [ ! -d "$BRIDGE_DIR/node_modules" ]; then
    echo "  📦 socket-bridge 의존성 설치 중..."
    (cd "$BRIDGE_DIR" && npm install)
  fi
  mkdir -p "$PROJECT_DIR/.events"
  tmux new-session -d -s "$BRIDGE_SESSION" -c "$BRIDGE_DIR" \
    "source $ENV_FILE && npm start"
  echo "  🌉 bridge 시작 (세션: $BRIDGE_SESSION)"
  sleep 3
fi

STARTED=0

for agent_config in "${AGENTS[@]}"; do
  IFS='|' read -r name agent_file bot_token app_token <<< "$agent_config"
  session_name="${SESSION_PREFIX}-${name}"

  # 이미 실행 중이면 스킵
  if tmux has-session -t "$session_name" 2>/dev/null; then
    echo "  ⏭ $name 이미 실행 중 (세션: $session_name)"
    continue
  fi

  tmux new-session -d -s "$session_name" -c "$PROJECT_DIR" \
    "export SLACK_BOT_TOKEN=\"$bot_token\" SLACK_APP_TOKEN=\"$app_token\" SLACK_TEAM_ID=\"$SLACK_TEAM_ID\" && claude --agent \"$PROJECT_DIR/$agent_file\""

  echo "  ✅ $name 시작 (세션: $session_name)"
  STARTED=$((STARTED + 1))
done

# claude --agent 초기화 대기 후 모니터링 프롬프트 전송
if [ "$STARTED" -gt 0 ]; then
  echo ""
  echo "⏳ 에이전트 초기화 대기 중 (8초)..."
  sleep 8

  for agent_config in "${AGENTS[@]}"; do
    IFS='|' read -r name agent_file bot_token app_token <<< "$agent_config"
    session_name="${SESSION_PREFIX}-${name}"
    if tmux has-session -t "$session_name" 2>/dev/null; then
      tmux send-keys -t "$session_name" ".events/${name}/ 디렉토리를 감시하세요. 새 JSON 파일이 생기면 읽고 처리한 뒤 삭제하세요. 파일이 없으면 5초 간격으로 확인하세요." Enter
    fi
  done
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 에이전트 ${STARTED}개 시작 완료"
echo ""
echo "📋 명령어:"
echo "  tmux ls                              # 세션 목록"
echo "  tmux attach -t ${SESSION_PREFIX}-backend   # 세션 접속"
echo "  Ctrl+B, D                            # 세션에서 빠져나오기"
echo "  ./scripts/stop-all.sh                # 전체 종료"
echo ""
