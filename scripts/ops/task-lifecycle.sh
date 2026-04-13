#!/usr/bin/env bash
# task-lifecycle.sh — 태스크 상태 전이 표준화
# Usage: bash scripts/ops/task-lifecycle.sh <command> [args]
#
# Commands:
#   add <role> "description" [priority]   active-{role}.md에 태스크 추가
#   done <role> "description"             active-{role}.md에서 done.md로 이동
#   list <role>                           active-{role}.md의 미완료 태스크 목록
#   list-all                              전체 role의 미완료 태스크 목록
#   audit                                 완료 표시([x])인데 active에 남아있는 항목 탐지
#   help                                  사용법 출력

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
TASKS_DIR="${ROOT}/.memory/tasks"
TODAY="$(date +%Y-%m-%d)"

VALID_ROLES=("pm" "designer" "frontend" "backend" "researcher" "secops" "triage")

# ── Helpers ──────────────────────────────────────────────────────────────

validate_role() {
  local role="$1"
  for valid in "${VALID_ROLES[@]}"; do
    if [[ "${role}" == "${valid}" ]]; then
      return 0
    fi
  done
  echo "Error: invalid role '${role}'"
  echo "Valid roles: ${VALID_ROLES[*]}"
  exit 1
}

active_file() {
  echo "${TASKS_DIR}/active-${1}.md"
}

normalize_priority() {
  local p="${1:-medium}"
  echo "${p}" | tr '[:lower:]' '[:upper:]'
}

# ── Commands ─────────────────────────────────────────────────────────────

cmd_add() {
  if [[ $# -lt 2 ]]; then
    echo "Usage: task-lifecycle.sh add <role> \"description\" [priority]"
    exit 1
  fi

  local role="$1"
  local desc="$2"
  local priority
  priority="$(normalize_priority "${3:-medium}")"
  validate_role "${role}"

  local file
  file="$(active_file "${role}")"

  if [[ ! -f "${file}" ]]; then
    echo "Error: file not found: ${file}"
    exit 1
  fi

  # Duplicate check — match description substring in uncompleted tasks
  if grep -qF -- "${desc}" "${file}" 2>/dev/null; then
    echo "Error: duplicate task found in ${file}:"
    grep -F -- "${desc}" "${file}"
    exit 1
  fi

  # Append task line
  echo "- [ ] ${desc} | ${TODAY} | ${priority}" >> "${file}"
  echo "Added to active-${role}.md: ${desc} (priority: ${priority})"
}

cmd_done() {
  if [[ $# -lt 2 ]]; then
    echo "Usage: task-lifecycle.sh done <role> \"description\""
    exit 1
  fi

  local role="$1"
  local desc="$2"
  validate_role "${role}"

  local file
  file="$(active_file "${role}")"
  local done_file="${TASKS_DIR}/done.md"

  if [[ ! -f "${file}" ]]; then
    echo "Error: file not found: ${file}"
    exit 1
  fi

  # Find matching uncompleted task line
  local match
  match="$(grep -n -- "\- \[ \].*${desc}" "${file}" || true)"

  if [[ -z "${match}" ]]; then
    echo "Error: no uncompleted task matching '${desc}' in active-${role}.md"
    exit 1
  fi

  local match_count
  match_count="$(echo "${match}" | wc -l | tr -d ' ')"
  if [[ "${match_count}" -gt 1 ]]; then
    echo "Error: multiple tasks match '${desc}':"
    echo "${match}"
    echo "Please use a more specific description."
    exit 1
  fi

  local line_num
  line_num="$(echo "${match}" | cut -d: -f1)"
  local task_line
  task_line="$(echo "${match}" | cut -d: -f2-)"
  # Trim leading space
  task_line="$(echo "${task_line}" | sed 's/^[[:space:]]*//')"

  # Extract just the description part (before first |)
  local task_desc
  task_desc="$(echo "${task_line}" | sed 's/^- \[ \] //' | sed 's/ |.*//')"

  # Remove the line from active file (and any immediate sub-items)
  local temp_file="${file}.tmp"
  awk -v ln="${line_num}" '
    BEGIN { skip = 0 }
    NR == ln { skip = 1; next }
    skip == 1 && /^[[:space:]]+- / { next }
    { skip = 0; print }
  ' "${file}" > "${temp_file}"
  mv "${temp_file}" "${file}"

  # Build done entry
  local done_entry="- [x] ${task_desc} (role: ${role}, done: ${TODAY})"

  # Append to done.md under today's date section using awk for reliable insertion
  local done_tmp="${done_file}.tmp"

  if grep -q "^## ${TODAY}" "${done_file}" 2>/dev/null; then
    # Today's section exists — append entry after the header line
    awk -v header="## ${TODAY}" -v entry="${done_entry}" '
      $0 == header { print; print entry; next }
      { print }
    ' "${done_file}" > "${done_tmp}"
    mv "${done_tmp}" "${done_file}"
  elif grep -q "^## " "${done_file}" 2>/dev/null; then
    # No today section — insert new date section before the first ## line
    awk -v header="## ${TODAY}" -v entry="${done_entry}" '
      !inserted && /^## / { print ""; print header; print entry; print ""; inserted=1 }
      { print }
    ' "${done_file}" > "${done_tmp}"
    mv "${done_tmp}" "${done_file}"
  else
    # No sections exist at all — append at end
    printf "\n## %s\n%s\n" "${TODAY}" "${done_entry}" >> "${done_file}"
  fi

  echo "Completed: ${task_desc}"
  echo "  Removed from: active-${role}.md"
  echo "  Archived to:  done.md (${TODAY})"
}

cmd_list() {
  if [[ $# -lt 1 ]]; then
    echo "Usage: task-lifecycle.sh list <role>"
    exit 1
  fi

  local role="$1"
  validate_role "${role}"

  local file
  file="$(active_file "${role}")"

  if [[ ! -f "${file}" ]]; then
    echo "No task file for role: ${role}"
    exit 1
  fi

  local tasks
  tasks="$(grep -- '- \[ \]' "${file}" | grep -v '<!--' || true)"

  if [[ -z "${tasks}" ]]; then
    echo "[${role}] (no active tasks)"
  else
    echo "[${role}]"
    echo "${tasks}"
  fi
}

cmd_list_all() {
  local found=0
  for role in "${VALID_ROLES[@]}"; do
    local file
    file="$(active_file "${role}")"
    if [[ ! -f "${file}" ]]; then
      continue
    fi

    local tasks
    tasks="$(grep -- '- \[ \]' "${file}" | grep -v '<!--' || true)"

    if [[ -n "${tasks}" ]]; then
      if [[ ${found} -gt 0 ]]; then
        echo ""
      fi
      echo "[${role}]"
      echo "${tasks}"
      found=$((found + 1))
    fi
  done

  if [[ ${found} -eq 0 ]]; then
    echo "(no active tasks across all roles)"
  fi
}

cmd_audit() {
  local found=0

  for file in "${TASKS_DIR}"/active-*.md; do
    if [[ ! -f "${file}" ]]; then
      continue
    fi

    local stale
    stale="$(grep -- '- \[x\]' "${file}" || true)"

    if [[ -n "${stale}" ]]; then
      local basename
      basename="$(basename "${file}")"
      echo "[AUDIT] ${basename} — completed tasks still in active file:"
      echo "${stale}"
      echo ""
      found=$((found + 1))
    fi
  done

  if [[ ${found} -eq 0 ]]; then
    echo "[AUDIT] Clean — no completed tasks lingering in active files."
  else
    echo "[AUDIT] Found ${found} file(s) with completed tasks that should be moved to done.md"
  fi
}

cmd_help() {
  cat <<'HELP'
task-lifecycle.sh — 태스크 상태 전이 표준화

Usage: bash scripts/ops/task-lifecycle.sh <command> [args]

Commands:
  add <role> "description" [priority]
    active-{role}.md에 태스크 추가
    priority: HIGH / MEDIUM / LOW (기본: MEDIUM)

  done <role> "description"
    active-{role}.md에서 태스크를 완료 처리하고 done.md로 이동
    description은 부분 매칭 (substring match)

  list <role>
    active-{role}.md의 미완료 태스크 목록

  list-all
    전체 role의 미완료 태스크 목록 (role별 그룹)

  audit
    완료 표시([x])인데 active에 남아있는 항목 탐지

  help
    이 사용법 출력

Valid roles: pm, designer, frontend, backend, researcher, secops, triage
HELP
}

# ── Main dispatch ────────────────────────────────────────────────────────

if [[ $# -lt 1 ]]; then
  cmd_help
  exit 1
fi

COMMAND="$1"
shift

case "${COMMAND}" in
  add)      cmd_add "$@" ;;
  done)     cmd_done "$@" ;;
  list)     cmd_list "$@" ;;
  list-all) cmd_list_all ;;
  audit)    cmd_audit ;;
  help)     cmd_help ;;
  *)
    echo "Error: unknown command '${COMMAND}'"
    cmd_help
    exit 1
    ;;
esac
