---
last-updated: 2026-04-12
---

# Backend (Homer) Operational Knowledge

> **작성 규칙**: 세션 종료 시 Sprint Learned 항목 → 해당 섹션에 이관. 항목 없어도 `last-updated` 갱신 필수.

## Codebase Knowledge
- `claim-db.ts`: SQLite INSERT OR IGNORE 기반 원자적 claim 획득
- `heartbeat.ts`: SQLite heartbeats 테이블 (2026-03-28 마이그레이션 완료)
- `router.ts`: 6단계 라우팅 — 단계 정의 상세는 `facts/project-context.md` 참조 (단일 출처)
- `agent-runtime.ts`: Agent SDK query() 기반 에이전트 실행 + metrics 파일 기록

## Undocumented Behaviors
<!-- 예: exit code 2가 도구 자체를 차단함 (JSON 출력은 경고만) — 문서에 없는 동작 -->
<!-- 예: queue-processor가 claim 실패 시 재시도 없이 즉시 skip함 -->

## Known Constraints
<!-- 예: Agent SDK query()는 동시 호출 시 rate limit 걸림 — 순차 실행 필요 -->
<!-- 예: memory.db WAL 모드에서 동시 write는 SQLITE_BUSY 발생 가능 -->

## Common Pitfalls
<!-- 예: active-{role}.md 대신 active.md에 태스크 등록 → 에이전트 미인식 -->
<!-- 예: sprint current.md Next 섹션에 태스크 등록 → 반영 안 됨 (히스토리 전용) -->

## Operational Tips
<!-- 예: pnpm run dev 실행 전 .env 로드 여부 확인 (dotenv 자동 로드 안 됨) -->
