#!/bin/bash
set -euo pipefail

# upload.sh — Slack Files API로 이미지 업로드
# Usage: bash upload.sh <file_path> <channel_id> [thread_ts] [title] [token_env_var]
#
# 인자:
#   file_path       업로드할 파일 경로 (PNG/JPG)
#   channel_id      Slack 채널 ID (예: C0ANKEB4CRF)
#   thread_ts       (optional) 스레드 ts — 비워두면 채널에 단독 포스팅
#   title           (optional) 파일 제목 — 기본값: 파일명
#   token_env_var   (optional) 사용할 토큰 환경변수명 — 기본값: SLACK_BOT_TOKEN_FRONTEND

FILE_PATH="${1:-}"
CHANNEL_ID="${2:-}"
THREAD_TS="${3:-}"
TITLE="${4:-}"
TOKEN_VAR="${5:-SLACK_BOT_TOKEN_FRONTEND}"

if [[ -z "$FILE_PATH" || -z "$CHANNEL_ID" ]]; then
  echo "Usage: bash upload.sh <file_path> <channel_id> [thread_ts] [title] [token_env_var]"
  exit 1
fi

if [[ ! -f "$FILE_PATH" ]]; then
  echo "❌ 파일 없음: $FILE_PATH"
  exit 1
fi

# .env 로드 (프로젝트 루트 기준)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -o allexport
  source "$PROJECT_DIR/.env"
  set +o allexport
fi

TOKEN="${!TOKEN_VAR:-}"
if [[ -z "$TOKEN" ]]; then
  echo "❌ 토큰 없음: $TOKEN_VAR"
  exit 1
fi

FILENAME="$(basename "$FILE_PATH")"
TITLE="${TITLE:-$FILENAME}"
FILE_SIZE="$(wc -c < "$FILE_PATH" | tr -d ' ')"

echo "📤 Slack 파일 업로드: $FILENAME → #$CHANNEL_ID"

# Step 1: getUploadURLExternal
UPLOAD_RESP=$(curl -s -X POST "https://slack.com/api/files.getUploadURLExternal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "filename=$FILENAME" \
  --data-urlencode "length=$FILE_SIZE")

OK=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok','false'))" 2>/dev/null || echo "false")
if [[ "$OK" != "True" && "$OK" != "true" ]]; then
  echo "❌ getUploadURLExternal 실패: $UPLOAD_RESP"
  exit 1
fi

UPLOAD_URL=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['upload_url'])")
FILE_ID=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['file_id'])")

# Step 2: 파일 업로드 (PUT to upload URL)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$UPLOAD_URL" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@$FILE_PATH")

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "❌ 파일 업로드 실패 (HTTP $HTTP_CODE)"
  exit 1
fi

echo "  ✓ 파일 업로드 완료 (file_id: $FILE_ID)"

# Step 3: completeUploadExternal
COMPLETE_BODY="{\"files\":[{\"id\":\"$FILE_ID\",\"title\":\"$TITLE\"}],\"channel_id\":\"$CHANNEL_ID\""
if [[ -n "$THREAD_TS" ]]; then
  COMPLETE_BODY="$COMPLETE_BODY,\"thread_ts\":\"$THREAD_TS\""
fi
COMPLETE_BODY="$COMPLETE_BODY}"

COMPLETE_RESP=$(curl -s -X POST "https://slack.com/api/files.completeUploadExternal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$COMPLETE_BODY")

OK2=$(echo "$COMPLETE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok','false'))" 2>/dev/null || echo "false")
if [[ "$OK2" != "True" && "$OK2" != "true" ]]; then
  echo "❌ completeUploadExternal 실패: $COMPLETE_RESP"
  exit 1
fi

echo "✅ 업로드 완료: $TITLE"
