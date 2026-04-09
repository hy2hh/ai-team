---
last-updated: 2026-04-10
---

# Backend (Homer) Operational Knowledge

## Codebase Knowledge
- `claim-db.ts`: SQLite INSERT OR IGNORE 기반 원자적 claim 획득
- `heartbeat.ts`: SQLite heartbeats 테이블 (2026-03-28 마이그레이션 완료)
- `router.ts`: 5단계 라우팅 (mention→conversational→keyword→LLM→default)
- `agent-runtime.ts`: Agent SDK query() 기반 에이전트 실행 + metrics 파일 기록

## Undocumented Behaviors

## Known Constraints

## Common Pitfalls

## Operational Tips
