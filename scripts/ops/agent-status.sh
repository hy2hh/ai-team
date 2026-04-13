#!/usr/bin/env bash
# agent-status.sh — 에이전트 상태 통합 점검
# Usage: bash scripts/ops/agent-status.sh [--json]
#
# 3계층 점검:
#   1. tmux 세션 존재 여부
#   2. heartbeat DB: 각 역할의 last_seen (임계값: 10분)
#   3. tmux 로그 연결 카운트 (fallback)
#
# 최종 상태:
#   OK      — 세션 + 7/7 heartbeat 정상
#   PARTIAL — 세션 + 일부 stale 또는 <7
#   DOWN    — 세션 없음 또는 heartbeat 0개
#
# 의존성: tmux, sqlite3, python3

set -euo pipefail

# ─── 상수 ──────────────────────────────────────────────────────
BRIDGE_SESSION="ai-team-bridge"
CAPTURE_LINES=5000

# ─── 프로젝트 루트 ────────────────────────────────────────────
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
if [ -z "$ROOT" ]; then
  echo "ERROR: git 프로젝트 루트를 찾을 수 없습니다." >&2
  exit 1
fi
DB_PATH="$ROOT/.memory/memory.db"

# ─── 인자 파싱 ────────────────────────────────────────────────
JSON_MODE="false"
if [ "${1:-}" = "--json" ]; then
  JSON_MODE="true"
fi

# ─── 1. tmux 세션 체크 ─────────────────────────────────────────
SESSION_ALIVE="false"
if tmux has-session -t "$BRIDGE_SESSION" 2>/dev/null; then
  SESSION_ALIVE="true"
fi

# ─── 2. tmux 로그 연결 카운트 ──────────────────────────────────
LOG_CONNECTIONS=0
if [ "$SESSION_ALIVE" = "true" ]; then
  LOG_CONNECTIONS=$(tmux capture-pane -t "$BRIDGE_SESSION" -p -S -"$CAPTURE_LINES" 2>/dev/null \
    | grep -c '연결 완료' || true)
fi

# ─── 3. python3로 DB 조회 + 상태 판정 + 출력 ──────────────────
python3 << PYEOF
import json
import os
import sqlite3
import time

# ─── 입력값 (bash 변수를 문자열로 수신) ────────────────────────
DB_PATH = "${DB_PATH}"
SESSION_ALIVE = ("${SESSION_ALIVE}" == "true")
JSON_MODE = ("${JSON_MODE}" == "true")
LOG_CONNECTIONS = int("${LOG_CONNECTIONS}")
BRIDGE_SESSION = "${BRIDGE_SESSION}"

ROLES = ["pm", "designer", "frontend", "backend", "researcher", "secops", "qa"]
TOTAL_AGENTS = len(ROLES)
STALE_THRESHOLD_MS = 600000  # 10분

now_ms = int(time.time() * 1000)
cutoff_ms = now_ms - STALE_THRESHOLD_MS

# ─── 상대 시간 포맷 ───────────────────────────────────────────
def format_relative(diff_ms):
    if diff_ms < 0:
        return "just now"
    diff_s = diff_ms // 1000
    if diff_s < 60:
        return f"{diff_s}s ago"
    elif diff_s < 3600:
        return f"{diff_s // 60}m ago"
    elif diff_s < 86400:
        return f"{diff_s // 3600}h ago"
    else:
        return f"{diff_s // 86400}d ago"

# ─── DB 조회 ──────────────────────────────────────────────────
agent_data = {}  # role -> last_seen (ms)
bridge_last_seen = None

if os.path.isfile(DB_PATH):
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()

        # 에이전트 역할 조회
        placeholders = ",".join(["?"] * len(ROLES))
        cur.execute(
            f"SELECT role, last_seen FROM heartbeats WHERE role IN ({placeholders})",
            ROLES,
        )
        for role, last_seen in cur.fetchall():
            agent_data[role] = last_seen

        # bridge 자체 heartbeat
        cur.execute("SELECT last_seen FROM heartbeats WHERE role = ?", ("bridge",))
        row = cur.fetchone()
        if row:
            bridge_last_seen = row[0]

        conn.close()
    except Exception:
        pass

# ─── 역할별 상태 판정 ─────────────────────────────────────────
connected_count = 0
details = {}

for role in ROLES:
    if role in agent_data:
        last_seen = agent_data[role]
        diff_ms = now_ms - last_seen
        relative = format_relative(diff_ms)

        if last_seen >= cutoff_ms:
            details[role] = {"status": "ok", "last_seen": relative}
            connected_count += 1
        else:
            details[role] = {"status": "stale", "last_seen": f"STALE ({relative})"}
    else:
        details[role] = {"status": "missing", "last_seen": "no heartbeat"}

# ─── 최종 상태 ────────────────────────────────────────────────
if not SESSION_ALIVE:
    final_status = "DOWN"
elif connected_count == 0:
    final_status = "DOWN"
elif connected_count == TOTAL_AGENTS:
    final_status = "OK"
else:
    final_status = "PARTIAL"

# ─── 출력 ─────────────────────────────────────────────────────
if JSON_MODE:
    output = {
        "status": final_status,
        "session": SESSION_ALIVE,
        "log_connections": LOG_CONNECTIONS,
        "agents": {
            "connected": connected_count,
            "total": TOTAL_AGENTS,
            "details": details,
        },
    }
    print(json.dumps(output, ensure_ascii=False))
else:
    # Bridge 세션
    if SESSION_ALIVE:
        print(f"Bridge: OK (session: {BRIDGE_SESSION})")
    else:
        print(f"Bridge: DOWN (session: {BRIDGE_SESSION} not found)")

    # Bridge heartbeat
    if bridge_last_seen is not None:
        bridge_diff = now_ms - bridge_last_seen
        print(f"Heartbeat: bridge last_seen {format_relative(bridge_diff)}")
    else:
        print("Heartbeat: bridge no record")

    # 에이전트 요약
    print(f"Agents: {connected_count}/{TOTAL_AGENTS} connected (log: {LOG_CONNECTIONS} connections)")

    # 역할별 상세
    for role in ROLES:
        d = details[role]
        if d["status"] == "ok":
            icon = "OK"
        elif d["status"] == "stale":
            icon = "STALE"
        else:
            icon = "MISSING"
        print(f"  {role + ':':<12} {icon} (last_seen: {d['last_seen']})")

    print(f"Status: {final_status}")
PYEOF
