---
date: 2026-04-10
topic: architecture
roles: [backend, frontend, designer]
summary: 알림 시스템 v2 Feature Spec — DB 스키마 & UI 컴포넌트 전면 설계 (draft)
status: accepted
---

# Feature Spec: 알림 시스템 v2 — DB 스키마 & UI 컴포넌트 전면 설계

**상태**: draft
**작성자**: Marge  **날짜**: 2026-04-10
**담당 에이전트**: Homer(Backend), Bart(Frontend), Krusty(Designer)
**출처**: 회의 #12 (Backend + Designer 합동 설계)
**선행 스펙**: `2026-04-07_kanban-comments-notifications.md` (Phase 1 — 이 스펙으로 대체)

---

## 문제
04-07 스펙의 알림 시스템은 코멘트 mention 알림에 한정되어 있고, UI는 대시보드 위젯 수준이다. 확장 가능한 알림 아키텍처(다형성 리소스, 날짜 그룹핑, 전용 페이지)로 업그레이드하여 카드·코멘트·작업 상태 등 다양한 알림 소스를 통합 처리해야 한다.

## 설계 결정

| 결정 | 선택한 방안 | 대안 | 선택 이유 |
|------|------------|------|----------|
| PK 타입 | Integer (autoincrement) | UUID | 현행 SQLite 단일 서버 — UUID 오버헤드 불필요. PG 전환 시 재평가 |
| 읽음 처리 | `read_at` 타임스탬프 (NULL=미읽음) | `is_read: 0\|1` | 읽은 시점 추적 가능, 분석 활용도 높음. `IS NULL` 인덱스로 성능 동일 |
| 리소스 참조 | 다형성 (`resource_type` + `resource_id`) | `card_id` 단일 FK | 향후 보드·댓글·작업 등 다양한 소스 확장 가능 |
| 인덱스 전략 | Partial Index 4종 채택 | 일반 인덱스 | 안 읽은 알림 조회(주요 경로) 최적화 |
| 뱃지 캐싱 | SQLite 직접 조회 (Redis 미도입) | Redis 캐싱 | 현재 규모에서 SQLite 충분. 10K+ 알림 시 Redis 도입 재평가 |
| 파티셔닝 | 미도입 (90일 자동 삭제) | 월별 파티셔닝 | SQLite는 네이티브 파티셔닝 미지원. TTL 삭제로 대체 |
| UI 구조 | 3계층: Toast + Badge/Dot + 전용 페이지 | 모달 알림 센터 | 토스 "한 화면, 한 목적" 원칙 준수 |
| 알림 리스트 | 전용 페이지 (`/notifications`) | 기존 위젯 확장 | 날짜 그룹핑·스와이프 삭제 등 풀 기능 필요 |
| 기존 위젯 | 프리뷰 유지 (최근 5개) + "전체 보기" 링크 | 위젯 제거 | 대시보드 진입점 유지 |

## 인터페이스 계약

### DB 스키마 (SQLite)

```sql
CREATE TABLE notifications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient     TEXT NOT NULL,              -- 수신 에이전트 (예: "homer")
  type          TEXT NOT NULL,              -- 'mention' | 'comment' | 'card:created' | 'card:moved' | 'card:updated' | 'task_update'
  resource_type TEXT NOT NULL DEFAULT 'card', -- 'card' | 'comment' | 'board'
  resource_id   INTEGER NOT NULL,           -- 해당 리소스 PK
  title         TEXT NOT NULL,              -- 알림 제목 (표시용)
  message       TEXT NOT NULL,              -- 알림 본문
  actor         TEXT,                       -- 발생시킨 에이전트
  read_at       TEXT DEFAULT NULL,          -- ISO8601, NULL=미읽음
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Partial Index 4종
CREATE INDEX idx_notif_unread ON notifications (recipient, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX idx_notif_timeline ON notifications (recipient, created_at DESC);
CREATE INDEX idx_notif_badge ON notifications (recipient)
  WHERE read_at IS NULL;
CREATE INDEX idx_notif_resource ON notifications (resource_type, resource_id);
```

### API 엔드포인트

| 엔드포인트 | 메서드 | 요청 | 응답 | 에러 응답 |
|-----------|--------|------|------|----------|
| `/notifications` | GET | `?recipient=homer&limit=20&unread_only=true` | `{ data: Notification[], unread_count: number }` | 400 recipient 누락 |
| `/notifications/:id/read` | PATCH | — | `{ success: true, read_at: string }` | 404 알림 없음 |
| `/notifications/read-all` | PATCH | `{ recipient: string }` | `{ updated: number }` | 400 recipient 누락 |
| `/notifications/:id` | DELETE | — | `{ success: true }` | 404 알림 없음 |

### 타입 정의 (Frontend)

```typescript
interface Notification {
  id: number;
  recipient: string;
  type: 'mention' | 'comment' | 'card:created' | 'card:moved' | 'card:updated' | 'task_update';
  resource_type: 'card' | 'comment' | 'board';
  resource_id: number;
  title: string;
  message: string;
  actor?: string;
  read_at: string | null;    // null = 미읽음
  created_at: string;
}
```

### WebSocket 이벤트

| 이벤트 | 페이로드 | 트리거 |
|--------|---------|--------|
| `notification:created` | `Notification` | 알림 생성 시 |
| `notification:read` | `{ id: number, read_at: string }` | 단건 읽음 시 |
| `notification:read-all` | `{ recipient: string, count: number }` | 전체 읽음 시 |

## UI 컴포넌트 스펙 (토스 디자인 시스템)

### Layer 1: Toast (즉각 피드백)

| 항목 | 스펙 |
|------|------|
| 위치 | 하단 탭 바 위 `12px`, 좌우 `20px` |
| 높이 | `48px`, radius `12px` |
| 배경 | `#191F28`, shadow `0 4px 16px rgba(0,0,0,0.12)` |
| 텍스트 | `#FFFFFF`, 16px, weight 400 |
| 모션 | 하단 slide-up spring(1, 80, 10), 3초 후 자동 닫힘 |
| 상태 | Default / Success(`#00C471`) / Error(`#F04452`) / Info(`#0064FF`) |
| 액션 | 선택적 우측 텍스트 버튼 (`#0064FF`, "확인하기") |

### Layer 2: Badge & Dot (네비게이션)

| 항목 | 스펙 |
|------|------|
| Dot | `6px` 원형, `#F04452`, 아이콘 우상단 `-2px` offset |
| Count Badge | min `18px` 높이, padding `4px 6px`, radius `50%`, bg `#F04452`, text `#FFFFFF` 11px weight 600 |
| 숫자 표시 | ≤9 숫자, 10~99 `9+`, ≥100 `99+` |

### Layer 3: 알림 리스트 (전용 페이지 `/notifications`)

| 항목 | 스펙 |
|------|------|
| 상단 바 | 56px, "← 알림" + "모두 읽기" 버튼 |
| ListRow 높이 | min `72px`, padding `16px 20px` |
| Unread dot | `8px`, `#0064FF`, 좌측 수직 중앙 |
| 아이콘 영역 | `40px` 원형, `#F2F4F6` 배경, 타입별 아이콘 |
| 제목 | 16px, unread weight 600 / read weight 400, `#191F28` |
| 부제 | 13px, weight 400, `#8B95A1`, "리소스명 · 시간" |
| 날짜 그룹핑 | "오늘" / "어제" / "이번 주" / 날짜 — ListHeader 13px `#8B95A1` |
| 그룹 구분 | Thick separator `8px solid #F4F4F4` |
| Hover | bg `#F4F4F4` |
| Pressed | bg `#ECECEC` |
| 스와이프 삭제 | 좌 스와이프 → bg `#F04452`, text `#FFFFFF` |
| Empty state | 📭 48px 아이콘 + "아직 알림이 없습니다" |
| 리스트 등장 | Staggered spring, 50ms 간격 |

## 구현 범위

### 포함
- [ ] `notifications` 테이블 생성 (위 스키마 + Partial Index 4종)
- [ ] CRUD API 4종 (목록 조회, 단건 읽음, 전체 읽음, 단건 삭제)
- [ ] WebSocket 이벤트 3종 (`notification:created`, `notification:read`, `notification:read-all`)
- [ ] 알림 자동 생성: 코멘트 mention, 카드 생성/이동/수정 시 관련자에게
- [ ] 90일 이상 오래된 알림 자동 삭제 (서버 시작 시 + 일일 cron)
- [ ] Toast 컴포넌트 (4가지 상태, 자동 닫힘, 액션 버튼)
- [ ] Badge/Dot 컴포넌트 (네비게이션 아이콘 연동)
- [ ] 알림 전용 페이지 (`/notifications`) — 날짜 그룹핑, 스와이프 삭제
- [ ] 기존 `notification-preview.tsx` 위젯을 새 API에 연결 (프리뷰 5개 + 전체 보기 링크)
- [ ] `dashboard-types.ts` Notification 인터페이스 교체

### 제외 (이번에 안 함)
- Redis 뱃지 캐싱 (현재 규모 불필요, 10K+ 알림 시 재평가)
- 월별 파티셔닝 (SQLite 미지원)
- i18n 메시지 템플릿 (Phase 2)
- 푸시 알림 / Slack 연동 (Phase 2)
- 알림 설정 (타입별 on/off) (Phase 2)
- 배치 삽입 최적화 (현재 규모 불필요)

## 인수 조건 (Acceptance Criteria)

### Happy Path
- [ ] Given 알림 전용 페이지 접근 When 알림이 존재할 때 Then 날짜별 그룹핑된 리스트가 표시된다
- [ ] Given 미읽음 알림 존재 When 네비게이션 바 확인 Then Badge에 미읽음 수가 표시된다 (9+ / 99+ 규칙 적용)
- [ ] Given 알림 항목 클릭 When 읽음 처리 Then `read_at` 타임스탬프 기록 + UI에서 unread dot 제거 + Badge 수 감소
- [ ] Given "모두 읽기" 클릭 When 미읽음 알림 존재 Then 해당 recipient의 모든 알림 읽음 처리 + Badge 초기화
- [ ] Given 코멘트에 `@homer` 작성 When 제출 Then homer에게 mention 타입 알림 생성 + WebSocket 실시간 전달
- [ ] Given 카드 이동 발생 When 해당 카드 assignee가 있을 때 Then card:moved 알림 자동 생성
- [ ] Given Toast 트리거 When 알림 수신 Then 하단 slide-up 표시 → 3초 후 자동 닫힘
- [ ] Given 대시보드 위젯 When 알림 존재 Then 최근 5개 프리뷰 + "전체 보기 →" 링크

### 에러 케이스
- [ ] Given recipient 파라미터 누락 When GET /notifications Then 400 에러 + 명확한 메시지
- [ ] Given 존재하지 않는 알림 ID When PATCH /notifications/:id/read Then 404 에러
- [ ] Given 네트워크 실패 When 알림 목록 로드 Then 에러 상태 UI + 재시도 버튼
- [ ] Given WebSocket 연결 끊김 When 알림 수신 불가 Then 폴링 폴백 또는 재연결 시 미싱 알림 동기화

### 엣지 케이스
- [ ] Given 알림 0개 When 전용 페이지 접근 Then Empty state (📭 아이콘 + "아직 알림이 없습니다")
- [ ] Given 미읽음 100개 이상 When Badge 표시 Then `99+` 표시
- [ ] Given 동일 리소스에 대한 알림 다수 When 목록 표시 Then 각각 개별 표시 (그룹핑 미적용 — Phase 2)
- [ ] Given 90일 이상 오래된 알림 When 서버 시작 Then 자동 삭제 실행

## 참조 파일
- `kanban/backend/src/db.ts` — DB 초기화 패턴, 테이블 생성 위치
- `kanban/backend/src/index.ts` — Express 라우트 + WebSocket 브로드캐스트 패턴
- `kanban/frontend/lib/dashboard-types.ts` — 기존 Notification 인터페이스 (교체 대상)
- `kanban/frontend/components/dashboard/notification-preview.tsx` — 기존 위젯 (API 연결 대상)
- `kanban/frontend/app/dashboard/page.tsx` — 대시보드 위젯 통합 위치
- `docs/specs/2026-04-07_kanban-comments-notifications.md` — 선행 스펙 (코멘트 API 부분은 여전히 유효)

## 성공 기준
- [ ] Happy Path AC 전체 통과
- [ ] 에러 케이스 AC 전체 통과
- [ ] 엣지 케이스 AC 전체 통과
- [ ] 기존 대시보드 위젯 기능 regression 없음
- [ ] Toast / Badge / 전용 페이지 3계층 모두 동작
- [ ] WebSocket 실시간 알림 전달 확인
- [ ] 토스 디자인 시스템 토큰 준수 (색상, 타이포, 모션)

## 메모
- 04-07 코멘트 스펙의 알림 부분을 이 스펙이 대체. 코멘트 CRUD API 부분은 04-07 스펙 유지.
- Backend `read_at` 제안 채택: `is_read: 0|1`보다 분석 활용도 높고, 프론트엔드에서는 `read_at === null`로 동일하게 미읽음 판별.
- Redis / 파티셔닝은 의도적으로 제외 — 현재 SQLite 단일 서버에서 premature optimization. 성능 이슈 발생 시 재도입.
- Toast는 신규 컴포넌트 — 알림 시스템뿐 아니라 범용 피드백으로 활용 가능.
