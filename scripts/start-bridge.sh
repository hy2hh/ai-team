#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
BRIDGE_DIR="$PROJECT_DIR/socket-bridge"
SESSION_NAME="ai-team-bridge"

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

# node_modules 확인
if [ ! -d "$BRIDGE_DIR/node_modules" ]; then
  echo "📦 socket-bridge 의존성 설치 중..."
  cd "$BRIDGE_DIR" && npm install
fi

# 이미 실행 중이면 attach
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "⏭ bridge 이미 실행 중 — 세션에 접속합니다"
  tmux attach -t "$SESSION_NAME"
  exit 0
fi

# .events 디렉토리 생성
mkdir -p "$PROJECT_DIR/.events"

# tmux 세션으로 bridge 실행 (set -a로 환경변수를 자동 export)
tmux new-session -d -s "$SESSION_NAME" -c "$BRIDGE_DIR" \
  "set -a && source $ENV_FILE && set +a && npm start"

echo "🌉 Socket Bridge 시작 (세션: $SESSION_NAME)"
echo ""
echo "📋 명령어:"
echo "  tmux attach -t $SESSION_NAME   # 세션 접속"
echo "  Ctrl+B, D                      # 세션에서 빠져나오기"
echo ""
