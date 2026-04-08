#!/bin/bash
set -euo pipefail

# screenshot-and-upload.sh — URL 촬영 후 Slack 업로드 (one-shot)
# Usage: bash screenshot-and-upload.sh <url> <channel_id> [thread_ts] [title] [width]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

URL="${1:-}"
CHANNEL_ID="${2:-}"
THREAD_TS="${3:-}"
TITLE="${4:-}"
WIDTH="${5:-1440}"

if [[ -z "$URL" || -z "$CHANNEL_ID" ]]; then
  echo "Usage: bash screenshot-and-upload.sh <url> <channel_id> [thread_ts] [title] [width]"
  exit 1
fi

# 임시 스크린샷 경로
TMP_FILE="/tmp/screenshot-$(date +%s).png"

echo "📸 스크린샷 촬영: $URL"
node "$SCRIPT_DIR/capture.js" "$URL" "$TMP_FILE" "$WIDTH" "900"

TITLE="${TITLE:-Screenshot $(date '+%Y-%m-%d %H:%M')}"
bash "$SCRIPT_DIR/upload.sh" "$TMP_FILE" "$CHANNEL_ID" "$THREAD_TS" "$TITLE"

rm -f "$TMP_FILE"
