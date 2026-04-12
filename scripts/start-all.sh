#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
BRIDGE_SESSION="ai-team-bridge"
BRIDGE_DIR="$PROJECT_DIR/socket-bridge"
START_MODE="${1:-}"
LOGFILE="$BRIDGE_DIR/bridge.log"

# .env 로드
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env 파일이 없습니다: $ENV_FILE"
  exit 1
fi

if [ -n "$START_MODE" ] && [ "$START_MODE" != "local" ]; then
  echo "⚠️  알 수 없는 인자: $START_MODE (무시됩니다)"
  echo "   사용법: $0 [local]"
  echo ""
fi

# tmux 필수
if ! command -v tmux &>/dev/null; then
  echo "❌ tmux가 설치되어 있지 않습니다: brew install tmux"
  exit 1
fi

echo "🚀 AI Team 시작 ($(date '+%Y-%m-%d %H:%M:%S'))"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 2: Agent SDK 런타임 (통합 프로세스)"
if [ "$START_MODE" = "local" ]; then
  echo "  인증: local → 로컬 Claude Code 로그인 계정 요금제 (BRIDGE_ANTHROPIC_AUTH_MODE=claude_local)"
  echo "        (에이전트별 다른 계정은 .env의 BRIDGE_CLAUDE_OAUTH_TOKEN_<역할> 사용)"
else
  echo "  인증: .env 의 BRIDGE_ANTHROPIC_AUTH_MODE / ANTHROPIC_API_KEY 등"
fi
echo ""

# Socket Bridge + Agent Runtime 시작 (하나의 프로세스)
if tmux has-session -t "$BRIDGE_SESSION" 2>/dev/null; then
  echo "  ⏭ bridge 이미 실행 중 (세션: $BRIDGE_SESSION)"
else
  if [ ! -d "$BRIDGE_DIR/node_modules" ]; then
    echo "  📦 socket-bridge 의존성 설치 중..."
    (cd "$BRIDGE_DIR" && npm install)
  fi
  # source .env 후 [local]이면 구독 모드(로컬 키체인) 강제 — .env의 모드보다 우선
  bridge_cmd='set -a && source "'"$ENV_FILE"'" && set +a'
  if [ "$START_MODE" = "local" ]; then
    bridge_cmd="$bridge_cmd && export BRIDGE_ANTHROPIC_AUTH_MODE=claude_local"
  fi
  bridge_cmd="$bridge_cmd && npm start 2>&1 | tee \"$LOGFILE\""
  tmux new-session -d -s "$BRIDGE_SESSION" -c "$BRIDGE_DIR" -- bash -lc "$bridge_cmd"
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
echo "  $0 local              # 로컬 claude login 계정 요금제로 기동"
echo "  tmux attach -t $BRIDGE_SESSION    # 세션 접속"
echo "  Ctrl+B, D                         # 세션에서 빠져나오기"
echo "  ./scripts/stop-all.sh             # 전체 종료"
echo ""

# 이 머신을 bridge 호스트로 등록 (watchdog 멀티-머신 지원)
echo "$(hostname)" > "$SCRIPT_DIR/.bridge-host"
