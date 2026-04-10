---
date: 2026-03-27
topic: design-system
roles: [designer, frontend]
summary: 칸반보드 UI 디자인 스펙 핸드오프 — 디자인 토큰, 컴포넌트 명세 (⚠️ 만료 +15일, facts/ 승격 또는 삭제 필요)
status: deprecated
---

# 칸반보드 UI 디자인 스펙
> Designer → Frontend 핸드오프
> 작성: 2026-03-27

---

## 1. 디자인 토큰

### 1.1 색상 시스템

```css
:root {
  /* === 기본 팔레트 === */
  --color-bg-base:        #0f1117;   /* 앱 배경 (다크) */
  --color-bg-surface:     #1a1d27;   /* 카드/컬럼 배경 */
  --color-bg-elevated:    #222636;   /* 모달/드롭다운 */
  --color-bg-hover:       #2a2f45;   /* hover 상태 */

  --color-border:         #2e3347;   /* 기본 border */
  --color-border-focus:   #5865f2;   /* focus ring */

  --color-text-primary:   #e8eaf0;   /* 본문 텍스트 */
  --color-text-secondary: #8b91a8;   /* 보조 텍스트 */
  --color-text-muted:     #555a70;   /* 비활성 텍스트 */
  --color-text-inverse:   #0f1117;   /* 어두운 배경의 밝은 텍스트 */

  /* === 컬럼 상태 색상 === */
  --color-col-backlog:    #4a5568;   /* Backlog — 회색 */
  --color-col-progress:   #5865f2;   /* In Progress — 인디고 */
  --color-col-review:     #d69e2e;   /* Review — 앰버 */
  --color-col-done:       #38a169;   /* Done — 그린 */
  --color-col-blocked:    #e53e3e;   /* Blocked — 레드 */

  /* 컬럼 색상 배경 버전 (투명도) */
  --color-col-backlog-bg:   rgba(74, 85, 104, 0.15);
  --color-col-progress-bg:  rgba(88, 101, 242, 0.15);
  --color-col-review-bg:    rgba(214, 158, 46, 0.15);
  --color-col-done-bg:      rgba(56, 161, 105, 0.15);
  --color-col-blocked-bg:   rgba(229, 62, 62, 0.15);

  /* === 우선순위 배지 === */
  --color-priority-high:    #fc8181;   /* High — 연한 레드 */
  --color-priority-medium:  #f6ad55;   /* Medium — 연한 오렌지 */
  --color-priority-low:     #68d391;   /* Low — 연한 그린 */

  --color-priority-high-bg:   rgba(252, 129, 129, 0.15);
  --color-priority-medium-bg: rgba(246, 173, 85, 0.15);
  --color-priority-low-bg:    rgba(104, 211, 145, 0.15);

  /* === 시맨틱 === */
  --color-accent:         #5865f2;
  --color-accent-hover:   #4752c4;
  --color-success:        #38a169;
  --color-warning:        #d69e2e;
  --color-danger:         #e53e3e;
  --color-info:           #4299e1;

  /* === 라이트 모드 오버라이드 === */
}

[data-theme="light"] {
  --color-bg-base:        #f0f2f5;
  --color-bg-surface:     #ffffff;
  --color-bg-elevated:    #ffffff;
  --color-bg-hover:       #f7f8fc;

  --color-border:         #e2e5ed;
  --color-text-primary:   #1a1d27;
  --color-text-secondary: #5a6070;
  --color-text-muted:     #a0a8bc;
  --color-text-inverse:   #ffffff;
}
```

### 1.2 타이포그래피

```css
:root {
  --font-sans: 'Inter', 'Pretendard', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* 스케일 */
  --text-xs:   0.6875rem;  /* 11px — 배지, 메타 */
  --text-sm:   0.8125rem;  /* 13px — 보조 텍스트 */
  --text-base: 0.9375rem;  /* 15px — 기본 본문 */
  --text-md:   1rem;       /* 16px — 카드 제목 */
  --text-lg:   1.125rem;   /* 18px — 컬럼 헤더 */
  --text-xl:   1.375rem;   /* 22px — 보드 제목 */
  --text-2xl:  1.75rem;    /* 28px — 모달 헤더 */

  --weight-regular: 400;
  --weight-medium:  500;
  --weight-semibold: 600;
  --weight-bold:    700;

  --leading-tight:  1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
}
```

### 1.3 간격 시스템 (8pt 그리드)

```css
:root {
  --space-1:  0.25rem;   /*  4px */
  --space-2:  0.5rem;    /*  8px */
  --space-3:  0.75rem;   /* 12px */
  --space-4:  1rem;      /* 16px */
  --space-5:  1.25rem;   /* 20px */
  --space-6:  1.5rem;    /* 24px */
  --space-8:  2rem;      /* 32px */
  --space-10: 2.5rem;    /* 40px */
  --space-12: 3rem;      /* 48px */
  --space-16: 4rem;      /* 64px */
}
```

### 1.4 보더 & 그림자

```css
:root {
  --radius-sm:  0.25rem;   /*  4px */
  --radius-md:  0.5rem;    /*  8px */
  --radius-lg:  0.75rem;   /* 12px */
  --radius-xl:  1rem;      /* 16px */
  --radius-full: 9999px;

  --shadow-card:   0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
  --shadow-drag:   0 8px 24px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3);
  --shadow-modal:  0 20px 60px rgba(0,0,0,0.6);

  --transition-fast:   120ms ease;
  --transition-normal: 220ms ease;
  --transition-slow:   350ms ease;
}
```

---

## 2. 컴포넌트 스펙

### 2.1 앱 레이아웃

```
┌─────────────────────────────────────────────────────┐
│  Header (56px 고정)                                  │
│  [보드 제목]                    [테마 토글] [+ 카드] │
├─────────────────────────────────────────────────────┤
│  Nav Tabs (48px)                                     │
│  [칸반 보드] [에이전트 뷰] [파이프라인]              │
├─────────────────────────────────────────────────────┤
│  Board Area (flex row, 가로 스크롤)                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ [+] │
│  │ Col  │ │ Col  │ │ Col  │ │ Col  │ │ Col  │     │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘     │
└─────────────────────────────────────────────────────┘
```

**Header 스펙**
- 높이: 56px, 배경: `--color-bg-surface`, 하단 border: `--color-border`
- 패딩: 수평 `--space-6`
- 보드 제목: `--text-xl`, `--weight-semibold`, `--color-text-primary`
- 버튼 gap: `--space-3`

**Nav Tabs 스펙**
- 높이: 48px, 배경: `--color-bg-base`
- 탭: `--text-sm`, `--weight-medium`, 수평 패딩 `--space-4`
- Active: `--color-accent` 하단 border 2px + `--color-text-primary`
- Inactive: `--color-text-secondary`, hover → `--color-text-primary`

---

### 2.2 칸반 컬럼

```
┌────────────────────────────────┐  ← width: 280px (고정)
│  ● Backlog          5  [···]  │  ← 컬럼 헤더 (40px)
├────────────────────────────────┤
│  ┌────────────────────────────┐│
│  │ 카드                       ││
│  └────────────────────────────┘│
│  ┌────────────────────────────┐│
│  │ 카드                       ││
│  └────────────────────────────┘│
│                                 │
│  + 카드 추가                    │  ← 하단 버튼
└────────────────────────────────┘
```

**컬럼 컨테이너**
- `width: 280px`, `min-width: 280px`, `max-width: 280px`
- `border-radius: --radius-lg`
- `background: --color-bg-surface`
- `border: 1px solid --color-border`
- 카드 목록 패딩: `--space-3`
- 카드 간 gap: `--space-2`
- 최대 높이: `calc(100vh - 160px)`, 세로 스크롤

**컬럼 헤더**
- 높이: 40px, 패딩: `--space-3 --space-4`
- 컬럼 상태 도트: `width/height 8px`, `border-radius: full`
  - 색상: 컬럼별 `--color-col-{name}` 사용
- 제목: `--text-base`, `--weight-semibold`
- 카드 수 배지: `--text-xs`, `--color-text-secondary`, `--color-bg-hover` 배경
- WIP 초과 시: 카드 수 배지 → `--color-danger` 배경

**드래그 오버 상태**
- 배경: 컬럼별 `--color-col-{name}-bg` (15% 투명도)
- border: `1px solid --color-col-{name}` (30% 투명도)

**+ 카드 추가 버튼**
- 전체 너비, 높이 36px
- `--text-sm`, `--color-text-muted`
- hover: `--color-text-secondary` + `--color-bg-hover` 배경

---

### 2.3 칸반 카드

```
┌────────────────────────────────────┐
│  [🔴 HIGH]                [assignee]│ ← 상단 메타 (배지 + 아바타)
│                                     │
│  카드 제목 텍스트                    │ ← 제목 (최대 2줄)
│                                     │
│  카드 설명 미리보기...               │ ← 설명 (최대 2줄, 없으면 숨김)
│                                     │
│  #12  ···  Mar 27                   │ ← 하단 메타
└────────────────────────────────────┘
```

**카드 컨테이너**
- `border-radius: --radius-md`
- `background: --color-bg-elevated`
- `border: 1px solid --color-border`
- `box-shadow: --shadow-card`
- 패딩: `--space-3`
- gap (내부): `--space-2`
- hover: `box-shadow: --shadow-drag` + `translateY(-1px)`
- 드래그 중: `opacity: 0.5`, 원래 자리에 placeholder

**우선순위 배지**
- `border-radius: --radius-full`
- 패딩: `2px --space-2`
- `--text-xs`, `--weight-semibold`
- high: 배경 `--color-priority-high-bg`, 텍스트 `--color-priority-high`
- medium: 배경 `--color-priority-medium-bg`, 텍스트 `--color-priority-medium`
- low: 배경 `--color-priority-low-bg`, 텍스트 `--color-priority-low`

**어사이니 아바타**
- `width/height: 24px`, `border-radius: full`
- 배경: `--color-accent` (텍스트 이니셜 표시)
- `--text-xs`, `--weight-bold`, `--color-text-inverse`
- 없으면 숨김

**카드 제목**
- `--text-base`, `--weight-medium`, `--color-text-primary`
- `line-clamp: 2`

**카드 설명**
- `--text-sm`, `--color-text-secondary`
- `line-clamp: 2`

**하단 메타**
- `--text-xs`, `--color-text-muted`
- 카드 ID (#숫자), 생성일 표시

---

### 2.4 카드 상세 모달

```
┌─────────────────────────────────────────┐
│  카드 제목 (편집 가능)           [✕]    │
├─────────────────────────────────────────┤
│  설명 (편집 가능 텍스트 영역)            │
│                                          │
├─────────────────────────────────────────┤
│  [우선순위 셀렉트] [컬럼 이동 셀렉트]   │
│  [담당자 입력]                           │
├─────────────────────────────────────────┤
│                    [취소] [저장] [삭제]  │
└─────────────────────────────────────────┘
```

**오버레이**: `rgba(0,0,0,0.7)`, backdrop blur `4px`
**모달 패널**
- `width: 520px`, `max-width: calc(100vw - 48px)`
- `border-radius: --radius-xl`
- `background: --color-bg-elevated`
- `border: 1px solid --color-border`
- `box-shadow: --shadow-modal`
- 패딩: `--space-6`

**모달 헤더**
- 제목: `--text-2xl`, `--weight-semibold`
- 닫기 버튼: 32×32px, `--radius-md`, hover → `--color-bg-hover`

**버튼 스펙**
- 저장 (primary): `background --color-accent`, hover → `--color-accent-hover`
- 취소 (ghost): `border --color-border`, hover → `--color-bg-hover`
- 삭제 (danger): `background --color-danger`, 우측 정렬 분리

---

### 2.5 드래그앤드롭 인터랙션

**드래그 시작**
- 드래그 중인 카드: `opacity: 0.4`, 원래 위치 유지 (고스트)
- 드래그 아이템 (cursor): 실제 카드 복사본, `rotate(2deg)`, `--shadow-drag`

**드롭 존 활성화**
- 컬럼 배경 → `--color-col-{name}-bg` 전환 (220ms ease)
- 카드 사이 드롭 인디케이터: `2px solid --color-accent`, `border-radius: full`

**드롭 완료**
- 0.3초 강조 애니메이션: `background --color-col-{name}-bg` → 일반 배경

---

## 3. 접근성

- 모든 인터랙티브 요소: `focus-visible` 링 `2px solid --color-border-focus` + `outline-offset: 2px`
- 키보드 드래그: Space 키 선택 → 방향키 이동 → Enter/Escape 확정/취소
- 컬럼 헤더: `role="heading"`, `aria-level="2"`
- 카드: `role="article"`, `aria-label="{제목}, {우선순위} 우선순위"`
- 모달: `role="dialog"`, `aria-modal="true"`, 포커스 트랩
- 색상 대비: 모든 텍스트 WCAG AA 이상 (4.5:1)
- 터치 타겟: 최소 44×44px

---

## 4. 반응형

**데스크탑 (1280px+)**
- 컬럼 width: 280px, 가로 스크롤
- 모달: 중앙 고정 (520px)

**태블릿 (768px–1279px)**
- 컬럼 width: 240px
- 가로 스크롤 유지
- 헤더 일부 버튼 아이콘 전용

**모바일 (< 768px)**
- 컬럼: 전체 너비 (vw), 세로 스크롤로 컬럼 전환
- 컬럼 전환: 스와이프 또는 상단 탭 셀렉터
- 모달: 하단 시트 (bottom sheet) 형태

---

## 5. 미결 결정 사항

- [ ] WIP limit 초과 시 카드 추가 차단 여부 (UX 결정 필요)
- [ ] 카드 순서 변경 API 호출 시점 (즉시 vs 드롭 후)
- [ ] 보드 멀티 지원 (현재 단일 보드)

---

---

## 6. 포인트컬러 개편 (2026-04-03 업데이트)

### 6.1 선택된 포인트컬러

| 테마 | 값 | CSS 변수 |
|------|-----|----------|
| 다크 | `#7C7AE8` (밝기 +15% 조정) | `--color-point` |
| 라이트 | `#5F5BE2` (원색) | `--color-point` |

파생 토큰:
- `--color-point-hover`: 다크 `#9B99EF` / 라이트 `#4D49C5`
- `--color-point-subtle`: `rgba(95, 91, 226, 0.12)` / `0.10`
- `--color-point-border`: `rgba(95, 91, 226, 0.30)` / `0.25`
- `--color-point-glow`: `rgba(95, 91, 226, 0.20)` / `0.15`

### 6.2 적용 범위

| 컴포넌트 | 적용 위치 | 방법 |
|----------|-----------|------|
| `.btn-primary` | 배경색, hover | `var(--color-point)` |
| `.input-field:focus` | border + glow | `var(--color-point)`, `var(--color-point-subtle)` |
| `.textarea-field:focus` | border + glow | `var(--color-point)`, `var(--color-point-subtle)` |
| UI kit `<Button variant="primary">` | `.bg-point` 오버라이드 | globals.css에서 `!important` 오버라이드 |
| 로딩 스피너 | `border-top-color` | `var(--color-point)` |
| 태그 pill | 배경/border/텍스트 | `--color-tag-{bg,border,text}` (point 기반) |
| 카드 hover | glow ring | `var(--color-point-glow)` |
| CardDetailModal 편집 input | focus border | `var(--color-point)` |
| 포커스 링 (전역) | `button/a:focus-visible` | `var(--color-focus-ring)` |
| 헤더 로고 | gradient | `var(--color-point)` |
| Nav 탭 active | color + border-bottom | `var(--color-point)` |

### 6.3 컬럼 accent — 변경 없음

`COLUMN_ACCENTS = ['#7C7AE8', '#fbbf24', '#c084fc', '#4ade80', '#fb923c', '#f472b6']`

• col-1(1번 컬럼): 포인트컬러 — point color와 일치 ✅
• col-2~6: 컬럼 시맨틱 색상 유지 (amber/purple/green/orange/pink)

### 6.4 Bart(Frontend) 후속 작업

- [ ] `COLUMN_ACCENTS[0]`를 다크/라이트 테마에 따라 동적으로 읽도록 변경 (현재 다크 `#7C7AE8` 하드코딩, 라이트 `#5F5BE2` 불일치)
  - 제안: `useTheme()`로 theme 값 읽고 `theme === 'dark' ? '#7C7AE8' : '#5F5BE2'`로 처리
  - 또는 CSS custom property를 JS에서 읽는 유틸 함수 사용
- [ ] `next build` + `next dev` 런타임 에러 없음 검증

---

**Krusty (Designer)** | 2026-03-27 (업데이트: 2026-04-03)
