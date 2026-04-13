#!/usr/bin/env bash
# routing-smoke.sh -- Bridge restart 후 라우팅 스모크 테스트
# Usage: bash scripts/ops/routing-smoke.sh <command>
#
# Commands:
#   quick              7개 에이전트 @mention 각 1건 -> 응답 확인
#   triage             mention 없는 메시지 3건 -> triage 라우팅 확인
#   full               quick + triage
#   help               사용법 출력

set -euo pipefail

# ── 프로젝트 루트 & 환경변수 ──────────────────────────────────
ROOT="$(git rev-parse --show-toplevel)"

if [[ ! -f "$ROOT/.env" ]]; then
  echo "ERROR: .env 파일이 없습니다 ($ROOT/.env)" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$ROOT/.env"

if [[ -z "${SLACK_USER_TOKEN:-}" ]]; then
  echo "ERROR: SLACK_USER_TOKEN이 .env에 설정되지 않았습니다" >&2
  exit 1
fi

# ── 상수 ──────────────────────────────────────────────────────
CHANNEL="C0ANKEB4CRF"
POLL_INTERVAL=10
POLL_TIMEOUT=120
SEND_INTERVAL=5

# Agent 정보: NAME USER_ID BOT_ID
# User ID = Slack mention 형식 (<@USER_ID>)
# Bot ID = conversations.replies에서 bot_id 필드 매칭
AGENTS=(
  "PM|U0AN037TU6P|B0AMR1CRC79"
  "Designer|U0ANKD0C7RP|B0AN33BNWHK"
  "Frontend|U0AP0SH3QRE|B0AN4GU6A8N"
  "Backend|U0AMR4WQMC7|B0ANKFERR0R"
  "Researcher|U0ANA5X427N|B0ANKFAS725"
  "SecOps|U0AP0RT4CUQ|B0AN4G42NCE"
  "QA|U0APJTWBNMC|B0AP5GRNC79"
)

# 테스트 질문 (에이전트별로 간단한 질문)
QUESTIONS=(
  "현재 스프린트 상태를 간단히 알려줘"
  "디자인 시스템 현황 확인"
  "프론트엔드 컴포넌트 상태 확인"
  "백엔드 API 상태 확인"
  "최근 리서치 주제 확인"
  "보안 점검 현황 확인"
  "QA 테스트 현황 확인"
)

# Triage 테스트 메시지 (mention 없음 -- triage agent가 라우팅해야 함)
TRIAGE_MESSAGES=(
  "데이터베이스 쿼리 성능이 느려진 것 같아. 확인 부탁해"
  "메인 페이지 디자인 개선 아이디어 있어?"
  "다음 릴리스 일정은 어떻게 되지?"
)

# ── 타임스탬프 ────────────────────────────────────────────────
NOW="$(date '+%Y%m%d-%H%M%S')"

# ── 유틸리티 함수 ─────────────────────────────────────────────

# Slack API로 메시지 전송, ts(타임스탬프) 반환
# $1: 메시지 텍스트
send_message() {
  local text="$1"
  local payload
  payload=$(python3 -c "
import json, sys
print(json.dumps({'channel': '$CHANNEL', 'text': sys.argv[1]}))
" "$text")

  local response
  response=$(curl -s -X POST \
    -H "Authorization: Bearer $SLACK_USER_TOKEN" \
    -H "Content-Type: application/json" \
    "https://slack.com/api/chat.postMessage" \
    -d "$payload")

  local ok
  ok=$(echo "$response" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('ok',''))")

  if [[ "$ok" != "True" ]]; then
    local err
    err=$(echo "$response" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('error','unknown'))")
    echo "SEND_ERROR:$err"
    return 1
  fi

  echo "$response" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('ts',''))"
}

# 스레드에서 특정 bot_id의 응답 확인
# $1: parent ts, $2: bot_id
# 응답이 있으면 해당 메시지의 ts 출력, 없으면 빈 문자열
check_bot_reply() {
  local parent_ts="$1"
  local bot_id="$2"

  local response
  response=$(curl -s \
    -H "Authorization: Bearer $SLACK_USER_TOKEN" \
    "https://slack.com/api/conversations.replies?channel=$CHANNEL&ts=$parent_ts&limit=20")

  echo "$response" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for m in d.get('messages', []):
    if m.get('bot_id') == '$bot_id':
        print(m['ts'])
        sys.exit(0)
print('')
"
}

# 스레드에서 아무 봇이든 응답했는지 확인
# $1: parent ts
# 응답이 있으면 "BOT_ID|ts" 출력, 없으면 빈 문자열
check_any_bot_reply() {
  local parent_ts="$1"

  local response
  response=$(curl -s \
    -H "Authorization: Bearer $SLACK_USER_TOKEN" \
    "https://slack.com/api/conversations.replies?channel=$CHANNEL&ts=$parent_ts&limit=20")

  echo "$response" | python3 -c "
import sys, json
d = json.load(sys.stdin)
msgs = d.get('messages', [])
# 첫 번째 메시지는 원본이므로 skip
for m in msgs[1:]:
    bid = m.get('bot_id', '')
    if bid:
        print(f'{bid}|{m[\"ts\"]}')
        sys.exit(0)
print('')
"
}

# bot_id로 에이전트 이름 역조회
bot_id_to_name() {
  local bid="$1"
  for entry in "${AGENTS[@]}"; do
    IFS='|' read -r name _uid bot_id <<< "$entry"
    if [[ "$bot_id" == "$bid" ]]; then
      echo "$name"
      return
    fi
  done
  echo "Unknown($bid)"
}

# 경과 시간 계산 (초)
elapsed_since() {
  local start="$1"
  local now
  now=$(date +%s)
  echo $(( now - start ))
}

# ── quick 테스트 ──────────────────────────────────────────────
run_quick() {
  echo "=== QUICK SMOKE TEST ($NOW) ==="
  echo "7개 에이전트 @mention 테스트 시작..."
  echo ""

  # 전송 단계
  declare -a message_ts=()
  local idx=0

  for entry in "${AGENTS[@]}"; do
    IFS='|' read -r name user_id bot_id <<< "$entry"
    local question="${QUESTIONS[$idx]}"
    local text=":test_tube: [SMOKE-$((idx + 1))] <@${user_id}> ${question}"

    echo "  전송 [$((idx + 1))/7] $name: $question"
    local ts
    ts=$(send_message "$text")

    if [[ "$ts" == SEND_ERROR:* ]]; then
      echo "    ERROR: 전송 실패 (${ts})" >&2
      message_ts+=("ERROR")
    else
      message_ts+=("$ts")
      echo "    ts=$ts"
    fi

    idx=$((idx + 1))

    # 마지막이 아니면 간격 대기
    if (( idx < ${#AGENTS[@]} )); then
      echo "    (${SEND_INTERVAL}초 대기...)"
      sleep "$SEND_INTERVAL"
    fi
  done

  echo ""
  echo "전송 완료. 응답 대기 시작 (최대 ${POLL_TIMEOUT}초, ${POLL_INTERVAL}초 간격 폴링)..."
  echo ""

  # 폴링 단계
  local start_time
  start_time=$(date +%s)

  # 결과 배열: "PASS|초" 또는 "FAIL" 또는 "SKIP"
  declare -a results=()
  declare -a responded=()
  for (( i=0; i<${#AGENTS[@]}; i++ )); do
    results+=("PENDING")
    responded+=("no")
  done

  while true; do
    local all_done="yes"
    local elapsed
    elapsed=$(elapsed_since "$start_time")

    for (( i=0; i<${#AGENTS[@]}; i++ )); do
      # 이미 응답 확인된 건 skip
      if [[ "${responded[$i]}" == "yes" ]]; then
        continue
      fi

      # 전송 실패한 건 skip
      if [[ "${message_ts[$i]}" == "ERROR" ]]; then
        results[$i]="SKIP"
        responded[$i]="yes"
        continue
      fi

      IFS='|' read -r name user_id bot_id <<< "${AGENTS[$i]}"
      local reply_ts
      reply_ts=$(check_bot_reply "${message_ts[$i]}" "$bot_id")

      if [[ -n "$reply_ts" ]]; then
        results[$i]="PASS|${elapsed}"
        responded[$i]="yes"
        echo "  [${elapsed}s] $name: PASS"
      else
        all_done="no"
      fi
    done

    if [[ "$all_done" == "yes" ]]; then
      break
    fi

    if (( elapsed >= POLL_TIMEOUT )); then
      # 타임아웃 -- 미응답 건 FAIL 처리
      for (( i=0; i<${#AGENTS[@]}; i++ )); do
        if [[ "${responded[$i]}" != "yes" ]]; then
          results[$i]="FAIL"
          IFS='|' read -r name _uid _bid <<< "${AGENTS[$i]}"
          echo "  [TIMEOUT] $name: FAIL"
        fi
      done
      break
    fi

    sleep "$POLL_INTERVAL"
  done

  echo ""

  # 결과 요약 반환용 전역 변수에 저장
  QUICK_RESULTS=("${results[@]}")
}

# ── triage 테스트 ─────────────────────────────────────────────
run_triage() {
  echo "=== TRIAGE ROUTING TEST ($NOW) ==="
  echo "3건 triage 라우팅 테스트 시작..."
  echo ""

  declare -a triage_ts=()
  local idx=0

  for msg in "${TRIAGE_MESSAGES[@]}"; do
    local text=":test_tube: [TRIAGE-$((idx + 1))] ${msg}"

    echo "  전송 [$((idx + 1))/3]: ${msg:0:50}..."
    local ts
    ts=$(send_message "$text")

    if [[ "$ts" == SEND_ERROR:* ]]; then
      echo "    ERROR: 전송 실패 (${ts})" >&2
      triage_ts+=("ERROR")
    else
      triage_ts+=("$ts")
      echo "    ts=$ts"
    fi

    idx=$((idx + 1))

    if (( idx < ${#TRIAGE_MESSAGES[@]} )); then
      echo "    (${SEND_INTERVAL}초 대기...)"
      sleep "$SEND_INTERVAL"
    fi
  done

  echo ""
  echo "전송 완료. 응답 대기 시작 (최대 ${POLL_TIMEOUT}초, ${POLL_INTERVAL}초 간격 폴링)..."
  echo ""

  local start_time
  start_time=$(date +%s)

  declare -a triage_results=()
  declare -a triage_responded=()
  declare -a triage_routed_to=()
  for (( i=0; i<${#TRIAGE_MESSAGES[@]}; i++ )); do
    triage_results+=("PENDING")
    triage_responded+=("no")
    triage_routed_to+=("")
  done

  while true; do
    local all_done="yes"
    local elapsed
    elapsed=$(elapsed_since "$start_time")

    for (( i=0; i<${#TRIAGE_MESSAGES[@]}; i++ )); do
      if [[ "${triage_responded[$i]}" == "yes" ]]; then
        continue
      fi

      if [[ "${triage_ts[$i]}" == "ERROR" ]]; then
        triage_results[$i]="SKIP"
        triage_responded[$i]="yes"
        continue
      fi

      local reply_info
      reply_info=$(check_any_bot_reply "${triage_ts[$i]}")

      if [[ -n "$reply_info" ]]; then
        local reply_bot_id
        reply_bot_id=$(echo "$reply_info" | cut -d'|' -f1)
        local routed_name
        routed_name=$(bot_id_to_name "$reply_bot_id")

        triage_results[$i]="PASS|${elapsed}"
        triage_responded[$i]="yes"
        triage_routed_to[$i]="$routed_name"
        echo "  [${elapsed}s] Triage #$((i + 1)): PASS (routed to $routed_name)"
      else
        all_done="no"
      fi
    done

    if [[ "$all_done" == "yes" ]]; then
      break
    fi

    if (( elapsed >= POLL_TIMEOUT )); then
      for (( i=0; i<${#TRIAGE_MESSAGES[@]}; i++ )); do
        if [[ "${triage_responded[$i]}" != "yes" ]]; then
          triage_results[$i]="FAIL"
          echo "  [TIMEOUT] Triage #$((i + 1)): FAIL"
        fi
      done
      break
    fi

    sleep "$POLL_INTERVAL"
  done

  echo ""

  TRIAGE_RESULTS=("${triage_results[@]}")
  TRIAGE_ROUTED=("${triage_routed_to[@]}")
}

# ── 요약 출력 ─────────────────────────────────────────────────
print_summary() {
  local has_quick="${1:-no}"
  local has_triage="${2:-no}"

  echo "============================================"
  echo "SMOKE TEST RESULTS"
  echo "============================================"

  local total=0
  local passed=0

  if [[ "$has_quick" == "yes" ]]; then
    for (( i=0; i<${#AGENTS[@]}; i++ )); do
      IFS='|' read -r name _uid _bid <<< "${AGENTS[$i]}"
      local result="${QUICK_RESULTS[$i]}"
      total=$((total + 1))

      # 이름을 고정폭으로 패딩
      local padded_name
      padded_name=$(printf "%-12s" "$name:")

      if [[ "$result" == PASS* ]]; then
        local secs
        secs=$(echo "$result" | cut -d'|' -f2)
        echo "  $padded_name PASS (responded in ${secs}s)"
        passed=$((passed + 1))
      elif [[ "$result" == "SKIP" ]]; then
        echo "  $padded_name SKIP (send failed)"
      elif [[ "$result" == "FAIL" ]]; then
        echo "  $padded_name FAIL (no response)"
      else
        echo "  $padded_name $result"
      fi
    done
  fi

  if [[ "$has_triage" == "yes" ]]; then
    for (( i=0; i<${#TRIAGE_MESSAGES[@]}; i++ )); do
      local result="${TRIAGE_RESULTS[$i]}"
      total=$((total + 1))

      local label
      label=$(printf "%-12s" "Triage #$((i + 1)):")

      if [[ "$result" == PASS* ]]; then
        local secs
        secs=$(echo "$result" | cut -d'|' -f2)
        local routed="${TRIAGE_ROUTED[$i]:-unknown}"
        echo "  $label PASS (routed to $routed, ${secs}s)"
        passed=$((passed + 1))
      elif [[ "$result" == "SKIP" ]]; then
        echo "  $label SKIP (send failed)"
      elif [[ "$result" == "FAIL" ]]; then
        echo "  $label FAIL (no response)"
      else
        echo "  $label $result"
      fi
    done
  fi

  echo ""
  echo "Result: $passed/$total PASS"
  echo "============================================"

  if (( passed < total )); then
    return 1
  fi
  return 0
}

# ── 도움말 ────────────────────────────────────────────────────
print_help() {
  cat <<'HELP'
routing-smoke.sh -- Bridge restart 후 라우팅 스모크 테스트

Usage: bash scripts/ops/routing-smoke.sh <command>

Commands:
  quick    7개 에이전트 @mention 각 1건 전송 -> 응답 확인
  triage   mention 없는 메시지 3건 전송 -> triage 라우팅 확인
  full     quick + triage (전체 테스트)
  help     이 도움말 출력

Details:
  - 메시지는 5초 간격으로 전송 (bridge batch debounce 방지)
  - 전송 후 최대 120초간 10초 간격으로 응답 폴링
  - 각 에이전트 응답은 bot_id로 정확히 매칭
  - 결과: 전체 PASS면 exit 0, 하나라도 FAIL이면 exit 1

Environment:
  SLACK_USER_TOKEN  .env에서 로드 (xoxp-* 형식)

Examples:
  bash scripts/ops/routing-smoke.sh quick     # 에이전트 응답만 빠르게 확인
  bash scripts/ops/routing-smoke.sh full      # 전체 스모크 테스트
HELP
}

# ── 메인 ──────────────────────────────────────────────────────
QUICK_RESULTS=()
TRIAGE_RESULTS=()
TRIAGE_ROUTED=()

cmd="${1:-help}"

case "$cmd" in
  quick)
    run_quick
    print_summary "yes" "no"
    ;;
  triage)
    run_triage
    print_summary "no" "yes"
    ;;
  full)
    run_quick
    echo ""
    run_triage
    print_summary "yes" "yes"
    ;;
  help|--help|-h)
    print_help
    ;;
  *)
    echo "ERROR: 알 수 없는 명령: $cmd" >&2
    echo ""
    print_help
    exit 1
    ;;
esac
