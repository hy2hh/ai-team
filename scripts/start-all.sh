#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
BRIDGE_SESSION="ai-team-bridge"
BRIDGE_DIR="$PROJECT_DIR/socket-bridge"

# .env 로드
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env 파일이 없습니다: $ENV_FILE"
  exit 1
fi

# tmux 필수
if ! command -v tmux &>/dev/null; then
  echo "❌ tmux가 설치되어 있지 않습니다: brew install tmux"
  exit 1
fi

echo "🚀 AI Team 시작 ($(date '+%Y-%m-%d %H:%M:%S'))"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 2: Agent SDK 런타임 (통합 프로세스)"
echo ""

# Socket Bridge + Agent Runtime 시작 (하나의 프로세스)
if tmux has-session -t "$BRIDGE_SESSION" 2>/dev/null; then
  echo "  ⏭ bridge 이미 실행 중 (세션: $BRIDGE_SESSION)"
else
  if [ ! -d "$BRIDGE_DIR/node_modules" ]; then
    echo "  📦 socket-bridge 의존성 설치 중..."
    (cd "$BRIDGE_DIR" && npm install)
  fi
  tmux new-session -d -s "$BRIDGE_SESSION" -c "$BRIDGE_DIR" \
    "set -a && source $ENV_FILE && set +a && npm start"
  echo "  🌉 bridge + agent-runtime 시작 (세션: $BRIDGE_SESSION)"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 시작 완료"
echo ""
echo "  Socket Bridge: Slack WebSocket 수신"
echo "  Agent Runtime: SDK query() 직접 호출"
echo "  모델: claude-sonnet-4-6"
echo ""
echo "📋 명령어:"
echo "  tmux attach -t $BRIDGE_SESSION    # 세션 접속"
echo "  Ctrl+B, D                         # 세션에서 빠져나오기"
echo "  ./scripts/stop-all.sh             # 전체 종료"
echo ""
