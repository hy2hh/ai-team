# Memory System

`.memory/` 파일 작업 시 적용되는 규칙. All agents share this directory.

Entry point: `index.md`

## Session Start Protocol

> **메모리 읽기 단계만 기술.** git pull, qa-metrics 등 전체 프로토콜은 `.claude/agents/shared/session-bootstrap.md` 참조.

1. Read `tasks/active-{your-role}.md` — your current tasks
2. Read `facts/project-context.md` — project state
3. Scan `research/index.md` → 오늘 작업과 관련된 topic 파일 있으면 Read
4. Scan `facts/agents/{your-role}/` → operational 지식 있으면 Read
5. Check `handoff/index.md` → 본인 role 포함 파일만 Read

## Read/Write Rules
- **facts/**: Read always. `project-context.md`, `team-profile.md`는 Marge 관리. 나머지 파일과 `facts/agents/{role}/`는 관련 에이전트 직접 작성 가능.
- **tasks/**: Each agent updates ONLY their own `active-{role}.md`. Completed → `done.md`.
- **decisions/**: 조회·작성 시 `/decision-ops` 스킬 호출.
- **conversations/**: Format `YYYY-MM-DD_{channel}.md`. Auto-expire after 7 days.
- **heartbeats/**: SQLite `memory.db`에만 저장. `.json` 파일 생성 금지. Bridge가 5분마다 heartbeat 갱신 (10분 이상 미갱신 시 stale 처리).
- **claims/**: Deprecated `.md` file directory (kept for `.gitkeep` only). Actual claim state lives in `memory.db` SQLite claims table.

## What NOT to Store
- Greetings, small talk, debug logs
- Temporary state or in-progress thoughts
- Information already in code or git history
