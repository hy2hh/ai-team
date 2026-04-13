#!/usr/bin/env bash
# config-check.sh — 환경 설정 완전성 검증
# Usage: bash scripts/ops/config-check.sh <command>
#
# Commands:
#   env              .env 필수 변수 존재 확인 (.env.example 기준)
#   settings         .claude/settings.json 구조 검증
#   db               .memory/memory.db 존재 + 핵심 테이블 확인
#   all              전체 검증 + 요약
#   help             사용법 출력

set -uo pipefail

# ── Colors ──────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Project root ────────────────────────────────────────────────
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo -e "${RED}FAIL${RESET} git repository root를 찾을 수 없습니다."
  exit 1
}

# ── Counters ────────────────────────────────────────────────────
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() {
  echo -e "  ${GREEN}PASS${RESET}  $1"
  ((PASS_COUNT++))
}

fail() {
  echo -e "  ${RED}FAIL${RESET}  $1"
  ((FAIL_COUNT++))
}

warn() {
  echo -e "  ${YELLOW}WARN${RESET}  $1"
  ((WARN_COUNT++))
}

header() {
  echo ""
  echo -e "${BOLD}[$1]${RESET}"
  echo "──────────────────────────────────────────"
}

# ── env check ───────────────────────────────────────────────────
check_env() {
  header "ENV: .env 필수 변수 검증"

  local env_example="${ROOT}/.env.example"
  local env_file="${ROOT}/.env"

  if [[ ! -f "$env_example" ]]; then
    fail ".env.example 파일이 존재하지 않습니다: ${env_example}"
    return
  fi

  if [[ ! -f "$env_file" ]]; then
    fail ".env 파일이 존재하지 않습니다: ${env_file}"
    return
  fi

  pass ".env.example 존재"
  pass ".env 존재"

  # Extract required variable names from .env.example
  # - Lines with KEY=value (not commented out with #)
  # - Skip blank lines and comment-only lines
  local required_vars=()
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip empty lines, comment-only lines
    if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
      continue
    fi
    # Extract variable name (part before first =)
    local var_name
    var_name="$(echo "$line" | sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p')"
    if [[ -n "$var_name" ]]; then
      required_vars+=("$var_name")
    fi
  done < "$env_example"

  if [[ ${#required_vars[@]} -eq 0 ]]; then
    warn ".env.example에서 필수 변수를 찾을 수 없습니다"
    return
  fi

  echo ""
  echo "  .env.example 기준 필수 변수 ${#required_vars[@]}개 검사:"
  echo ""

  local env_pass=0
  local env_fail=0

  for var in "${required_vars[@]}"; do
    # Check if the variable exists in .env with a non-empty value
    # Match: VAR_NAME=<something non-empty>
    if grep -qE "^${var}=.+" "$env_file" 2>/dev/null; then
      pass "${var}"
      ((env_pass++))
    else
      fail "${var} — 누락 또는 빈 값"
      ((env_fail++))
    fi
  done

  echo ""
  echo "  ENV 결과: ${env_pass} pass / ${env_fail} fail (총 ${#required_vars[@]}개)"
}

# ── settings check ──────────────────────────────────────────────
check_settings() {
  header "SETTINGS: .claude/settings.json 구조 검증"

  local settings_file="${ROOT}/.claude/settings.json"

  if [[ ! -f "$settings_file" ]]; then
    fail "settings.json 파일이 존재하지 않습니다: ${settings_file}"
    return
  fi

  pass "settings.json 존재"

  # Validate JSON
  if ! jq . "$settings_file" > /dev/null 2>&1; then
    fail "settings.json이 유효한 JSON이 아닙니다"
    return
  fi

  pass "유효한 JSON"

  # Check required keys
  if jq -e '.hooks.PreToolUse' "$settings_file" > /dev/null 2>&1; then
    pass "hooks.PreToolUse 섹션 존재"
  else
    fail "hooks.PreToolUse 섹션 누락"
  fi

  if jq -e '.hooks.SessionEnd' "$settings_file" > /dev/null 2>&1; then
    pass "hooks.SessionEnd 섹션 존재"
  else
    fail "hooks.SessionEnd 섹션 누락"
  fi

  if jq -e '.permissions' "$settings_file" > /dev/null 2>&1; then
    pass "permissions 섹션 존재"
  else
    fail "permissions 섹션 누락"
  fi

  # Additional info: hook counts
  local pre_count
  pre_count="$(jq '.hooks.PreToolUse | length' "$settings_file" 2>/dev/null || echo 0)"
  local session_end_count
  session_end_count="$(jq '.hooks.SessionEnd | length' "$settings_file" 2>/dev/null || echo 0)"
  echo ""
  echo "  Hook 수: PreToolUse=${pre_count}, SessionEnd=${session_end_count}"
}

# ── db check ────────────────────────────────────────────────────
check_db() {
  header "DB: .memory/memory.db 존재 + 핵심 테이블 검증"

  local db_file="${ROOT}/.memory/memory.db"

  if [[ ! -f "$db_file" ]]; then
    fail "memory.db 파일이 존재하지 않습니다: ${db_file}"
    return
  fi

  pass "memory.db 존재"

  # Check sqlite3 availability
  if ! command -v sqlite3 &> /dev/null; then
    fail "sqlite3 명령이 설치되어 있지 않습니다"
    return
  fi

  pass "sqlite3 사용 가능"

  # Core tables to check
  local core_tables=("claims" "heartbeats" "schema_version" "meetings")

  # Get actual tables
  local actual_tables
  actual_tables="$(sqlite3 "$db_file" ".tables" 2>/dev/null)" || {
    fail "memory.db를 읽을 수 없습니다 (손상 가능)"
    return
  }

  echo ""
  echo "  핵심 테이블 ${#core_tables[@]}개 검사:"
  echo ""

  for table in "${core_tables[@]}"; do
    if echo "$actual_tables" | grep -qw "$table"; then
      pass "테이블: ${table}"
    else
      fail "테이블 누락: ${table}"
    fi
  done

  # Total table count
  local total_tables
  total_tables="$(sqlite3 "$db_file" "SELECT count(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "?")"
  echo ""
  echo "  전체 테이블 수: ${total_tables}"

  # Integrity check
  local integrity
  integrity="$(sqlite3 "$db_file" "PRAGMA integrity_check;" 2>/dev/null || echo "error")"
  if [[ "$integrity" == "ok" ]]; then
    pass "무결성 검사 (integrity_check): ok"
  else
    fail "무결성 검사 실패: ${integrity}"
  fi
}

# ── summary ─────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${BOLD}[요약]${RESET}"
  echo "══════════════════════════════════════════"
  echo -e "  ${GREEN}PASS${RESET}: ${PASS_COUNT}"
  echo -e "  ${RED}FAIL${RESET}: ${FAIL_COUNT}"
  if [[ $WARN_COUNT -gt 0 ]]; then
    echo -e "  ${YELLOW}WARN${RESET}: ${WARN_COUNT}"
  fi
  echo "══════════════════════════════════════════"

  if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "  ${RED}결과: 검증 실패 — ${FAIL_COUNT}개 항목 수정 필요${RESET}"
    return 1
  else
    echo -e "  ${GREEN}결과: 모든 검증 통과${RESET}"
    return 0
  fi
}

# ── help ────────────────────────────────────────────────────────
show_help() {
  echo "config-check.sh — 환경 설정 완전성 검증"
  echo ""
  echo "Usage: bash scripts/ops/config-check.sh <command>"
  echo ""
  echo "Commands:"
  echo "  env        .env 필수 변수 존재 확인 (.env.example 기준)"
  echo "  settings   .claude/settings.json 구조 검증"
  echo "  db         .memory/memory.db 존재 + 핵심 테이블 확인"
  echo "  all        전체 검증 + 요약"
  echo "  help       이 도움말 출력"
}

# ── main ────────────────────────────────────────────────────────
main() {
  local cmd="${1:-help}"

  case "$cmd" in
    env)
      check_env
      print_summary
      ;;
    settings)
      check_settings
      print_summary
      ;;
    db)
      check_db
      print_summary
      ;;
    all)
      check_env
      check_settings
      check_db
      print_summary
      ;;
    help|--help|-h)
      show_help
      ;;
    *)
      echo -e "${RED}알 수 없는 명령: ${cmd}${RESET}"
      echo ""
      show_help
      exit 1
      ;;
  esac
}

main "$@"
