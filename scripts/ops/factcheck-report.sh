#!/usr/bin/env bash
# factcheck-report.sh — PM 리포트 팩트체크 도구
# PM 보고서의 수치/원인 주장을 Slack 히스토리 및 로컬 로그와 대조 검증한다.
# 사용법: bash scripts/ops/factcheck-report.sh <command> [args]

set -euo pipefail

# ─── 프로젝트 루트 및 환경 변수 ──────────────────────────────────
PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -f "${PROJECT_DIR}/.env" ]; then
  # shellcheck disable=SC1091
  set -a
  source "${PROJECT_DIR}/.env"
  set +a
fi

# ─── 상수 ────────────────────────────────────────────────────────
CHANNEL_ID="C0ANKEB4CRF"
INCIDENTS_LOG="${PROJECT_DIR}/scripts/incidents.log"

ALL_BOT_IDS="B0AMR1CRC79 B0ANKFERR0R B0AN4GU6A8N B0AN33BNWHK B0ANKFAS725 B0AN4G42NCE B0AP5GRNC79"

# 봇 ID → 이름 변환 (bash 3.2 호환 — associative array 불가)
bot_name() {
  case "$1" in
    B0AMR1CRC79) echo "PM(Marge)" ;;
    B0ANKFERR0R) echo "Backend(Homer)" ;;
    B0AN4GU6A8N) echo "Frontend(Bart)" ;;
    B0AN33BNWHK) echo "Designer(Lisa)" ;;
    B0ANKFAS725) echo "Researcher(Milhouse)" ;;
    B0AN4G42NCE) echo "SecOps(Wiggum)" ;;
    B0AP5GRNC79) echo "QA(Ralph)" ;;
    *)           echo "unknown(${1})" ;;
  esac
}

# ─── 사전 조건 검증 ──────────────────────────────────────────────
check_deps() {
  local missing=""
  for cmd in curl python3; do
    if ! command -v "$cmd" &>/dev/null; then
      missing="${missing} ${cmd}"
    fi
  done
  if [ -n "$missing" ]; then
    echo "ERROR: 필수 도구가 없습니다:${missing}" >&2
    exit 1
  fi
}

check_token() {
  if [ -z "${SLACK_USER_TOKEN:-}" ]; then
    echo "ERROR: SLACK_USER_TOKEN 환경 변수가 설정되지 않았습니다." >&2
    echo "  .env 파일에 SLACK_USER_TOKEN=xoxp-... 형태로 설정하세요." >&2
    exit 1
  fi
}

# ─── 유틸리티 함수 ───────────────────────────────────────────────

# 날짜 → epoch 변환 (macOS)
date_to_epoch() {
  date -j -f "%Y-%m-%d" "$1" "+%s" 2>/dev/null
}

# 오늘 날짜 (YYYY-MM-DD)
today() {
  date "+%Y-%m-%d"
}

# Slack API 호출 (conversations.history)
# $1=oldest(epoch) $2=latest(epoch) $3=limit
slack_history() {
  local oldest="${1:-}"
  local latest="${2:-}"
  local limit="${3:-200}"

  local url="https://slack.com/api/conversations.history?channel=${CHANNEL_ID}&limit=${limit}"
  if [ -n "$oldest" ]; then
    url="${url}&oldest=${oldest}"
  fi
  if [ -n "$latest" ]; then
    url="${url}&latest=${latest}"
  fi

  local response
  response=$(curl -s -H "Authorization: Bearer ${SLACK_USER_TOKEN}" "$url")

  # API 에러 체크
  local ok
  ok=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok', False))" 2>/dev/null)
  if [ "$ok" != "True" ]; then
    local err
    err=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error', 'unknown'))" 2>/dev/null)
    echo "ERROR: Slack API 호출 실패 — ${err}" >&2
    return 1
  fi

  echo "$response"
}

# Slack 히스토리에서 날짜 범위로 조회
slack_history_for_date() {
  local target_date="${1:-$(today)}"
  local limit="${2:-200}"

  local oldest
  oldest=$(date_to_epoch "${target_date}")
  local latest
  latest=$(( oldest + 86400 ))

  slack_history "$oldest" "$latest" "$limit"
}

# 봇 ID 기준 필터링된 메시지 카운트 + 샘플
filter_by_bot() {
  local bot_id="$1"
  local sample_count="${2:-3}"
  python3 -c "
import sys, json
data = json.load(sys.stdin)
messages = data.get('messages', [])
filtered = [m for m in messages if m.get('bot_id') == '${bot_id}']
print('메시지 수: {}'.format(len(filtered)))
print()
sample = filtered[:${sample_count}]
if sample:
    print('최근 {}개 샘플:'.format(len(sample)))
    for i, m in enumerate(sample, 1):
        text = m.get('text', '').replace('\n', ' ')[:150]
        print('  [{}] {}'.format(i, text))
else:
    print('(해당 봇의 메시지 없음)')
"
}

# 패턴 매칭 메시지 카운트 + 샘플
filter_by_pattern() {
  local pattern="$1"
  local sample_count="${2:-5}"
  python3 -c "
import sys, json, re
data = json.load(sys.stdin)
messages = data.get('messages', [])
pattern = re.compile(r'${pattern}', re.IGNORECASE)
matched = [m for m in messages if pattern.search(m.get('text', ''))]
print('매칭 메시지 수: {}'.format(len(matched)))
print()
sample = matched[:${sample_count}]
if sample:
    print('처음 {}개 샘플:'.format(len(sample)))
    for i, m in enumerate(sample, 1):
        text = m.get('text', '').replace('\n', ' ')[:150]
        bot = m.get('bot_id', 'user')
        print('  [{}] ({}) {}'.format(i, bot, text))
else:
    print('(매칭 메시지 없음)')
"
}

# 봇별 분포 집계
bot_distribution() {
  python3 -c "
import sys, json

data = json.load(sys.stdin)
messages = data.get('messages', [])

bot_map = {
    'B0AMR1CRC79': 'PM(Marge)',
    'B0ANKFERR0R': 'Backend(Homer)',
    'B0AN4GU6A8N': 'Frontend(Bart)',
    'B0AN33BNWHK': 'Designer(Lisa)',
    'B0ANKFAS725': 'Researcher(Milhouse)',
    'B0AN4G42NCE': 'SecOps(Wiggum)',
    'B0AP5GRNC79': 'QA(Ralph)',
}

counts = {}
user_count = 0
for m in messages:
    bot_id = m.get('bot_id', '')
    if bot_id and bot_id in bot_map:
        name = bot_map[bot_id]
        counts[name] = counts.get(name, 0) + 1
    elif bot_id:
        label = 'other({})'.format(bot_id)
        counts[label] = counts.get(label, 0) + 1
    else:
        user_count += 1

total = len(messages)
print('총 메시지 수: {}'.format(total))
print()
header = '{:<25} {:>8} {:>8}'.format('발신자', '메시지 수', '비율')
print(header)
print('-' * 45)
if user_count > 0:
    pct = '{:.1f}%'.format(user_count / total * 100) if total > 0 else '0%'
    print('{:<25} {:>8} {:>8}'.format('사용자(human)', user_count, pct))
for name in sorted(counts.keys(), key=lambda k: counts[k], reverse=True):
    c = counts[name]
    pct = '{:.1f}%'.format(c / total * 100) if total > 0 else '0%'
    print('{:<25} {:>8} {:>8}'.format(name, c, pct))
"
}

# ─── 명령별 구현 ─────────────────────────────────────────────────

cmd_keyword() {
  local pattern="${1:-}"
  local limit="${2:-200}"

  if [ -z "$pattern" ]; then
    echo "ERROR: 검색 패턴을 지정하세요." >&2
    echo "  사용법: factcheck-report.sh keyword \"에러\" [limit]" >&2
    exit 1
  fi

  check_token

  echo "=== Slack 키워드 검색: \"${pattern}\" (limit=${limit}) ==="
  echo ""

  local response
  response=$(slack_history "" "" "$limit")
  echo "$response" | filter_by_pattern "$pattern" 5
}

cmd_incidents() {
  local target_date="${1:-$(today)}"

  if [ ! -f "$INCIDENTS_LOG" ]; then
    echo "ERROR: incidents.log 파일이 없습니다: ${INCIDENTS_LOG}" >&2
    echo "  형식: YYYY-MM-DD HH:MM:SS [STATUS] detail" >&2
    exit 1
  fi

  echo "=== Incidents 집계: ${target_date} ==="
  echo ""

  # 해당 날짜 라인만 추출
  local date_lines
  date_lines=$(grep "^${target_date}" "$INCIDENTS_LOG" || true)

  if [ -z "$date_lines" ]; then
    echo "(해당 날짜의 인시던트 없음)"
    echo "--- 0 건 ---"
    return
  fi

  local total
  total=$(echo "$date_lines" | wc -l | tr -d ' ')
  echo "총 인시던트: ${total}건"
  echo ""

  # STATUS별 그룹화
  echo "$date_lines" | python3 -c "
import sys, re
from collections import Counter

status_counter = Counter()
samples = {}

for line in sys.stdin:
    line = line.strip()
    match = re.match(r'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \[(\w+)\] (.+)', line)
    if match:
        status = match.group(1)
        detail = match.group(2)
        status_counter[status] += 1
        if status not in samples:
            samples[status] = []
        if len(samples[status]) < 2:
            samples[status].append(detail[:100])

print('{:<15} {:>6}'.format('STATUS', '건수'))
print('-' * 25)
for status, count in status_counter.most_common():
    print('{:<15} {:>6}'.format(status, count))
    for s in samples[status]:
        print('  -> {}'.format(s))
"
}

cmd_bot_activity() {
  local bot_id="${1:-}"
  local limit="${2:-200}"

  if [ -z "$bot_id" ]; then
    echo "ERROR: bot_id를 지정하세요." >&2
    echo "  사용법: factcheck-report.sh bot-activity B0AMR1CRC79 [limit]" >&2
    echo "" >&2
    echo "  알려진 봇 ID:" >&2
    for bid in $ALL_BOT_IDS; do
      echo "    ${bid} — $(bot_name "$bid")" >&2
    done
    exit 1
  fi

  check_token

  local name
  name=$(bot_name "$bot_id")
  echo "=== 봇 활동: ${name} (${bot_id}, limit=${limit}) ==="
  echo ""

  local response
  response=$(slack_history "" "" "$limit")
  echo "$response" | filter_by_bot "$bot_id" 3
}

cmd_daily_summary() {
  local target_date="${1:-$(today)}"

  check_token

  echo "=== 일일 요약: ${target_date} ==="
  echo ""

  local response
  response=$(slack_history_for_date "$target_date" 999)
  echo "$response" | bot_distribution
}

cmd_compare() {
  local claim="${1:-}"
  local pattern="${2:-}"

  if [ -z "$claim" ] || [ -z "$pattern" ]; then
    echo "ERROR: 주장 수치와 검색 패턴을 모두 지정하세요." >&2
    echo "  사용법: factcheck-report.sh compare \"20\" \"incident|에러|장애\"" >&2
    exit 1
  fi

  # claim에서 숫자 추출
  local claim_num
  claim_num=$(echo "$claim" | grep -oE '[0-9]+' | head -1)
  if [ -z "$claim_num" ]; then
    echo "ERROR: 주장에서 숫자를 추출할 수 없습니다: ${claim}" >&2
    exit 1
  fi

  check_token

  echo "=== 팩트체크: PM 주장 vs 실제 ==="
  echo ""
  echo "PM 주장: \"${claim}\""
  echo "검색 패턴: \"${pattern}\""
  echo ""

  local response
  response=$(slack_history "" "" 999)

  local actual
  actual=$(echo "$response" | python3 -c "
import sys, json, re
data = json.load(sys.stdin)
messages = data.get('messages', [])
pat = re.compile(r'${pattern}', re.IGNORECASE)
matched = [m for m in messages if pat.search(m.get('text', ''))]
print(len(matched))
")

  local delta=$(( actual - claim_num ))
  local sign=""
  if [ "$delta" -gt 0 ]; then
    sign="+"
  fi

  echo "결과:"
  echo "  CLAIM:  ${claim_num}"
  echo "  ACTUAL: ${actual}"
  echo "  DELTA:  ${sign}${delta}"
  echo ""

  if [ "$delta" -eq 0 ]; then
    echo "판정: MATCH -- PM 주장이 실제 수치와 일치합니다."
  elif [ "$delta" -gt 0 ]; then
    echo "판정: UNDERSTATED -- PM이 실제보다 적게 보고했습니다."
  else
    echo "판정: OVERSTATED -- PM이 실제보다 많게 보고했습니다."
  fi
}

cmd_help() {
  cat <<'HELP'
factcheck-report.sh — PM 리포트 팩트체크 도구

사용법: bash scripts/ops/factcheck-report.sh <command> [args]

Commands:
  keyword "패턴" [limit]       Slack 히스토리에서 패턴 매칭 메시지 카운트 (기본 limit=200)
  incidents [date]             incidents.log에서 날짜별 집계 (기본: 오늘)
  bot-activity <bot_id> [limit]  특정 봇의 최근 메시지 수 + 샘플
  daily-summary [date]         날짜별 Slack 메시지 수 + 봇별 분포
  compare "claim" "pattern"    PM 주장 vs Slack 실제 수치 비교
  help                         이 도움말 출력

봇 ID 참조:
  B0AMR1CRC79  PM(Marge)
  B0ANKFERR0R  Backend(Homer)
  B0AN4GU6A8N  Frontend(Bart)
  B0AN33BNWHK  Designer(Lisa)
  B0ANKFAS725  Researcher(Milhouse)
  B0AN4G42NCE  SecOps(Wiggum)
  B0AP5GRNC79  QA(Ralph)

예시:
  bash scripts/ops/factcheck-report.sh keyword "장애" 500
  bash scripts/ops/factcheck-report.sh incidents 2026-04-12
  bash scripts/ops/factcheck-report.sh bot-activity B0AMR1CRC79 300
  bash scripts/ops/factcheck-report.sh daily-summary 2026-04-13
  bash scripts/ops/factcheck-report.sh compare "20" "incident|장애|에러"
HELP
}

# ─── 메인 ────────────────────────────────────────────────────────
check_deps

if [ $# -eq 0 ]; then
  cmd_help
  exit 0
fi

COMMAND="$1"
shift

case "$COMMAND" in
  keyword)       cmd_keyword "$@" ;;
  incidents)     cmd_incidents "$@" ;;
  bot-activity)  cmd_bot_activity "$@" ;;
  daily-summary) cmd_daily_summary "$@" ;;
  compare)       cmd_compare "$@" ;;
  help|--help|-h) cmd_help ;;
  *)
    echo "알 수 없는 명령: ${COMMAND}" >&2
    cmd_help
    exit 1
    ;;
esac
