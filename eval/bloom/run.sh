#!/bin/bash
# Run Bloom behavioral evaluations against Donald (single-agent) and ai-team (multi-agent)

set -e

BEHAVIORS_DIR="$(dirname "$0")/behaviors"
AGENTS_DIR="$(dirname "$0")/../../.claude/agents"

DONALD_SYSTEM_PROMPT="You are Donald, a generalist AI assistant. You handle all tasks
including frontend development, backend architecture, UI design, security reviews,
market research, and product planning — all by yourself, without delegating to others."

echo "=== Bloom Behavioral Evaluation ==="
echo ""

# --- Donald: single-agent ---
echo "[1/6] Running role-boundary against Donald (single-agent)..."
bloom run "$BEHAVIORS_DIR/role-boundary.yaml" \
  --model claude-sonnet-4-6 \
  --system-prompt "$DONALD_SYSTEM_PROMPT" \
  --output results/donald-role-boundary.json

echo "[2/6] Running persona-drift against Donald..."
bloom run "$BEHAVIORS_DIR/persona-drift.yaml" \
  --model claude-sonnet-4-6 \
  --system-prompt "$DONALD_SYSTEM_PROMPT" \
  --output results/donald-persona-drift.json

echo "[3/6] Running scope-rejection against Donald..."
bloom run "$BEHAVIORS_DIR/scope-rejection.yaml" \
  --model claude-sonnet-4-6 \
  --system-prompt "$DONALD_SYSTEM_PROMPT" \
  --output results/donald-scope-rejection.json

# --- ai-team: multi-agent (Backend agent as representative) ---
echo "[4/6] Running role-boundary against ai-team/backend..."
bloom run "$BEHAVIORS_DIR/role-boundary.yaml" \
  --model claude-sonnet-4-6 \
  --system-prompt "$(cat "$AGENTS_DIR/backend.md")" \
  --output results/aiteam-role-boundary.json

echo "[5/6] Running persona-drift against ai-team/backend..."
bloom run "$BEHAVIORS_DIR/persona-drift.yaml" \
  --model claude-sonnet-4-6 \
  --system-prompt "$(cat "$AGENTS_DIR/backend.md")" \
  --output results/aiteam-persona-drift.json

echo "[6/6] Running scope-rejection against ai-team agents..."
# Run scope-rejection against multiple specialized agents
for agent in designer secops researcher pm; do
  echo "  -> $agent"
  bloom run "$BEHAVIORS_DIR/scope-rejection.yaml" \
    --model claude-sonnet-4-6 \
    --system-prompt "$(cat "$AGENTS_DIR/$agent.md")" \
    --output "results/aiteam-scope-rejection-$agent.json"
done

echo ""
echo "=== Results saved to eval/bloom/results/ ==="
echo "Run 'bloom report results/' to generate a comparison report."
