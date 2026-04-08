#!/bin/bash
# Run Bloom evaluation via local proxy (no API key needed).
# The proxy translates Anthropic API calls → claude -p CLI calls.
#
# Usage:
#   bash eval/bloom/run-with-proxy.sh                     # default seed.yaml
#   bash eval/bloom/run-with-proxy.sh --port 9000         # custom proxy port
#   bash eval/bloom/run-with-proxy.sh --seed custom.yaml  # custom seed file

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8765
SEED_FILE="$SCRIPT_DIR/bloom-data/seed.yaml"

while [[ $# -gt 0 ]]; do
  case $1 in
    --port) PORT="$2"; shift 2 ;;
    --seed) SEED_FILE="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Cleanup on exit
cleanup() {
  if [[ -n "${PROXY_PID:-}" ]]; then
    echo "[run] Stopping proxy (PID=$PROXY_PID)..."
    kill "$PROXY_PID" 2>/dev/null || true
    wait "$PROXY_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# 1. Start proxy server
echo "[run] Starting Anthropic API proxy on port $PORT..."
python3 "$SCRIPT_DIR/proxy.py" --port "$PORT" &
PROXY_PID=$!
sleep 1

# Verify proxy is running
if ! kill -0 "$PROXY_PID" 2>/dev/null; then
  echo "[run] ERROR: Proxy failed to start"
  exit 1
fi

# 2. Test proxy
echo "[run] Testing proxy..."
TEST_RESPONSE=$(curl -s -X POST "http://127.0.0.1:$PORT/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-dummy" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Say hello in one word."}]
  }' 2>/dev/null || echo "FAILED")

if echo "$TEST_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('type')=='message'" 2>/dev/null; then
  REPLY_TEXT=$(echo "$TEST_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['content'][0]['text'][:80])")
  echo "[run] Proxy OK — test reply: $REPLY_TEXT"
else
  echo "[run] ERROR: Proxy test failed"
  echo "[run] Response: $TEST_RESPONSE"
  exit 1
fi

# 3. Run Bloom with proxy
echo ""
echo "[run] Starting Bloom evaluation..."
echo "[run] Seed: $SEED_FILE"
echo ""

export ANTHROPIC_API_KEY="sk-dummy-for-proxy"
export ANTHROPIC_API_BASE="http://127.0.0.1:$PORT"

cd "$SCRIPT_DIR"
source .venv/bin/activate
bloom run "$SEED_FILE"
