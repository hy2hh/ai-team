#!/usr/bin/env bash
# memdb.sh — Memory DB 표준 조회 도구
# 에이전트가 sqlite3 쿼리를 직접 작성할 때 발생하는 오타/실수 방지
# 사용법: bash scripts/ops/memdb.sh <command> [args]

set -euo pipefail

# ─── DB 경로 결정 ─────────────────────────────────────────────────
PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"
DB_PATH="${PROJECT_DIR}/.memory/memory.db"

if [ ! -f "$DB_PATH" ]; then
  echo "오류: DB 파일 없음 — ${DB_PATH}" >&2
  exit 1
fi

# ─── 공통 실행 함수 ───────────────────────────────────────────────
run_query() {
  sqlite3 -header -column "$DB_PATH" "$1"
}

# ─── 명령어 구현 ─────────────────────────────────────────────────

cmd_claims() {
  run_query "SELECT status, COUNT(*) AS count FROM claims GROUP BY status ORDER BY count DESC;"
}

cmd_claims_active() {
  run_query "
    SELECT message_ts, agent, channel, status,
           datetime(created_at / 1000, 'unixepoch', 'localtime') AS created,
           datetime(updated_at / 1000, 'unixepoch', 'localtime') AS updated
    FROM claims
    WHERE status = 'processing'
    ORDER BY created_at DESC;
  "
}

cmd_stale_claims() {
  local minutes="${1:-30}"
  local cutoff_ms=$(( $(date +%s) * 1000 - minutes * 60 * 1000 ))
  run_query "
    SELECT message_ts, agent, channel,
           datetime(created_at / 1000, 'unixepoch', 'localtime') AS created,
           ROUND(($(date +%s) * 1000 - updated_at) / 60000.0, 1) AS stale_min
    FROM claims
    WHERE status = 'processing'
      AND updated_at < ${cutoff_ms}
    ORDER BY updated_at ASC;
  "
}

cmd_heartbeats() {
  local now_ms=$(( $(date +%s) * 1000 ))
  run_query "
    SELECT role, status, current_task, pid, agent_version,
           datetime(last_seen / 1000, 'unixepoch', 'localtime') AS last_seen_local,
           ROUND((${now_ms} - last_seen) / 60000.0, 1) AS age_min
    FROM heartbeats
    ORDER BY last_seen DESC;
  "
}

cmd_schema() {
  run_query "SELECT version, applied_at FROM schema_version ORDER BY version DESC;"
}

cmd_meetings() {
  local limit="${1:-5}"
  run_query "
    SELECT id, type, topic, status, initiator,
           datetime(created_at / 1000, 'unixepoch', 'localtime') AS created,
           CASE WHEN resolved_at IS NOT NULL
                THEN datetime(resolved_at / 1000, 'unixepoch', 'localtime')
                ELSE '-'
           END AS resolved
    FROM meetings
    ORDER BY created_at DESC
    LIMIT ${limit};
  "
}

cmd_tables() {
  run_query "
    SELECT name, type
    FROM sqlite_master
    WHERE type IN ('table', 'view')
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name;
  "
}

cmd_query() {
  if [ -z "${1:-}" ]; then
    echo "오류: SQL 쿼리를 인자로 전달하세요" >&2
    echo "  예: bash scripts/ops/memdb.sh query \"SELECT * FROM heartbeats\"" >&2
    exit 1
  fi
  # 주의: read-only 보장 아님 — 조회 전용으로 사용할 것
  run_query "$1"
}

cmd_help() {
  cat <<'HELP'
memdb.sh — Memory DB 표준 조회 도구
사용법: bash scripts/ops/memdb.sh <command> [args]

Commands:
  claims              claims 상태별 카운트
  claims-active       현재 active(processing) claim 목록
  stale-claims [min]  N분 이상 고착된 claim (기본 30)
  heartbeats          전체 heartbeat 현황 (age 포함)
  schema              schema_version 조회
  meetings [N]        최근 N개 회의 (기본 5)
  tables              전체 테이블 목록
  query "SQL"         커스텀 SQL 실행 (조회 전용 권장)
  help                이 도움말 출력

예시:
  bash scripts/ops/memdb.sh claims
  bash scripts/ops/memdb.sh stale-claims 60
  bash scripts/ops/memdb.sh meetings 10
  bash scripts/ops/memdb.sh query "SELECT COUNT(*) FROM task_queue WHERE status='running'"
HELP
}

# ─── 라우팅 ───────────────────────────────────────────────────────
if [ $# -eq 0 ]; then
  cmd_help
  exit 1
fi

COMMAND="$1"
shift

case "$COMMAND" in
  claims)        cmd_claims ;;
  claims-active) cmd_claims_active ;;
  stale-claims)  cmd_stale_claims "$@" ;;
  heartbeats)    cmd_heartbeats ;;
  schema)        cmd_schema ;;
  meetings)      cmd_meetings "$@" ;;
  tables)        cmd_tables ;;
  query)         cmd_query "$@" ;;
  help|--help|-h) cmd_help ;;
  *)
    echo "알 수 없는 명령: ${COMMAND}" >&2
    cmd_help
    exit 1
    ;;
esac
