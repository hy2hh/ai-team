# API Documentation

AI Team 프로젝트의 모든 API를 문서화합니다.

## Core Systems

### 1. Socket-Bridge
**파일**: `socket-bridge-architecture.md`

Slack 기반 AI 에이전트 라우팅 및 런타임 관리 시스템의 완전한 아키텍처 가이드.

**포함 내용:**
- 핵심 데이터 타입 (SlackEvent, RoutingResult, AgentSession)
- Router 모듈 (메시지 분석 및 라우팅)
- Queue Processor (큐 기반 작업 처리)
- Agent Runtime (에이전트 실행 및 생명주기)
- Claim Database (중복 처리 방지)
- Auto-Proceed (사용자 승인 처리)
- Kanban Sync (칸반 동기화)
- Circuit Breaker 및 Retry 전략
- Slack 이벤트 플로우 다이어그램
- 설정값 및 모니터링

**사용 시기:**
- Slack 메시지 라우팅 흐름 이해
- 에이전트 런타임 동작 원리 파악
- 큐 시스템 통합
- 에러 처리 및 재시도 로직 구현

---

### 2. Kanban Backend API
**파일**: `kanban-backend-api.md`

칸반 보드 REST API의 완전한 명세.

**포함 내용:**
- 데이터 타입 정의 (Board, Column, Card, CardActivity)
- Boards 엔드포인트
  - GET /boards (목록 조회)
  - GET /boards/:id (단건 조회 with 계층 구조)
- Cards 엔드포인트
  - GET /cards (컬럼별 조회)
  - POST /cards (생성)
  - PATCH /cards/:id (부분 업데이트)
  - PATCH /cards/:id/move (이동 & WIP 검증)
  - DELETE /cards/:id (단건 삭제)
  - DELETE /cards/cleanup (대량 삭제)
- 유효성 검증 규칙
- 실시간 WebSocket 이벤트
- 에러 처리
- 성능 최적화 (JOIN 쿼리, 인덱싱)
- 사용 예제

**사용 시기:**
- 칸반 카드 CRUD 연산 구현
- WIP 제한 적용
- 대량 데이터 정리
- 클라이언트-서버 동기화

---

## Quick Links

| 시스템 | 용도 | 링크 |
|--------|------|------|
| Slack 라우팅 | 메시지 분류 및 에이전트 위임 | [`socket-bridge-architecture.md`](./socket-bridge-architecture.md) |
| 칸반 API | 카드/보드 CRUD | [`kanban-backend-api.md`](./kanban-backend-api.md) |

---

## Related Documentation

- **System Design**: `.claude/context/backend/examples/`
- **Database Schema**: `.claude/context/backend/examples/database-schema.md`
- **Architecture Decisions**: `.memory/decisions/`
- **Type Definitions**:
  - socket-bridge: `socket-bridge/src/types.ts`
  - kanban: `kanban/backend/src/types.ts`

---

**Last Updated**: 2026-04-11
**Maintained by**: Homer (Backend Architect)
