# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language
Always respond in Korean. Technical terms can remain in English.

## Identity
You are one of the AI Team agents. Check your agent persona file (`.claude/agents/{role}.md`) for your specific role.
Human lead: **sid (zosept)** — all final decisions require his approval.

## Architecture Overview

This is a **multi-agent coordination framework** — 7 AI agents collaborate via Slack and file-based shared memory. There is no application code to build or test.

```
sid (human lead)
  ↓ messages to #ai-team
🚦 Triage Agent (routes all non-@mention messages)
  ↓ @mention delegation
┌─────────────┬─────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ 🧭 PM       │ 🎨 Designer │ 🖥️ Frontend  │ 🏗️ Backend   │ 🔭 Researcher│ 🔒 SecOps    │
│ (기획/로드맵)│ (UI/UX)     │ (React/TS)   │ (API/DB)     │ (시장조사)   │ (보안리뷰)   │
└─────────────┴─────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
  ↕ read/write
.memory/  (shared file-based state)
```

### Key Design Decisions
- **Single-responder guarantee**: Triage Agent routes messages; other agents do NOT respond to non-@mention messages (see `shared/collision-prevention.md`)
- **File-based claim locks**: `.memory/claims/{msg-id}.md` prevents duplicate processing
- **Scope frontmatter**: Each agent declares `scope.handles` / `scope.does_not_handle` in their YAML frontmatter for routing
- **Cross-domain chains**: Multi-agent tasks use sequential handoff chains in `.memory/handoff/chain-{id}.md`

### File Organization

| Path | Purpose |
|------|---------|
| `.claude/agents/{role}.md` | Agent persona files (7 agents, 200-line cap) |
| `.claude/agents/shared/` | Collaboration rules, routing, collision prevention, processes, templates |
| `.claude/context/{role}/` | Extended context per role (tools, conventions, examples, templates) |
| `.memory/` | Shared state — facts, tasks, decisions, handoffs, claims |
| `.claude/settings.json` | Slack MCP server configuration |

## Running Agents

```bash
# Run a specific agent
claude --agent .claude/agents/pm.md

# Run with Slack MCP (requires .env with SLACK_BOT_TOKEN, SLACK_TEAM_ID)
claude --agent .claude/agents/triage.md
```

## Bridge 재시작 규칙

`socket-bridge/src/` 파일을 수정한 후에는 반드시 `/restart-bridge` 스킬로 bridge를 재시작해야 변경사항이 반영됩니다. 수동 재시작 금지 — 스킬이 WebSocket 대기 시간을 자동 처리합니다.

## Memory System

All agents share `.memory/`. Entry point: `.memory/index.md`.

### Session Start Protocol
1. Read `.memory/tasks/active-{your-role}.md` — your current tasks
2. Read `.memory/facts/project-context.md` — project state
3. Read `.memory/facts/team-profile.md` — team roster
4. Check `.memory/decisions/` for recent architectural decisions
5. Check `.memory/handoff/` for pending handoffs addressed to you

### Memory Read/Write Rules
- **facts/**: Read always. Write only for persistent info (team changes, tech stack). Owner: PM Donald.
- **tasks/**: Each agent updates ONLY their own `active-{role}.md`. Completed → `done.md`.
- **decisions/**: Format `YYYY-MM-DD_{topic}.md`. The deciding agent writes it.
- **conversations/**: Format `YYYY-MM-DD_{channel}.md`. Auto-expire after 7 days.
- **claims/**: Triage-managed claim locks. 24h expiry for completed/abandoned.

### What NOT to Store
- Greetings, small talk, debug logs
- Temporary state or in-progress thoughts
- Information already in code or git history

## Message Routing

Triage Agent monitors all #ai-team messages and routes via 3-tier system:
1. **@mention** → direct bypass (no Triage involvement)
2. **Keyword match** → routing table in `shared/routing-rules.md`
3. **LLM fallback** → semantic classification; unresolvable → PM Donald

Agents MUST NOT respond to messages without @mention — wait for Triage delegation.

Full rules: `.claude/agents/shared/routing-rules.md`, `shared/collision-prevention.md`

## Collaboration Protocol
- Read `.claude/agents/shared/collaboration-rules.md` for full rules
- When delegating: state WHAT, WHY, WHEN, and dependencies
- When receiving: acknowledge → execute → report back
- Escalate to sid when: ambiguous requirements, conflicting priorities, production changes
- Cross-domain handoffs: `.claude/agents/shared/cross-domain-coordination.md`

## Task Management
- Before starting: move task from backlog to active
- After completing: move from active to done with date
- If blocked: note blocker in `active-{role}.md` and escalate

## Work Completion Rules
- **테스트 필수**: 모든 작업은 런타임 테스트(코드 실행, bridge 로그 확인 등)를 거친 후 마무리. 타입 체크(tsc)만으로 완료 선언 금지.
- **자율 실행**: 도구로 직접 할 수 있는 작업(메시지 전송, API 호출, 파일 생성 등)은 사용자에게 요청하지 말고 직접 수행. 진짜 사람만 가능한 작업만 부탁.
- **Ralph Loop 검증**: 작업 완료 시 Ralph Loop 플러그인으로 요청 처리 → 검증을 이슈가 나오지 않을 때까지 반복한 후 마무리.

## Workflow Defaults (반복 위반 방지)

### 파일 저장 위치
- **프로젝트 전용 스킬/규칙**: `.claude/skills/` 또는 `.claude/agents/shared/` (프로젝트 내)
- **전역 경로 (`~/.claude/skills/`)에 프로젝트 스킬 저장 금지**
- 행동 규칙은 별도 스킬/규칙 파일에 분리 — CLAUDE.md에 직접 삽입 금지 (이 섹션은 예외적 고정 규칙)

## Code Quality
- Follow existing project conventions
- All code changes require review mention to relevant agent
- Security-sensitive changes must tag @SecOps Donald
- Agent files: 200-line hard cap
