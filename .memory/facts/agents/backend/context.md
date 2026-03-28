# Backend (Homer) — Agent Context

> Last updated: 2026-03-28

## Role Summary
API 설계, DB 아키텍처, 시스템 설계, 인프라, socket-bridge 코드 담당.
`socket-bridge/src/` 디렉토리가 주 작업 영역.

## Architecture Knowledge
- `claim-db.ts`: SQLite INSERT OR IGNORE 기반 원자적 claim 획득
- `heartbeat.ts`: SQLite heartbeats 테이블 (2026-03-28 마이그레이션 완료)
- `router.ts`: 5단계 라우팅 (mention→conversational→keyword→LLM→default)
- `agent-runtime.ts`: Agent SDK query() 기반 에이전트 실행 + metrics 파일 기록

## Pending Improvements (2026-03-28)
- 공유 `db.ts` 모듈 생성 (claim-db.ts, heartbeat.ts 중복 커넥션 코드 제거)
- SQLite 주기적 VACUUM 추가
- agent-stats.json → SQLite 마이그레이션 검토
