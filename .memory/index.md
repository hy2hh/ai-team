# AI Team Memory Index

> Entry point for all agents. Read this first on every session start.

## Directory Structure

```
.memory/
├── index.md              ← You are here
├── facts/
│   ├── team-profile.md   — Team members, roles, Slack bots
│   ├── project-context.md — Goals, tech stack, constraints
│   ├── services.md       — External service identifiers per project
│   ├── {topic}.md        — Add as needed (e.g., api-contracts.md)
│   └── agents/
│       ├── pm/           — PM agent's own facts (직접 쓰기 가능)
│       ├── backend/      — Backend agent's own facts
│       ├── frontend/     — Frontend agent's own facts
│       ├── designer/     — Designer agent's own facts
│       ├── researcher/   — Researcher agent's own facts
│       └── secops/       — SecOps agent's own facts
├── heartbeats/
│   └── (SQLite memory.db에 저장됨 — bridge가 10분마다 갱신)
├── tasks/
│   ├── active.md         — Index (역할별 파일 링크)
│   ├── active-{role}.md  — 역할별 진행 중 태스크 (6개)
│   ├── backlog.md        — Queued tasks (prioritized)
│   └── done.md           — Completed (rotate monthly)
├── handoff/
│   └── {from}-to-{to}_{topic}.md — 에이전트 간 인수인계 문서
├── decisions/
│   └── YYYY-MM-DD_{topic}.md — Architectural/strategic decisions
├── conversations/
│   └── YYYY-MM-DD_{channel}.md — Important cross-agent discussions
└── research/
    ├── index.md              — 리서치 목록 (제목, 날짜, 파일 링크)
    └── YYYY-MM-DD_{topic}.md — 리서치 원본 결과 (Lisa 작성)
```

## Session Start Checklist
1. Read `tasks/active-{your-role}.md` — your current tasks
2. Read `facts/project-context.md` — current project state
3. Scan `decisions/` — recent architectural choices
4. Check `handoff/` — pending handoffs for you
5. Check Slack #ai-team for unread mentions

## Writing Rules

### heartbeats/
- Heartbeats are stored in `memory.db` (SQLite), NOT as `.json` files
- Bridge calls `writeHeartbeat(role, status, currentTask?)` at task start/end
- Bridge refreshes its own heartbeat every 5 minutes automatically
- Heartbeats not updated in 10 minutes are considered stale (`cleanupStaleHeartbeats`)
- The `heartbeats/` directory is kept for legacy compatibility — do NOT write `.json` files there

### facts/ (root)
- Persistent knowledge only (team changes, tech stack, API contracts)
- Owner: PM only — others propose via Slack, PM updates
- Keep files under 200 lines — split if growing

### facts/agents/{role}/
- Each agent can write their own facts directly — no PM approval needed
- Use for role-specific knowledge: local decisions, component notes, domain-specific context
- Keep files under 200 lines — split if growing

### tasks/
- Each agent updates ONLY their own `active-{role}.md`
- Format: `- [ ] task description | created | priority`
- Move to done.md with completion date when finished
- Backlog sorted by priority: HIGH → MEDIUM → LOW

### handoff/
- 에이전트 간 작업 인수인계 시 사용
- Format: `{from}-to-{to}_{topic}.md`
- 7일 이상 된 문서는 승격 또는 삭제

### decisions/
- One file per decision
- Template:
  ```
  # Decision: {title}
  Date: YYYY-MM-DD
  Decided by: {agent or sid}
  Status: accepted | superseded | deprecated

  ## Context
  ## Options Considered
  ## Decision
  ## Consequences
  ```

### conversations/
- Only log discussions with actionable outcomes
- Auto-expire after 7 days unless promoted to facts/ or decisions/
- Don't log: greetings, small talk, debug sessions

### research/
- Owner: Lisa (Researcher) — 리서치 완료 후 직접 저장
- Format: `YYYY-MM-DD_{topic}.md` (예: `2026-04-07_toss-design-system.md`)
- 저장 내용: 리서치 원본 전문 (검증 마커 포함), 출처 목록, 핵심 인사이트 요약
- `research/index.md` 업데이트 필수 (제목, 날짜, 모드, 파일 링크 한 줄)
- 만료 없음 — 장기 보관 (facts/와 동일 정책)

## Conflict Resolution
- Each agent writes only to their own active file (동시쓰기 방지)
- If facts conflict: escalate to sid
- If task ownership is unclear: PM Donald assigns
