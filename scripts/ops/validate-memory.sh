#!/usr/bin/env bash
# validate-memory.sh — Memory 파일 참조 유효성 검증
# .memory/ 내 md 파일이 참조하는 파일 경로, 함수명이 실제 코드베이스에
# 존재하는지 검증한다. 오래된(stale) 참조를 찾아 보고.
# 사용법: bash scripts/ops/validate-memory.sh [--fix]

set -euo pipefail

# ─── 설정 ─────────────────────────────────────────────────────
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
MEMORY_DIR="${PROJECT_ROOT}/.memory"
FIX_MODE=false

# 소스 검색 대상 디렉토리 (함수 참조 검증용)
SOURCE_DIRS=(
  "${PROJECT_ROOT}/socket-bridge/src"
  "${PROJECT_ROOT}/.claude/agents"
  "${PROJECT_ROOT}/scripts"
)

# 무시할 함수명 (내장 함수, 일반적인 API)
BUILTIN_FUNCTIONS=(
  "console.log" "console.error" "console.warn" "console.info" "console.debug"
  "Date.now" "Date.parse" "JSON.parse" "JSON.stringify"
  "Math.floor" "Math.ceil" "Math.round" "Math.max" "Math.min" "Math.random"
  "Array.from" "Array.isArray" "Object.keys" "Object.values" "Object.entries"
  "Object.assign" "Object.freeze" "Promise.all" "Promise.resolve" "Promise.reject"
  "setTimeout" "setInterval" "clearTimeout" "clearInterval"
  "parseInt" "parseFloat" "isNaN" "encodeURIComponent" "decodeURIComponent"
  "require" "import" "export" "typeof" "instanceof"
  "String" "Number" "Boolean" "RegExp" "Error" "Map" "Set"
  "process.env" "process.exit" "process.cwd"
  "path.join" "path.resolve" "path.dirname" "path.basename"
  "fs.readFileSync" "fs.writeFileSync" "fs.existsSync"
  "Buffer.from" "URL" "URLSearchParams"
  "describe" "it" "test" "expect" "beforeEach" "afterEach" "beforeAll" "afterAll"
  "React.memo" "React.cache" "React.createElement"
  "useState" "useEffect" "useCallback" "useMemo" "useRef" "useContext"
)

# ─── 인자 처리 ────────────────────────────────────────────────
if [[ "${1:-}" == "--fix" ]]; then
  FIX_MODE=true
fi

# ─── 유틸 함수 ────────────────────────────────────────────────
is_builtin_function() {
  local func_name="$1"
  func_name="${func_name%%(*}"

  for builtin in "${BUILTIN_FUNCTIONS[@]}"; do
    if [[ "$func_name" == "$builtin" ]]; then
      return 0
    fi
  done

  # 한 글자 함수명은 무시
  if [[ ${#func_name} -le 1 ]]; then
    return 0
  fi

  # 숫자로 시작하면 무시
  if [[ "$func_name" =~ ^[0-9] ]]; then
    return 0
  fi

  return 1
}

is_project_function() {
  local func_name="$1"
  func_name="${func_name%%(*}"

  # camelCase 패턴 (소문자 시작, 최소 2글자)
  if [[ "$func_name" =~ ^[a-z][a-zA-Z0-9]+$ ]]; then
    return 0
  fi

  # dot notation (e.g., claimDb.acquire)
  if [[ "$func_name" =~ ^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]+$ ]]; then
    return 0
  fi

  return 1
}

# ─── git ls-files 캐시 ────────────────────────────────────────
TRACKED_FILES=""
load_tracked_files() {
  TRACKED_FILES="$(cd "$PROJECT_ROOT" && git ls-files)"
}

file_exists_in_repo() {
  local filepath="$1"
  if echo "$TRACKED_FILES" | grep -qxF "$filepath"; then
    return 0
  fi
  return 1
}

# ─── 메인 로직 ────────────────────────────────────────────────
echo "Scanning .memory/ files..."
echo ""

load_tracked_files

# 메모리 파일 목록
MEMORY_FILES=()
while IFS= read -r f; do
  MEMORY_FILES+=("$f")
done < <(find "$MEMORY_DIR" -name "*.md" -type f | sort)

TOTAL_FILES=${#MEMORY_FILES[@]}

# 결과 저장 (임시 파일 사용으로 빈 배열 문제 회피)
STALE_REF_FILE="$(mktemp)"
STALE_FUNC_FILE="$(mktemp)"
DEPRECATED_FILE="$(mktemp)"
trap 'rm -f "$STALE_REF_FILE" "$STALE_FUNC_FILE" "$DEPRECATED_FILE"' EXIT

# ─── 1. 파일 경로 참조 검증 ──────────────────────────────────
for memfile in "${MEMORY_FILES[@]}"; do
  relative_memfile="${memfile#"${PROJECT_ROOT}/"}"
  line_num=0

  while IFS= read -r line; do
    line_num=$((line_num + 1))

    # 경로 패턴 추출: 슬래시를 포함하고 확장자가 있는 문자열
    extracted=$(echo "$line" | grep -oE '[a-zA-Z0-9_./-]+/[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+' 2>/dev/null || true)

    if [[ -z "$extracted" ]]; then
      continue
    fi

    while IFS= read -r filepath; do
      if [[ -z "$filepath" ]]; then
        continue
      fi

      # URL 필터 (http://, https://)
      if echo "$line" | grep -qF "http://${filepath}" || echo "$line" | grep -qF "https://${filepath}"; then
        continue
      fi
      if [[ "$filepath" =~ ^https?:// ]]; then
        continue
      fi

      # 일반적인 거짓 양성 필터
      if [[ "$filepath" =~ ^node_modules/ ]]; then
        continue
      fi
      if [[ "$filepath" =~ ^\.git/ ]]; then
        continue
      fi

      # 이미지/외부 리소스 패턴 필터
      if [[ "$filepath" =~ \.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ ]]; then
        continue
      fi

      # npm 패키지 형태 필터 (@scope/package.name)
      if [[ "$filepath" =~ ^@[a-z]+/ ]]; then
        continue
      fi

      # 버전 번호 패턴 필터 (e.g., 1.2/3.4)
      if [[ "$filepath" =~ ^[0-9]+\.[0-9]+/[0-9] ]]; then
        continue
      fi

      # frontmatter 날짜 패턴 무시 (e.g., 2026-04/01.md)
      if [[ "$filepath" =~ ^[0-9]{4}-[0-9]{2} ]]; then
        continue
      fi

      # 마크다운 헤더 앵커 필터 (#L79 등)
      filepath="${filepath%%#*}"
      if [[ -z "$filepath" ]]; then
        continue
      fi

      # .env 환경 파일은 git 추적 대상이 아닐 수 있으므로 스킵
      if [[ "$filepath" =~ ^\.env ]]; then
        continue
      fi

      # placeholder 경로 필터 (예시 경로, 템플릿)
      if [[ "$filepath" =~ (xxx|XXX|example|placeholder|YYYY) ]]; then
        continue
      fi

      # 경로가 프로젝트 관련인지 확인
      is_project_path=false
      if [[ "$filepath" =~ ^(socket-bridge|\.claude|\.memory|scripts|docs|kanban|src|\.agent)/ ]]; then
        is_project_path=true
      fi
      if [[ "$filepath" =~ \.(md|ts|tsx|js|jsx|json|sh|yaml|yml|toml)$ ]]; then
        is_project_path=true
      fi

      if [[ "$is_project_path" == false ]]; then
        continue
      fi

      # 실제 존재 여부 확인
      # 1차: 그대로 검색
      if file_exists_in_repo "$filepath" || [[ -e "${PROJECT_ROOT}/${filepath}" ]]; then
        continue
      fi
      # 2차: memory 파일 내 상대 경로 → .memory/ 접두사 붙여서 검색
      if [[ "$relative_memfile" == .memory/* && ! "$filepath" == .memory/* ]]; then
        memory_prefixed=".memory/${filepath}"
        if file_exists_in_repo "$memory_prefixed" || [[ -e "${PROJECT_ROOT}/${memory_prefixed}" ]]; then
          continue
        fi
        # 3차: 소스 파일의 디렉토리 기준 상대 경로
        memfile_dir="$(dirname "$relative_memfile")"
        dir_relative="${memfile_dir}/${filepath}"
        if file_exists_in_repo "$dir_relative" || [[ -e "${PROJECT_ROOT}/${dir_relative}" ]]; then
          continue
        fi
      fi
      echo "${relative_memfile}:${line_num} → ${filepath} (NOT FOUND)" >> "$STALE_REF_FILE"
    done <<< "$extracted"
  done < "$memfile"
done

# ─── 2. 함수 참조 검증 ───────────────────────────────────────
for memfile in "${MEMORY_FILES[@]}"; do
  relative_memfile="${memfile#"${PROJECT_ROOT}/"}"
  line_num=0

  while IFS= read -r line; do
    line_num=$((line_num + 1))

    # backtick으로 감싸진 함수 호출 패턴: `functionName()` 또는 `functionName(`
    extracted=$(echo "$line" | grep -oE '`[a-zA-Z][a-zA-Z0-9_.]*\(' 2>/dev/null || true)

    if [[ -z "$extracted" ]]; then
      continue
    fi

    while IFS= read -r match; do
      if [[ -z "$match" ]]; then
        continue
      fi

      # backtick 제거, 괄호 정리
      func_ref="${match#\`}"
      func_ref="${func_ref%\(}"

      if [[ -z "$func_ref" ]]; then
        continue
      fi

      # 내장 함수 스킵
      if is_builtin_function "$func_ref"; then
        continue
      fi

      # 프로젝트 함수인지 확인
      if ! is_project_function "$func_ref"; then
        continue
      fi

      # 소스에서 함수 검색
      func_found=false
      func_search="$func_ref"
      if [[ "$func_ref" == *"."* ]]; then
        func_search="${func_ref##*.}"
      fi

      for src_dir in "${SOURCE_DIRS[@]}"; do
        if [[ -d "$src_dir" ]]; then
          if grep -rq "$func_search" "$src_dir" 2>/dev/null; then
            func_found=true
            break
          fi
        fi
      done

      if [[ "$func_found" == false ]]; then
        echo "${relative_memfile}:${line_num} → ${func_ref}() (NOT FOUND in codebase)" >> "$STALE_FUNC_FILE"
      fi
    done <<< "$extracted"
  done < "$memfile"
done

# ─── 3. Deprecated 마커 검출 ─────────────────────────────────
for memfile in "${MEMORY_FILES[@]}"; do
  relative_memfile="${memfile#"${PROJECT_ROOT}/"}"

  matched_lines=$(grep -inE '(deprecated|removed|삭제|폐기)' "$memfile" 2>/dev/null || true)

  if [[ -z "$matched_lines" ]]; then
    continue
  fi

  # 키워드 추출
  keyword_list=""
  if echo "$matched_lines" | grep -iqE 'deprecated'; then
    keyword_list="deprecated"
  fi
  if echo "$matched_lines" | grep -iqE 'removed'; then
    if [[ -n "$keyword_list" ]]; then
      keyword_list="${keyword_list}, removed"
    else
      keyword_list="removed"
    fi
  fi
  if echo "$matched_lines" | grep -qE '삭제'; then
    if [[ -n "$keyword_list" ]]; then
      keyword_list="${keyword_list}, 삭제"
    else
      keyword_list="삭제"
    fi
  fi
  if echo "$matched_lines" | grep -qE '폐기'; then
    if [[ -n "$keyword_list" ]]; then
      keyword_list="${keyword_list}, 폐기"
    else
      keyword_list="폐기"
    fi
  fi

  echo "${relative_memfile} — contains \"${keyword_list}\"" >> "$DEPRECATED_FILE"
done

# ─── 결과 출력 ────────────────────────────────────────────────
stale_ref_count=0
stale_func_count=0
deprecated_count=0

if [[ -s "$STALE_REF_FILE" ]]; then
  stale_ref_count=$(wc -l < "$STALE_REF_FILE" | tr -d ' ')
fi
if [[ -s "$STALE_FUNC_FILE" ]]; then
  stale_func_count=$(wc -l < "$STALE_FUNC_FILE" | tr -d ' ')
fi
if [[ -s "$DEPRECATED_FILE" ]]; then
  deprecated_count=$(wc -l < "$DEPRECATED_FILE" | tr -d ' ')
fi

stale_count=$((stale_ref_count + stale_func_count))

if [[ $stale_count -gt 0 ]]; then
  echo "❌ STALE REFERENCES:"
  if [[ -s "$STALE_REF_FILE" ]]; then
    while IFS= read -r ref; do
      echo "  ${ref}"
    done < "$STALE_REF_FILE"
  fi
  if [[ -s "$STALE_FUNC_FILE" ]]; then
    while IFS= read -r ref; do
      echo "  ${ref}"
    done < "$STALE_FUNC_FILE"
  fi
  echo ""
fi

if [[ $deprecated_count -gt 0 ]]; then
  echo "⚠️  DEPRECATED MARKERS:"
  while IFS= read -r marker; do
    echo "  ${marker}"
  done < "$DEPRECATED_FILE"
  echo ""
fi

if [[ $stale_count -eq 0 && $deprecated_count -eq 0 ]]; then
  echo "✅ No stale references or deprecated markers found."
  echo ""
fi

echo "Summary: ${stale_count} stale refs, ${deprecated_count} deprecated markers, ${TOTAL_FILES} files scanned"

if [[ "$FIX_MODE" == true ]]; then
  echo ""
  echo "Note: --fix flag detected. Auto-fix is not yet implemented."
  echo "      Currently in report-only mode."
fi

# stale 참조가 있으면 exit 1 (CI 연동용)
if [[ $stale_count -gt 0 ]]; then
  exit 1
fi

exit 0
