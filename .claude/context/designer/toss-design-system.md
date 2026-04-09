# Design System — 토스(Toss) 스타일

> 출처: toss.im 앱 + Toss Design System (TDS) + brand.toss.im 공식
> Krusty(Designer) 에이전트가 UI 생성 시 참조하는 기준 문서 — **단일 정본(SSOT)**
> ⚠️ Apple 디자인 시스템에서 전환됨 (2026-04-09) | 색상값 `#0064FF`로 통일 (2026-04-09, 회의 #10)

---

## 1. Visual Theme & Atmosphere

**토스 핵심 철학: 한 화면, 한 목적 — 카드 기반 정보 구조화**

- 밝고 깨끗한 배경(`#F4F4F4`) 위에 `#FFFFFF` 카드로 정보 분리
- 강조색 `#0064FF` (Toss Blue) + 시맨틱 컬러(성공/경고/에러)만 허용
- 모션이 맥락 — Spring 애니메이션으로 정보 흐름 안내
- 여백이 위계 — 섹션 간 32px, 카드 내부 20px
- 배경에 그라디언트·텍스처 절대 금지

---

## 2. Color System

### 2-1. Primary (단일 강조색 원칙)

| 역할 | Light | Dark | 용도 |
|------|-------|------|------|
| **Toss Blue (CTA)** | `#0064FF` | `#4D9BFF` | 버튼, 인터랙티브 요소 |
| Toss Blue Hover | `#0052CC` | — | 호버 상태 |
| Toss Blue Pressed | `#0041A3` | — | 프레스 상태 |
| Focus Ring | `#0064FF` | — | 키보드 포커스 (2px solid) |

> `#0064FF` 외 커스텀 유채색 강조 금지. 시맨틱 컬러(성공/경고/에러)만 예외 허용.

### 2-2. Background

| 역할 | Light | Dark | 용도 |
|------|-------|------|------|
| Page Background | `#F4F4F4` | `#17171C` | 전체 페이지 배경 |
| Card / Surface | `#FFFFFF` | `#2C2C35` | 카드, 입력 필드 |
| Elevated Surface | `#FFFFFF` | `#3C3C45` | 바텀시트, 팝업 |

> **금지값**: `#f8f8f8`, `#fafafa`, `#F2F2F7` — `#F4F4F4` 또는 `#FFFFFF`만 허용

### 2-3. Text

| 역할 | Light | Dark | 용도 |
|------|-------|------|------|
| Primary | `#191F28` | `#ECECEC` | 제목·본문 |
| Secondary | `#4E5968` | `#8B95A1` | 보조 설명 |
| Tertiary / Disabled | `#8B95A1` | `#6B7684` | 비활성·힌트 |
| Inverse | `#FFFFFF` | `#191F28` | 컬러 배경 위 |

### 2-4. Semantic

| 역할 | 값 | 용도 |
|------|----|------|
| Success | `#00C471` | 완료, 수익, 긍정 |
| Warning | `#FF9500` | 주의, 경고 |
| Error / Loss | `#F04452` | 에러, 손실, 위험 |
| Info | `#0064FF` | 정보 (Primary와 동일) |

### 2-5. Surface

| 역할 | 값 | 용도 |
|------|----|------|
| Tab Bar (모바일) | `#FFFFFF` + 상단 `1px solid #F0F0F0` | 하단 네비게이션 |
| Card Shadow | `0 2px 8px rgba(0,0,0,0.08)` | 기본 카드 |
| Separator | `#F0F0F0` | 구분선 |
| Dimmed Overlay | `rgba(0,0,0,0.4)` | 바텀시트 배경 |

---

## 3. Typography (Toss Product Sans / Pretendard)

### 선택 기준
- **Primary**: Toss Product Sans (라이선스 확인 필요, 대체: Pretendard)
- **Fallback**: `Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- 혼용 금지. 최대 2 폰트 패밀리.

### Type Scale (토스 기준)

| 역할 | Size | Weight | Line Height | Letter Spacing |
|------|------|--------|-------------|----------------|
| Display Hero | 32px | 700 | 1.3 | `-0.4px` |
| Section Heading | 24px | 700 | 1.4 | `-0.3px` |
| Title | 20px | 700 | 1.4 | `-0.3px` |
| Subtitle | 17px | 600 | 1.4 | `-0.3px` |
| Body | 16px | 400 | 1.5 | `-0.3px` |
| Body Emphasis | 16px | 600 | 1.5 | `-0.3px` |
| Caption | 13px | 400 | 1.4 | `-0.2px` |
| Micro | 11px | 400 | 1.3 | `0px` |

> **금지**: `font-weight: 800/900`, `uppercase + tracking-wider` 조합

---

## 4. Spacing (4px 기반)

| Token | Value | 용도 |
|-------|-------|------|
| `--space-1` | `4px` | micro 간격 |
| `--space-2` | `8px` | 아이콘-텍스트 |
| `--space-3` | `12px` | 아이템 간격 |
| `--space-4` | `16px` | 섹션 내부 |
| `--space-5` | `20px` | 좌우 패딩, 카드 내부 패딩 |
| `--space-6` | `24px` | 중간 섹션 |
| `--space-8` | `32px` | 섹션 간격 |
| `--space-10` | `40px` | 큰 간격 |

> 좌우 기본 패딩: 20px (모바일), 섹션 간격: 32px

---

## 5. Border Radius

| Token | Value | 용도 |
|-------|-------|------|
| micro | `4px` | 태그, 배지 |
| small | `8px` | 인풋 필드, 작은 요소 |
| standard | `12px` | 버튼 |
| card | `16px` | 카드, 바텀시트 상단 |
| large | `24px` | 큰 카드, 모달 |
| circle | `50%` | 아바타, 아이콘 배경 |

---

## 6. Component Specs

### Navigation

**모바일 — 하단 탭 바**
- Height: `56px`
- Background: `#FFFFFF`
- 상단 border: `1px solid #F0F0F0`
- 아이콘: 24px, 비활성 `#8B95A1`, 활성 `#0064FF`
- 라벨: 11px, weight 500

**데스크톱 — 미니멀 상단 바**
- Height: `56px`
- Background: `#FFFFFF`
- 하단 border: `1px solid #F0F0F0`

### Buttons

| 유형 | Background | Text | Radius | Height |
|------|-----------|------|--------|--------|
| Primary (CTA) | `#0064FF` | `#FFFFFF` | `12px` | `54px` |
| Secondary | `#F2F4F6` | `#4E5968` | `12px` | `54px` |
| Danger | `#F04452` | `#FFFFFF` | `12px` | `54px` |
| Ghost | `transparent` | `#0064FF` | `12px` | `54px` |
| Small | `#0064FF` | `#FFFFFF` | `8px` | `36px` |

- 최소 터치 타겟: **48×48px** (필수)
- 모바일 CTA: **full-width** (좌우 20px 패딩 유지)
- 텍스트 입력 최소: **16px** (iOS Safari 자동 줌 방지)

### Cards

- Border: **없음** (shadow로만 구분)
- Background: `#FFFFFF` (light) / `#2C2C35` (dark)
- Radius: `16px`
- Shadow: `0 2px 8px rgba(0,0,0,0.08)` (기본)
- Padding: `20px`
- 카드 간 간격: `12px`

### Input Fields

- Height: `54px`
- Background: `#F2F4F6` (비활성) / `#FFFFFF` (활성, 1px border `#0064FF`)
- Radius: `8px`
- Padding: `0 16px`
- 플레이스홀더: `#8B95A1`

### Layout

- 최대 콘텐츠 너비: **640px** (모바일 중심), 데스크톱 확장 시 **1080px**
- 좌우 패딩: `20px`
- 섹션 간격: `32px`
- 기본 단위: 4px

---

## 7. Motion System (토스 핵심 차별점)

### Spring 애니메이션
- 페이지 전환: `spring(1, 80, 10)` — stiffness 80, damping 10
- 카드 등장: `spring(0.8, 100, 12)`
- 리스트 아이템: staggered delay `50ms` 간격

### 바텀시트
- 모달 대신 바텀시트 우선 사용
- 상단 radius: `16px`
- 핸들 바: `40px × 4px`, radius `2px`, `#D1D6DB`
- 스와이프 다운으로 닫기 지원
- 배경 dim: `rgba(0,0,0,0.4)`

### 숫자 카운트업
- 금액·수치 표시 시 0에서 목표값까지 애니메이션
- Duration: `800ms`, easing: `ease-out`
- 소수점 이하는 고정, 정수 부분만 카운트

### 로딩
- **Skeleton shimmer** 전용 (Spinner 절대 금지)
- Shimmer gradient: `#F2F4F6` → `#E5E8EB` → `#F2F4F6`
- Duration: `1.5s` infinite

### Micro-interactions
- 버튼 프레스: `scale(0.97)`, `150ms`
- 토글: spring 전환, `200ms`
- 탭 전환: underline slide, `250ms`

---

## 8. Do's and Don'ts

**Do:**
- `#0064FF` 단일 강조색 + 시맨틱 컬러
- 카드 기반 정보 구조화 (한 카드, 한 정보 그룹)
- 한 화면, 한 목적 — 핵심 CTA 1개
- 하단 탭 바 네비게이션 (모바일)
- Skeleton shimmer 로딩
- Spring 애니메이션 (페이지 전환, 카드 등장)
- 바텀시트 (모달 대신)
- 숫자 카운트업 애니메이션
- `text-balance` / `text-pretty` (제목·카피)
- 음수 letter-spacing (Body 계열)

**Don't:**
- 커스텀 유채색 강조 (시맨틱 외)
- 카드에 border
- Spinner
- `uppercase` + `tracking-wider` 조합
- `font-weight: 800/900`
- 배경에 그라디언트·텍스처
- Glass morphism / blur 네비게이션
- 한 화면에 CTA 2개 이상
- near-white 임의값 (`#f8f8f8`, `#fafafa`, `#F2F2F7`)
- 다크/라이트 섹션 교차 리듬 (Apple 패턴 — 토스는 단일 배경)

---

## 9. Quick Reference (CSS)

```css
:root {
  /* Primary */
  --toss-blue:          #0064FF;
  --toss-blue-hover:    #0052CC;
  --toss-blue-pressed:  #0041A3;
  --toss-blue-dark:     #4D9BFF;

  /* Background */
  --bg-page:            #F4F4F4;
  --bg-card:            #FFFFFF;
  --bg-elevated:        #FFFFFF;
  --bg-page-dark:       #17171C;
  --bg-card-dark:       #2C2C35;

  /* Text */
  --text-primary:       #191F28;
  --text-secondary:     #4E5968;
  --text-tertiary:      #8B95A1;
  --text-primary-dark:  #ECECEC;

  /* Semantic */
  --color-success:      #00C471;
  --color-warning:      #FF9500;
  --color-error:        #F04452;

  /* Surface */
  --separator:          #F0F0F0;
  --shadow-card:        0 2px 8px rgba(0,0,0,0.08);
  --dim-overlay:        rgba(0,0,0,0.4);

  /* Radius */
  --radius-micro:       4px;
  --radius-sm:          8px;
  --radius-md:          12px;
  --radius-card:        16px;
  --radius-lg:          24px;

  /* Spacing */
  --space-1:            4px;
  --space-2:            8px;
  --space-3:            12px;
  --space-4:            16px;
  --space-5:            20px;
  --space-8:            32px;
}
```

---

## 10. Responsive Behavior

| Breakpoint | Width | Notes |
|-----------|-------|-------|
| Mobile | 360–480px | 단일 컬럼, 좌우 20px 패딩 |
| Tablet | 640–834px | 2-col 그리드 시작 |
| Desktop | 1024–1280px | 표준 레이아웃, 최대 1080px |
| Large | >1440px | 최대 너비 1080px, 중앙 정렬 |

- Hero 헤드라인: 32px → 28px → 24px (모바일)
- 그리드: 3-col → 2-col → 단일 컬럼
- Nav: 데스크톱 상단 바 → 모바일 하단 탭 바
- CTA: 인라인 → full-width (모바일)
