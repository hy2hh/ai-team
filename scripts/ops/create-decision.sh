#!/usr/bin/env bash
# create-decision.sh -- Decision 파일 자동 생성 + 인덱스 업데이트
# Usage: bash scripts/ops/create-decision.sh "토픽" "status" "role1,role2" ["요약"]
#
# Arguments:
#   $1 -- topic (required)
#   $2 -- status: accepted|superseded|deprecated (required)
#   $3 -- roles: comma-separated (required)
#   $4 -- summary (optional, defaults to topic)
#
# Actions:
#   1. Validate all required args
#   2. Generate slug from topic (alphanumeric + hyphens, max 50 chars)
#   3. Create decision file with YAML frontmatter template
#   4. Append row to _index.md table (create if not exists)
#   5. Print created file path

set -euo pipefail

# ─── Project root ────────────────────────────────────────────
ROOT="$(git rev-parse --show-toplevel)"
DECISIONS_DIR="$ROOT/.memory/decisions"
INDEX_FILE="$DECISIONS_DIR/_index.md"
TODAY="$(date +%Y-%m-%d)"
TODAY_SHORT="$(date +%m-%d)"

# ─── Help ────────────────────────────────────────────────────
show_help() {
  echo "create-decision.sh -- Decision 파일 자동 생성 + 인덱스 업데이트"
  echo ""
  echo "Usage: bash scripts/ops/create-decision.sh \"토픽\" \"status\" \"role1,role2\" [\"요약\"]"
  echo ""
  echo "Arguments:"
  echo "  topic    결정 토픽 제목 (필수)"
  echo "  status   accepted | superseded | deprecated (필수)"
  echo "  roles    참여 role, 쉼표 구분 (필수) 예: pm,backend,frontend"
  echo "  summary  한줄 요약 (선택, 미지정시 topic과 동일)"
  echo ""
  echo "예시:"
  echo "  bash scripts/ops/create-decision.sh \"WebSocket 실시간 알림\" accepted \"frontend,backend\""
  echo "  bash scripts/ops/create-decision.sh \"캐싱 전략\" accepted \"backend\" \"Redis L1 + CDN L2 채택\""
}

# ─── Validation ──────────────────────────────────────────────
if [ $# -eq 0 ] || [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  show_help
  exit 0
fi

if [ $# -lt 3 ]; then
  echo "ERROR: 필수 인자가 부족합니다. (topic, status, roles 필요)" >&2
  echo "" >&2
  show_help >&2
  exit 1
fi

TOPIC="$1"
STATUS="$2"
ROLES="$3"
SUMMARY="${4:-$TOPIC}"

# Status validation
case "$STATUS" in
  accepted|superseded|deprecated) ;;
  *)
    echo "ERROR: 유효하지 않은 status '$STATUS'. accepted|superseded|deprecated 중 선택." >&2
    exit 1
    ;;
esac

# Topic must not be empty
if [ -z "$TOPIC" ]; then
  echo "ERROR: topic이 비어있습니다." >&2
  exit 1
fi

# Roles must not be empty
if [ -z "$ROLES" ]; then
  echo "ERROR: roles가 비어있습니다." >&2
  exit 1
fi

# ─── Slug generation ─────────────────────────────────────────
# Keep alphanumeric, Korean (Hangul), hyphens. Replace spaces with hyphens.
# Remove other special chars. Truncate to 50 chars.
generate_slug() {
  local input="$1"
  local slug

  # Replace spaces/underscores with hyphens
  slug="${input// /-}"
  slug="${slug//_/-}"

  # Remove chars that are not alphanumeric, Korean (via perl), or hyphens
  slug=$(printf '%s' "$slug" | perl -CSD -pe 's/[^\p{Hangul}a-zA-Z0-9\-]//g')

  # Collapse multiple hyphens
  slug=$(printf '%s' "$slug" | sed 's/--*/-/g')

  # Remove leading/trailing hyphens
  slug=$(printf '%s' "$slug" | sed 's/^-//;s/-$//')

  # Truncate to 50 chars (byte-aware for multibyte; use perl for char count)
  slug=$(printf '%s' "$slug" | perl -CSD -pe 's/^(.{50}).*/$1/')

  # Remove trailing hyphen after truncation
  slug=$(printf '%s' "$slug" | sed 's/-$//')

  printf '%s' "$slug"
}

SLUG=$(generate_slug "$TOPIC")

if [ -z "$SLUG" ]; then
  echo "ERROR: topic에서 유효한 slug를 생성할 수 없습니다." >&2
  exit 1
fi

FILENAME="${TODAY}_${SLUG}.md"
FILEPATH="$DECISIONS_DIR/$FILENAME"

# ─── Duplicate check ─────────────────────────────────────────
if [ -f "$FILEPATH" ]; then
  echo "ERROR: 이미 동일한 파일이 존재합니다: $FILEPATH" >&2
  exit 1
fi

# ─── Ensure decisions directory exists ───────────────────────
mkdir -p "$DECISIONS_DIR"

# ─── Format roles as YAML array ─────────────────────────────
# "pm,backend,frontend" -> [pm, backend, frontend]
ROLES_YAML="[$(echo "$ROLES" | sed 's/,/, /g')]"
# "pm,backend,frontend" -> "- pm, backend, frontend"
ROLES_LIST="$(echo "$ROLES" | sed 's/,/, /g')"

# ─── Create decision file (atomic: .tmp then mv) ────────────
TMP_FILE="${FILEPATH}.tmp"

cat > "$TMP_FILE" << DECISION_EOF
---
date: ${TODAY}
topic: "${TOPIC}"
roles: ${ROLES_YAML}
summary: "${SUMMARY}"
status: ${STATUS}
---

# 결정: ${TOPIC}

## 배경
(내용)

## 결정
(내용)

## 참여자
- ${ROLES_LIST}
DECISION_EOF

mv "$TMP_FILE" "$FILEPATH"

# ─── Update _index.md ────────────────────────────────────────
# Truncate filename for display if longer than 40 chars
DISPLAY_FILENAME="$FILENAME"
if [ ${#DISPLAY_FILENAME} -gt 43 ]; then
  # Use perl for proper multibyte truncation
  DISPLAY_FILENAME=$(printf '%s' "$FILENAME" | perl -CSD -pe 's/^(.{40}).*/$1/')
  DISPLAY_FILENAME="${DISPLAY_FILENAME}..."
fi

INDEX_ROW="| ${TODAY_SHORT} | \`${DISPLAY_FILENAME}\` | ${ROLES} | ${SLUG} | ${SUMMARY} |"

if [ ! -f "$INDEX_FILE" ]; then
  # Create _index.md with header
  TMP_INDEX="${INDEX_FILE}.tmp"
  cat > "$TMP_INDEX" << INDEX_EOF
# Decisions Index

> **에이전트 사용 규칙**: 이 파일만 먼저 스캔. \`roles\` 또는 \`topic\`이 관련 있는 행만 선택해서 해당 파일 Read.
> 전체 파일을 무조건 읽지 말 것.

## $(date +%Y-%m) 결정사항

| 날짜 | 파일 | roles | topic | 한줄요약 |
|------|------|-------|-------|---------|
${INDEX_ROW}
INDEX_EOF
  mv "$TMP_INDEX" "$INDEX_FILE"
else
  # Insert row after the last table row in the current month section.
  # Strategy: find the last line starting with "| " and insert after it.
  # This avoids appending to the end of the file past archive sections.
  LAST_TABLE_LINE=$(grep -n '^| ' "$INDEX_FILE" | tail -1 | cut -d: -f1)

  if [ -n "$LAST_TABLE_LINE" ]; then
    # Insert after the last table row using a temp file (atomic)
    TMP_INDEX="${INDEX_FILE}.tmp"
    {
      head -n "$LAST_TABLE_LINE" "$INDEX_FILE"
      echo "$INDEX_ROW"
      tail -n +"$((LAST_TABLE_LINE + 1))" "$INDEX_FILE"
    } > "$TMP_INDEX"
    mv "$TMP_INDEX" "$INDEX_FILE"
  else
    # No table rows found — append to end as fallback
    echo "$INDEX_ROW" >> "$INDEX_FILE"
  fi
fi

# ─── Output ──────────────────────────────────────────────────
echo "$FILEPATH"
