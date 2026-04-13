#!/bin/bash
# guard-check.sh — PreToolUse Guard Hook
# 회의 #11 결정: 치명(Critical) → deny(exit 2), 높음(High) → ask(warn + exit 0)
# allowlist: 하드코딩 (에이전트 편집 불가), 전 에이전트 동일 규칙
# fail-closed: 파싱 오류 시 deny (exit 2)
# 구조: deny → allowlist → warn (체인 우회 방지를 위해 allowlist는 deny 이후)

# ============================================================
# FAIL-CLOSED: jq/파싱 실패 시 deny
# ============================================================
set -o pipefail

INPUT=$(cat) || { echo "[Guard:DENY] stdin 읽기 실패" >&2; exit 2; }

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty') || {
  echo "[Guard:DENY] jq 파싱 실패 (tool_name)" >&2; exit 2;
}
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // {}') || {
  echo "[Guard:DENY] jq 파싱 실패 (tool_input)" >&2; exit 2;
}

FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty') || {
  echo "[Guard:DENY] jq 파싱 실패 (file_path)" >&2; exit 2;
}
COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command // empty') || {
  echo "[Guard:DENY] jq 파싱 실패 (command)" >&2; exit 2;
}

# ============================================================
# HELPER FUNCTIONS
# ============================================================

deny() {
  local reason="$1"
  echo "[Guard:DENY] $reason" >&2
  exit 2
}

warn() {
  local msg="$1"
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"[Guard:WARN] %s 의도한 작업인지 다시 확인하세요."}}\n' "$msg"
  exit 0
}

# ============================================================
# CRITICAL → deny (exit 2)
# [주의] allowlist보다 먼저 실행 — 체인 우회(ls && rm -rf /) 방지
# ============================================================

if [[ "$TOOL_NAME" == "Bash" ]]; then
  # git force push (--force-with-lease 제외)
  # macOS grep -E는 negative lookahead 미지원 → 두 조건으로 분리
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)git\s+push\s.*(--force\b|-f\b)' && \
     [[ "$COMMAND" != *"--force-with-lease"* ]]; then
    deny "git force push는 원격 히스토리를 파괴합니다. sid에게 명시적 승인을 받으세요."
  fi

  # main/master 브랜치 삭제
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)git\s+branch\s+-D\s+(main|master)\b'; then
    deny "main/master 브랜치 삭제는 금지되어 있습니다."
  fi

  # 루트/홈 전체 삭제
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)rm\s+-rf?\s+(/|~/?)\s*$'; then
    deny "루트/홈 디렉토리 전체 삭제는 차단됩니다."
  fi

  # rm -rf * (와일드카드 전체 삭제) — 통합/분리 플래그 모두 탐지
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)rm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*)\s+\*'; then
    deny "rm -rf * 와일드카드 전체 삭제는 차단됩니다."
  fi

  # rm 플래그 분리 우회: rm -r -f / rm -f -r
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)rm\s+.*-r\s+.*-f|rm\s+.*-f\s+.*-r'; then
    deny "rm 플래그 분리(rm -r -f / rm -f -r)를 통한 강제 삭제는 차단됩니다."
  fi

  # git checkout . (전체 되돌리기)
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)git\s+checkout\s+\.\s*($|;|&&|\|)'; then
    deny "git checkout . 는 모든 로컬 변경을 되돌립니다. 파일을 지정하세요."
  fi

  # git restore . (전체 되돌리기)
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)git\s+restore\s+\.\s*($|;|&&|\|)'; then
    deny "git restore . 는 모든 로컬 변경을 되돌립니다. 파일을 지정하세요."
  fi

  # origin hard reset (로컬 커밋 손실)
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)git\s+reset\s+--hard\s+origin/'; then
    deny "origin으로 hard reset은 로컬 커밋을 잃을 수 있습니다. sid에게 명시적 승인을 받으세요."
  fi

  # --no-verify 커밋 (hook 우회)
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)git\s+commit\s.*--no-verify'; then
    deny "git commit --no-verify는 pre-commit hook을 우회합니다. 금지된 패턴입니다."
  fi

  # DROP TABLE / DROP DATABASE (DB 파괴 — Tier 1)
  if echo "$COMMAND" | grep -qiE '\b(DROP\s+(TABLE|DATABASE))\b'; then
    deny "DROP TABLE/DATABASE는 데이터를 복구할 수 없습니다. 차단됩니다."
  fi

  # TRUNCATE (DB 파괴 — Tier 1)
  if echo "$COMMAND" | grep -qiE '\bTRUNCATE\b'; then
    deny "TRUNCATE는 데이터를 복구할 수 없습니다. 차단됩니다."
  fi

  # FLUSHALL (Redis 전체 삭제 — Tier 1)
  if echo "$COMMAND" | grep -qiE '\bFLUSHALL\b'; then
    deny "FLUSHALL은 Redis 전체 데이터를 삭제합니다. 차단됩니다."
  fi
fi

# .env 직접 수정 및 guard/설정 파일 자기 수정 금지
if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
  if echo "$FILE_PATH" | grep -qE '(^|/)\.env(\.[^e]|$)' 2>/dev/null; then
    deny ".env 파일 직접 수정 금지. .env.example 업데이트 후 sid에게 보고하세요."
  fi
  # [이슈 2 수정] guard 훅 및 Claude 설정 파일 자기 수정 방지
  if echo "$FILE_PATH" | grep -qE '\.claude/(hooks/|settings)' 2>/dev/null; then
    deny "guard 훅 및 Claude 설정 파일 수정은 차단됩니다. sid에게 직접 수정을 요청하세요."
  fi
fi

# ============================================================
# OPS HARNESS 강제 — 직접 호출 차단, scripts/ops/ 사용 유도
# ============================================================

if [[ "$TOOL_NAME" == "Bash" ]]; then
  # sqlite3 .memory 직접 호출 → memdb.sh 사용 강제
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)sqlite3\s+.*\.memory/memory\.db'; then
    deny "sqlite3 직접 호출 금지. bash scripts/ops/memdb.sh <command> 를 사용하세요."
  fi

  # tmux capture-pane 직접 호출 → bridge-log.sh 사용 강제
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)tmux\s+capture-pane\s+-t\s+ai-team-bridge'; then
    deny "tmux capture-pane 직접 호출 금지. bash scripts/ops/bridge-log.sh <command> 를 사용하세요."
  fi
fi

# .memory/decisions/ 직접 Write → create-decision.sh 사용 강제
if [[ "$TOOL_NAME" == "Write" ]]; then
  if echo "$FILE_PATH" | grep -qE '\.memory/decisions/[0-9]{4}-' 2>/dev/null; then
    deny ".memory/decisions/ 직접 생성 금지. bash scripts/ops/create-decision.sh 를 사용하세요."
  fi
fi

# .memory/decisions/_index.md 직접 편집 → index-rebuild.sh 사용 강제
if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
  if echo "$FILE_PATH" | grep -qE '\.memory/decisions/_index\.md' 2>/dev/null; then
    deny "_index.md 직접 편집 금지. bash scripts/ops/index-rebuild.sh decisions 를 사용하세요."
  fi
fi

# .memory/tasks/active-*.md, done.md 직접 Write → task-lifecycle.sh 사용 강제
if [[ "$TOOL_NAME" == "Write" ]]; then
  if echo "$FILE_PATH" | grep -qE '\.memory/tasks/(active-[a-z]+\.md|done\.md)' 2>/dev/null; then
    deny ".memory/tasks/ 직접 생성 금지. bash scripts/ops/task-lifecycle.sh <command> 를 사용하세요."
  fi
fi

# ============================================================
# ALLOWLIST (hardcoded — agents cannot modify)
# [주의] deny 이후에 위치 — allowlist가 deny를 우회하는 것을 방지
# [이슈 1 수정] 체인 명령어(&&, ;, |)는 allowlist 스킵
#   → ls && docker system prune 에서 ls가 allowlist 매칭 후 exit 0 하던 버그 방지
# ============================================================
ALLOWLIST_PATTERNS=(
  "^git (status|log|diff|show|fetch|stash list)\b"
  "^git branch(\s*$|\s+-[avrl])"
  "^(ls|cat|echo|pwd|which|head|tail|wc|find|grep)\b"
  "^(npm (run|test|install|ci|list)|node )"
  "^(curl|wget) .*(localhost|127\.0\.0\.1)"
  # 빌드 아티팩트 삭제 허용
  "^rm -rf (node_modules|dist|\.next|build|coverage|__pycache__|\.turbo)(/?\s*$|$)"
)

if ! echo "$COMMAND" | grep -qE '(&&|;|\|)'; then
  for pattern in "${ALLOWLIST_PATTERNS[@]}"; do
    if echo "$COMMAND" | grep -qE "$pattern"; then
      exit 0
    fi
  done
fi

# ============================================================
# HIGH → ask (hookSpecificOutput 경고, exit 0)
# ============================================================

if [[ "$TOOL_NAME" == "Bash" ]]; then
  # docker system prune
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)docker\s+system\s+prune\b'; then
    warn "docker system prune은 미사용 리소스를 전부 삭제합니다."
  fi

  # kubectl delete namespace
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)kubectl\s+delete\s+namespace\b'; then
    warn "kubectl delete namespace는 네임스페이스 전체를 삭제합니다."
  fi

  # curl ... | ... bash (파이프 실행)
  if echo "$COMMAND" | grep -qE 'curl\s.*\|.*\b(bash|sh)\b'; then
    warn "curl 출력을 bash/sh로 파이프 실행합니다."
  fi

  # wget ... | ... sh (파이프 실행)
  if echo "$COMMAND" | grep -qE 'wget\s.*\|.*\b(bash|sh)\b'; then
    warn "wget 출력을 bash/sh로 파이프 실행합니다."
  fi

  # terraform destroy
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)terraform\s+destroy\b'; then
    warn "terraform destroy는 인프라를 파괴합니다."
  fi

  # main/master 직접 push (force가 아닌 일반 push)
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)git\s+push\b' && echo "$COMMAND" | grep -qE '\b(main|master)\b'; then
    warn "main/master로 직접 push합니다."
  fi

  # git reset --hard (로컬, origin 제외)
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)git\s+reset\s+--hard\b' && ! echo "$COMMAND" | grep -qE 'origin/'; then
    warn "git reset --hard는 로컬 변경사항을 잃을 수 있습니다."
  fi

  # git push --force-with-lease
  if echo "$COMMAND" | grep -qE '(^|\s|&&|\|)git\s+push\s.*--force-with-lease\b'; then
    warn "force-with-lease push입니다. 팀 협업 브랜치에서는 주의하세요."
  fi
fi

exit 0
