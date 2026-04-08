# Memory System

`.memory/` 파일 작업 시 적용되는 규칙. All agents share this directory.

Entry point: `index.md`

## Session Start Protocol
1. Read `tasks/active-{your-role}.md` — your current tasks
2. Read `facts/project-context.md` — project state
3. Check `handoff/index.md` → 본인 role 포함 파일만 Read

## Read/Write Rules
- **facts/**: Read always. Write only for persistent info (team changes, tech stack). Owner: Marge.
- **tasks/**: Each agent updates ONLY their own `active-{role}.md`. Completed → `done.md`.
- **decisions/**: 조회·작성 시 `/decision-ops` 스킬 호출.
- **conversations/**: Format `YYYY-MM-DD_{channel}.md`. Auto-expire after 7 days.
- **claims/**: Deprecated `.md` file directory (kept for `.gitkeep` only). Actual claim state lives in `memory.db` SQLite claims table.

## What NOT to Store
- Greetings, small talk, debug logs
- Temporary state or in-progress thoughts
- Information already in code or git history
