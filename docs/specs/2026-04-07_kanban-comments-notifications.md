# Feature Spec: 칸반 코멘트 + 알림 시스템 (Clawe 이식 Phase 1)

**상태**: approved
**작성자**: Marge  **날짜**: 2026-04-07
**담당 에이전트**: Homer(Backend), Bart(Frontend)
**출처**: Clawe 레포 분석 (Lisa 리서치 2026-04-07)

---

## 문제
카드에 코멘트를 남기거나 @mention 알림을 받을 수 없어 에이전트 간 카드 내 소통이 불가능하다. 현재 알림은 타입 정의(`dashboard-types.ts`)와 빈 UI(`notification-preview.tsx`)만 있고 실제 동작하지 않는다.

## 설계 결정
| 결정 | 선택한 방안 | 대안 | 선택 이유 |
|------|------------|------|----------|
| DB | SQLite 테이블 추가 | Convex (Clawe 방식) | 현행 스택 유지, 마이그레이션 비용 없음 |
| mention 파싱 | 서버에서 `@agent` 정규식 파싱 | 클라이언트 파싱 | 알림 생성과 동일 트랜잭션 보장 |
| 실시간 갱신 | 기존 WebSocket 브로드캐스트 확장 | 폴링 | 이미 WS 인프라 있음 |
| 알림 UI | 기존 notification-preview.tsx 연결 | 새 컴포넌트 | 이미 타입/UI 껍데기 있음 |

## 인터페이스 계약

| 엔드포인트 | 메서드 | 요청 | 응답 | 에러 응답 |
|-----------|--------|------|------|----------|
| `/cards/:id/comments` | GET | `?limit=50&offset=0` | `Comment[]` | 404 카드 없음 |
| `/cards/:id/comments` | POST | `{ author: string, content: string }` | `Comment` (생성됨) | 400 content 비어있음, 404 카드 없음 |
| `/notifications` | GET | `?agent=homer&limit=20&unread_only=true` | `Notification[]` | — |
| `/notifications/:id/read` | PATCH | — | `{ success: true }` | 404 알림 없음 |
| `/notifications/read-all` | PATCH | `{ agent: string }` | `{ updated: number }` | — |

### 타입 정의
```typescript
interface Comment {
  id: number;
  card_id: number;
  author: string;        // 에이전트 assignee 값 재사용
  content: string;
  mentions: string[];    // ["homer", "bart"]
  created_at: string;
}

interface Notification {
  id: number;
  type: 'mention' | 'comment' | 'task_update';
  card_id: number;
  card_title: string;
  message: string;
  actor: string;
  is_read: number;       // 0 | 1
  created_at: string;
}
```

## 구현 범위
### 포함
- [ ] `comments` 테이블 생성 (id, card_id FK, author, content, mentions JSON, created_at)
- [ ] `notifications` 테이블 생성 (id, recipient, type, card_id, card_title, message, actor, is_read, created_at)
- [ ] 코멘트 CRUD API (GET 목록, POST 생성)
- [ ] mention 파싱: `@agent` 패턴 → notifications 자동 생성
- [ ] 알림 조회/읽음처리/일괄읽음 API
- [ ] 코멘트 작성 시 WebSocket 브로드캐스트 (`comment:created` 이벤트)
- [ ] CardDetailModal에 코멘트 섹션 추가 (입력창 + 스레드 목록)
- [ ] notification-preview.tsx를 실제 API 연결 (기존 빈 상태 대체)
- [ ] 알림 벨 아이콘에 읽지 않은 알림 수 배지 표시

### 제외 (이번에 안 함)
- 코멘트 수정/삭제 (Phase 2에서 검토)
- 코멘트 내 이미지/파일 첨부
- 서브태스크, Deliverable, Activity Feed (Phase 2-3)
- 푸시 알림 (Slack 연동)
- 코멘트 검색

## 인수 조건 (Acceptance Criteria)

### Happy Path
- [ ] Given 카드 상세 모달을 열었을 때 When 코멘트 입력란이 보인다 Then 텍스트를 입력하고 제출할 수 있다
- [ ] Given 코멘트에 `@homer`를 포함하여 작성 When 제출 Then homer의 알림 목록에 mention 알림이 생성된다
- [ ] Given 알림 벨을 클릭 When 읽지 않은 알림이 있다 Then 알림 목록이 표시되고 읽지 않은 수가 배지로 보인다
- [ ] Given 알림을 클릭 When 읽음 처리 Then is_read가 1로 변경되고 배지 수가 감소한다
- [ ] Given 코멘트를 작성 When 다른 클라이언트가 같은 카드를 보고 있다 Then WebSocket으로 실시간 반영된다

### 에러 케이스
- [ ] Given 빈 content로 POST When /cards/:id/comments Then 400 에러 + "코멘트 내용을 입력하세요" 메시지
- [ ] Given 존재하지 않는 card_id When GET /cards/:id/comments Then 404 에러
- [ ] Given 네트워크 실패 When 코멘트 제출 Then UI에 재시도 안내 표시, 입력 내용 유지

### 엣지 케이스
- [ ] Given 코멘트가 0개인 카드 When 코멘트 섹션 표시 Then "아직 코멘트가 없습니다" 빈 상태 표시
- [ ] Given mention 대상이 존재하지 않는 에이전트 When 파싱 Then 무시 (알림 미생성, 에러 아님)
- [ ] Given 알림이 0개 When 알림 벨 클릭 Then "새 알림이 없습니다" 표시 (기존 UI 동작 유지)

## 참조 파일
- `kanban/backend/src/db.ts` — DB 초기화 패턴, 기존 테이블 스키마 (boards, columns, cards)
- `kanban/backend/src/index.ts` — Express 라우트 패턴, WebSocket 브로드캐스트 패턴
- `kanban/frontend/lib/dashboard-types.ts` — 기존 Notification 인터페이스 (이 스펙의 타입으로 교체)
- `kanban/frontend/components/dashboard/notification-preview.tsx` — 빈 알림 UI (실데이터 연결 대상)
- `kanban/frontend/components/CardDetailModal.tsx` — 코멘트 섹션 추가 위치

## 성공 기준
- [ ] Happy Path AC 전체 통과
- [ ] 에러 케이스 AC 전체 통과
- [ ] 엣지 케이스 AC 전체 통과
- [ ] 기존 카드 CRUD 기능에 regression 없음
- [ ] 대시보드 알림 위젯이 실제 데이터 표시

## 메모
- Clawe의 Convex/Docker 스택 대신 현행 SQLite+Express 유지 결정 (Lisa 리서치 기반)
- 기존 `Notification` 타입(`dashboard-types.ts`)은 이 스펙의 타입으로 교체 필요
- Phase 2 (서브태스크 + Deliverable), Phase 3 (루틴 스케줄링)은 별도 스펙으로 관리
