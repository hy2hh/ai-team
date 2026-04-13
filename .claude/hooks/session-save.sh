#!/bin/bash
# session-save.sh — Stop hook: sprint log + context-handoff 자동 갱신
# 세션 종료 시 최근 커밋을 기반으로 sprint current.md에 Tried 항목 삽입,
# context-handoff.md에 활성 태스크 + 마지막 결정 섹션 추가

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
DATE=$(date '+%Y-%m-%d')
TIME=$(date '+%Y-%m-%d %H:%M:%S')
SPRINT_FILE="$PROJECT_DIR/.agent/sprint/current.md"
HANDOFF_FILE="$PROJECT_DIR/.context-handoff.md"

# ── 1. 최근 커밋 수집 (최대 2시간, no-merges) ──────────────────────────────
COMMITS=$(git -C "$PROJECT_DIR" log --since="2 hours ago" --oneline --no-merges 2>/dev/null | head -10)

# 커밋이 없으면 context-handoff만 갱신하고 sprint 삽입은 건너뜀
SKIP_SPRINT=false
if [ -z "$COMMITS" ]; then
  SKIP_SPRINT=true
fi

# ── 2. sprint current.md 삽입 ─────────────────────────────────────────────
if [ "$SKIP_SPRINT" = false ] && [ -f "$SPRINT_FILE" ]; then
  LAST_COMMIT_TITLE=$(echo "$COMMITS" | head -1 | cut -d' ' -f2-)
  LAST_HASH=$(echo "$COMMITS" | head -1 | cut -d' ' -f1)

  # Tried 항목: 커밋 메시지 → bullet list
  TRIED_ITEMS=$(git -C "$PROJECT_DIR" log --since="2 hours ago" --oneline --no-merges --format="- %s" 2>/dev/null | head -10)

  # 오늘 이미 같은 날짜 세션이 있으면 중복 삽입 방지
  if grep -q "^\### \[$DATE\]" "$SPRINT_FILE" 2>/dev/null; then
    SKIP_SPRINT=true
  fi

  if [ "$SKIP_SPRINT" = false ]; then
    SPRINT_BLOCK="### [$DATE] Session: $LAST_COMMIT_TITLE

**Tried:**
$TRIED_ITEMS

**Learned:**
- (이 세션에서 직접 기록된 내용 없음 — 필요 시 수동 보완)

**Commit:** $LAST_HASH

---"

    # 주석 블록(--> 줄) 바로 다음에 새 세션 삽입
    TEMP=$(mktemp)
    SPRINT_BLOCK="$SPRINT_BLOCK" awk '
      /-->$/ && !inserted {
        print $0
        print ""
        print ENVIRON["SPRINT_BLOCK"]
        print ""
        inserted = 1
        next
      }
      { print }
    ' "$SPRINT_FILE" > "$TEMP" && mv "$TEMP" "$SPRINT_FILE"
  fi
fi

# ── 3. context-handoff.md 갱신 ────────────────────────────────────────────
CHANGED_FILES=$(git -C "$PROJECT_DIR" diff --name-only HEAD 2>/dev/null | head -20 || echo "")
STAGED_FILES=$(git -C "$PROJECT_DIR" diff --name-only --cached 2>/dev/null | head -10 || echo "")
RECENT_COMMITS=$(git -C "$PROJECT_DIR" log --oneline -5 2>/dev/null || echo "")
BRANCH=$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo "unknown")

# 활성 태스크: active-*.md 파일에서 첫 번째 todo 항목 추출
ACTIVE_TASKS=""
for f in "$PROJECT_DIR/.memory/tasks/active-"*.md; do
  [ -f "$f" ] || continue
  ROLE=$(basename "$f" | sed 's/active-//;s/\.md//')
  FIRST_TASK=$(grep -m1 "^- \[" "$f" 2>/dev/null || grep -m1 "^- " "$f" 2>/dev/null || echo "")
  if [ -n "$FIRST_TASK" ]; then
    ACTIVE_TASKS="${ACTIVE_TASKS}
- [${ROLE}] ${FIRST_TASK}"
  fi
done

# 마지막 결정: _index.md 마지막 데이터 행
LAST_DECISION=$(grep "^| [0-9]" "$PROJECT_DIR/.memory/decisions/_index.md" 2>/dev/null | tail -1 \
  | awk -F'|' '{
      gsub(/^ +| +$/, "", $2); gsub(/^ +| +$/, "", $6);
      print $2 " — " $6
    }' || echo "")

# ── 4. Learned 섹션 placeholder 경고 ─────────────────────────────────────────
if [ -f "$SPRINT_FILE" ]; then
  if grep -q "직접 기록된 내용 없음" "$SPRINT_FILE" 2>/dev/null; then
    echo '[session-save] ⚠️  sprint/current.md Learned 섹션이 placeholder입니다. 비자명한 발견이 있었다면 지금 기록하세요.' >&2
  fi
fi

cat > "$HANDOFF_FILE" << HANDOFF
# Context Handoff (Auto-saved on session exit)
> 저장 시각: $TIME
> 자동 저장 (Stop hook)
> 프로젝트: $PROJECT_DIR

## 최근 변경 파일
$CHANGED_FILES

## 스테이징된 파일
$STAGED_FILES

## 최근 커밋
$RECENT_COMMITS

## 현재 브랜치
$BRANCH

## 활성 태스크 (주요)
$ACTIVE_TASKS

## 마지막 결정
$LAST_DECISION
HANDOFF
