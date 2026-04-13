#!/usr/bin/env bash
# bridge-log.sh — Bridge 로그 표준 조회 도구
# 에이전트별로 다른 tmux capture-pane 명령 사용을 방지하고
# 일관된 로그 조회 인터페이스를 제공한다.
# 사용법: bash scripts/ops/bridge-log.sh <command> [args]

set -euo pipefail

BRIDGE_SESSION="ai-team-bridge"
CAPTURE_LINES=5000

# ─── tmux 세션 확인 ───────────────────────────────────────────
ensure_session() {
  if ! tmux has-session -t "$BRIDGE_SESSION" 2>/dev/null; then
    echo "ERROR: tmux 세션 '$BRIDGE_SESSION' 이 존재하지 않습니다." >&2
    exit 1
  fi
}

# ─── 로그 캡처 (전체 베이스) ──────────────────────────────────
capture_log() {
  tmux capture-pane -t "$BRIDGE_SESSION" -p -S -"$CAPTURE_LINES" 2>/dev/null
}

# ─── 결과 출력 + 라인 카운트 footer ──────────────────────────
print_with_count() {
  local lines
  lines=$(cat)
  if [ -z "$lines" ]; then
    echo "(일치하는 로그 없음)"
    echo "--- 0 lines ---"
  else
    echo "$lines"
    local count
    count=$(echo "$lines" | wc -l | tr -d ' ')
    echo "--- ${count} lines ---"
  fi
}

# ─── grep 필터 (매치 0건이어도 pipefail 방지) ────────────────
filter_log() {
  # grep은 매치 없으면 exit 1 → set -eo pipefail에서 스크립트 종료됨
  # || true로 안전하게 처리
  local pattern="$1"
  shift
  ensure_session
  capture_log | { grep "$@" "$pattern" || true; } | print_with_count
}

# ─── 명령별 구현 ─────────────────────────────────────────────
cmd_route() {
  filter_log '\[route\]'
}

cmd_perf() {
  filter_log '\[perf\]'
}

cmd_meeting() {
  filter_log '\[meeting\]'
}

cmd_errors() {
  filter_log '(Error|FATAL|TypeError|ReferenceError)' -E
}

cmd_connections() {
  filter_log '연결 완료'
}

cmd_tail() {
  local n="${1:-50}"
  ensure_session
  capture_log | tail -"$n" | print_with_count
}

cmd_search() {
  if [ -z "${1:-}" ]; then
    echo "ERROR: 검색 패턴을 지정해주세요." >&2
    echo "사용법: bridge-log.sh search \"pattern\"" >&2
    exit 1
  fi
  filter_log "$1"
}

cmd_full() {
  ensure_session
  capture_log | print_with_count
}

cmd_help() {
  echo "bridge-log.sh — Bridge 로그 표준 조회 도구"
  echo ""
  echo "사용법: bash scripts/ops/bridge-log.sh <command> [args]"
  echo ""
  echo "Commands:"
  echo "  route              [route] 라우팅 로그만 출력"
  echo "  perf               [perf] 성능 로그만 출력"
  echo "  meeting            [meeting] 회의 로그만 출력"
  echo "  errors             Error/FATAL/TypeError 등 에러만 출력"
  echo "  connections        연결 상태 로그만 출력"
  echo "  tail [N]           최근 N줄 (기본 50)"
  echo "  search \"pattern\"   커스텀 grep 패턴"
  echo "  full               전체 로그 (최근 ${CAPTURE_LINES}줄)"
  echo "  help               이 도움말 출력"
  echo ""
  echo "예시:"
  echo "  bash scripts/ops/bridge-log.sh route"
  echo "  bash scripts/ops/bridge-log.sh tail 100"
  echo "  bash scripts/ops/bridge-log.sh search \"timeout\""
  echo "  bash scripts/ops/bridge-log.sh errors"
}

# ─── 메인 ─────────────────────────────────────────────────────
if [ $# -eq 0 ]; then
  cmd_help
  exit 0
fi

COMMAND="$1"
shift

case "$COMMAND" in
  route)       cmd_route ;;
  perf)        cmd_perf ;;
  meeting)     cmd_meeting ;;
  errors)      cmd_errors ;;
  connections) cmd_connections ;;
  tail)        cmd_tail "$@" ;;
  search)      cmd_search "$@" ;;
  full)        cmd_full ;;
  help)        cmd_help ;;
  *)           echo "알 수 없는 명령: $COMMAND" >&2; cmd_help; exit 1 ;;
esac
