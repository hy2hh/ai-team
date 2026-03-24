# AI Team Memory Index

> Entry point for all agents. Read this first on every session start.

## Directory Structure

```
.memory/
├── index.md              ← You are here
├── facts/
│   ├── team-profile.md   — Team members, roles, Slack bots
│   ├── project-context.md — Goals, tech stack, constraints
│   └── {topic}.md        — Add as needed (e.g., api-contracts.md)
├── tasks/
│   ├── active.md         — Index (역할별 파일 링크)
│   ├── active-{role}.md  — 역할별 진행 중 태스크 (6개)
│   ├── backlog.md        — Queued tasks (prioritized)
│   └── done.md           — Completed (rotate monthly)
├── handoff/
│   └── {from}-to-{to}_{topic}.md — 에이전트 간 인수인계 문서
├── decisions/
│   └── YYYY-MM-DD_{topic}.md — Architectural/strategic decisions
└── conversations/
    └── YYYY-MM-DD_{channel}.md — Important cross-agent discussions
```

## Session Start Checklist
1. Read `tasks/active-{your-role}.md` — your current tasks
2. Read `facts/project-context.md` — current project state
3. Scan `decisions/` — recent architectural choices
4. Check `handoff/` — pending handoffs for you
5. Check Slack #ai-team for unread mentions

## Writing Rules

### facts/
- Persistent knowledge only (team changes, tech stack, API contracts)
- Owner: PM Donald (others propose via Slack, PM updates)
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

## Conflict Resolution
- Each agent writes only to their own active file (동시쓰기 방지)
- If facts conflict: escalate to sid
- If task ownership is unclear: PM Donald assigns
