# Dashboard Page — UI/UX Design Spec

> 작성자: Krusty (Designer)
> 작성일: 2026-04-02
> 버전: 1.0
> 연관 결정: meeting-3 (실시간 알림 기능 설계)

---

## 1. 개요

칸반보드 대시보드 페이지는 팀의 작업 현황을 한눈에 파악할 수 있는 요약 뷰입니다.
기존 보드 페이지(`/`) 외에 별도 라우트(`/dashboard`)로 구현합니다.

**핵심 목표:**
- 전체 카드 현황, WIP 상태, 마감일 위험도, 에이전트 워크로드를 단일 뷰에서 제공
- 기존 디자인 시스템 토큰 100% 재사용 (신규 색상/폰트 추가 없음)
- 모든 데이터는 기존 REST API + WebSocket으로 실시간 반영

---

## 2. 디자인 토큰 적용 원칙

### 색상 (기존 토큰만 사용)

**배경 계층:**
- 페이지 배경: `--color-bg-base` (#080d17 dark / #f0f4f8 light)
- 위젯 카드: `--color-bg-elevated` (#111d33 dark / #ffffff light)
- 헤더/강조 영역: `--color-bg-surface` (#0d1526 dark / #f8fafc light)

**텍스트:**
- 제목: `--color-text-primary` (#e2e8f5 dark / #1e293b light)
- 부제목/레이블: `--color-text-secondary` (#7a90b8 dark / #64748b light)
- 비활성: `--color-text-muted` (#3d506e dark / #94a3b8 light)

**상태 색상:**
- 위험/높음: `--color-priority-high` (#f87171)
- 주의/중간: `--color-priority-medium` (#fbbf24)
- 정상/낮음: `--color-priority-low` (#4ade80)
- 마감 임박: `--color-due-warning` (#fb923c)
- 마감 초과: `--color-due-overdue` (#f87171)

**컬럼 accent:**
- TODO: `--color-col-todo` (#4f7ef0)
- In Progress: `--color-col-inprogress` (#fbbf24)
- Review: `--color-col-review` (#c084fc)
- Done: `--color-col-done` (#4ade80)

**에이전트 색상:** `--color-agent-{name}` (Homer~Wiggum 8종)

### 타이포그래피

```
대형 수치 (stat number): 28px / font-weight: 700 / --color-text-primary
섹션 제목:               14px / font-weight: 600 / --color-text-primary
위젯 레이블:             12px / font-weight: 500 / --color-text-secondary
본문/설명:               13px / font-weight: 400 / --color-text-secondary
타임스탬프/메타:         11px / font-weight: 400 / --color-text-muted
```

### 간격 시스템

```
위젯 내부 padding:        16px (모바일: 12px)
위젯 간격 (gap):          16px (모바일: 12px)
섹션 간격:               24px
border-radius (위젯):    10px
border-radius (배지):    6px
border-radius (아바타):  50%
```

### 테두리

```
위젯 border: 1px solid --color-border (#1e2d47 dark / #e2e8f0 light)
강조 border: 1px solid --color-border-strong (#253550)
```

---

## 3. 레이아웃 구조

### 3-1. 전체 페이지 구조

```
┌─────────────────────────────────────────────────────┐
│  Dashboard Header (네비게이션 탭 포함)                │
├─────────────────────────────────────────────────────┤
│  Summary Stats Row (4개 수치 카드)                   │
├──────────────────────────┬──────────────────────────┤
│  Column Status Overview  │  WIP Monitor              │
│  (카드 분포 바 차트)      │  (한도 대비 현황)          │
├──────────────────────────┴──────────────────────────┤
│  Priority Distribution   │  Agent Workload           │
│  (우선순위 분포)          │  (에이전트별 카드 수)      │
├──────────────────────────┴──────────────────────────┤
│  Recent Activity Feed (최근 활동 타임라인)            │
├─────────────────────────────────────────────────────┤
│  Notification Center Preview (미읽음 알림 미리보기)  │
└─────────────────────────────────────────────────────┘
```

### 3-2. 데스크탑 그리드 (≥ 768px)

```
12-column grid, gap: 16px, max-width: 1280px, margin: 0 auto

Row 1 — Summary Stats:
  [col 1-3] [col 4-6] [col 7-9] [col 10-12]
  총 카드    완료율     WIP 경고   마감 임박

Row 2 — Status:
  [col 1-7] Column Status Overview (58%)
  [col 8-12] WIP Monitor (42%)

Row 3 — Analytics:
  [col 1-6] Priority Distribution (50%)
  [col 7-12] Agent Workload (50%)

Row 4 — Activity:
  [col 1-12] Recent Activity Feed (full width)

Row 5 — Notifications:
  [col 1-12] Notification Center Preview (full width)
```

### 3-3. 태블릿 그리드 (480px – 767px)

```
2-column grid, gap: 12px

Row 1: [총 카드] [완료율]
Row 2: [WIP 경고] [마감 임박]
Row 3: [Column Status — full width]
Row 4: [WIP Monitor — full width]
Row 5: [Priority Distribution] [Agent Workload]
Row 6: [Recent Activity — full width]
Row 7: [Notification Center — full width]
```

### 3-4. 모바일 레이아웃 (< 480px)

```
1-column, gap: 12px, padding: 12px

순서 (세로 스택):
1. Summary Stats (2×2 그리드 내부)
2. Column Status Overview
3. WIP Monitor
4. Priority Distribution
5. Agent Workload
6. Recent Activity Feed (최대 5개 항목)
7. Notification Center Preview
```

---

## 4. 위젯 상세 명세

---

### 4-1. Dashboard Header

**구조:**
```
┌────────────────────────────────────────────────────┐
│  [Kanban Logo]  Board | Dashboard      [🌙] [🔔 3] │
└────────────────────────────────────────────────────┘
```

**스펙:**
- 높이: 52px (데스크탑) / 44px (모바일)
- 배경: `--color-bg-surface`
- 하단 border: `1px solid --color-border`
- 탭 네비게이션: "Board" (기본), "Dashboard" (현재)
  - 활성 탭: `--color-action-primary` + 하단 2px 밑줄
  - 비활성 탭: `--color-text-secondary`
- 알림 벨 아이콘: 미읽음 시 `--color-priority-high` 뱃지 (meeting-3 결정)
- 테마 토글: 기존 `useTheme()` 훅 재사용

---

### 4-2. Summary Stats Row (수치 카드 4개)

각 카드 구조:
```
┌───────────────────┐
│ 🔢  수치 (28px)   │
│ 레이블 (12px)     │
│ 변화량 (11px)     │
└───────────────────┘
```

**카드 목록:**

| # | 아이콘 | 수치 | 레이블 | accent 색상 |
|---|--------|------|--------|------------|
| 1 | 📋 | 전체 카드 수 | Total Cards | `--color-action-primary` |
| 2 | ✅ | 완료율 (%) | Completion Rate | `--color-col-done` |
| 3 | ⚠️ | WIP 한도 초과 컬럼 수 | WIP Violations | `--color-priority-high` |
| 4 | 🔴 | 마감 초과/임박 카드 수 | Due Soon | `--color-due-warning` |

**스펙:**
- 배경: `--color-bg-elevated`
- 좌측에 4px accent 세로 바 (accent 색상)
- 수치: `--color-text-primary`, 700 weight
- 레이블: `--color-text-secondary`, 12px
- 변화량: "↑ 2 from yesterday" 형태, `--color-text-muted`, 11px
- padding: 16px
- border-radius: 10px
- hover: `--color-bg-card` 배경 전환 (150ms)

**상태:**
- Loading: 수치 영역에 32×12px 스켈레톤 (pulse 애니메이션)
- Error: `--color-priority-high` 아이콘 + "데이터 로드 실패" 11px 텍스트
- Empty (0): 수치 "0", 색상 `--color-text-muted`

---

### 4-3. Column Status Overview

**목적:** 각 컬럼의 카드 수를 비율 바로 시각화

**구조:**
```
Column Status                         [총 n장]
──────────────────────────────────────────────
TODO          ████████░░░░  8 / 12    (67%)
In Progress   ██████░░░░░░  6 / 10    (60%) ⚠
Review        ████░░░░░░░░  4 / 8     (50%)
Done          ████████████  12        ——
──────────────────────────────────────────────
```

**스펙:**
- 각 행 높이: 32px
- 진행 바: 높이 6px, `border-radius: 3px`
  - 배경: `--color-border`
  - 채움: 해당 컬럼 accent 색상 (`--color-col-{name}`)
  - WIP 초과 시: `--color-priority-high` + ⚠️ 아이콘
- WIP 한도 표시: `현재 / 한도` 형태, `--color-text-muted`
- 비율(%): `--color-text-secondary`, 11px, 우측 정렬
- 컬럼명: `--color-text-primary`, 13px, font-weight 500

**상태:**
- Loading: 행마다 바 영역 스켈레톤
- Empty: "카드가 없습니다" + 빈 보드 아이콘, `--color-text-muted`
- Error: 재시도 버튼 포함 에러 메시지

---

### 4-4. WIP Monitor

**목적:** WIP 한도 대비 현황을 컬럼별 게이지로 표시

**구조:**
```
WIP Monitor
────────────────────
TODO         6/∞  ——
In Progress  8/6  ⚠ WIP 초과!
Review       3/5  ●●●○○
Done         ——
────────────────────
가장 부하가 높은 컬럼: In Progress
```

**스펙:**
- 한도 없는 컬럼 (∞): "——" 표시, `--color-text-muted`
- 정상 (< 한도): `--color-col-inprogress` (채움), `--color-col-todo` (배경)
- 경고 (= 한도): `--color-priority-medium`
- 초과 (> 한도): `--color-priority-high` + 배경 `rgba(248,113,113,0.12)`
- 하단 요약: "가장 부하 높은 컬럼 + 카드 수" 강조 표시

**상태:**
- Loading: 게이지 스켈레톤
- 모든 정상: "✅ 모든 컬럼 WIP 정상" 초록 텍스트
- Error: "WIP 데이터를 불러올 수 없습니다"

---

### 4-5. Priority Distribution

**목적:** 전체 카드의 우선순위 분포를 도넛형 비주얼로 표시

**구조:**
```
Priority Distribution
─────────────────────────
  ●  High    8장  (33%)
  ●  Medium  12장 (50%)
  ●  Low     4장  (17%)
─────────────────────────
  총 24장
```

**스펙:**
- CSS only 도넛 차트 (SVG 원형) or 수평 누적 바
  - High: `--color-priority-high` (#f87171)
  - Medium: `--color-priority-medium` (#fbbf24)
  - Low: `--color-priority-low` (#4ade80)
- 범례: 컬러 닷(8px circle) + 레이블 + 수량 + 비율
- 총계: 하단에 `--color-text-secondary`
- 클릭 시: 보드로 이동 + 해당 우선순위 필터 자동 적용

**상태:**
- Loading: 도넛 차트 자리에 원형 스켈레톤
- Empty: "카드가 없습니다" 중앙 텍스트
- 전부 동일: 정상 표시 (차트 단색)

---

### 4-6. Agent Workload

**목적:** 에이전트별 담당 카드 수와 마감 위험도 표시

**구조:**
```
Agent Workload
──────────────────────────────
● Homer    ████░░  4장  (2 완료, 1 임박)
● Bart     ██░░░░  2장  (0 완료)
● Marge    ████████  6장  ⚠ 과부하
● (미배정)  ░░░░░░  3장
──────────────────────────────
```

**스펙:**
- 에이전트 아바타: 16px 원형, `--color-agent-{name}` 배경 + 이니셜
- 바 길이: 최대 담당 수 대비 비율
- 과부하 기준: 가장 많이 맡은 에이전트 대비 2배 이상
- 마감 임박 카드: 주황 소형 뱃지 표시
- 미배정 카드: `--color-text-muted` 빗금 아바타
- 클릭 시: 보드로 이동 + 해당 에이전트 필터 적용

**상태:**
- Loading: 행마다 아바타 + 바 스켈레톤
- Empty: "담당 카드 없음"
- 에이전트 없음: "아직 카드가 배정되지 않았습니다"

---

### 4-7. Recent Activity Feed

**목적:** 최근 발생한 카드 변경 이벤트를 타임라인으로 표시

**구조:**
```
Recent Activity                          [전체 보기]
──────────────────────────────────────────────────
● Marge    "API 설계" 카드를 Review로 이동    3분 전
● Homer    "DB 스키마" 카드 생성              12분 전
● Bart     "프론트 컴포넌트" 완료 처리        1시간 전
● Lisa     "리서치 정리" 마감일 변경          어제
──────────────────────────────────────────────────
```

**스펙:**
- 각 항목 높이: 40px
- 에이전트 아바타: 24px 원형 (left side)
- 이벤트 텍스트: 13px, `--color-text-primary`
  - 카드명: 굵게 (font-weight 600)
  - 액션: 일반 (font-weight 400)
- 타임스탬프: 11px, `--color-text-muted`, 우측 정렬
- 이벤트 타입별 아이콘:
  - card:created → 🆕 `--color-col-todo`
  - card:moved → ➡️ `--color-col-inprogress`
  - card:updated → ✏️ `--color-text-secondary`
  - card:deleted → 🗑️ `--color-priority-high`
- 표시 개수: 기본 10개 / 모바일 5개
- "전체 보기" 링크: `--color-action-primary`

**상태:**
- Loading: 10개 행 스켈레톤 (아바타 원 + 긴 텍스트 바 + 짧은 타임스탬프 바)
- Empty: "아직 활동 내역이 없습니다" + 보드 시작 CTA 버튼
- Error: "활동 내역을 불러오지 못했습니다" + 재시도 버튼

---

### 4-8. Notification Center Preview

**목적:** meeting-3 결정의 알림 센터 미리보기 (미읽음 알림 최대 5개)

**구조:**
```
Notifications                      [미읽음 3]  [모두 읽음]
──────────────────────────────────────────────────────
🔵 [●] "칸반 설계" 카드가 생성됨 — Homer     5분 전
🟡 [●] "API 연동" In Progress → Review — Bart  20분 전
🔴 [●] "DB 마이그레이션" 마감 초과!           1시간 전
   [ ] "프론트 컴포넌트" 완료 처리 — Bart     어제
──────────────────────────────────────────────────────
[알림 센터 전체 보기 →]
```

**스펙:**
- 미읽음 항목: 좌측 4px `--color-action-primary` accent 바 + `--color-bg-card` 배경
- 읽음 항목: 배경 투명, `--color-text-muted` 텍스트
- 미읽음 닷: 8px 원, `--color-action-primary`
- 알림 타입별 아이콘 색상: 이벤트 타입과 동일 (4-7과 통일)
- "모두 읽음" 버튼: `--color-text-secondary`, hover 시 `--color-action-primary`
- "전체 보기" 링크: 클릭 시 `/dashboard#notifications` 앵커 or 알림 전용 패널 오픈

**상태:**
- Loading: 5개 행 스켈레톤
- Empty (모두 읽음): "✅ 새 알림이 없습니다" 초록 텍스트
- Error: "알림을 불러올 수 없습니다"

---

## 5. 상호작용 패턴

### 5-1. 위젯 → 보드 필터 연동

모든 클릭 가능한 데이터는 보드로 이동 + 필터 자동 적용:

```
우선순위 High 클릭     → /         + priority: ['high'] 필터 적용
에이전트 Homer 클릭   → /         + assignee: ['homer'] 필터 적용
컬럼 In Progress 클릭 → /         + 해당 컬럼 스크롤
마감 임박 카드 클릭   → /         + 카드 상세 모달 오픈
```

### 5-2. 실시간 업데이트

기존 WebSocket 연결 재사용 (Board.tsx 패턴 동일):
- `card:created / card:updated / card:moved / card:deleted` 이벤트 수신 시
- 수치 카드 즉시 업데이트 (re-fetch 없이 클라이언트 상태 계산)
- Activity Feed 새 항목 상단 삽입 (slideDown 애니메이션 150ms)
- Notification 뱃지 카운터 실시간 증가

### 5-3. 새로고침

- 각 위젯 우상단 새로고침 아이콘 (hover 시 표시)
- 아이콘 클릭: spin 애니메이션 300ms + 데이터 재요청

### 5-4. 애니메이션

```css
/* 기존 토큰 사용 */
--duration-fast:   150ms   /* hover, 상태 전환 */
--duration-normal: 200ms   /* 위젯 로드 완료 */
--duration-slow:   300ms   /* 페이지 진입, 스켈레톤 → 데이터 */
```

---

## 6. 접근성 명세

- 모든 위젯: `role="region"` + `aria-label="위젯명"`
- 수치 카드: `aria-live="polite"` (실시간 업데이트 알림)
- 알림 센터: `aria-live="assertive"` + `role="log"`
- 진행 바: `role="progressbar"` + `aria-valuenow` + `aria-valuemax`
- 스켈레톤: `aria-busy="true"` + `aria-label="로딩 중"`
- 색상만으로 상태 구분 금지 → 아이콘/텍스트 병행 표시
- 최소 터치 타겟: 44×44px (버튼, 링크)
- 키보드 포커스 링: `0 0 0 3px rgba(79,126,240,0.15)` (기존 패턴 동일)

---

## 7. 컴포넌트 목록 (구현 대상)

```
app/
└── dashboard/
    └── page.tsx              ← 대시보드 페이지 라우트

components/dashboard/
├── DashboardHeader.tsx       ← 네비게이션 탭 + 테마 토글 + 알림 벨
├── SummaryStatCard.tsx       ← 수치 카드 (재사용 가능, props로 구성)
├── ColumnStatusOverview.tsx  ← 컬럼별 카드 분포 바 차트
├── WipMonitor.tsx            ← WIP 한도 게이지
├── PriorityDistribution.tsx  ← 우선순위 도넛/누적 바
├── AgentWorkload.tsx         ← 에이전트별 카드 수 바
├── RecentActivityFeed.tsx    ← 활동 타임라인
├── NotificationPreview.tsx   ← 미읽음 알림 미리보기
└── SkeletonWidget.tsx        ← 공용 스켈레톤 로딩 컴포넌트
```

---

## 8. 신규 API 엔드포인트 요구사항

대시보드 데이터는 아래 API가 필요합니다 (Backend 구현 필요):

```
GET /dashboard/summary
  Response: {
    totalCards: number,
    completionRate: number,        // Done 컬럼 카드 / 전체 카드
    wipViolations: number,         // WIP 초과 컬럼 수
    dueSoonCount: number,          // 오늘 + 내일 마감 카드 수
    overdueCount: number           // 마감 초과 카드 수
  }

GET /dashboard/activity?limit=10
  Response: ActivityEvent[]
    ActivityEvent: {
      id, type, cardId, cardTitle,
      actor, fromColumn?, toColumn?,
      timestamp
    }

GET /notifications?limit=5&unread=true
  (meeting-3 결정 — notifications 테이블 기반)
```

기존 `GET /boards/:id` 응답의 columns + cards 데이터를 클라이언트에서
집계하여 Column Status, WIP Monitor, Priority Distribution, Agent Workload
위젯에 사용 가능 (추가 API 불필요).

---

## 9. 파일 저장 경로

```
kanban/docs/specs/dashboard-page-spec.md   ← 이 문서
kanban/frontend/app/dashboard/page.tsx     ← 구현 대상
kanban/frontend/components/dashboard/     ← 구현 대상
```

---

## 10. 구현 우선순위 (Frontend 참고)

```
P0 (MVP):
  - DashboardHeader (탭 네비게이션)
  - SummaryStatCard × 4
  - ColumnStatusOverview
  - WipMonitor

P1 (Phase 2):
  - PriorityDistribution
  - AgentWorkload
  - RecentActivityFeed

P2 (Phase 3 — meeting-3 알림 센터 완료 후):
  - NotificationPreview
  - 알림 벨 실시간 뱃지
```

---

*이 스펙은 기존 디자인 토큰(`globals.css`)을 100% 재사용합니다.
신규 색상 변수, 폰트, 간격 단위를 추가하지 않습니다.*
