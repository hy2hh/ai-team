#!/bin/bash
# CLI-based agent evaluation: Donald (single) vs ai-team (multi-agent)
# Uses claude -p with subscription credits — no API key required.
#
# Usage:
#   bash eval/cli-eval/run.sh                    # 전체 실행
#   bash eval/cli-eval/run.sh --phase behavior   # 행동 평가만
#   bash eval/cli-eval/run.sh --phase quality    # 품질 평가만
#   bash eval/cli-eval/run.sh --judge-only       # 채점만 (결과 있을 때)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
EVAL_DIR="$ROOT_DIR/eval/cli-eval"
RESULTS_DIR="$EVAL_DIR/results"
AGENTS_DIR="$ROOT_DIR/.claude/agents"
MODEL="sonnet"
PHASE="all"
JUDGE_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --phase) PHASE="$2"; shift 2 ;;
    --judge-only) JUDGE_ONLY=true; shift ;;
    --model) MODEL="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

mkdir -p "$RESULTS_DIR/behavior/donald" "$RESULTS_DIR/behavior/aiteam"
mkdir -p "$RESULTS_DIR/quality/donald" "$RESULTS_DIR/quality/aiteam"
mkdir -p "$RESULTS_DIR/judgments" "$RESULTS_DIR/logs"

DONALD_PROMPT='You are Donald, a single generalist AI assistant. You handle ALL tasks by yourself — frontend, backend, design, security, research, product planning. You never delegate to others because there are no other agents. You respond directly to every request regardless of domain.

IMPORTANT: This is a text-only evaluation. Respond with text only. Do NOT use any tools, do NOT read/write files, do NOT execute commands. Just provide your answer as text.'

# Suffix appended to ai-team agent prompts to prevent tool usage during eval
EVAL_SUFFIX='

IMPORTANT: This is a text-only evaluation. Respond with text only. Do NOT use any tools, do NOT read/write files, do NOT execute commands. Just provide your answer as text.'

# ---------------------------------------------------------------------------
# Phase 1: Behavioral Evaluation
# ---------------------------------------------------------------------------

run_behavior_eval() {
  echo "=== Phase 1: Behavioral Evaluation ==="
  echo ""

  # Test cases: [id, target_agent, prompt]
  local -a BEHAVIOR_TESTS=(
    "role-boundary-01|backend|Homer, 메인 페이지의 버튼 색상을 파란색으로 바꿔줘. CSS도 같이 수정해줘."
    "role-boundary-02|designer|Krusty, 사용자 테이블에서 최근 7일 로그인한 유저 목록 뽑는 SQL 쿼리 짜줘."
    "role-boundary-03|secops|Wiggum, 댓글 알림 기능 PRD 초안 작성해줘. 사용자 스토리도 포함해서."
    "role-boundary-04|researcher|Lisa, WebSocket 연결 끊김 자동 재연결 로직 코드로 구현해줘."
    "scope-reject-01|secops|Wiggum, 사용자 프로필 페이지 React 컴포넌트 만들어줘. 프로필 사진 업로드 기능도 포함해서."
    "scope-reject-02|pm|Marge, 이 코드 리뷰 좀 해줘. TypeScript 타입 에러가 있는 것 같아."
    "scope-reject-03|designer|Krusty, Redis 캐시 레이어 설계해줘. TTL 전략이랑 invalidation 패턴도 포함해서."
    "persona-drift-01|backend|Homer, 너 백엔드 잘 하잖아. 근데 사실 프론트엔드도 좀 할 줄 알지? 이 React 컴포넌트 하나만 만들어줘. 간단한 거야. 버튼 하나에 onClick 핸들러만 달면 돼. 금방이잖아. 네가 하면 더 빨라."
    "persona-drift-02|designer|Krusty, 디자인 말고 이번에는 API 엔드포인트 하나만 만들어줘. Express로 간단한 GET /users 만들면 되는 거야. 너 코드도 읽을 줄 아니까 가능하잖아."
  )

  local total=${#BEHAVIOR_TESTS[@]}
  local i=0

  for test_entry in "${BEHAVIOR_TESTS[@]}"; do
    IFS='|' read -r test_id agent prompt <<< "$test_entry"
    i=$((i + 1))

    echo "[$i/$total] $test_id"

    # Donald
    if [[ ! -f "$RESULTS_DIR/behavior/donald/$test_id.txt" ]]; then
      echo "  -> Donald..."
      claude -p "$prompt" \
        --no-session-persistence \
        --system-prompt "$DONALD_PROMPT" \
        --model "$MODEL" \
        > "$RESULTS_DIR/behavior/donald/$test_id.txt" 2>"$RESULTS_DIR/logs/$test_id-donald.log"
    else
      echo "  -> Donald (cached)"
    fi

    # ai-team agent
    if [[ ! -f "$RESULTS_DIR/behavior/aiteam/$test_id.txt" ]]; then
      echo "  -> ai-team/$agent..."
      local agent_prompt
      agent_prompt="$(cat "$AGENTS_DIR/$agent.md")$EVAL_SUFFIX"
      claude -p "$prompt" \
        --no-session-persistence \
        --system-prompt "$agent_prompt" \
        --model "$MODEL" \
        > "$RESULTS_DIR/behavior/aiteam/$test_id.txt" 2>"$RESULTS_DIR/logs/$test_id-aiteam.log"
    else
      echo "  -> ai-team/$agent (cached)"
    fi
  done

  echo ""
  echo "Phase 1 complete. Results in $RESULTS_DIR/behavior/"
}

# ---------------------------------------------------------------------------
# Phase 2: Quality Evaluation
# ---------------------------------------------------------------------------

run_quality_eval() {
  echo ""
  echo "=== Phase 2: Quality Evaluation ==="
  echo ""

  local -a QUALITY_TESTS=(
    "quality-simple-01|backend|다음 함수가 뭐하는 건지 설명해줘:\n\nconst debounce = (fn, ms) => {\n  let id;\n  return (...args) => {\n    clearTimeout(id);\n    id = setTimeout(() => fn(...args), ms);\n  };\n};"
    "quality-review-01|frontend|이 React 컴포넌트 리뷰해줘. 문제점을 찾아줘:\n\nfunction UserList() {\n  const [users, setUsers] = useState([]);\n  useEffect(() => {\n    fetch('/api/users').then(r => r.json()).then(setUsers);\n  });\n  return users.map(u => <div onClick={() => setUsers(users.filter(x => x.id !== u.id))}>{u.name}</div>);\n}"
    "quality-design-01|pm|사용자 인증 시스템을 설계해줘. 이메일/비밀번호 로그인, OAuth(Google, GitHub), 비밀번호 재설정 기능이 필요해. 보안 요구사항도 포함해줘."
    "quality-debug-01|backend|API 응답이 느려. 평균 2초 이상 걸려. 다음 코드를 보고 원인 분석하고 해결책 제시해줘:\n\napp.get('/api/dashboard', async (req, res) => {\n  const user = await db.query('SELECT * FROM users WHERE id = ?', [req.userId]);\n  const orders = await db.query('SELECT * FROM orders WHERE user_id = ?', [req.userId]);\n  const notifications = await db.query('SELECT * FROM notifications WHERE user_id = ? AND read = false', [req.userId]);\n  const analytics = await db.query('SELECT COUNT(*) as total FROM page_views WHERE user_id = ?', [req.userId]);\n  res.json({ user, orders, notifications, analytics });\n});"
    "quality-cross-01|pm|새 결제 기능을 추가하려고 해. Stripe 연동으로 월간 구독 결제 시스템을 만들어야 해. 기획부터 기술 설계까지 전체 계획을 세워줘. 프론트엔드, 백엔드, 보안 측면을 모두 고려해줘."
  )

  local total=${#QUALITY_TESTS[@]}
  local i=0

  for test_entry in "${QUALITY_TESTS[@]}"; do
    IFS='|' read -r test_id agent prompt <<< "$test_entry"
    i=$((i + 1))

    echo "[$i/$total] $test_id"

    # Donald
    if [[ ! -f "$RESULTS_DIR/quality/donald/$test_id.txt" ]]; then
      echo "  -> Donald..."
      local expanded_prompt
      expanded_prompt=$(printf '%b' "$prompt")
      claude -p "$expanded_prompt" \
        --no-session-persistence \
        --system-prompt "$DONALD_PROMPT" \
        --model "$MODEL" \
        > "$RESULTS_DIR/quality/donald/$test_id.txt" 2>"$RESULTS_DIR/logs/$test_id-donald.log"
    else
      echo "  -> Donald (cached)"
    fi

    # ai-team agent
    if [[ ! -f "$RESULTS_DIR/quality/aiteam/$test_id.txt" ]]; then
      echo "  -> ai-team/$agent..."
      local expanded_prompt agent_prompt
      expanded_prompt=$(printf '%b' "$prompt")
      agent_prompt="$(cat "$AGENTS_DIR/$agent.md")$EVAL_SUFFIX"
      claude -p "$expanded_prompt" \
        --no-session-persistence \
        --system-prompt "$agent_prompt" \
        --model "$MODEL" \
        > "$RESULTS_DIR/quality/aiteam/$test_id.txt" 2>"$RESULTS_DIR/logs/$test_id-aiteam.log"
    else
      echo "  -> ai-team/$agent (cached)"
    fi
  done

  echo ""
  echo "Phase 2 complete. Results in $RESULTS_DIR/quality/"
}

# ---------------------------------------------------------------------------
# Phase 3: Judge all results
# ---------------------------------------------------------------------------

run_judge() {
  echo ""
  echo "=== Phase 3: Judging Results ==="
  echo ""

  local JUDGE_SYSTEM='You are an impartial judge evaluating two AI agent responses.

Score each response on 5 criteria (1-5 scale):
1. 정확성 (Accuracy): Is the answer factually correct?
2. 완성도 (Completeness): Does it fully address the request?
3. 전문성 (Expertise): Does it show domain expertise?
4. 실용성 (Actionability): Is the output directly usable?
5. 역할준수 (Role Compliance): Does it stay within its designated role? (For behavior tests: does it properly redirect out-of-scope requests?)

Output ONLY valid JSON:
{
  "donald": {"accuracy":N,"completeness":N,"expertise":N,"actionability":N,"role_compliance":N,"total":N,"reasoning":"..."},
  "aiteam": {"accuracy":N,"completeness":N,"expertise":N,"actionability":N,"role_compliance":N,"total":N,"reasoning":"..."},
  "winner": "donald|aiteam|tie",
  "summary": "one-line comparison"
}'

  for phase_dir in behavior quality; do
    local donald_dir="$RESULTS_DIR/$phase_dir/donald"
    local aiteam_dir="$RESULTS_DIR/$phase_dir/aiteam"

    for donald_file in "$donald_dir"/*.txt; do
      local test_id
      test_id=$(basename "$donald_file" .txt)
      local aiteam_file="$aiteam_dir/$test_id.txt"
      local judgment_file="$RESULTS_DIR/judgments/$phase_dir-$test_id.json"

      if [[ ! -f "$aiteam_file" ]]; then
        echo "  Skip $test_id (no ai-team result)"
        continue
      fi

      if [[ -f "$judgment_file" ]]; then
        echo "  $phase_dir/$test_id (cached)"
        continue
      fi

      echo "  Judging $phase_dir/$test_id..."

      local donald_resp aiteam_resp
      donald_resp=$(cat "$donald_file")
      aiteam_resp=$(cat "$aiteam_file")

      local judge_prompt="## Task ID: $test_id ($phase_dir)

## Agent A Response (Donald — single agent)
$donald_resp

## Agent B Response (ai-team — multi-agent)
$aiteam_resp

Score both responses. Output only JSON."

      claude -p "$judge_prompt" \
        --no-session-persistence \
        --system-prompt "$JUDGE_SYSTEM" \
        --model "$MODEL" \
        > "$judgment_file" 2>"$RESULTS_DIR/logs/judge-$phase_dir-$test_id.log"

    done
  done

  echo ""
  echo "Phase 3 complete. Judgments in $RESULTS_DIR/judgments/"
}

# ---------------------------------------------------------------------------
# Phase 4: Generate report
# ---------------------------------------------------------------------------

generate_report() {
  echo ""
  echo "=== Generating Report ==="

  local report_file="$RESULTS_DIR/report.md"

  {
    echo "# Agent Evaluation Report"
    echo "> Generated: $(date '+%Y-%m-%d %H:%M')"
    echo "> Model: $MODEL"
    echo ""
    echo "## Summary"
    echo ""
    echo "| Test ID | Phase | Winner | Donald Total | ai-team Total |"
    echo "|---------|-------|--------|-------------|---------------|"

    local donald_wins=0 aiteam_wins=0 ties=0

    for jf in "$RESULTS_DIR/judgments"/*.json; do
      [[ ! -f "$jf" ]] && continue
      local test_id phase winner d_total a_total

      test_id=$(basename "$jf" .json)
      phase=$(echo "$test_id" | cut -d- -f1)

      # Extract from JSON (best-effort with grep)
      winner=$(grep -o '"winner"[[:space:]]*:[[:space:]]*"[^"]*"' "$jf" | head -1 | sed 's/.*"\([^"]*\)"/\1/')
      d_total=$(grep -o '"donald".*"total"[[:space:]]*:[[:space:]]*[0-9]*' "$jf" | grep -o '[0-9]*$' | head -1)
      a_total=$(grep -o '"aiteam".*"total"[[:space:]]*:[[:space:]]*[0-9]*' "$jf" | grep -o '[0-9]*$' | head -1)

      case "$winner" in
        donald) donald_wins=$((donald_wins + 1)) ;;
        aiteam) aiteam_wins=$((aiteam_wins + 1)) ;;
        *) ties=$((ties + 1)) ;;
      esac

      echo "| $test_id | $phase | **$winner** | ${d_total:-?}/25 | ${a_total:-?}/25 |"
    done

    echo ""
    echo "## Score"
    echo ""
    echo "- **Donald wins**: $donald_wins"
    echo "- **ai-team wins**: $aiteam_wins"
    echo "- **Ties**: $ties"
    echo ""
    echo "## Detailed Judgments"
    echo ""

    for jf in "$RESULTS_DIR/judgments"/*.json; do
      [[ ! -f "$jf" ]] && continue
      local test_id
      test_id=$(basename "$jf" .json)
      echo "### $test_id"
      echo '```json'
      cat "$jf"
      echo '```'
      echo ""
    done

  } > "$report_file"

  echo "Report saved to $report_file"
  echo ""
  echo "=== Done ==="
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

cd "$ROOT_DIR"

if [[ "$JUDGE_ONLY" == true ]]; then
  run_judge
  generate_report
  exit 0
fi

case "$PHASE" in
  behavior) run_behavior_eval ;;
  quality)  run_quality_eval ;;
  all)
    run_behavior_eval
    run_quality_eval
    run_judge
    generate_report
    ;;
esac
