#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
BRIDGE_DIR="$PROJECT_DIR/socket-bridge"
EVENTS_DIR="$PROJECT_DIR/.events"
SESSION_NAME="ai-team-bridge-test"
CHANNEL_ID="C0ANKEB4CRF"  # #ai-team

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✅ PASS${NC}: $1"; }
fail() { echo -e "  ${RED}❌ FAIL${NC}: $1"; FAILURES=$((FAILURES + 1)); }
info() { echo -e "  ${YELLOW}→${NC} $1"; }

FAILURES=0
TESTS=0

# .env 로드
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env 파일이 없습니다"
  exit 1
fi
source "$ENV_FILE"

echo "🧪 Socket Bridge 통합 테스트"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 기존 테스트 bridge 정리 ──
tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true

# ── 이벤트 디렉토리 정리 ──
rm -rf "$EVENTS_DIR"
mkdir -p "$EVENTS_DIR"

# ── 테스트 모드로 bridge 시작 ──
info "테스트 모드 bridge 시작 중..."
tmux new-session -d -s "$SESSION_NAME" -c "$BRIDGE_DIR" \
  "set -a && source $ENV_FILE && BRIDGE_TEST_MODE=1 && set +a && exec npm start"

sleep 20  # Socket Mode 순차 연결 대기 (6개 앱)

# bridge 실행 확인
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  pass "bridge 프로세스 실행 중"
else
  fail "bridge 프로세스가 시작되지 않음"
  exit 1
fi
TESTS=$((TESTS + 1))

# bridge 로그에서 연결 확인
BRIDGE_LOG=$(tmux capture-pane -t "$SESSION_NAME" -p -S -20 2>&1)
if echo "$BRIDGE_LOG" | grep -q "전체 에이전트 Socket Mode 연결 완료"; then
  pass "6개 에이전트 Socket Mode 연결"
else
  fail "Socket Mode 연결 실패"
  echo "$BRIDGE_LOG"
  tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
  exit 1
fi
TESTS=$((TESTS + 1))

# ── 테스트 1: 멘션 없는 메시지 → triage 라우팅 ──
echo ""
echo "📝 테스트 1: 멘션 없는 메시지 → triage 라우팅"
TEST_TEXT="[bridge-test] triage routing $(date +%s)"
curl -s -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN_PM" \
  -H "Content-Type: application/json" \
  -d "{\"channel\":\"$CHANNEL_ID\",\"text\":\"$TEST_TEXT\"}" > /dev/null

sleep 5

TRIAGE_COUNT=$(ls "$EVENTS_DIR/triage/" 2>/dev/null | wc -l | tr -d ' ')
if [ "$TRIAGE_COUNT" -eq 1 ]; then
  pass "triage 디렉토리에 정확히 1개 파일 생성"
else
  fail "triage 파일 수: $TRIAGE_COUNT (기대: 1)"
fi
TESTS=$((TESTS + 1))

# 파일 내용 확인
if [ "$TRIAGE_COUNT" -ge 1 ]; then
  TRIAGE_FILE=$(ls "$EVENTS_DIR/triage/" | head -1)
  FILE_TEXT=$(python3 -c "import json; d=json.load(open('$EVENTS_DIR/triage/$TRIAGE_FILE')); print(d['text'])")
  if echo "$FILE_TEXT" | grep -q "bridge-test"; then
    pass "이벤트 파일에 메시지 텍스트 포함"
  else
    fail "이벤트 파일 텍스트 불일치: $FILE_TEXT"
  fi
  TESTS=$((TESTS + 1))

  MENTIONS=$(python3 -c "import json; d=json.load(open('$EVENTS_DIR/triage/$TRIAGE_FILE')); print(d['mentions'])")
  if [ "$MENTIONS" = "[]" ]; then
    pass "멘션 목록 비어있음 (triage 정상)"
  else
    fail "멘션 목록이 비어있지 않음: $MENTIONS"
  fi
  TESTS=$((TESTS + 1))
fi

# ── 테스트 2: @Backend 멘션 → backend 라우팅 ──
echo ""
echo "📝 테스트 2: @멘션 메시지 → 해당 에이전트 라우팅"

# Backend bot user ID 추출
BACKEND_USER_ID=$(echo "$BRIDGE_LOG" | grep "backend:" | grep -o 'botUserId=[^ ,]*' | cut -d= -f2)
if [ -z "$BACKEND_USER_ID" ]; then
  fail "Backend bot user ID를 찾을 수 없음"
  TESTS=$((TESTS + 1))
else
  MENTION_TEXT="[bridge-test] <@$BACKEND_USER_ID> API 설계 검토해줘"
  curl -s -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer $SLACK_BOT_TOKEN_PM" \
    -H "Content-Type: application/json" \
    -d "{\"channel\":\"$CHANNEL_ID\",\"text\":\"$MENTION_TEXT\"}" > /dev/null

  sleep 5

  BACKEND_COUNT=$(ls "$EVENTS_DIR/backend/" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$BACKEND_COUNT" -eq 1 ]; then
    pass "backend 디렉토리에 정확히 1개 파일 생성"
  else
    fail "backend 파일 수: $BACKEND_COUNT (기대: 1)"
  fi
  TESTS=$((TESTS + 1))

  # 멘션 파싱 확인
  if [ "$BACKEND_COUNT" -ge 1 ]; then
    BACKEND_FILE=$(ls "$EVENTS_DIR/backend/" | head -1)
    MENTIONS=$(python3 -c "import json; d=json.load(open('$EVENTS_DIR/backend/$BACKEND_FILE')); print(d['mentions'])")
    if echo "$MENTIONS" | grep -q "backend"; then
      pass "멘션 목록에 'backend' 포함"
    else
      fail "멘션에 backend 없음: $MENTIONS"
    fi
    TESTS=$((TESTS + 1))
  fi

  # triage에 중복 생성 안 됐는지 확인 (이전 triage 파일 + 새 것 없어야)
  TRIAGE_COUNT_AFTER=$(ls "$EVENTS_DIR/triage/" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$TRIAGE_COUNT_AFTER" -eq 1 ]; then
    pass "멘션 메시지가 triage에 중복 생성 안 됨"
  else
    fail "triage에 추가 파일 생성됨 (수: $TRIAGE_COUNT_AFTER, 기대: 1)"
  fi
  TESTS=$((TESTS + 1))
fi

# ── 테스트 3: 다중 멘션 → 복수 에이전트 라우팅 ──
echo ""
echo "📝 테스트 3: 다중 멘션 → 복수 에이전트 라우팅"

FRONTEND_USER_ID=$(echo "$BRIDGE_LOG" | grep "frontend:" | grep -o 'botUserId=[^ ,]*' | cut -d= -f2)
if [ -n "$BACKEND_USER_ID" ] && [ -n "$FRONTEND_USER_ID" ]; then
  MULTI_TEXT="[bridge-test] <@$BACKEND_USER_ID> <@$FRONTEND_USER_ID> 공동 작업 요청"
  curl -s -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer $SLACK_BOT_TOKEN_PM" \
    -H "Content-Type: application/json" \
    -d "{\"channel\":\"$CHANNEL_ID\",\"text\":\"$MULTI_TEXT\"}" > /dev/null

  sleep 5

  # backend에 2개 (이전 1 + 새 1)
  BACKEND_TOTAL=$(ls "$EVENTS_DIR/backend/" 2>/dev/null | wc -l | tr -d ' ')
  FRONTEND_TOTAL=$(ls "$EVENTS_DIR/frontend/" 2>/dev/null | wc -l | tr -d ' ')

  if [ "$BACKEND_TOTAL" -eq 2 ]; then
    pass "backend에 누적 2개 파일"
  else
    fail "backend 파일 수: $BACKEND_TOTAL (기대: 2)"
  fi
  TESTS=$((TESTS + 1))

  if [ "$FRONTEND_TOTAL" -eq 1 ]; then
    pass "frontend에 1개 파일 생성"
  else
    fail "frontend 파일 수: $FRONTEND_TOTAL (기대: 1)"
  fi
  TESTS=$((TESTS + 1))
else
  fail "Frontend/Backend user ID를 찾을 수 없음"
  TESTS=$((TESTS + 1))
fi

# ── 테스트 4: 이벤트 파일 구조 검증 ──
echo ""
echo "📝 테스트 4: 이벤트 파일 JSON 구조 검증"

SAMPLE_FILE=$(find "$EVENTS_DIR" -name "*.json" | head -1)
if [ -n "$SAMPLE_FILE" ]; then
  REQUIRED_FIELDS=("type" "channel" "channel_name" "user" "text" "ts" "thread_ts" "mentions" "raw")
  ALL_PRESENT=true
  for field in "${REQUIRED_FIELDS[@]}"; do
    if ! python3 -c "import json; d=json.load(open('$SAMPLE_FILE')); assert '$field' in d" 2>/dev/null; then
      fail "필수 필드 누락: $field"
      ALL_PRESENT=false
    fi
  done
  if [ "$ALL_PRESENT" = true ]; then
    pass "모든 필수 필드 존재 (${#REQUIRED_FIELDS[@]}개)"
  fi
  TESTS=$((TESTS + 1))
else
  fail "이벤트 파일을 찾을 수 없음"
  TESTS=$((TESTS + 1))
fi

# ── 정리 ──
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
rm -rf "$EVENTS_DIR"

if [ "$FAILURES" -eq 0 ]; then
  echo -e "${GREEN}🎉 전체 테스트 통과 ($TESTS/$TESTS)${NC}"
else
  echo -e "${RED}💥 실패: $FAILURES/$TESTS${NC}"
fi

exit "$FAILURES"
