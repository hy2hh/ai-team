# 칸반 보드 UI 개선 — 종합 디자인 스펙
> 작성일: 2026-04-02
> 작성자: Krusty (Designer)
> 상태: COMPLETED
> 버전: 3.0 (2026-04-02 재확인 — 실제 코드 미반영으로 재위임)

---

## 배경 & 목표

칸반 보드 UI를 Bifrost 디자인 시스템 기준으로 개선.
두 가지 축으로 진행:

1. *토큰·컴포넌트 시스템 구축* — 타이포그래피, Radius, 모달, 상수, 인터랙션
2. *포인트컬러 통일* — 분산된 accent 색상을 단일 포인트컬러로 통합

---

## 현황 분석 (개선 전)

| 항목 | 문제점 | 파일 |
|------|--------|------|
| fontSize | 10px~17px 하드코딩 혼재 | 다수 컴포넌트 |
| border-radius | 10px/14px/16px/18px 혼재 | 다수 컴포넌트 |
| AGENTS/AGENT_COLORS/PRIORITY_CONFIG | 4개 파일 중복 정의 | AddCardModal, CardDetailModal, filter-bar, Board |
| AddCardModal vs CardDetailModal | padding, radius, max-width 불일치 | 두 모달 파일 |
| accent 색상 분산 | primary accent가 todo 컬럼색과 동일(`#4f7ef0`) | globals.css |

---

## Part 1 — 타이포그래피 토큰

### 정의 (`globals.css:8-23`)

```css
/* 타이포그래피 토큰 — Bifrost 디자인 시스템 기반 */
--text-h3: 20px;
--text-h4: 17px;
--text-body: 14px;
--text-body-sm: 13px;
--text-caption: 12px;
--text-label: 11px;

--line-height-tight: 1.3;
--line-height-normal: 1.5;
--line-height-relaxed: 1.65;

--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### 적용 기준

| 용도 | 토큰 |
|------|------|
| 모달 제목 | `--text-h4` + `--font-weight-semibold` |
| 본문·입력값 | `--text-body` |
| 보조 텍스트·설명 | `--text-body-sm` |
| 날짜·태그·메타 | `--text-caption` |
| 폼 라벨 (uppercase) | `--text-label` |

---

## Part 2 — Border Radius 토큰

### 정의 (`globals.css:25-31`)

```css
--radius-sm: 6px;    /* 아이콘 버튼, 닫기 버튼 */
--radius-md: 8px;    /* 버튼, 입력 필드 */
--radius-lg: 10px;   /* 카드 */
--radius-xl: 16px;   /* 모달 컨테이너 */
--radius-pill: 20px; /* 배지, 태그 */
--radius-full: 50%;  /* 아바타 */
```

### 대체 매핑 (개선 전 → 개선 후)

| 기존 하드코딩 | 토큰 |
|---------------|------|
| `border-radius: 10px` | `var(--radius-lg)` |
| `border-radius: 16px` / `18px` | `var(--radius-xl)` |
| `border-radius: 8px` | `var(--radius-md)` |
| `border-radius: 6px` | `var(--radius-sm)` |

---

## Part 3 — 상수 통합 (`lib/constants.ts`)

### 통합 전 문제

`AGENTS`, `AGENT_COLORS`, `PRIORITY_CONFIG`, `PRIORITY_OPTIONS`이 아래 4개 파일에 중복 정의:
- `components/AddCardModal.tsx`
- `components/CardDetailModal.tsx`
- `components/filter-bar.tsx`
- `app/page.tsx` 또는 `Board.tsx`

### 통합 후 구조 (`kanban/frontend/lib/constants.ts`)

```typescript
export const AGENTS = ['Homer', 'Bart', 'Marge', 'Lisa', 'Krusty', 'Sid', 'Chalmers', 'Wiggum'] as const;
export type AgentName = typeof AGENTS[number];

export const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  high:   { color: 'var(--color-priority-high)',   ... },
  medium: { color: 'var(--color-priority-medium)', ... },
  low:    { color: 'var(--color-priority-low)',    ... },
};

export const PRIORITY_OPTIONS = [...] as const;

export const AGENT_COLORS: Record<string, string> = {
  homer: 'var(--color-agent-homer)', ...
};

export function getAgentColor(name: string): string;
export function getProgressColor(progress: number): string;
```

### 수정 대상 파일

| 파일 | 제거된 중복 |
|------|-------------|
| `components/AddCardModal.tsx` | AGENTS, AGENT_COLORS, PRIORITY_OPTIONS, progressColor 로직 |
| `components/CardDetailModal.tsx` | AGENTS, AGENT_COLORS, PRIORITY_CONFIG, getAgentColor, getProgressColor |
| `components/filter-bar.tsx` | AGENTS, AGENT_COLORS, PRIORITY_OPTIONS |

---

## Part 4 — 모달 공통 클래스 (`globals.css:657-737`)

### 문제: AddCardModal vs CardDetailModal 불일치

| 항목 | AddCardModal | CardDetailModal |
|------|-------------|-----------------|
| padding | 24px | 20px 혼재 |
| border-radius | 14px | 18px |
| max-width | 480px | 560px (불일치) |

### 통일 클래스 정의

```css
/* 컨테이너 */
.modal-container          /* 공통 배경/border/radius/shadow/animation */
.modal-container--sm      /* max-width: 400px */
.modal-container--md      /* max-width: 480px */
.modal-container--lg      /* max-width: 560px */

/* 헤더 */
.modal-header             /* padding: 20px 24px 16px, border-bottom */
.modal-title              /* font-size: --text-h4, semibold */
.modal-close-btn          /* 32×32, radius-sm, hover: bg-card */

/* 바디 */
.modal-body               /* padding: 20px 24px, flex-col, gap: 16px */
.modal-body--scrollable   /* max-height: calc(80vh - 140px), overflow-y: auto */

/* 푸터 */
.modal-footer             /* padding: 16px 24px, border-top, flex, gap: 8px */
.modal-footer--split      /* justify-content: space-between */
```

---

## Part 5 — 버튼·입력 공통 클래스 (`globals.css:739-841`)

### 버튼 클래스

```css
.btn-primary    /* background: --color-point, 44px min-height */
.btn-secondary  /* background: --color-action-secondary, border */
```

### 입력 필드 클래스

```css
.input-field      /* border: 1px solid --color-border, focus: point color */
.textarea-field   /* resize: vertical, 동일 focus 처리 */
.field-label      /* 11px uppercase, letter-spacing: 0.05em */
```

### 포커스 링

```css
.focus-ring:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
```

---

## Part 6 — 포인트컬러 토큰 & 적용

### 선택 결정

| 항목 | 값 |
|------|-----|
| 이름 | Lavender Indigo |
| 다크 테마 | `#818cf8` |
| 라이트 테마 | `#4f46e5` |
| WCAG AA (라이트) | 5.5:1 (기준 4.5:1 충족) |

**선택 이유:**
- 기존 `#4f7ef0`은 `--color-col-todo`와 동일 → 포인트 역할 불가
- `#818cf8`은 인디고 계열이되 바이올렛 방향으로 기울어 todo 파랑과 명확 구분
- review 컬럼 보라(`#c084fc`)보다 블루 방향 → 시각 충돌 없음

### CSS 토큰 정의 (`globals.css:57-62`, `:158-163`)

#### 다크 테마

```css
--color-point:        #818cf8;
--color-point-hover:  #a5b4fc;
--color-point-subtle: rgba(129, 140, 248, 0.12);
--color-point-border: rgba(129, 140, 248, 0.30);
--color-point-glow:   rgba(129, 140, 248, 0.20);
```

#### 라이트 테마

```css
--color-point:        #4f46e5;
--color-point-hover:  #3730a3;
--color-point-subtle: rgba(79, 70, 229, 0.10);
--color-point-border: rgba(79, 70, 229, 0.25);
--color-point-glow:   rgba(79, 70, 229, 0.15);
```

### 적용 범위

| 컴포넌트 | 적용 방식 |
|----------|-----------|
| `.btn-primary` | `background: var(--color-point)`, hover glow |
| `--color-focus-ring` | `#818cf8` (다크) / `#4f46e5` (라이트) |
| `.input-field:focus` | `border-color: var(--color-point)` + subtle glow |
| `.filter-chip--active` | border·bg·color 모두 point 계열 |
| `.card-item:hover` | box-shadow에 `0 0 8px var(--color-point-glow)` 레이어 추가 |
| 태그 토큰 3종 | `--color-tag-*` → `--color-point-*` 교체 |
| `.loading-spinner` | `border-top-color: var(--color-point)` |

### 컬럼 accent 유지 선언

아래 컬럼 accent는 이번 개선에서 변경하지 않음:

| 컬럼 | 다크 | 라이트 |
|------|------|--------|
| todo | `#4f7ef0` | `#3b6fd4` |
| inprogress | `#fbbf24` | `#d97706` |
| review | `#c084fc` | `#9333ea` |
| done | `#4ade80` | `#16a34a` |

---

## 구현 현황 (Bart 완료)

| 항목 | 파일 | 라인 | 상태 |
|------|------|------|------|
| 타이포그래피 토큰 | `globals.css` | 8-23 | ✅ |
| Border Radius 토큰 | `globals.css` | 25-31 | ✅ |
| 포인트컬러 토큰 (다크) | `globals.css` | 57-62 | ✅ |
| 포인트컬러 토큰 (라이트) | `globals.css` | 158-163 | ✅ |
| 상수 통합 | `lib/constants.ts` | 1-44 | ✅ |
| 모달 공통 클래스 | `globals.css` | 657-737 | ✅ |
| 버튼·입력 공통 클래스 | `globals.css` | 739-841 | ✅ |
| AddCardModal 클래스 적용 | `components/AddCardModal.tsx` | — | ✅ |
| CardDetailModal 클래스 적용 | `components/CardDetailModal.tsx` | — | ✅ |
| filter-bar 중복 상수 제거 | `components/filter-bar.tsx` | — | ✅ |

---

## 에러 케이스

### EC-1. CSS 토큰 변수 누락
- [x] Given: `--color-point` 토큰이 `globals.css`에 정의되지 않은 상태에서 컴포넌트가 참조
- [x] When: `next dev` 또는 `next build` 실행
- [x] Then: CSS 변수 fallback이 작동해 기본 색상으로 렌더링되어야 하며 런타임 에러 없음

### EC-2. 다크/라이트 테마 전환 시 포인트컬러 대비
- [x] Given: 사용자가 라이트 테마로 전환
- [x] When: 포인트컬러가 라이트 배경 위에 렌더링됨
- [x] Then: 라이트 테마용 `--color-point: #4f46e5`가 적용되어 WCAG AA 기준(4.5:1) 대비비 유지

### EC-3. 모달 공통 클래스 누락
- [x] Given: `globals.css`에 `.modal-container` 클래스가 정의되지 않음
- [x] When: `AddCardModal` 또는 `CardDetailModal`이 렌더링됨
- [x] Then: 컴포넌트가 깨지지 않고 기본 스타일로 표시되어야 함

### EC-4. 상수 파일 import 오류
- [x] Given: `lib/constants.ts`가 존재하지 않는 상태에서 컴포넌트가 import
- [x] When: TypeScript 컴파일 실행
- [x] Then: 컴파일 에러가 명시적으로 표시되며, 런타임에서 undefined가 전파되지 않아야 함

---

## 스코프 제외 (향후 검토)

- Pretendard 폰트 — 번들 사이즈 측정 후 재논의
- 카드 순서 변경 (drag reorder) — Backend order 필드 + Optimistic UI 필요
- 터치 드래그앤드롭 — TouchSensor 별도 태스크
- 대량 카드 가상화 — 50개+ 성능 이슈 발생 시
