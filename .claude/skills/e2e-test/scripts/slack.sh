#!/usr/bin/env bash
# E2E Slack 하네스 — MCP 없이 curl 직접 사용
# 사용법: bash .claude/skills/e2e-test/scripts/slack.sh <command> [args...]

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/.env"

CHANNEL="C0ANKEB4CRF"

# Bot ID 맵
BOT_PM="B0AMR1CRC79"
BOT_DESIGNER="B0AN33BNWHK"
BOT_FRONTEND="B0AN4GU6A8N"
BOT_BACKEND="B0ANKFERR0R"
BOT_RESEARCHER="B0ANKFAS725"
BOT_SECOPS="B0AN4G42NCE"
BOT_QA="B0AP5GRNC79"

cmd="${1:-help}"
shift || true

case "$cmd" in

  # 메시지 전송 → ts 출력
  # 사용법: slack.sh send "텍스트" [thread_ts]
  send)
    text="$1"
    thread_ts="${2:-}"
    payload="{\"channel\":\"$CHANNEL\",\"text\":\"$text\"}"
    if [[ -n "$thread_ts" ]]; then
      payload="{\"channel\":\"$CHANNEL\",\"text\":\"$text\",\"thread_ts\":\"$thread_ts\"}"
    fi
    ts=$(curl -s -X POST \
      -H "Authorization: Bearer $SLACK_USER_TOKEN" \
      -H "Content-Type: application/json" \
      "https://slack.com/api/chat.postMessage" \
      -d "$payload" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('ts','ERROR:'+str(d.get('error',''))))")
    echo "$ts"
    ;;

  # 스레드 응답 전체 출력 (JSON)
  # 사용법: slack.sh replies <ts> [limit]
  replies)
    ts="$1"
    limit="${2:-20}"
    curl -s -H "Authorization: Bearer $SLACK_USER_TOKEN" \
      "https://slack.com/api/conversations.replies?channel=$CHANNEL&ts=$ts&limit=$limit"
    ;;

  # 특정 봇의 스레드 메시지만 출력
  # 사용법: slack.sh bot_messages <ts> <bot_id>
  bot_messages)
    ts="$1"
    bot_id="$2"
    curl -s -H "Authorization: Bearer $SLACK_USER_TOKEN" \
      "https://slack.com/api/conversations.replies?channel=$CHANNEL&ts=$ts&limit=20" \
      | python3 -c "
import sys,json
d=json.load(sys.stdin)
for m in d.get('messages',[]):
    if m.get('bot_id') == '$bot_id':
        print(f'ts={m[\"ts\"]}')
        print(m.get('text','')[:300])
        print()
"
    ;;

  # PM 메시지 수 확인 (중복 포스팅 검증용)
  # 사용법: slack.sh pm_count <ts>
  pm_count)
    ts="$1"
    curl -s -H "Authorization: Bearer $SLACK_USER_TOKEN" \
      "https://slack.com/api/conversations.replies?channel=$CHANNEL&ts=$ts&limit=20" \
      | python3 -c "
import sys,json
d=json.load(sys.stdin)
msgs = d.get('messages',[])
pm = [m for m in msgs if m.get('bot_id') == '$BOT_PM']
print(f'PM messages: {len(pm)}')
for m in pm:
    print(f'  [{m[\"ts\"]}] {m.get(\"text\",\"\")[:80]}')
"
    ;;

  # 스레드에 응답이 올 때까지 폴링 대기
  # 사용법: slack.sh wait_reply <ts> [timeout_sec=60] [min_count=2]
  wait_reply)
    ts="$1"
    timeout="${2:-60}"
    min="${3:-2}"
    elapsed=0
    while (( elapsed < timeout )); do
      count=$(curl -s -H "Authorization: Bearer $SLACK_USER_TOKEN" \
        "https://slack.com/api/conversations.replies?channel=$CHANNEL&ts=$ts&limit=20" \
        | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('messages',[])))")
      if (( count >= min )); then
        echo "READY: $count messages after ${elapsed}s"
        exit 0
      fi
      sleep 5
      elapsed=$(( elapsed + 5 ))
      echo "waiting... ${elapsed}s (${count} messages so far)" >&2
    done
    echo "TIMEOUT: ${timeout}s elapsed"
    exit 1
    ;;

  # 채널 최근 메시지 확인
  # 사용법: slack.sh history [limit=10]
  history)
    limit="${1:-10}"
    curl -s -H "Authorization: Bearer $SLACK_USER_TOKEN" \
      "https://slack.com/api/conversations.history?channel=$CHANNEL&limit=$limit" \
      | python3 -c "
import sys,json
d=json.load(sys.stdin)
for m in d.get('messages',[]):
    user = m.get('user','?')
    bot = m.get('bot_id','')
    text = m.get('text','')[:100]
    ts = m.get('ts','')
    print(f'[{ts}] {user}/{bot}: {text}')
"
    ;;

  *)
    echo "사용법: slack.sh <command> [args]"
    echo ""
    echo "Commands:"
    echo "  send <text> [thread_ts]           메시지 전송 → ts 반환"
    echo "  replies <ts> [limit]              스레드 응답 JSON"
    echo "  bot_messages <ts> <bot_id>        봇 메시지만 출력"
    echo "  pm_count <ts>                     PM 메시지 수 확인"
    echo "  wait_reply <ts> [timeout] [min]   응답 대기 폴링"
    echo "  history [limit]                   채널 최근 메시지"
    echo ""
    echo "Bot IDs: PM=$BOT_PM FRONTEND=$BOT_FRONTEND BACKEND=$BOT_BACKEND"
    ;;
esac
