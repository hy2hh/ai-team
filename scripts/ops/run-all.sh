#!/bin/bash
# run-all.sh — ops 스크립트 전체 실행 후 구조화된 결과 출력
# 목적: Chalmers가 raw 출력을 직접 읽지 않고 이 스크립트 결과만 읽도록 설계
#       각 스크립트의 Summary/핵심 지표만 추출 → 오독/miscount 방지
#
# 사용법: bash scripts/ops/run-all.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── 색상 ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
RESET='\033[0m'

pass_count=0
fail_count=0
warn_count=0

# ── 결과 행 출력 ──────────────────────────────────────────────────────────
result() {
  local status="$1"
  local name="$2"
  local summary="$3"
  case "$status" in
    PASS) echo -e "  ${GREEN}✅ PASS${RESET}  ${BOLD}${name}${RESET} — ${summary}"; pass_count=$((pass_count + 1)) ;;
    FAIL) echo -e "  ${RED}❌ FAIL${RESET}  ${BOLD}${name}${RESET} — ${summary}"; fail_count=$((fail_count + 1)) ;;
    WARN) echo -e "  ${YELLOW}⚠️  WARN${RESET}  ${BOLD}${name}${RESET} — ${summary}"; warn_count=$((warn_count + 1)) ;;
  esac
}

# ── grep 헬퍼 (no-match 시 0 반환, set -e 안전) ───────────────────────────
gcount() { grep -c "$1" 2>/dev/null || true; }
gline()  { grep "$@"   2>/dev/null || true; }

echo ""
echo -e "${BOLD}🔍 Ops Harness 전체 검사 — $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
echo "════════════════════════════════════════════════════════"

# ── 1. config-check: .env 필수 변수 ──────────────────────────────────────
out=$(bash "$SCRIPT_DIR/config-check.sh" env 2>&1 || true)
env_pass=$(echo "$out" | gcount "PASS")
env_fail=$(echo "$out" | gcount "FAIL")
if [ "${env_fail}" -eq 0 ]; then
  result PASS "config-check env" "PASS ${env_pass}개"
else
  missing=$(echo "$out" | sed 's/\x1b\[[0-9;]*m//g' | gline "FAIL" | sed 's/.*FAIL[[:space:]]*//' | cut -d' ' -f1 | tr '\n' ', ' | sed 's/, $//')
  result FAIL "config-check env" "PASS ${env_pass} / FAIL ${env_fail} — 누락: ${missing}"
fi

# ── 2. config-check: DB 무결성 ───────────────────────────────────────────
out=$(bash "$SCRIPT_DIR/config-check.sh" db 2>&1 || true)
db_fail=$(echo "$out" | gcount "FAIL")
if [ "${db_fail}" -eq 0 ]; then
  result PASS "config-check db" "memory.db 테이블 정상"
else
  result FAIL "config-check db" "FAIL ${db_fail}개"
fi

# ── 3. memdb: 핵심 테이블 조회 ───────────────────────────────────────────
claims_out=$(bash "$SCRIPT_DIR/memdb.sh" claims 2>&1 || true)
claim_total=$(echo "$claims_out" | grep -v "^status\|^-\|^$" | awk '{sum+=$2} END {print sum+0}' 2>/dev/null || echo "0")
tables_out=$(bash "$SCRIPT_DIR/memdb.sh" tables 2>&1 || true)
table_count=$(echo "$tables_out" | gcount "table")
if [ "${table_count}" -ge 3 ]; then
  result PASS "memdb" "테이블 ${table_count}개 존재, claims 누적 ${claim_total}건"
else
  result FAIL "memdb" "테이블 수 부족 (${table_count}개)"
fi

# ── 4. agent-status: 브리지 + 에이전트 ──────────────────────────────────
out=$(bash "$SCRIPT_DIR/agent-status.sh" 2>&1 || true)
bridge_status=$(echo "$out" | gline "^Status:" | tail -1 | awk '{print $2}')
active_agents=$(echo "$out" | gcount "ACTIVE")
if [ "${bridge_status}" = "UP" ]; then
  result PASS "agent-status" "Bridge UP, 활성 ${active_agents}/7"
elif [ -z "${bridge_status}" ]; then
  result WARN "agent-status" "Bridge 상태 미확인 (브리지 미실행?), 활성 ${active_agents}/7"
else
  missing_agents=$(echo "$out" | gcount "MISSING")
  result WARN "agent-status" "Bridge ${bridge_status}, 활성 ${active_agents}/7 (비활성 ${missing_agents}개는 정상)"
fi

# ── 5. index-rebuild decisions --dry ────────────────────────────────────
out=$(bash "$SCRIPT_DIR/index-rebuild.sh" decisions --dry 2>&1 || true)
rebuilt=$(echo "$out" | gline "^Rebuilt:" | tail -1)
if [ -n "${rebuilt}" ]; then
  result PASS "index-rebuild decisions" "${rebuilt}"
else
  result FAIL "index-rebuild decisions" "Rebuilt 행 없음"
fi

# ── 6. bridge-log errors ────────────────────────────────────────────────
out=$(bash "$SCRIPT_DIR/bridge-log.sh" errors 2>&1 || true)
error_lines=$(echo "$out" | gline "^---" | grep -oE '[0-9]+' | head -1 || echo "0")
if [ "${error_lines:-0}" -eq 0 ]; then
  result PASS "bridge-log errors" "errors 0건"
else
  result WARN "bridge-log errors" "${error_lines}건 — 확인 필요"
fi

# ── 7. spec-validator check-all ─────────────────────────────────────────
out=$(bash "$SCRIPT_DIR/spec-validator.sh" check-all 2>&1 || true)
spec_pass=$(echo "$out" | gcount "Result: PASS")
spec_fail=$(echo "$out" | gcount "Result: FAIL")
spec_total=$((spec_pass + spec_fail))
if [ "${spec_fail}" -eq 0 ]; then
  result PASS "spec-validator" "${spec_pass}/${spec_total} PASS"
else
  # FAIL 난 파일명만 추출
  failed_names=$(echo "$out" | gline "Failed files:" -A 20 | gline "^\s*- " | sed 's/.*- //' | tr '\n' ', ' | sed 's/, $//')
  result FAIL "spec-validator" "${spec_pass}/${spec_total} PASS, FAIL ${spec_fail}개 — ${failed_names}"
fi

# ── 8. validate-memory ──────────────────────────────────────────────────
out=$(bash "$SCRIPT_DIR/validate-memory.sh" 2>&1 || true)
# Summary 줄을 직접 읽어서 보고 (miscount 방지)
summary=$(echo "$out" | gline "^Summary:" | tail -1)
if [ -n "${summary}" ]; then
  stale=$(echo "${summary}" | grep -oE '[0-9]+(?= stale)' 2>/dev/null || echo "0")
  deprecated=$(echo "${summary}" | grep -oE '[0-9]+(?= deprecated)' 2>/dev/null || echo "0")
  if [ "${stale:-0}" -eq 0 ] && [ "${deprecated:-0}" -eq 0 ]; then
    result PASS "validate-memory" "${summary}"
  else
    result WARN "validate-memory" "${summary}"
  fi
else
  result FAIL "validate-memory" "Summary 출력 없음"
fi

# ── 9. task-lifecycle list (전 역할) ────────────────────────────────────
total_tasks=0
for role in backend frontend pm designer researcher secops; do
  out=$(bash "$SCRIPT_DIR/task-lifecycle.sh" list "$role" 2>&1 || true)
  count=$(echo "$out" | gcount "^\- \[")
  total_tasks=$((total_tasks + count))
done
result PASS "task-lifecycle" "전 역할 미완료 태스크 합계 ${total_tasks}건"

# ── 10. create-decision --help (실행 가능 여부) ──────────────────────────
if bash "$SCRIPT_DIR/create-decision.sh" --help >/dev/null 2>&1; then
  result PASS "create-decision" "실행 가능"
else
  result FAIL "create-decision" "스크립트 오류"
fi

# ── 11. factcheck incidents.log 존재 여부 ───────────────────────────────
incidents_log="$(dirname "$SCRIPT_DIR")/incidents.log"
if [ -f "${incidents_log}" ]; then
  count=$(wc -l < "${incidents_log}" | tr -d ' ')
  result PASS "factcheck incidents.log" "${count}건 기록됨"
else
  result WARN "factcheck incidents.log" "파일 없음 (watch-bridge.sh 첫 실행 시 생성됨)"
fi

# ── 요약 ─────────────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════"
echo -e "${BOLD}결과 요약${RESET}"
echo -e "  ${GREEN}PASS${RESET}: ${pass_count}"
[ "${warn_count}" -gt 0 ] && echo -e "  ${YELLOW}WARN${RESET}: ${warn_count}"
[ "${fail_count}" -gt 0 ] && echo -e "  ${RED}FAIL${RESET}: ${fail_count}"
echo ""

if [ "${fail_count}" -gt 0 ]; then
  echo -e "${RED}${BOLD}검사 실패 — FAIL ${fail_count}건 수정 필요${RESET}"
  exit 1
elif [ "${warn_count}" -gt 0 ]; then
  echo -e "${YELLOW}${BOLD}경고 있음 — WARN ${warn_count}건 확인 권장${RESET}"
  exit 0
else
  echo -e "${GREEN}${BOLD}전체 이상 없음${RESET}"
  exit 0
fi
