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
│   ├── active.md         — In-progress tasks
│   ├── backlog.md        — Queued tasks (prioritized)
│   └── done.md           — Completed (rotate monthly)
├── decisions/
│   └── YYYY-MM-DD_{topic}.md — Architectural/strategic decisions
└── conversations/
    └── YYYY-MM-DD_{channel}.md — Important cross-agent discussions
```

## Session Start Checklist
1. Read `tasks/active.md` — what's in progress?
2. Read `facts/project-context.md` — current project state
3. Scan `decisions/` — recent architectural choices
4. Check Slack #ai-team for unread mentions

## Writing Rules

### facts/
- Persistent knowledge only (team changes, tech stack, API contracts)
- Owner: PM Donald (others propose via Slack, PM updates)
- Keep files under 200 lines — split if growing

### tasks/
- Any agent can update tasks they own
- Format: `- [ ] task description | owner | created | priority`
- Move to done.md with completion date when finished
- Backlog sorted by priority: HIGH → MEDIUM → LOW

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
- If two agents update the same file: last write wins, notify in Slack
- If facts conflict: escalate to sid
- If task ownership is unclear: PM Donald assigns
