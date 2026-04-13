#!/usr/bin/env bash
# spec-validator.sh — Feature Spec 구조 및 완전성 검증
# Usage: bash scripts/ops/spec-validator.sh <command> [args]
#
# Commands:
#   validate <file>    단일 spec 파일 검증
#   check-all          docs/specs/*.md 전체 검증
#   missing-ac         AC 섹션 없는 spec 목록
#   report             전체 커버리지 리포트
#   help               사용법 출력

set -euo pipefail

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# --- Project root ---
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo -e "${RED}ERROR: git repository not found${RESET}" >&2
  exit 1
}
SPECS_DIR="${ROOT}/docs/specs"

# --- Valid status values (from README + template + actual usage) ---
VALID_STATUSES="draft|review|approved|accepted|implemented|archived|deprecated"

# --- Utility functions ---

# Extract YAML frontmatter content (between first pair of ---)
extract_frontmatter() {
  local file="$1"
  local in_frontmatter=0
  local line_num=0
  local fm_start=-1
  local fm_end=-1

  while IFS= read -r line; do
    line_num=$((line_num + 1))
    if [[ "$line" == "---" ]]; then
      if [[ $in_frontmatter -eq 0 && $fm_start -eq -1 ]]; then
        fm_start=$line_num
        in_frontmatter=1
      elif [[ $in_frontmatter -eq 1 ]]; then
        fm_end=$line_num
        break
      fi
    fi
  done < "$file"

  if [[ $fm_start -gt 0 && $fm_end -gt 0 ]]; then
    sed -n "$((fm_start + 1)),$((fm_end - 1))p" "$file"
    return 0
  fi
  return 1
}

# Get a frontmatter field value
get_field() {
  local frontmatter="$1"
  local field="$2"
  echo "$frontmatter" | grep -E "^${field}:" | sed "s/^${field}:[[:space:]]*//" | sed 's/^["'"'"']//;s/["'"'"']$//'
}

# Check if file has a matching H2 section
has_section() {
  local file="$1"
  shift
  # Each remaining argument is a regex pattern for an H2 heading
  for pattern in "$@"; do
    if grep -qiE "^## ${pattern}" "$file"; then
      return 0
    fi
  done
  return 1
}

# --- Core validation ---

# Validate a single spec file. Returns 0 if all checks pass, 1 otherwise.
# Output: field-by-field PASS/FAIL
validate_file() {
  local file="$1"
  local quiet="${2:-false}"
  local errors=0

  local basename
  basename="$(basename "$file")"

  if [[ "$quiet" != "true" ]]; then
    echo -e "\n${BOLD}${CYAN}=== Validating: ${basename} ===${RESET}"
  fi

  # --- 1. Frontmatter existence ---
  local frontmatter
  if frontmatter="$(extract_frontmatter "$file")"; then
    if [[ "$quiet" != "true" ]]; then
      echo -e "  Frontmatter:     ${GREEN}PASS${RESET}"
    fi
  else
    if [[ "$quiet" != "true" ]]; then
      echo -e "  Frontmatter:     ${RED}FAIL${RESET} — YAML frontmatter (--- markers) not found"
    fi
    errors=$((errors + 1))
    # Without frontmatter, skip field checks but continue section checks
    frontmatter=""
  fi

  # --- 2. Required frontmatter fields ---
  local required_fields=("date" "topic" "roles" "summary" "status")
  for field in "${required_fields[@]}"; do
    local value
    value="$(get_field "$frontmatter" "$field")"
    if [[ -n "$value" ]]; then
      # Extra validation for status field
      if [[ "$field" == "status" ]]; then
        if echo "$value" | grep -qiE "^(${VALID_STATUSES})$"; then
          if [[ "$quiet" != "true" ]]; then
            echo -e "  Field [${field}]:    ${GREEN}PASS${RESET} — ${value}"
          fi
        else
          if [[ "$quiet" != "true" ]]; then
            echo -e "  Field [${field}]:    ${RED}FAIL${RESET} — invalid value '${value}' (expected: ${VALID_STATUSES})"
          fi
          errors=$((errors + 1))
        fi
      else
        if [[ "$quiet" != "true" ]]; then
          echo -e "  Field [${field}]:   ${GREEN}PASS${RESET}"
        fi
      fi
    else
      if [[ -n "$frontmatter" ]]; then
        if [[ "$quiet" != "true" ]]; then
          echo -e "  Field [${field}]:   ${RED}FAIL${RESET} — missing"
        fi
        errors=$((errors + 1))
      fi
    fi
  done

  # --- 3. Required sections ---
  # Background section: 배경, 배경 & 문제, 배경 & 목표, Background, 문제
  if has_section "$file" "배경" "Background" "문제"; then
    if [[ "$quiet" != "true" ]]; then
      echo -e "  Section [배경]:   ${GREEN}PASS${RESET}"
    fi
  else
    if [[ "$quiet" != "true" ]]; then
      echo -e "  Section [배경]:   ${RED}FAIL${RESET} — missing (expected: 배경/Background/문제)"
    fi
    errors=$((errors + 1))
  fi

  # AC section: Acceptance Criteria, 인수 조건, AC, 완료 조건
  if has_section "$file" "Acceptance Criteria" "인수 조건" "AC$" "완료 조건"; then
    if [[ "$quiet" != "true" ]]; then
      echo -e "  Section [AC]:     ${GREEN}PASS${RESET}"
    fi
  else
    if [[ "$quiet" != "true" ]]; then
      echo -e "  Section [AC]:     ${RED}FAIL${RESET} — missing (expected: Acceptance Criteria/인수 조건/AC/완료 조건)"
    fi
    errors=$((errors + 1))
  fi

  # Scope section (recommended, warn only): 구현 범위, Scope, 스코프
  if has_section "$file" "구현 범위" "Scope" "스코프"; then
    if [[ "$quiet" != "true" ]]; then
      echo -e "  Section [Scope]:  ${GREEN}PASS${RESET}"
    fi
  else
    if [[ "$quiet" != "true" ]]; then
      echo -e "  Section [Scope]:  ${YELLOW}WARN${RESET} — missing (recommended: 구현 범위/Scope/스코프)"
    fi
    # Scope is recommended but not required, so no error increment
  fi

  if [[ "$quiet" != "true" ]]; then
    if [[ $errors -eq 0 ]]; then
      echo -e "  ${BOLD}${GREEN}Result: PASS${RESET}"
    else
      echo -e "  ${BOLD}${RED}Result: FAIL (${errors} issue(s))${RESET}"
    fi
  fi

  return $errors
}

# --- Commands ---

cmd_validate() {
  if [[ $# -lt 1 ]]; then
    echo -e "${RED}ERROR: validate requires a file path${RESET}" >&2
    echo "Usage: $0 validate <file>" >&2
    exit 1
  fi

  local file="$1"
  # Resolve relative paths from specs dir
  if [[ ! -f "$file" && -f "${SPECS_DIR}/${file}" ]]; then
    file="${SPECS_DIR}/${file}"
  fi

  if [[ ! -f "$file" ]]; then
    echo -e "${RED}ERROR: file not found: ${file}${RESET}" >&2
    exit 1
  fi

  validate_file "$file"
  local rc=$?
  exit $rc
}

cmd_check_all() {
  if [[ ! -d "$SPECS_DIR" ]]; then
    echo -e "${RED}ERROR: specs directory not found: ${SPECS_DIR}${RESET}" >&2
    exit 1
  fi

  local total=0
  local passed=0
  local failed=0
  local failed_files=()

  echo -e "${BOLD}${CYAN}Feature Spec Validation — check-all${RESET}"
  echo -e "Directory: ${SPECS_DIR}\n"

  for file in "${SPECS_DIR}"/*.md; do
    [[ ! -f "$file" ]] && continue
    local basename
    basename="$(basename "$file")"
    # Skip README.md
    [[ "$basename" == "README.md" ]] && continue

    total=$((total + 1))
    if validate_file "$file"; then
      passed=$((passed + 1))
    else
      failed=$((failed + 1))
      failed_files+=("$basename")
    fi
  done

  echo -e "\n${BOLD}━━━ Summary ━━━${RESET}"
  echo -e "  Total:   ${total}"
  echo -e "  Passed:  ${GREEN}${passed}${RESET}"
  echo -e "  Failed:  ${RED}${failed}${RESET}"

  if [[ ${#failed_files[@]} -gt 0 ]]; then
    echo -e "\n  ${RED}Failed files:${RESET}"
    for f in "${failed_files[@]}"; do
      echo -e "    - ${f}"
    done
  fi

  if [[ $failed -gt 0 ]]; then
    exit 1
  fi
}

cmd_missing_ac() {
  if [[ ! -d "$SPECS_DIR" ]]; then
    echo -e "${RED}ERROR: specs directory not found: ${SPECS_DIR}${RESET}" >&2
    exit 1
  fi

  echo -e "${BOLD}${CYAN}Specs missing AC section${RESET}\n"

  local count=0
  local found=0

  for file in "${SPECS_DIR}"/*.md; do
    [[ ! -f "$file" ]] && continue
    local basename
    basename="$(basename "$file")"
    [[ "$basename" == "README.md" ]] && continue

    count=$((count + 1))

    if ! has_section "$file" "Acceptance Criteria" "인수 조건" "AC$" "완료 조건"; then
      echo -e "  ${RED}MISSING${RESET}  ${basename}"
      found=$((found + 1))
    fi
  done

  echo ""
  if [[ $found -eq 0 ]]; then
    echo -e "${GREEN}All ${count} specs have AC sections.${RESET}"
  else
    echo -e "${YELLOW}${found}/${count} specs are missing AC sections.${RESET}"
  fi
}

cmd_report() {
  if [[ ! -d "$SPECS_DIR" ]]; then
    echo -e "${RED}ERROR: specs directory not found: ${SPECS_DIR}${RESET}" >&2
    exit 1
  fi

  echo -e "${BOLD}${CYAN}Feature Spec Coverage Report${RESET}"
  echo -e "Directory: ${SPECS_DIR}"
  echo -e "Generated: $(date '+%Y-%m-%d %H:%M:%S')\n"

  # Table header
  printf "  ${BOLD}%-45s %-12s %-8s %-8s %-12s${RESET}\n" "FILENAME" "FRONTMATTER" "AC" "SCOPE" "STATUS"
  printf "  %-45s %-12s %-8s %-8s %-12s\n" "$(printf '%.0s-' {1..45})" "$(printf '%.0s-' {1..12})" "$(printf '%.0s-' {1..8})" "$(printf '%.0s-' {1..8})" "$(printf '%.0s-' {1..12})"

  local total=0
  local complete=0

  for file in "${SPECS_DIR}"/*.md; do
    [[ ! -f "$file" ]] && continue
    local basename
    basename="$(basename "$file")"
    [[ "$basename" == "README.md" ]] && continue

    total=$((total + 1))

    # Check frontmatter
    local has_fm="NO"
    local status_val="-"
    local frontmatter
    if frontmatter="$(extract_frontmatter "$file")"; then
      # Check all required fields exist
      local all_fields=1
      for field in date topic roles summary status; do
        local val
        val="$(get_field "$frontmatter" "$field")"
        if [[ -z "$val" ]]; then
          all_fields=0
          break
        fi
      done
      if [[ $all_fields -eq 1 ]]; then
        has_fm="YES"
      else
        has_fm="PARTIAL"
      fi
      status_val="$(get_field "$frontmatter" "status")"
      if [[ -z "$status_val" ]]; then
        status_val="-"
      fi
    fi

    # Check AC section
    local has_ac="NO"
    if has_section "$file" "Acceptance Criteria" "인수 조건" "AC$" "완료 조건"; then
      has_ac="YES"
    fi

    # Check Scope section
    local has_scope="NO"
    if has_section "$file" "구현 범위" "Scope" "스코프"; then
      has_scope="YES"
    fi

    # Truncate filename for display
    local display_name="$basename"
    if [[ ${#display_name} -gt 44 ]]; then
      display_name="${display_name:0:41}..."
    fi

    # Color coding
    local fm_color="${RED}"
    if [[ "$has_fm" == "YES" ]]; then
      fm_color="${GREEN}"
    elif [[ "$has_fm" == "PARTIAL" ]]; then
      fm_color="${YELLOW}"
    fi

    local ac_color="${RED}"
    if [[ "$has_ac" == "YES" ]]; then
      ac_color="${GREEN}"
    fi

    local scope_color="${RED}"
    if [[ "$has_scope" == "YES" ]]; then
      scope_color="${GREEN}"
    fi

    printf "  %-45s ${fm_color}%-12s${RESET} ${ac_color}%-8s${RESET} ${scope_color}%-8s${RESET} %-12s\n" \
      "$display_name" "$has_fm" "$has_ac" "$has_scope" "$status_val"

    # Count complete (has frontmatter + AC)
    if [[ "$has_fm" == "YES" && "$has_ac" == "YES" ]]; then
      complete=$((complete + 1))
    fi
  done

  echo ""
  if [[ $total -gt 0 ]]; then
    local pct=$((complete * 100 / total))
    local pct_color="${RED}"
    if [[ $pct -ge 80 ]]; then
      pct_color="${GREEN}"
    elif [[ $pct -ge 50 ]]; then
      pct_color="${YELLOW}"
    fi
    echo -e "${BOLD}━━━ Overall ━━━${RESET}"
    echo -e "  Total specs:       ${total}"
    echo -e "  Fully compliant:   ${complete}"
    echo -e "  Completeness:      ${pct_color}${pct}%${RESET}"
  else
    echo -e "${YELLOW}No spec files found.${RESET}"
  fi
}

cmd_help() {
  echo -e "${BOLD}spec-validator.sh${RESET} — Feature Spec 구조 및 완전성 검증\n"
  echo "Usage: $0 <command> [args]"
  echo ""
  echo "Commands:"
  echo "  validate <file>    단일 spec 파일 검증 (필드별 PASS/FAIL)"
  echo "  check-all          docs/specs/*.md 전체 검증 (README.md 제외)"
  echo "  missing-ac         AC 섹션 없는 spec 목록"
  echo "  report             전체 커버리지 리포트 (테이블 형식)"
  echo "  help               이 사용법 출력"
  echo ""
  echo "Required frontmatter fields: date, topic, roles, summary, status"
  echo "Valid status values: ${VALID_STATUSES}"
  echo ""
  echo "Required sections:"
  echo "  - 배경/Background/문제"
  echo "  - Acceptance Criteria/인수 조건/AC/완료 조건"
  echo ""
  echo "Recommended sections:"
  echo "  - 구현 범위/Scope/스코프"
}

# --- Main ---
command="${1:-help}"
shift || true

case "$command" in
  validate)   cmd_validate "$@" ;;
  check-all)  cmd_check_all ;;
  missing-ac) cmd_missing_ac ;;
  report)     cmd_report ;;
  help|--help|-h) cmd_help ;;
  *)
    echo -e "${RED}ERROR: unknown command '${command}'${RESET}" >&2
    cmd_help >&2
    exit 1
    ;;
esac
