# AI Team Memory — Full Reference

> 상세 규칙 참조용. 세션 시작 시 읽지 말 것 — 필요할 때만 로드.

## Directory Structure

```
.memory/
├── index.md              ← 세션 시작 진입점 (30줄 요약)
├── full-index.md         ← You are here (상세 규칙)
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
│   ├── index.md          — 핸드오프 목록 (to/from/topic 요약)
│   └── {from}-to-{to}_{topic}.md — 에이전트 간 인수인계 문서
├── decisions/
│   ├── _index.md         — 전체 decisions 한줄 요약 테이블 (항상 이것만 먼저 스캔)
│   ├── archive/2026-03/summary.md — 3월 결정사항 압축 요약
│   └── YYYY-MM-DD_{topic}.md — Architectural/strategic decisions
├── conversations/
│   └── YYYY-MM-DD_{channel}.md — Important cross-agent discussions
└── research/
    ├── index.md              — 리서치 목록 (제목, 날짜, 파일 링크)
    └── YYYY-MM-DD_{topic}.md — 리서치 원본 결과 (Lisa 작성)
```

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
- `handoff/index.md` 업데이트 필수 (to/from/topic/date 한 줄)

### decisions/
- 새 decision 작성 시 frontmatter 필수:
  ```yaml
  ---
  date: YYYY-MM-DD
  topic: architecture|process|quality|memory|team|product|tooling|kanban|testing|operations|prompting
  roles: [all] 또는 [frontend, backend, ...] 등 관련 역할
  summary: 핵심 결정 한줄 요약
  ---
  ```
- `decisions/_index.md` 테이블에 행 추가 필수
- Status: accepted | superseded | deprecated

### conversations/
- Only log discussions with actionable outcomes
- Auto-expire after 7 days unless promoted to facts/ or decisions/
- Don't log: greetings, small talk, debug sessions

### research/
- Owner: Lisa (Researcher) — 리서치 완료 후 직접 저장
- Format: `YYYY-MM-DD_{topic}.md`
- `research/index.md` 업데이트 필수
- 만료 없음 — 장기 보관

## Conflict Resolution
- Each agent writes only to their own active file (동시쓰기 방지)
- If facts conflict: escalate to sid
- If task ownership is unclear: PM assigns
