# Design System — apple.com 스타일

> 출처: apple.com (마케팅 사이트) 디자인 언어
> Krusty(Designer) 에이전트가 UI 생성 시 참조하는 기준 문서
> ⚠️ Apple HIG(iOS/macOS 앱 가이드)와 다름 — 이 프로젝트는 apple.com 스타일 기준

---

## 1. Visual Theme & Atmosphere

**apple.com 핵심 철학: 제품이 주인공, 인터페이스는 후퇴**

- 다크(`#000000`) / 라이트(`#f5f5f7`) 섹션 교차로 리듬감 형성
- 강조색 단 하나 — `#0071e3` (Apple Blue) 외 유채색 금지
- 여백이 디자인 — 섹션 수직 패딩 최소 80px
- 배경에 그라디언트·텍스처 절대 금지

---

## 2. Color System

### 2-1. Accent (단일 강조색 원칙)

| 역할 | 값 | 용도 |
|------|----|------|
| **Apple Blue (CTA)** | `#0071e3` | 버튼, 인터랙티브 요소 |
| Link Blue (light bg) | `#0066cc` | 텍스트 링크 |
| Link Blue (dark bg) | `#2997ff` | 다크 섹션 링크 |
| Focus Ring | `#0071e3` | 키보드 포커스 (2px solid) |

> `#0071e3` 외 유채색 강조 절대 금지 (`#22c55e`, `#9333ea`, `#e11d48` 등 모두 금지)

### 2-2. Background (이진 리듬)

| 역할 | 값 | 용도 |
|------|----|------|
| Dark Background | `#000000` | 몰입형 섹션, 히어로 |
| Light Background | `#f5f5f7` | 정보형 섹션, 기본 배경 |
| Card Background | `#ffffff` | 카드, 인라인 콘텐츠 |

> **금지값**: `#f8f8f8`, `#fafafa`, `#F2F2F7`, `#f2f2f7` — `#f5f5f7` 또는 `#ffffff`만 허용

### 2-3. Text

| 역할 | 값 | 용도 |
|------|----|------|
| Primary (light bg) | `#1d1d1f` | 제목·본문 |
| Primary (dark bg) | `#ffffff` | 다크 섹션 텍스트 |
| Secondary | `rgba(0,0,0,0.80)` | 보조 설명 |
| Tertiary / Disabled | `rgba(0,0,0,0.48)` | 비활성·힌트 |

### 2-4. Surface

| 역할 | 값 | 용도 |
|------|----|------|
| Navigation (sticky) | `rgba(0,0,0,0.80)` + `backdrop-filter: saturate(180%) blur(20px)` | Sticky nav |
| Card Shadow | `rgba(0,0,0,0.22) 3px 5px 30px 0px` | Elevated card |
| Separator | `rgba(0,0,0,0.08)` | 구분선 |

---

## 3. Typography (SF Pro)

### 선택 기준
- **20px 이상**: SF Pro Display
- **19px 이하**: SF Pro Text
- CSS fallback: `"Helvetica Neue", Helvetica, Arial, sans-serif`
- 혼용 금지. 최대 2 폰트 패밀리.

### Type Scale (apple.com 기준)

| 역할 | Size | Weight | Line Height | Letter Spacing |
|------|------|--------|-------------|----------------|
| Display Hero | 56px | 600 | 1.07 | `-0.28px` |
| Section Heading | 40px | 600 | 1.10 | `normal` |
| Tile Heading | 28px | 400 | 1.14 | `+0.196px` |
| Card Title | 21px | 700 | 1.19 | `+0.231px` |
| Body | 17px | 400 | 1.47 | `-0.374px` |
| Body Emphasis | 17px | 600 | 1.24 | `-0.374px` |
| Button Large | 18px | 300 | 1.00 | `normal` |
| Caption / Link | 14px | 400 | 1.29–1.43 | `-0.224px` |
| Nav Link | 12px | 400 | normal | `normal` |
| Micro | 12px | 400/600 | 1.33 | `-0.12px` |

> **금지**: `font-weight: 800/900`, `uppercase + tracking-wider` 조합

---

## 4. Spacing (8px 기반)

| Token | Value | 용도 |
|-------|-------|------|
| `--space-1` | `4px` | 아이콘-텍스트 micro |
| `--space-2` | `8px` | 기본 소단위 |
| `--space-3` | `12px` | 아이템 간격 |
| `--space-4` | `16px` | 섹션 내부 패딩 |
| `--space-5` | `20px` | 카드 패딩 |
| `--space-6` | `24px` | 섹션 간격 |
| `--space-8` | `32px` | 큰 섹션 |
| `--space-10` | `40px` | 페이지 마진 |

> 섹션 수직 패딩 최소 80px — 유틸리티 앱도 apple.com 여백 기준 적용

---

## 5. Border Radius

| Token | Value | 용도 |
|-------|-------|------|
| micro | `5px` | 최소 요소, 태그·배지 |
| standard | `8px` | 버튼, 카드 |
| input | `11px` | 인풋 필드 |
| panel | `12px` | 패널, 시트 |
| pill | `980px` | CTA 링크 ("Learn more") |
| circle | `50%` | 미디어 컨트롤 |

---

## 6. Component Specs

### Navigation Bar

- Height: `48px`, Sticky
- Background: `rgba(0,0,0,0.80)` + `backdrop-filter: saturate(180%) blur(20px)`
- Links: 12px SF Pro Text, white
- **불투명 nav 절대 금지**

### Buttons

| 유형 | Background | Text | Radius |
|------|-----------|------|--------|
| Primary Pill (CTA) | `#0071e3` | `#ffffff` | `980px` |
| Primary Rect | `#0071e3` | `#ffffff` | `8px` |
| Dark CTA | `#1d1d1f` | `#ffffff` | `8px` |
| Ghost Link | `transparent` | `#0066cc` | `980px` |

- 최소 터치 타겟: **44×44px** (필수)
- 텍스트 입력 최소: **16px** (iOS Safari 자동 줌 방지)

### Cards

- Border: **없음** (shadow로만 구분)
- Background: `#ffffff` (light section) / `#272729`–`#242426` (dark section)
- Radius: `8px` (standard)
- Shadow: `rgba(0,0,0,0.22) 3px 5px 30px 0px` (elevated만, 대부분 shadow 없음)

### Layout

- 최대 콘텐츠 너비: **980px**, 중앙 정렬
- 섹션 구분: `#000000` / `#f5f5f7` 배경 교차 (거터·border 없음)
- Hero: full-viewport-width, 단일 컬럼
- 기본 단위: 8px

---

## 7. Do's and Don'ts

**Do:**
- `#0071e3` 단일 강조색
- 다크/라이트 섹션 교차로 리듬
- Glass nav (`backdrop-filter: saturate(180%) blur(20px)`)
- Skeleton 로딩 (spinner 금지)
- 음수 letter-spacing (Body 계열)
- `text-balance` / `text-pretty` (제목·카피)

**Don't:**
- 커스텀 유채색 강조 (`#22c55e`, `#9333ea` 등)
- 카드에 border
- 불투명 navigation bar
- `uppercase` + `tracking-wider` 조합
- `font-weight: 800/900`
- 배경에 그라디언트·텍스처
- near-white 임의값 (`#f8f8f8`, `#fafafa`, `#F2F2F7`)

---

## 8. Quick Reference (CSS)

```css
:root {
  /* Accent */
  --blue:             #0071e3;
  --blue-link-light:  #0066cc;
  --blue-link-dark:   #2997ff;

  /* Background */
  --bg-light:         #f5f5f7;
  --bg-dark:          #000000;
  --bg-card:          #ffffff;
  --bg-card-dark:     #272729;

  /* Text */
  --text-primary:     #1d1d1f;
  --text-primary-dark:#ffffff;
  --text-secondary:   rgba(0,0,0,0.80);
  --text-tertiary:    rgba(0,0,0,0.48);

  /* Navigation */
  --nav-bg:           rgba(0,0,0,0.80);
  --nav-blur:         saturate(180%) blur(20px);

  /* Shadow */
  --shadow-elevated:  rgba(0,0,0,0.22) 3px 5px 30px 0px;

  /* Radius */
  --radius-sm:        8px;
  --radius-input:     11px;
  --radius-md:        12px;
  --radius-pill:      980px;

  /* Spacing */
  --space-2:          8px;
  --space-4:          16px;
  --space-6:          24px;
}
```

---

## 9. Responsive Behavior

| Breakpoint | Width | Notes |
|-----------|-------|-------|
| Mobile | 360–480px | 단일 컬럼, 패딩 16px |
| Tablet | 640–834px | 2-col 그리드 시작 |
| Desktop | 1024–1280px | 표준 레이아웃 |
| Large | >1440px | 최대 너비 980px, 중앙 정렬 |

- Hero 헤드라인: 56px → 40px → 28px (모바일)
- 그리드: 3-col → 2-col → 단일 컬럼
- Nav: 수평 전체 → 모바일 햄버거
