#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
BRIDGE_SESSION="ai-team-bridge"
# 인자 파싱: restart.sh [local] [cooldown]
START_MODE=""
WEBSOCKET_COOLDOWN=5

for arg in "$@"; do
  if [ "$arg" = "local" ]; then
    START_MODE="local"
  elif [[ "$arg" =~ ^[0-9]+$ ]]; then
    WEBSOCKET_COOLDOWN="$arg"
  fi
done

echo "🔄 Bridge 재시작 (모드: ${START_MODE:-default}, WebSocket 대기: ${WEBSOCKET_COOLDOWN}s)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 0. 활성 작업 확인 (실행 중인 에이전트/큐 태스크가 있으면 재시작 중단)
DB_PATH="$PROJECT_DIR/.memory/memory.db"
if [ -f "$DB_PATH" ]; then
  ACTIVE_CLAIMS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM claims WHERE status='processing'" 2>/dev/null || echo "0")
  ACTIVE_QUEUE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM queue_tasks WHERE status='running'" 2>/dev/null || echo "0")
  ACTIVE_TOTAL=$((ACTIVE_CLAIMS + ACTIVE_QUEUE))

  if [ "$ACTIVE_TOTAL" -gt 0 ]; then
    echo "❌ 재시작 중단 — 실행 중인 작업이 있습니다 (claims: ${ACTIVE_CLAIMS}, queue: ${ACTIVE_QUEUE})"
    echo "   작업 완료 후 재시작하거나, 취소 버튼으로 작업을 중단하세요."
    exit 1
  fi
fi

# 1. 종료
echo "  🛑 기존 프로세스 종료..."
bash "$PROJECT_DIR/scripts/stop-all.sh" 2>/dev/null || true

# 2. Slack WebSocket 세션 정리 대기
echo "  ⏳ Slack WebSocket 세션 정리 대기 (${WEBSOCKET_COOLDOWN}s)..."
sleep "$WEBSOCKET_COOLDOWN"

# 3. 시작
echo "  🚀 Bridge 시작..."
bash "$PROJECT_DIR/scripts/start-all.sh" $START_MODE

# 4. 연결 확인 (최대 60초 대기)
echo ""
echo "  🔍 연결 확인 중 (최대 60초)..."
MAX_WAIT=60
ELAPSED=0
INTERVAL=5
CONNECTED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))

  if ! tmux has-session -t "$BRIDGE_SESSION" 2>/dev/null; then
    echo "  ❌ Bridge 세션이 종료됨 — 크래시 확인 필요"
    exit 1
  fi

  CONNECTED=$(tmux capture-pane -t "$BRIDGE_SESSION" -p 2>/dev/null | grep -c '연결 완료' || true)

  if [ "$CONNECTED" -ge 6 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Bridge 재시작 완료 — 6/6 연결 정상"
    exit 0
  fi

  echo "  ... ${CONNECTED}/6 연결됨 (${ELAPSED}s)"
done

# 타임아웃
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  ${CONNECTED}/6 연결됨 (60초 타임아웃)"
echo ""
echo "  pong 타임아웃 로그:"
tmux capture-pane -t "$BRIDGE_SESSION" -p 2>/dev/null | grep -i 'pong\|WARN\|error' | tail -5
echo ""
echo "  💡 WebSocket 대기 시간을 늘려서 재시도:"
echo "     bash $0 10"
exit 1
