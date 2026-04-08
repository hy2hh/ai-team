# [Project Name] UI Design System — Apple 스타일

## Design Foundations

### Color System
**Accent (단일)**: `#0071e3` (light) / `#2997ff` (dark section)
**Link**: `#0066cc` (light bg) / `#2997ff` (dark bg)
**Background**: `#ffffff` (카드·오버레이) / `#f5f5f7` (light 섹션) / `#000000` (dark 섹션)
**Dark Surface**: `#272729` / `#242426`
**Text Primary**: `#1d1d1f` (light bg) / `#ffffff` (dark bg)
**Text Secondary**: `rgba(0,0,0,0.80)` / **Tertiary**: `rgba(0,0,0,0.48)`
**Shadow (elevated)**: `rgba(0,0,0,0.22) 3px 5px 30px 0px`

> 강조색은 `#0071e3` 단 하나. 커스텀 유채색 금지.

### Typography System
**Font**: `"Helvetica Neue", Helvetica, Arial, sans-serif`
**SF Pro Display** (20px+) / **SF Pro Text** (19px 이하) — 혼용 금지

| 역할 | Size | Weight | Line Height | Letter Spacing |
|------|------|--------|-------------|----------------|
| Display Hero | 56px | 600 | 1.07 | -0.28px |
| Section Heading | 40px | 600 | 1.10 | normal |
| Tile Heading | 28px | 400 | 1.14 | 0.196px |
| Card Title | 21px | 700 | 1.19 | 0.231px |
| Body | 17px | 400 | 1.47 | -0.374px |
| Body Emphasis | 17px | 600 | 1.24 | -0.374px |
| Caption / Link | 14px | 400 | 1.29 | -0.224px |
| Nav / Micro | 12px | 400 | normal | -0.12px |

> weight 800/900 절대 금지. 음수 letter-spacing 필수 (Display 헤딩 제외).

### Spacing System
**Base Unit**: 8px

| Token | Value |
|-------|-------|
| `--space-1` | 8px |
| `--space-2` | 16px |
| `--space-3` | 24px |
| `--space-4` | 32px |
| `--space-5` | 40px |
| `--space-6` | 48px |
| `--space-8` | 64px |

섹션 수직 패딩 최소 80px.

### Border Radius
| Token | Value | 용도 |
|-------|-------|------|
| `--radius-micro` | 5px | 최소 요소 |
| `--radius-md` | 8px | 버튼·카드 |
| `--radius-input` | 11px | 인풋 필드 |
| `--radius-panel` | 12px | 패널·시트 |
| `--radius-pill` | 980px | CTA Pill |
| `--radius-circle` | 50% | 미디어 컨트롤 |

---

## Component Library

### Navigation Bar
- Height: 48px, Sticky
- `background: rgba(0,0,0,0.80); backdrop-filter: saturate(180%) blur(20px);`
- Links: 12px SF Pro Text, `#ffffff`

### Buttons
| 유형 | Background | Text | Radius |
|------|-----------|------|--------|
| Primary CTA | `#0071e3` | `#ffffff` | `980px` (pill) |
| Primary Standard | `#0071e3` | `#ffffff` | `8px` |
| Secondary | `transparent` | `#0066cc` | `980px` |
| Destructive | `#ff3b30` | `#ffffff` | `8px` |

### Cards
- Border 없음, `background: #ffffff`
- Shadow (elevated만): `rgba(0,0,0,0.22) 3px 5px 30px 0px`
- Radius: `8px`

### Component States
모든 컴포넌트에 8개 상태 정의 필수:
**Default / Hover / Active / Focus / Disabled / Loading / Error / Empty**

- Focus ring: `2px solid #0071e3`
- Loading: Skeleton (Spinner 금지)
- Empty: 텍스트만 (일러스트·CTA 없음)

---

## Responsive Design

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | 360–639px | 단일 컬럼, 패딩 16px |
| Tablet | 640–1023px | 2-col 그리드 |
| Desktop | 1024px+ | 최대 너비 980px, 중앙 정렬 |

- Hero 헤드라인: 56px → 40px → 28px (모바일)
- 그리드: 3-col → 2-col → 단일 컬럼
- 섹션 구분: `#000000` / `#f5f5f7` 교차 (거터 없음)

---

## Accessibility (WCAG AA)
- 일반 텍스트 대비: **4.5:1** 이상
- 대형 텍스트 (18px+ bold / 24px+): **3:1** 이상
- 터치 타겟 최소 **44×44px**
- 텍스트 입력 최소 **16px** (iOS Safari 자동 줌 방지)
- `reduced-motion` 미디어 쿼리 대응
- 비장식 이미지 alt 텍스트 필수

---

## CSS Token File (핸드오프 필수 제공)

```css
:root {
  --color-apple-blue:   #0071e3;
  --color-link-light:   #0066cc;
  --color-link-dark:    #2997ff;

  --color-bg-light:     #f5f5f7;
  --color-bg-white:     #ffffff;
  --color-bg-dark:      #000000;
  --color-bg-dark-1:    #272729;

  --color-text-primary:   #1d1d1f;
  --color-text-secondary: rgba(0,0,0,0.80);
  --color-text-tertiary:  rgba(0,0,0,0.48);
  --color-text-on-dark:   #ffffff;

  --shadow-card: rgba(0,0,0,0.22) 3px 5px 30px 0px;

  --radius-micro:  5px;
  --radius-md:     8px;
  --radius-input:  11px;
  --radius-panel:  12px;
  --radius-pill:   980px;
  --radius-circle: 50%;

  --space-1: 8px;  --space-2: 16px; --space-3: 24px;
  --space-4: 32px; --space-5: 40px; --space-6: 48px;
  --space-8: 64px;
}
```

---
**Designer**: Krusty
**Handoff to**: @Bart
