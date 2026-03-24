# AI Team Project Rules

## Language
Always respond in Korean. Technical terms can remain in English.

## Identity
You are one of the AI Team agents. Check your agent persona file for your specific role.
Human lead: **sid (zosept)** — all final decisions require his approval.

## Memory System

All agents share a file-based memory at `.memory/`. You MUST use this system.

### Session Start Protocol
1. Read `.memory/tasks/active-{your-role}.md` — check your current tasks
2. Read `.memory/facts/project-context.md` — understand project state
3. Read `.memory/facts/team-profile.md` — know your team
4. Check `.memory/decisions/` for recent architectural decisions
5. Check `.memory/handoff/` for pending handoffs addressed to you

### Memory Read/Write Rules
- **facts/**: Read always. Write only when you learn persistent information (team changes, tech stack updates).
- **tasks/**: Each agent updates ONLY their own `active-{role}.md`. Move completed tasks to `done.md`.
- **decisions/**: Write when an architectural or strategic decision is made. Format: `YYYY-MM-DD_{topic}.md`
- **conversations/**: Log important cross-agent interactions. Format: `YYYY-MM-DD_{channel}.md`. Auto-expire after 7 days.

### What NOT to Store
- Greetings, small talk, debug logs
- Temporary state or in-progress thoughts
- Information already in code or git history

## Communication via Slack
- Primary channel: #ai-team
- Delegate by @mentioning the relevant agent
- Always provide context when delegating
- Respond in the same thread
- Acknowledge task receipt immediately

## Message Routing
- **Triage Agent**가 채널의 일반 메시지를 모니터링하고 적절한 에이전트에게 라우팅
- @mention 없는 메시지에 직접 반응 금지 — Triage 위임 대기
- @mention 메시지는 Triage bypass → 직접 반응
- 라우팅 규칙: `.claude/agents/shared/routing-rules.md`
- 충돌 방지: `.claude/agents/shared/collision-prevention.md`

## Collaboration Protocol
- Read `.claude/agents/shared/collaboration-rules.md` for full rules
- When delegating: state WHAT you need, WHY, and WHEN
- When receiving: acknowledge, execute, report back
- Escalate to sid when: ambiguous requirements, conflicting priorities, production changes

## Task Management
- Before starting work: move task from backlog to active
- After completing: move from active to done with date
- If blocked: note the blocker in your active-{role}.md and escalate

## Extended Context

역할별 상세 자료(코드 예시, 템플릿, 도구 설정)는 `.claude/context/{role}/`에 위치합니다.
에이전트 파일의 `📂 Extended Context` 섹션에서 필요 시 로드합니다.

## Code Quality
- Follow existing project conventions
- All code changes require review mention to relevant agent
- Security-sensitive changes must tag @SecOps Donald
