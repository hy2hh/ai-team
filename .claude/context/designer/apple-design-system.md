# Design System — Apple HIG

> 출처: Apple Human Interface Guidelines (https://developer.apple.com/design/human-interface-guidelines/)
> Krusty(Designer) 에이전트가 Apple 스타일 UI 생성 시 참조하는 기준 문서

---

## 1. Visual Theme & Atmosphere

Apple HIG 핵심 철학: **명료함(Clarity) · 경의(Deference) · 깊이(Depth)**

- 인터페이스는 콘텐츠에 봉사 — 크롬(chrome)은 최소화
- Semantic color 사용 — 라이트/다크 자동 대응
- SF Pro 폰트 시스템 — 20pt 이상은 Display, 이하는 Text
- 8pt 그리드 기반 간격
- 반투명 레이어(frosted glass) — 공간 깊이 표현

---

## 2. Color System

### 2-1. Interactive / Accent (단일 강조색 원칙)

| 역할 | Light | Dark |
|------|-------|------|
| **System Blue — CTA·링크·강조 (기본)** | `#007AFF` | `#0A84FF` |
| System Red — 삭제·경고 | `#FF3B30` | `#FF453A` |
| System Green — 성공·완료 | `#34C759` | `#30D158` |
| System Orange | `#FF9500` | `#FF9F0A` |
| System Yellow | `#FFCC00` | `#FFD60A` |
| System Purple | `#AF52DE` | `#BF5AF2` |
| System Pink | `#FF2D55` | `#FF375F` |
| System Indigo | `#5856D6` | `#5E5CE6` |
| System Teal | `#5AC8FA` | `#64D2FF` |

> **단일 강조색 원칙**: UI당 강조색은 하나. 기본은 System Blue `#007AFF`.

### 2-2. Gray Scale

| Token | Light | Dark |
|-------|-------|------|
| `--system-gray` | `#8E8E93` | `#8E8E93` |
| `--system-gray2` | `#AEAEB2` | `#636366` |
| `--system-gray3` | `#C7C7CC` | `#48484A` |
| `--system-gray4` | `#D1D1D6` | `#3A3A3C` |
| `--system-gray5` | `#E5E5EA` | `#2C2C2E` |
| `--system-gray6` | `#F2F2F7` | `#1C1C1E` |

### 2-3. Semantic Label (텍스트 계층)

| Token | Light | Dark | 용도 |
|-------|-------|------|------|
| `--label-primary` | `#000000` | `#FFFFFF` | 주요 텍스트 |
| `--label-secondary` | `rgba(60,60,67,0.60)` | `rgba(235,235,245,0.60)` | 보조 정보 |
| `--label-tertiary` | `rgba(60,60,67,0.30)` | `rgba(235,235,245,0.30)` | 힌트·플레이스홀더 |
| `--label-quaternary` | `rgba(60,60,67,0.18)` | `rgba(235,235,245,0.18)` | 비활성·워터마크 |

### 2-4. Background (배경 계층)

| Token | Light | Dark | 용도 |
|-------|-------|------|------|
| `--bg-primary` | `#FFFFFF` | `#000000` | 루트 배경 |
| `--bg-secondary` | `#F2F2F7` | `#1C1C1E` | 그룹 배경·카드 뒤 |
| `--bg-tertiary` | `#FFFFFF` | `#2C2C2E` | 인라인 콘텐츠 배경 |
| `--bg-grouped` | `#F2F2F7` | `#000000` | 그룹 테이블 배경 |
| `--bg-grouped-secondary` | `#FFFFFF` | `#1C1C1E` | 그룹 내 셀 배경 |

### 2-5. Separator

| Token | Light | Dark | 용도 |
|-------|-------|------|------|
| `--separator` | `rgba(60,60,67,0.29)` | `rgba(84,84,88,0.60)` | 반투명 구분선 |
| `--separator-opaque` | `#C6C6C8` | `#38383A` | 불투명 구분선 |

---

## 3. Typography

### SF Pro 선택 기준
- **20px 이상**: SF Pro Display
- **19px 이하**: SF Pro Text
- CSS fallback: `-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`

### Dynamic Type Scale (Default size 기준)

| Style | Size | Line Height | Weight | Letter Spacing |
|-------|------|-------------|--------|----------------|
| Large Title | 34px | 41px | 400 | `+0.374px` |
| Title 1 | 28px | 34px | 400 | `+0.364px` |
| Title 2 | 22px | 28px | 400 | `+0.352px` |
| Title 3 | 20px | 25px | 400 | `+0.380px` |
| Headline | 17px | 22px | **600** | `-0.408px` |
| Body | 17px | 22px | 400 | `-0.408px` |
| Callout | 16px | 21px | 400 | `-0.320px` |
| Subhead | 15px | 20px | 400 | `-0.240px` |
| Footnote | 13px | 18px | 400 | `-0.078px` |
| Caption 1 | 12px | 16px | 400 | `0px` |
| Caption 2 | 11px | 13px | 400 | `+0.066px` |

> 34px 이상 Display 스타일 헤드라인은 letter-spacing 양수 허용; Body 계열은 음수.

---

## 4. Spacing (8pt Grid)

| Token | Value | 용도 |
|-------|-------|------|
| `--space-1` | `4px` | 아이콘-텍스트 micro 간격 |
| `--space-2` | `8px` | 기본 소단위 |
| `--space-3` | `12px` | 아이템 간격 |
| `--space-4` | `16px` | 섹션 내부 패딩 |
| `--space-5` | `20px` | 카드 패딩 |
| `--space-6` | `24px` | 섹션 간격 |
| `--space-8` | `32px` | 큰 섹션 |
| `--space-10` | `40px` | 페이지 마진 |
| `--space-12` | `48px` | 헤더 높이 기준 |

---

## 5. Border Radius (Concentric Rule)

| Token | Value | 용도 |
|-------|-------|------|
| `--radius-xs` | `5px` | 태그·배지 |
| `--radius-sm` | `8px` | 버튼·인풋 |
| `--radius-md` | `12px` | 카드·패널 |
| `--radius-lg` | `16px` | 모달·액션시트 |
| `--radius-xl` | `20px` | 대형 카드 |
| `--radius-2xl` | `24px` | 최대 패널 |
| `--radius-full` | `9999px` | Pill 버튼·캡슐 |

> **Concentric Rule**: 컨테이너 안 요소의 radius = `outer_radius - padding`

---

## 6. Depth & Elevation

| Level | CSS | 용도 |
|-------|-----|------|
| Flat | shadow 없음 | 일반 섹션 배경 |
| Card | `0 2px 12px rgba(0,0,0,0.08)` | 일반 카드 |
| Elevated Card | `rgba(0,0,0,0.22) 3px 5px 30px 0px` | 강조 카드 |
| Navigation Glass | `backdrop-filter: saturate(180%) blur(20px)` | Sticky nav·sheet |
| Focus Ring | `0 0 0 3px rgba(0,122,255,0.45)` | 키보드 포커스 |

---

## 7. Component Specs

### Navigation Bar
- Height: `48px`
- Light: `background: rgba(255,255,255,0.72); backdrop-filter: saturate(180%) blur(20px);`
- Dark: `background: rgba(28,28,30,0.72); backdrop-filter: saturate(180%) blur(20px);`

### Buttons

| 유형 | Background | Text | Radius |
|------|-----------|------|--------|
| Primary | `#007AFF` | `#FFFFFF` | `8px` |
| Primary Pill | `#007AFF` | `#FFFFFF` | `9999px` |
| Secondary (Tinted) | `rgba(0,122,255,0.12)` | `#007AFF` | `8px` |
| Destructive | `#FF3B30` | `#FFFFFF` | `8px` |
| Ghost | `transparent` | `#007AFF` | `8px` |

- 최소 터치 타겟: **44×44px** (HIG 필수)

### Cards
- border 없음, shadow만: `0 2px 12px rgba(0,0,0,0.08)`
- Radius: `12px` (기본) / `16px` (대형)
- Background: `--bg-primary` (#FFF light / #1C1C1E dark)

---

## 8. Do's and Don'ts

**Do:**
- System Blue `#007AFF` 단일 강조색
- `-apple-system` 폰트 스택
- 8pt 그리드 준수
- Glass nav (`backdrop-filter: saturate(180%) blur(20px)`)
- 카드: border 없음, shadow만
- Semantic label colors (`rgba(60,60,67,0.6)` 등)
- Touch target 44px 이상

**Don't:**
- 커스텀 브랜드 유채색 강조 (`#22c55e`, `#9333ea`, `#0071e3` 등)
- 카드에 border
- 불투명 navigation bar
- `uppercase` + `tracking-wider` 조합
- font-weight 800/900
- 배경에 그라디언트·텍스처
- near-white 임의값 (`#f8f8f8`, `#fafafa`) — 배경은 `#F2F2F7` 또는 `#FFFFFF`

---

## 9. Agent Quick Reference (CSS)

```css
:root {
  /* Accent */
  --blue:             #007AFF;
  --blue-dark:        #0A84FF;

  /* Background */
  --bg-primary:       #FFFFFF;
  --bg-secondary:     #F2F2F7;
  --bg-dark:          #000000;
  --bg-dark-secondary:#1C1C1E;

  /* Label */
  --label:            #000000;
  --label-secondary:  rgba(60, 60, 67, 0.60);
  --label-tertiary:   rgba(60, 60, 67, 0.30);

  /* Separator */
  --separator:        rgba(60, 60, 67, 0.29);

  /* Elevation */
  --shadow-card:      0 2px 12px rgba(0, 0, 0, 0.08);
  --shadow-elevated:  rgba(0, 0, 0, 0.22) 3px 5px 30px 0px;

  /* Navigation glass */
  --nav-bg:           rgba(255, 255, 255, 0.72);
  --nav-blur:         saturate(180%) blur(20px);

  /* Radius */
  --radius-sm:        8px;
  --radius-md:        12px;
  --radius-lg:        16px;
  --radius-full:      9999px;

  /* Spacing */
  --space-2:          8px;
  --space-4:          16px;
  --space-6:          24px;
}
```

---

## 10. Responsive Behavior

| Breakpoint | Width | Notes |
|-----------|-------|-------|
| Mobile | 360–480px | 단일 컬럼, 최소 패딩 16px |
| Tablet | 640–834px | 2-col 그리드 시작 |
| Desktop | 1024–1280px | 표준 레이아웃 |
| Large | >1440px | 최대 너비 980–1200px, 중앙 정렬 |

- Hero 헤드라인: 34px → 28px → 22px (모바일)
- 그리드: 3-col → 2-col → 단일 컬럼
- Nav: 수평 전체 → 모바일 햄버거
