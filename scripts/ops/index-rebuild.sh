#!/usr/bin/env bash
# index-rebuild.sh — 인덱스 파일 재구축
# Usage: bash scripts/ops/index-rebuild.sh <command>
#
# Commands:
#   decisions          .memory/decisions/_index.md 재구축
#   decisions --dry    변경 내용만 출력 (파일 수정 안 함)
#   help               사용법 출력

set -euo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
DECISIONS_DIR="${PROJECT_ROOT}/.memory/decisions"

# --- Utility Functions ---

usage() {
  cat <<'USAGE'
index-rebuild.sh — 인덱스 파일 재구축

Usage:
  bash scripts/ops/index-rebuild.sh <command>

Commands:
  decisions          .memory/decisions/_index.md 재구축
  decisions --dry    변경 내용만 출력 (파일 수정 안 함)
  help               사용법 출력
USAGE
}

# Extract a YAML frontmatter field value.
# Usage: extract_fm <field> <file>
# Returns empty string if field not found.
extract_fm() {
  local field="$1" file="$2"
  # Read between --- delimiters, find the field line
  local in_fm=0
  while IFS= read -r line; do
    if [[ "$line" == "---" ]]; then
      if (( in_fm == 0 )); then
        in_fm=1
        continue
      else
        break
      fi
    fi
    if (( in_fm == 1 )); then
      # Match field: value (handles both scalar and array forms)
      if [[ "$line" =~ ^${field}:\ *(.+)$ ]]; then
        local val="${BASH_REMATCH[1]}"
        # Strip surrounding quotes if present
        val="${val#\"}"
        val="${val%\"}"
        val="${val#\'}"
        val="${val%\'}"
        # Clean up array notation [a, b, c] -> a, b
        if [[ "$val" =~ ^\[(.+)\]$ ]]; then
          val="${BASH_REMATCH[1]}"
        fi
        echo "$val"
        return
      fi
    fi
  done < "$file"
  echo ""
}

# Extract metadata from blockquote format (> 유형: xxx, > 참여자: xxx)
# Usage: extract_bq <field_korean> <file>
extract_bq() {
  local field="$1" file="$2"
  local val
  val=$(grep -m1 "^> ${field}:" "$file" 2>/dev/null | sed "s/^> ${field}: *//" || true)
  echo "$val"
}

# Check if file has YAML frontmatter (starts with ---)
has_frontmatter() {
  local file="$1"
  local first_line
  first_line=$(head -1 "$file")
  [[ "$first_line" == "---" ]]
}

# Infer date from filename prefix (YYYY-MM-DD_...)
infer_date() {
  local basename="$1"
  if [[ "$basename" =~ ^([0-9]{4}-[0-9]{2}-[0-9]{2})_ ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo "unknown"
  fi
}

# Infer topic from filename slug
# E.g., 2026-04-04_react-process-and-evaluation-rebalance.md -> react process and evaluation rebalance
infer_topic() {
  local basename="$1"
  local slug
  # Remove date prefix and .md extension
  slug="${basename#[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]_}"
  slug="${slug%.md}"
  # Remove meeting prefix if present (meeting-N_)
  slug=$(echo "$slug" | sed 's/^meeting-[0-9]*_//')
  # Replace hyphens with spaces
  slug="${slug//-/ }"
  echo "$slug"
}

# Parse a single decision file, output tab-separated: date\ttopic\troles\tstatus\tfilename
parse_decision_file() {
  local filepath="$1"
  local filename
  filename=$(basename "$filepath")

  local date="" topic="" roles="" status="" summary=""

  if has_frontmatter "$filepath"; then
    date=$(extract_fm "date" "$filepath")
    topic=$(extract_fm "topic" "$filepath")
    roles=$(extract_fm "roles" "$filepath")
    status=$(extract_fm "status" "$filepath")
    summary=$(extract_fm "summary" "$filepath")
  else
    # Try blockquote format
    local bq_type bq_participants bq_date_str
    bq_type=$(extract_bq "유형" "$filepath")
    bq_participants=$(extract_bq "참여자" "$filepath")
    bq_date_str=$(extract_bq "일시" "$filepath")

    if [[ -n "$bq_type" ]]; then
      topic="$bq_type"
    fi
    if [[ -n "$bq_participants" ]]; then
      roles="$bq_participants"
    fi
    if [[ -n "$bq_date_str" ]]; then
      # Extract YYYY-MM-DD from ISO date string
      if [[ "$bq_date_str" =~ ^([0-9]{4}-[0-9]{2}-[0-9]{2}) ]]; then
        date="${BASH_REMATCH[1]}"
      fi
    fi
    # Try to get summary from first H1 heading
    summary=$(grep -m1 "^# " "$filepath" 2>/dev/null | sed 's/^# //' || true)
    # Status not typically in blockquote format
    status=""
  fi

  # Fallback: infer from filename
  [[ -z "$date" ]] && date=$(infer_date "$filename")
  [[ -z "$topic" ]] && topic=$(infer_topic "$filename")
  [[ -z "$roles" ]] && roles="unknown"
  [[ -z "$status" ]] && status="unknown"
  [[ -z "$summary" ]] && summary=$(infer_topic "$filename")

  # Clean up roles: remove extra spaces around commas
  roles=$(echo "$roles" | sed 's/ *, */,/g')

  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$date" "$topic" "$roles" "$status" "$summary" "$filename"
}

# --- Commands ---

cmd_decisions() {
  local dry_run=0
  if [[ "${1:-}" == "--dry" ]]; then
    dry_run=1
  fi

  local index_file="${DECISIONS_DIR}/_index.md"
  local entries=()
  local archive_entries=()
  local count=0
  local archive_count=0

  # Scan main decisions directory
  for f in "${DECISIONS_DIR}"/20*.md; do
    [[ ! -f "$f" ]] && continue
    local bn
    bn=$(basename "$f")
    # Skip _index.md
    [[ "$bn" == "_index.md" ]] && continue
    entries+=("$(parse_decision_file "$f")")
    count=$((count + 1))
  done

  # Scan archive subdirectories
  if [[ -d "${DECISIONS_DIR}/archive" ]]; then
    while IFS= read -r -d '' f; do
      [[ ! -f "$f" ]] && continue
      local bn
      bn=$(basename "$f")
      # Skip non-date files (e.g., summary.md)
      [[ ! "$bn" =~ ^20[0-9]{2}- ]] && continue
      archive_entries+=("$(parse_decision_file "$f")")
      archive_count=$((archive_count + 1))
    done < <(find "${DECISIONS_DIR}/archive" -name "20*.md" -print0 2>/dev/null)
  fi

  # Sort entries by date descending
  local sorted_entries=()
  if (( ${#entries[@]} > 0 )); then
    while IFS= read -r line; do
      sorted_entries+=("$line")
    done < <(printf '%s\n' "${entries[@]}" | sort -t$'\t' -k1,1r)
  fi

  local sorted_archive=()
  if (( ${#archive_entries[@]} > 0 )); then
    while IFS= read -r line; do
      sorted_archive+=("$line")
    done < <(printf '%s\n' "${archive_entries[@]}" | sort -t$'\t' -k1,1r)
  fi

  # Group main entries by YYYY-MM
  local current_month=""
  local table_rows=""

  for entry in "${sorted_entries[@]}"; do
    IFS=$'\t' read -r date topic roles status summary filename <<< "$entry"
    local month="${date%%-[0-9][0-9]}"
    month="${date:0:7}" # YYYY-MM

    if [[ "$month" != "$current_month" ]]; then
      if [[ -n "$current_month" ]]; then
        table_rows+=$'\n'
      fi
      # Month header (YYYY-MM format -> Korean section header)
      local year="${month:0:4}"
      local mon="${month:5:2}"
      table_rows+="## ${year}-${mon} 결정사항"$'\n'
      table_rows+=$'\n'
      table_rows+="| 날짜 | 토픽 | 참여자 | 상태 | 한줄요약 | 파일 |"$'\n'
      table_rows+="|------|------|--------|------|---------|------|"$'\n'
      current_month="$month"
    fi

    # Format date as MM-DD for display
    local display_date="${date:5}"
    table_rows+="| ${display_date} | ${topic} | ${roles} | ${status} | ${summary} | \`${filename}\` |"$'\n'
  done

  # Build archive section
  local archive_rows=""
  if (( ${#sorted_archive[@]} > 0 )); then
    local current_archive_month=""
    for entry in "${sorted_archive[@]}"; do
      IFS=$'\t' read -r date topic roles status summary filename <<< "$entry"
      local month="${date:0:7}"

      if [[ "$month" != "$current_archive_month" ]]; then
        if [[ -n "$current_archive_month" ]]; then
          archive_rows+=$'\n'
        fi
        local year="${month:0:4}"
        local mon="${month:5:2}"
        archive_rows+="### ${year}-${mon}"$'\n'
        archive_rows+=$'\n'
        archive_rows+="| 날짜 | 토픽 | 참여자 | 상태 | 한줄요약 | 파일 |"$'\n'
        archive_rows+="|------|------|--------|------|---------|------|"$'\n'
        current_archive_month="$month"
      fi

      local display_date="${date:5}"
      archive_rows+="| ${display_date} | ${topic} | ${roles} | ${status} | ${summary} | \`archive/${month}/${filename}\` |"$'\n'
    done
  fi

  # Assemble full index
  local output=""
  output+="# Decisions Index"$'\n'
  output+=$'\n'
  output+="> **에이전트 사용 규칙**: 이 파일만 먼저 스캔. \`roles\` 또는 \`topic\`이 관련 있는 행만 선택해서 해당 파일 Read."$'\n'
  output+="> 전체 파일을 무조건 읽지 말 것."$'\n'
  output+=$'\n'
  output+="${table_rows}"

  if (( archive_count > 0 )); then
    output+=$'\n'
    output+="## Archive"$'\n'
    output+=$'\n'
    output+="${archive_rows}"
  fi

  local total=$((count + archive_count))

  if (( dry_run == 1 )); then
    echo "--- DRY RUN: 다음 내용으로 ${index_file} 을 재구축합니다 ---"
    echo ""
    echo "$output"
    echo "---"
    echo "Rebuilt: ${total} entries (${archive_count} from archive)"
  else
    # Atomic write
    local tmp_file="${index_file}.tmp"
    echo -n "$output" > "$tmp_file"
    mv "$tmp_file" "$index_file"
    echo "Rebuilt: ${total} entries (${archive_count} from archive)"
    echo "Written to: ${index_file}"
  fi
}

# --- Main ---

case "${1:-help}" in
  decisions)
    cmd_decisions "${2:-}"
    ;;
  help|--help|-h)
    usage
    ;;
  *)
    echo "Error: Unknown command '${1}'"
    echo ""
    usage
    exit 1
    ;;
esac
