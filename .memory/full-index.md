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
    ├── index.md    — 리서치 목록 (주제, last-updated, confidence)
    └── {topic}.md  — 주제별 지식 베이스 (날짜 prefix 없음, 재조사 시 UPDATE)
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
- Format: `{topic}.md` (날짜 prefix 금지 — 주제가 파일 이름)
- 새 리서치 시작 전 `research/index.md` 먼저 확인 → 같은 주제 파일 있으면 **CREATE 금지, UPDATE만**
- 각 파일 상단에 frontmatter 필수:
  ```
  last-updated: YYYY-MM-DD
  confidence: high | medium | low
  sources: [url, ...]
  ```
- `research/index.md` 업데이트 필수 (파일명, 주제, last-updated)
- 만료 없음 — 장기 보관. 300줄 초과 시 파일 하단 `## Archive` 섹션으로 구버전 이동

### facts/agents/{role}/
- 각 에이전트가 자기 역할 디렉토리에 직접 작성 (PM 승인 불필요)
- **대상**: 도구/시스템의 비문서화 동작, 발견된 제약, 반복 실수 방지용 operational 지식
  - 예: `facts/agents/backend/slack-mcp.md` — Slack MCP throttle 한계, 인증 오류 패턴
  - 예: `facts/agents/frontend/next-app-quirks.md` — Next.js 라우터 특이 동작
- research/(외부 동향), decisions/(팀 결정)과 구분 — 여기는 **내부 operational 사실**만
- 작업 중 새 발견 시 즉시 업데이트. 파일 없으면 CREATE 허용

## Conflict Resolution
- Each agent writes only to their own active file (동시쓰기 방지)
- If facts conflict: escalate to sid
- If task ownership is unclear: PM assigns
