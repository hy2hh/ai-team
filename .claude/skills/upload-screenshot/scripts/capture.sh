#!/bin/bash
# capture.sh — agent-browser로 URL 스크린샷 촬영 (capture.js Playwright 교체)
# Usage: bash capture.sh <url> <output_path> [width] [height]

set -euo pipefail

URL="${1:-}"
OUTPUT_PATH="${2:-}"
WIDTH="${3:-1440}"
HEIGHT="${4:-900}"

if [[ -z "$URL" || -z "$OUTPUT_PATH" ]]; then
  echo "Usage: bash capture.sh <url> <output_path> [width] [height]" >&2
  exit 1
fi

if ! command -v agent-browser &>/dev/null; then
  echo "❌ agent-browser 미설치: npm install -g agent-browser && agent-browser install" >&2
  exit 1
fi

agent-browser open "$URL" > /dev/null
agent-browser set viewport "$WIDTH" "$HEIGHT" > /dev/null
agent-browser screenshot "$OUTPUT_PATH" --full > /dev/null

SIZE=$(du -sh "$OUTPUT_PATH" 2>/dev/null | cut -f1)
echo "✅ 스크린샷 저장: $OUTPUT_PATH ($SIZE)"
