---
name: Bifrost Design System (디자이너 리뷰용)
description: Bifrost 디자인 시스템 전체 분석 — Storybook 컴포넌트 + 4개 프로덕션 사이트 UI 분석. 디자이너 검증용 사실 기반 문서.
type: reference
---

# Bifrost Design System 분석 보고서

> **문서 목적**: Storybook(storybook.thebifrost.dev) 및 프로덕션 사이트 4곳의 UI를 브라우저 DevTools로 실측하여 정리한 문서입니다. 디자이너의 의도와 실제 구현이 일치하는지 확인을 요청드립니다.
>
> **분석 일시**: 2026-03-12
> **분석 대상**: storybook.thebifrost.dev, bifrostnetwork.com, biquid.io, boost.btcfi.one

---

## 1. 공통 기반

### 1-1. 폰트

모든 사이트에서 동일한 폰트 스택이 확인되었습니다:

```
"Pretendard Variable", Pretendard, -apple-system, system-ui, Roboto,
"Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR",
"Malgun Gothic", sans-serif
```

### 1-2. 기술 스택 차이

| 사이트 | CSS 프레임워크 | 비고 |
|--------|---------------|------|
| storybook.thebifrost.dev | Tailwind CSS | 컴포넌트 라이브러리 |
| bifrostnetwork.com | MUI (CSS-in-JS, `css-` 접두사 클래스) | Next.js |
| biquid.io | Tailwind CSS | Next.js + Framer Motion + React Toastify + React Tooltip |
| boost.btcfi.one | Tailwind CSS (`dark` class 방식) | 라이트/다크 전환 지원 |

> bifrostnetwork.com만 MUI 기반이고, 나머지 DApp 사이트는 모두 Tailwind CSS입니다. biquid.io는 기존 "React SPA"로 분류되었으나 실제로는 Next.js 기반입니다.

### 1-3. 반응형 브레이크포인트 비교

| 사이트 | 주요 BP | 세부 BP | 프리픽스 방식 |
|--------|---------|---------|-------------|
| bifrostnetwork.com | 768px, 900px | 768px(주요), 900px(only-desktop/mobile) | MUI 기반 커스텀 |
| biquid.io | 799px, 800px, 1280px | mobile(799px), tablet(800-1279px), desktop(1280px+), landing(1080px) | Tailwind 커스텀 프리픽스 |
| boost.btcfi.one | 654px, 768px, 1024px, 1440px | mobile(654px), sm(768px), md(1024px), lg(1440px) | Tailwind 커스텀 |

> **관찰**: 세 사이트 모두 Tailwind 기본 브레이크포인트(640/768/1024/1280)를 그대로 사용하지 않고 커스텀 BP를 정의합니다.

---

## 2. Storybook 컴포넌트 라이브러리 (storybook.thebifrost.dev)

### 2-1. Color Tokens

#### Gray Scale

| Token | Hex | 실측 확인 |
|-------|-----|----------|
| gray-100 | #F7F7F7 | O |
| gray-200 | #EDEDED | O |
| gray-300 | #D9D9D9 | O |
| gray-400 | #B3B3B3 | O |
| gray-500 | #8C8C8C | O |
| gray-600 | #666666 | O |
| gray-700 | #4D4D4D | O |
| gray-800 | #333333 | O |
| gray-900 | #1A1A1A | O |

#### Brand Scale

| Token | Hex |
|-------|-----|
| brand-100 | #F3F3FF |
| brand-200 | #D9D8F8 |
| brand-300 | #B3B1F1 |
| brand-400 | #8B89E0 |
| brand-500 | #6B69CC |
| brand-600 | #4D3D94 |
| brand-700 | #2E2D6A |
| brand-800 | #1B1B3C |
| **brand-point** | **#5F5BE2** |

#### Semantic Colors (각 50~700 범위)

| 카테고리 | 50 (가장 연함) | 700 (가장 진함) | 용도 |
|----------|---------------|----------------|------|
| negative | #FFFBFB | #EC2D30 | 에러, 삭제, 위험 |
| warning | #FFFDFA | #FE9B0E | 경고 |
| positive | #FBFEFC | #0C9D61 | 성공, 확인 |
| message | #F8FCFF | #3A70E2 | 정보, 알림 |

### 2-2. Typography Tokens

| 레벨 | Tailwind 클래스 | 실측 크기 | line-height |
|------|----------------|----------|-------------|
| H1 | .text-h1 | 48px | 1.17 (≒56px) |
| H2 | .text-h2 | 40px | 1.2 (48px) |
| H3 | .text-h3 | 32px | 1.25 (40px) |
| H4 | .text-h4 | 24px | 1.33 (≒32px) |
| Subtitle | .text-subtitle | 20px | 1.4 (28px) |
| Body | .text-body | 16px | 1.5 (24px) |
| Caption | .text-caption | 12px | 1.33 (16px) |

#### Font Weight

| 이름 | weight 값 |
|------|----------|
| Light | 300 |
| Regular | 400 |
| Medium | 500 |
| Bold | 700 |
| Black | 900 |

### 2-3. Button 컴포넌트

#### Variants: primary, outline, ghost

| 속성 | Primary | Outline | Ghost |
|------|---------|---------|-------|
| background | #5F5BE2 (brand-point) | transparent | transparent |
| border | 없음 | 1px solid #5F5BE2 | 없음 |
| color | gray-100 (#F7F7F7) | #5F5BE2 | #5F5BE2 |
| hover bg | brand-300 | — | — |
| active bg | brand-500 | — | — |
| disabled | bg gray-300, text gray-100, cursor-not-allowed | 동일 규칙 | 동일 규칙 |

#### Sizes

| Size | 실측 높이 | padding | border-radius | font-size |
|------|----------|---------|---------------|-----------|
| Large | 50px | 12px 16px | 12px (rounded-xl) | 16px |
| Medium | ~46px | 12px 16px | 8px (rounded-lg) | 14px |
| Small | ~38px | 12px 12px | 8px (rounded-lg) | 12px |

### 2-4. Input 컴포넌트

| 속성 | 실측 값 |
|------|--------|
| 높이 | 40px (h-10) |
| border-radius | 8px |
| border | 1px solid gray-300 (#D9D9D9) |
| padding | 0 8px |
| font-size | 14px |
| font-weight | 500 (medium) |
| placeholder color | gray-300 (#D9D9D9) |
| hover border | brand-200 (#D9D8F8) |
| focus border | brand-300 (#B3B1F1) + shadow |

### 2-5. Toast 컴포넌트

| 속성 | 실측 값 |
|------|--------|
| border-radius | 24px |
| padding | 12px |
| min-height | 44px |
| shadow | 0px 4px 10px rgba(0,0,0,0.08) |

### 2-6. Toggle 컴포넌트

| 속성 | 실측 값 |
|------|--------|
| Track 크기 | 28px × 48px |
| Track border-radius | 9999px (rounded-full) |
| Track 색상 (off) | gray-300 |
| Track 색상 (on) | brand-point (#5F5BE2) |
| Thumb 크기 | 20px × 20px |
| Thumb 색상 | white + drop-shadow |
| transition | 150ms |

### 2-7. Tabs 컴포넌트

- **Variants**: line, segment, text
- **Sizes**: large, medium, small
- **Active 상태**: font-bold, text gray-900
- **Inactive 상태**: text gray-500

### 2-8. Badge 컴포넌트

| 타입 | 실측 값 |
|------|--------|
| Text Badge | padding 0 4px, border-radius 16px, bg brand-point, font-size 12px |
| Count Badge | font-size 8px, height 10px, position absolute (아이콘 위) |
| Dot | 4px × 4px, bg red-500 |

### 2-9. Layout Demo 패턴

| 요소 | 실측 값 |
|------|--------|
| 배경 | gradient from-gray-10 to-gray-20 |
| 최대 너비 | 1280px (max-w-7xl), margin auto |
| Header | border-bottom gray-300, bg white/80 + backdrop-blur-sm |
| Card | bg white, border-radius 16px (rounded-2xl), border gray-200, shadow-lg, padding 24~32px |
| Footer | border-top gray-200, 4-column grid, text gray-500 |

### 2-10. Checkbox 컴포넌트

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| label | string | - | 체크박스 라벨 |
| size | large / medium / small | medium | 크기 |
| variant | square / round | square | 네모 또는 원형 |
| checked | boolean | - | 체크 상태 |
| indeterminate | boolean | false | 부분 선택 |
| disabled | boolean | false | 비활성화 |
| description | string | - | 추가 설명 |
| error | string | - | 에러 메시지 |

#### Sizes (SVG 아이콘 기준)

| Size | 아이콘 크기 | Tailwind 클래스 |
|------|-----------|----------------|
| Large | 24px | w-6 h-6 |
| Medium | 20px | w-5 h-5 |
| Small | 16px | w-4 h-4 |

#### 색상 상태

| 상태 | 색상 | 토큰 |
|------|------|------|
| 미선택 (기본) | rgb(217, 217, 217) | text-gray-300 |
| 미선택 (hover) | brand-300 | group-hover:text-brand-300 |
| 미선택 (focus) | brand-300 | group-focus-within:text-brand-300 |
| 선택됨 | rgb(95, 91, 226) | text-brand-point |
| 라벨 텍스트 | rgb(26, 26, 26) | text-gray-900, font-medium, leading-[1.5] |
| 에러 텍스트 | rgb(239, 68, 68) | text-red-500, text-caption (12px), mt-1 ml-7 |

#### Transition

- `transition-colors duration-200`

#### Stories

- Default, Checked, With Description, With Error, Sizes, States, Interactive (전체동의 패턴), Without Label, Variants (Square/Round), Round Sizes, Long Label, Keyboard Accessibility

### 2-11. Radio 컴포넌트

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| checked | boolean | false | 선택 상태 |
| disabled | boolean | false | 비활성화 |
| labelPosition | left / right | right | 라벨 위치 |
| label | string | - | 라벨 텍스트 |
| size | small / medium / large | medium | 크기 |
| name | string | - | 그룹 이름 |
| value | string | - | 값 |

#### 색상 상태

| 상태 | 색상 | 토큰 |
|------|------|------|
| 미선택 (기본) | rgb(217, 216, 248) | text-brand-200 |
| 미선택 (hover) | brand-300 | group-hover:text-brand-300 |
| 선택됨 | rgb(95, 91, 226) | text-brand-point |
| 비활성화 | rgb(217, 217, 217) | text-gray-300 |
| 라벨 (활성) | rgb(26, 26, 26) | text-gray-900, font-medium, leading-[1.5] |
| 라벨 (비활성) | rgb(217, 217, 217) | text-gray-300, font-medium, leading-[1.5] |

#### Transition

- `transition-colors duration-200`

#### Stories

- Default, Checked, Disabled, Disabled Checked, Without Label, Label Positions, States, Radio Group, All States, Independent Radios, Multiple Groups, Interactive Demo

### 2-12. Tooltip 컴포넌트

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| content | string (필수) | - | 표시할 내용 |
| place | TooltipPlacement | top | 위치 (12방향) |
| delayShow | number | 200 | 표시 지연 (ms) |
| delayHide | number | 0 | 숨김 지연 (ms) |
| trigger | hover / click | hover | 트리거 방식 |
| arrow | boolean | true | 화살표 표시 |
| backgroundColor | string | - | 커스텀 배경색 |

#### 실측 CSS

| 속성 | 값 |
|------|-----|
| background | rgba(0, 0, 0, 0.8) |
| color | #FFFFFF |
| border-radius | 8px (rounded-lg) |
| padding | 4px 8px |
| font-size | 14px (text-sm) |
| font-weight | 400 (normal) |
| line-height | 1.43 |
| max-width | 320px (max-w-xs) |
| z-index | 9999 |

#### Placement 옵션

top, top-start, top-end, right, right-start, right-end, bottom, bottom-start, bottom-end, left, left-start, left-end

#### Stories

- Default, Placements, Color Playground, Custom Colors, Arrow Color Variations, Long Text, Click Trigger, Always Visible, Feature Showcase, Brand Colors

### 2-13. Popover 컴포넌트

#### 구조 (Compound Component)

- `Popover` — 메인 컨테이너 (Context Provider)
- `Popover.Trigger` — 트리거 요소
- `Popover.Content` — 내용 컨테이너
- `Popover.Title` — 제목
- `Popover.Description` — 설명
- `Popover.Item` — 클릭 가능한 메뉴 아이템
- `Popover.Separator` — 구분선
- `Popover.Action` — 액션 버튼

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| placement | 12방향 | - | 위치 |
| closeOnOutsideClick | boolean | true | 외부 클릭 시 닫기 |
| closeOnEscape | boolean | true | ESC 키 닫기 |
| offset | number | 8 | 트리거와의 거리 |

#### 기반 기술

- Floating UI 기반 위치 계산
- 자동 위치 조정 (화면 경계 검사)
- 키보드 접근성 지원

#### Stories

- Default, Placements, Menu Popover, Button Variations (Primary/Success/Warning/Danger), Complex Content, Interactive Menu, Options, User Profile Menu

### 2-14. Skeleton 컴포넌트

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| loading | boolean | true | 로딩 상태 여부 |
| width | string / number | - | 너비 |
| height | string / number | - | 높이 |
| children | ReactNode | - | 감쌀 콘텐츠 |

#### 실측 CSS

| 속성 | 값 |
|------|-----|
| Wrapper | `relative overflow-hidden` |
| 내부 배경 | bg-gray-200 (rgb(237, 237, 237)), `w-full h-full` |
| 기본 모양 (rounded) | border-radius 4px |
| 원형 (rounded-full) | border-radius 9999px |
| 애니메이션 | shimmer (커스텀 키프레임) |

#### 모양 옵션

| 모양 | Tailwind 클래스 | border-radius |
|------|----------------|---------------|
| 사각형 | rounded | 4px |
| 원형 (프로필) | rounded-full | 9999px |

#### Stories

- Default, With Content, Show Content, Shapes (원형/텍스트/카드), Loading States, Real World Example

### 2-15. Spinner 컴포넌트

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| size | small / medium / large | medium | 크기 |
| textPosition | right / bottom | right | 텍스트 위치 |
| text | string | - | 텍스트 |
| icon | ReactElement | - | 커스텀 아이콘 |

#### Sizes

| Size | SVG 크기 | 텍스트 크기 | 텍스트 Tailwind |
|------|---------|-----------|----------------|
| Small | 16px | 12px | text-xs |
| Medium | 20px | 14px | text-sm |
| Large | 24px | 16px | text-base |

#### 실측 CSS

| 속성 | 값 |
|------|-----|
| animation | `animate-spin-smooth` (spin 1s) |
| 텍스트 색상 | text-black |
| 텍스트 font-weight | medium (500) |

### 2-16. Slider 컴포넌트

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| min | number | 0 | 최솟값 |
| max | number | 100 | 최댓값 |
| defaultValue | number | 0 | 기본값 |
| labelType | number / label / cdp | number | 라벨 타입 |
| disabled | boolean | false | 비활성화 |
| width | number | 400 | 너비 |
| showDots | boolean | true | 점 인디케이터 |
| labelDisplay | all / edges | all | 라벨 표시 방식 |

#### 기반 기술

- rc-slider 라이브러리 기반

#### 실측 CSS

| 요소 | 속성 |
|------|------|
| 트랙 배경 | bg-gray-100 (rgb(247, 247, 247)), h-4 (16px), rounded-xl (12px) |
| 트랙 배경 (disabled) | bg-gray-200 (rgb(237, 237, 237)) |
| 트랙 채움 (gradient) | linear-gradient(90deg, brand-300 0%, brand-point 100%) |
| 핸들 (기본) | 24px, bg white, border-radius 50%, cursor grab |
| 핸들 shadow | rgba(0,0,0,0.04) 0px 2px 4px, rgba(0,0,0,0.02) 0px 1px 1px |
| 핸들 (disabled) | bg gray-200, cursor not-allowed, shadow none |
| 점 인디케이터 (활성) | 8px, rounded-full, bg-brand-400 |
| 점 인디케이터 (비활성) | 8px, rounded-full, bg-gray-200 |
| 점 (disabled) | bg-gray-300, cursor-not-allowed |
| 트랙/점 transition | `transition-all duration-200` |
| 채움 transition | `transition-all duration-300 ease-out` |

### 2-17. Pagination 컴포넌트

#### Props

| Prop | 타입 | 설명 |
|------|------|------|
| current | number | 현재 페이지 |
| total | number | 전체 페이지 수 |
| size | large / medium / small | 크기 |

#### 타입별 변형

- **Dot**: 둥근 점으로 페이지 표시
- **Number**: 숫자 버튼으로 페이지 표시
- **Number With Indicator**: 숫자 + "/"+ 총 페이지
- **Indicator Only**: 현재/총 페이지 숫자만

#### Dot 타입 실측

| Size | 활성 dot | 비활성 dot | gap |
|------|---------|----------|-----|
| Large | w-10 (40px) h-4 (16px), rounded-2xl, bg brand-point, border brand-point | w-4 (16px) h-4 (16px), rounded-2xl, border brand-200 | gap-4 (16px) |
| Medium | w-3 (12px) h-3 (12px) | 12px, border brand-200 | gap-3 (12px) |
| Small | w-2 (8px) h-2 (8px) | 8px | gap-2 (8px) |

#### Dot transition

- `transition-all duration-200`, hover:opacity-80

#### Number 타입 실측

| 속성 | 활성 | 비활성 |
|------|------|--------|
| color | brand-point (rgb(95, 91, 226)) | gray-400 (rgb(179, 179, 179)) |
| font-weight | 500 (medium) | 400 (regular) |
| font-size (large) | 16px (text-base) | 16px |
| font-size (medium) | 14px (text-bodySm) | 14px |
| font-size (small) | 12px (text-caption) | 12px |

#### 화살표 아이콘

- 크기: 16px
- 비활성 색상: gray-300

### 2-18. Snackbar 컴포넌트

#### Variants

| Variant | 배경 | 텍스트 | border | shadow |
|---------|------|--------|--------|--------|
| Black | rgba(0,0,0,0.8) | white | 없음 | shadow-lg |
| White | rgb(255,255,255) | gray-900 (#1A1A1A) | 1px solid gray-200 | shadow-md |

#### 실측 CSS (공통)

| 속성 | 값 |
|------|-----|
| border-radius | 16px (rounded-2xl) |
| padding | 16px |
| min-width | 320px |
| backdrop-filter | blur(sm) |
| layout | flex justify-between gap-1 |
| 아이콘 크기 | 24px (w-6 h-6) |
| 제목 font-size | 16px |
| 제목 font-weight | 500 (medium) |
| 설명 font-size | 14px |
| 설명 color (black) | gray-300 |
| 설명 color (white) | gray-500 |

#### Stories

- Black, White, Basic Default, Basic With Description, Basic With Icon, Basic Without Close Button, Action Single Button, Action Double Button, Interactive Demo

### 2-19. Divider 컴포넌트

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| orientation | horizontal / vertical | horizontal | 방향 |
| variant | line / bar | line | 스타일 |

#### 실측 CSS

| 조합 | 구현 |
|------|------|
| Horizontal Line | `border-t border-gray-300 w-full` — 1px solid rgb(217, 217, 217) |
| Horizontal Bar | `bg-gray-200 w-full` — height 8px, bg rgb(237, 237, 237) |
| Vertical Line | `border-l border-gray-300 h-full` — 1px solid rgb(217, 217, 217) |
| Vertical Bar | `bg-gray-200 h-full` — width 8px, bg rgb(237, 237, 237) |

### 2-20. Label 컴포넌트

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| children | ReactNode (필수) | - | 내용 |
| variant | solid / line / text | solid | 스타일 |
| type | message / negative / warning / positive / point / normal | normal | 색상 타입 |
| startIcon | ReactElement | - | 시작 아이콘 |
| endIcon | ReactElement | - | 끝 아이콘 |

#### 공통 실측 CSS

| 속성 | 값 |
|------|-----|
| display | inline-flex |
| height | 28px (h-7) |
| padding | 0px 8px (px-2) |
| border-radius | 4px (rounded) |
| font-size | 14px (text-bodySm) |
| font-weight | 500 (medium) |
| line-height | 1.43 |
| gap | 4px (gap-1) |
| border | 1px solid |

#### Solid 변형 색상

| Type | 배경 | 텍스트 |
|------|------|--------|
| Normal | gray-900 (#1A1A1A) | white |
| Message | message-700 (#3A70E2) | white |
| Positive | positive-700 (#0C9D61) | white |
| Negative | negative-700 (#EC2D30) | white |
| Warning | warning-700 (#FE9B0E) | white |
| Point | brand-point (#5F5BE2) | white |

#### Line 변형

- 투명 배경 + 각 type 색상의 border + 해당 색상 텍스트

#### Text 변형

- 투명 배경 + 투명 border + 해당 색상 텍스트만

### 2-21. Profile 컴포넌트

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| src | string | - | 이미지 URL |
| defaultSrc | string | - | 폴백 이미지 URL |
| alt | string | Profile | 대체 텍스트 |
| size | x-small / small / medium / large | large | 크기 |
| editable | boolean | false | 편집 아이콘 표시 |

#### Sizes

| Size | 크기 | Tailwind |
|------|------|----------|
| X-Small | 24px | w-6 h-6 |
| Small | 28px | w-7 h-7 |
| Medium | 32px | w-8 h-8 |
| Large | 40px | w-10 h-10 |

#### 실측 CSS

| 속성 | 값 |
|------|-----|
| 외형 | rounded-full, overflow-hidden |
| 폴백 배경 | bg-gray-200, border border-gray-300 |
| 폴백 텍스트 | "?", text-gray-400, font-bold |
| 이미지 | rounded-full, object-cover |

### 2-22. SegmentSlider 컴포넌트

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| markers | array | - | 마커 정의 배열 |
| defaultValue | number | 0 | 기본값 |
| min | number | 0 | 최솟값 |
| max | number | 100 | 최댓값 |
| width | number | 400 | 너비 |
| disabled | boolean | true | 읽기 전용 (핸들 숨김) |

#### 실측 CSS

| 요소 | 속성 |
|------|------|
| 트랙 | bg-gray-100, h-4 (16px), rounded-xl (12px), transition-all duration-200 |
| Safe 마커 | 4px, rounded-full, bg rgb(192, 229, 209) (positive 계열) |
| 중간 마커 | 4px, rounded-full, bg gray-300 |
| Risk 마커 | 4px, rounded-full, bg rgb(255, 204, 210) (negative 계열) |
| 마커 라벨 | text-sm (14px), text-gray-600 |

#### Stories

- Default (Safe/Moderate/Risk), Figma CDP Design, Read Only Demo, Segment States

### 2-23. TabBar 컴포넌트

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| disableLabel | boolean | false | 라벨 숨김 |

#### 실측 CSS

| 요소 | 속성 |
|------|------|
| 탭 버튼 (공통) | flex flex-col items-center, w-20 (80px), p-1 (4px) |
| 탭 (활성) | text-brand-800 (#1B1B3C) |
| 탭 (비활성) | text-gray-400 (#B3B3B3), hover:text-brand-400 |
| 탭 (disabled) | text-gray-300 (#D9D9D9), cursor-not-allowed |
| Container (nav) | flex, border-top border-gray-200, bg white |
| transition | `transition-colors duration-200` |

#### Stories

- Basic, Without Labels, With Disabled, Wallet Navigation, Uncontrolled Mode, Many Items, Interactive Example, Conditional Rendering, State Comparison

### 2-24. Icon 시스템

#### 개요

- 커스텀 SVG 아이콘 세트 (Lucide/Heroicons 아님)
- name prop으로 아이콘 선택
- size prop (숫자 또는 CSS 문자열)
- width/height로 비율 커스텀 가능

#### 기본 크기

- **Default: 24px x 24px**

#### 사용 가능 사이즈

| 크기 | px |
|------|-----|
| 16 | 16px |
| 20 | 20px |
| 24 | 24px (기본) |
| 28 | 28px |
| 32 | 32px |
| 48 | 48px |
| 64 | 64px |

#### 아이콘 목록 (총 100+ 개)

**네비게이션**: ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronLeftSmall, ChevronRightSmall, Close, CloseSmall, CaretDown, CaretUp, Home, HomeFilled, Browser, First, End

**액션**: Add, Cancel, CancelBox, CancelBoxFilled, CancelFilled, Check, CheckBox, CheckBoxFilled, Complete, CompleteFilled, Copy, Edit, Erase, Search, Send, Link, Lock, Unlock, Hide, Show, More, Hamburger

**지갑/금융**: Wallet, WalletConnect, WalletConnectColored, Deposit, Withdraw, Swap, Borrow, Stake, Unstake, GasTopup, GasTopupFilled, Vault, AddLiquidity, Deploy

**커뮤니케이션**: Bell, BellFilled, Chat, ChatFilled, Email, Notification, NotificationFilled

**유틸리티**: Info, InfoFilled, Warn, WarnFilled, HelpCenter, Settings, SettingsColored, Key, QrCode, Receive, Image, Gift, Crown, Like, Dislike

**소셜**: Discord, Telegram, Twitter, Medium, Reddit

**서비스별**: BiportColored, CoinbaseColored, MetamaskColored, GoogleColored, AppleColored

**설정**: DarkMode, LightMode, Volume, Mute, LanguageSettingColored, NetworkSettingColored, BrowserSettingColored, NftSettingColored, VersionColored, CurrencyColored

**인증**: FaceId, FingerPrint, BiometricId, BioAuthColored, Verification

### 2-25. Assets 컴포넌트

#### 개요

- 암호화폐/토큰 아이콘 표시용 컴포넌트
- 원형 이미지 + 선택적 네트워크 아이콘 오버레이

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| size | xx-small ~ x-large | medium | 크기 |
| mainImage | string | - | 메인 이미지 URL |
| networkImage | string | - | 네트워크 아이콘 URL |
| surfaceColor | string | transparent | 네트워크 아이콘 배경색 |

#### Sizes

| Size | 이미지 크기 | Tailwind |
|------|-----------|----------|
| XX-Small | 16px | w-4 h-4 |
| X-Small | 20px | w-5 h-5 |
| Small | 24px | w-6 h-6 |
| Medium | 32px | w-8 h-8 |
| Large | 40px | w-10 h-10 |
| X-Large | 48px | w-12 h-12 |

#### 실측 CSS

- 이미지: rounded-full, object-cover
- 네트워크 오버레이: 고정 20x20px, 2px 패딩, absolute 위치
- 폴백: "?" 텍스트, 사이즈별 적응형 font-size

### 2-26. 디자인 토큰 (추가 확인)

#### Color Tokens (Storybook Style 섹션 실측)

Colors 페이지에서 확인된 전체 토큰:

| 카테고리 | 범위 | 비고 |
|---------|------|------|
| black/white | #000000, #FFFFFF | 기본 |
| gray | 100~900 (9단계) | 2-1에 기재 |
| brand | 100~800 + point (9단계) | 2-1에 기재 |
| negative | 50~700 (8단계) | 50~700까지 8단계 확인 |
| warning | 50~700 (8단계) | 동일 |
| positive | 50~700 (8단계) | 동일 |
| message | 50~700 (8단계) | 동일 |

> **참고**: Spacing scale, Shadow 토큰, Breakpoint 정의는 Storybook에 별도 섹션으로 존재하지 않음. Tailwind 기본값(spacing 4px 단위, 기본 breakpoints)을 사용 여부는 미확인.

### 2-27. Typography Tokens (추가 확인)

bodySm 클래스가 컴포넌트 내부에서 발견됨:

| 레벨 | Tailwind 클래스 | 실측 크기 | line-height |
|------|----------------|----------|-------------|
| Body Small | .text-bodySm | 14px | 1.43 (≒20px) |

> 기존 2-2에서 bodySm이 누락되어 있었으나, Label, Tooltip, SegmentSlider 등 다수 컴포넌트에서 사용 확인.

### 2-28. 모션/트랜지션 종합

컴포넌트별 transition CSS 속성 정리:

| 컴포넌트 | transition | 값 |
|---------|-----------|-----|
| Checkbox | transition-colors | duration-200 (200ms) |
| Radio | transition-colors | duration-200 |
| Toggle | transition | 150ms |
| Button | transition-colors | duration-150 |
| Slider (트랙/점) | transition-all | duration-200 |
| Slider (채움) | transition-all | duration-300 ease-out |
| Pagination (Dot) | transition-all | duration-200 |
| TabBar | transition-colors | duration-200 |
| Popover 트리거 버튼 | transition-colors | duration-150 |

> **패턴**: 대부분의 컴포넌트가 150ms 또는 200ms의 transition을 사용. 색상 변경은 `transition-colors`, 크기/위치 변경은 `transition-all`. Easing은 Tailwind 기본(cubic-bezier(0.4, 0, 0.2, 1))이 주로 사용되며, Slider 채움에만 ease-out을 별도 적용.

---

## 3. bifrostnetwork.com — 공식 사이트

### 3-1. 개요

- **테마**: 다크 모드 전용
- **기술**: Next.js + MUI (Material UI) + CSS-in-JS
- **페이지**: /, /ecosystem, /developer, /about, /network, /stake, /bridge, /faucet

### 3-2. 컬러

| 용도 | 실측 값 |
|------|--------|
| 페이지 배경 | #1A1A1A (rgb(26,26,26)) |
| Header 배경 | rgba(26,26,26, 0.92) — 반투명 |
| 카드/섹션 배경 | rgba(26,26,26, 0.8) |
| 주요 텍스트 | #FFFFFF |
| 보조 텍스트 | #888888 |
| **Primary CTA** | **#FF474C** (레드) |
| 버튼/카드 border | #888888 |
| Footer 배경 | #111111 |

### 3-3. 타이포그래피

| 요소 | font-size | font-weight | line-height |
|------|-----------|-------------|-------------|
| 히어로 H2 (메인 타이틀) | 64px | 900 (Black) | 64px |
| 로고 H1 | 28px | 900 | — |
| 섹션 H2 | 40px | 900 | — |
| 소제목 | 28px | 900 | — |
| 본문 | 16px | 400~500 | — |
| 네비게이션 | 16px | 400 | — |
| 히어로 H2 (모바일) | 24px | 900 | — |

> **반응형**: 데스크톱 H2 64px → 모바일 24px로 대폭 축소. weight 900은 유지.

### 3-4. 버튼

| 요소 | 실측 스타일 |
|------|-----------|
| "Start Building" Primary CTA | bg #FF474C, color white, **border-radius 4px**, padding 24px, height 72px |
| "Start Building" Outline | transparent, color #FF474C, border 1px solid, **border-radius 4px**, padding 24px |
| "Get Started" / "Join us" | transparent, border 1px solid #888, **border-radius 4px**, color #888 |
| "Documentation" / "API References" | transparent, border 1px solid, color #FF474C, **border-radius 4px** |
| Ghost (네비게이션 항목) | transparent, no border, color white, hover → color #FF474C |
| Nav Button (하위 페이지) | transparent, border 1px solid #888, hover → border-color #FF474C |

> **관찰**: 이 사이트의 모든 버튼은 border-radius **4px**로, DApp 사이트(12~48px)와 현저히 다릅니다.

### 3-5. 카드 (에코시스템 페이지)

| 속성 | 실측 값 |
|------|--------|
| border | 1px solid #888 (일부 #3D3D3D) |
| border-radius | 4px |
| layout | 4열 그리드 |
| 카드 크기 | 268×408px |
| gap | 80px(세로) × 16px(가로) |
| hover | scale(1.05) + saturate 증가 |
| 구성 | 로고 중심 + 하단 텍스트 |

### 3-6. 특징적 UI 요소

- **3D 메탈릭 비주얼**: 각 페이지마다 고퀄리티 3D 렌더링 이미지 배치 (B 로고, 토러스, 큐브 등)
- **파트너 로고 마퀴**: 2행, 로고 160×160px, gap 64px, `slide` keyframe 300s 무한 반복
- **비디오**: autoplay, loop, muted, playsInline, poster 없음
- **섹션 레이아웃**: 풀스크린에 가까운 높이 (100vh 근접)

### 3-7. Header 상세

| 속성 | 값 |
|------|-----|
| position | fixed |
| 높이 | 데스크톱 80px / 모바일 56px |
| backdrop-filter | blur(2px) |
| z-index | 3 |
| 배경 | rgba(26,26,26, 0.92) |
| 모바일 (768px 이하) | 햄버거 메뉴 → 전체화면 아코디언 오버레이 |

### 3-8. Hover 패턴 종합

| 요소 | hover 효과 |
|------|-----------|
| 네비게이션 링크 | color → #FF474C (레드) |
| CTA pill 버튼 | 우측만 border-radius 36px 변형 + `::after` 화살표 출현 |
| 에코시스템 카드 | scale(1.05) + saturate 증가 |
| 파트너 로고 | opacity → 0.8 |

### 3-9. 하위 페이지 레이아웃

| 페이지 | 레이아웃 |
|--------|---------|
| /ecosystem | 4열 그리드 268px, gap 80px×16px |
| /developer | pill 링크 버튼, 섹션 gap 80px |
| /about | 텍스트 중심, 섹션 gap 160px |
| /network | 스펙 그리드 + Validator 테이블 |
| /stake | DApp 내장 (biquid.io embed) |
| /bridge | 480px 폼 (싱글 컬럼) |
| /faucet | Input + Request 버튼 |

### 3-10. 간격 체계

- **기본 단위**: 40px 배수 (40, 80, 120, 160px)
- **섹션 간 padding**: 80~160px
- **카드 내부**: padding 40px
- **Footer**: padding 80px 40px

### 3-11. 반응형

| 브레이크포인트 | 용도 |
|--------------|------|
| 768px | 주요 BP — 레이아웃 전환, 햄버거 메뉴 활성화 |
| 900px | only-desktop / only-mobile 전환 |
| 480px | 미확인 |

- 모바일 타이포 축소: H2 64→24px, weight 900 유지
- 그리드 4열 → 2열 → 1열

### 3-12. Footer 상세

| 속성 | 값 |
|------|-----|
| 배경 | #111111 |
| padding | 80px 40px |
| 구성 | 3열 링크 그리드 (Ecosystem / Build / Learn) |
| 구분선 | 1px solid |
| 소셜 아이콘 | Twitter, Discord, GitHub, Reddit, Telegram (5개) |

---

## 4. biquid.io — 유동성 스테이킹 DApp

### 4-1. 개요

- **테마**: 다크 모드 전용
- **기술**: Next.js + Tailwind CSS + Framer Motion
- **페이지**: / (랜딩), /staking, /wrapping, /dashboard, /unstaking
- **앱 레이아웃**: 싱글 컬럼, max-width 672px

### 4-2. 다크 배경 레이어 시스템

| 레이어 | Hex | 적용 위치 |
|--------|-----|----------|
| Level 0 | #000000 | 페이지 배경 |
| Level 1 | #080808 | Header |
| Level 2 | #1E1E1E | 카드 배경 |
| Level 3 | #303030 | Input, 서브카드 |
| Level 4 | #3D3D3D | 툴팁 |
| border | #4A4A4A | 구분선 |

> **관찰**: box-shadow를 사용하지 않고, 배경색의 명도 차이만으로 UI 깊이(depth)를 표현합니다.

### 4-3. 텍스트 컬러

| 용도 | Hex | 토큰명 |
|------|-----|--------|
| 주요 텍스트 | #FFFFFF | text-white-100 |
| 보조 텍스트 | #888888 | text-grey-100 |
| 비활성 텍스트 | #4A4A4A | text-grey-200 |
| 일반 텍스트 | #303030 | text-black-100 |
| Positive (수익) | #00FF66 (네온 그린) | — |
| Negative (손실) | #FF474C | text-point |

### 4-4. 버튼

| 타입 | border-radius | 높이 | 비고 |
|------|-------------|------|------|
| Primary CTA | 48px (pill) | 48px | — |
| Hero CTA | 9999px (pill) | 56px | 랜딩 페이지 |
| 지갑 연결 | 6px | auto | — |
| Max 버튼 | 8px | auto | Input 내부 |
| Disabled | — | — | bg #303030, color #888888, cursor not-allowed |

### 4-5. 주요 컴포넌트

| 컴포넌트 | 실측 값 |
|---------|--------|
| Card | bg #1E1E1E, border-radius 24px, padding 16px, shadow 없음 |
| Input | bg #303030, border-radius 16px, height 48px |
| Tab | 활성: white bg + border-radius 24px + height 40px, 비활성: transparent |
| 정보 요약 박스 | bg #1E1E1E, border-radius 16px, padding 16px, key-value 쌍 나열 |
| 탭 전환 (pill) | 332×48px, pill 형태, 활성=white bg, 전환 트랜지션 포함 |
| Slider | Storybook 컴포넌트 기반, Max 연동 |

### 4-6. 특징적 UI 요소

- **비디오 히어로**: 빨간 라바(용암) 애니메이션 배경
- **마퀴 텍스트**: "Smart Choice Returns" 등 좌우 반복 스크롤
- **플로팅 Stake 배지**: 원형 회전 텍스트 요소
- **카운트업 애니메이션**: 0 → 목표값까지 숫자 증가 (히어로 섹션 KPI)
- **Framer Motion 등장**: translateY(8px/16px) + opacity 0→1, 뷰포트 진입 시 트리거
- **브랜드 컬러**: #FF474C (레드) — bifrostnetwork.com과 동일

### 4-7. 네비게이션 상세

| 속성 | 값 |
|------|-----|
| position | sticky, top 0 |
| z-index | 50 |
| height | 81px |
| padding | px-10 py-6 |
| 활성 탭 | color white (#FFFFFF) |
| 비활성 탭 | color grey-200 (#4A4A4A), hover → text-point (#FF474C) 또는 text-white-100 |
| 모바일 | 풀스크린 오버레이 메뉴 |

### 4-8. 모션/애니메이션

| 패턴 | 구현 |
|------|------|
| 등장 애니메이션 | Framer Motion, translateY(8px/16px) + opacity 0→1 |
| 트리거 | 뷰포트 진입 시 (viewport once) |
| 인터랙션 전환 | transition 0.3s cubic-bezier(0.4, 0, 0.2, 1) |
| hover 텍스트 | → text-point(#FF474C) 또는 text-white-100 |
| 마퀴 텍스트 | 160px 크기, text-black-100(#303030), mobile:hidden |
| 카운트업 | 0 → 목표값 숫자 증가 (히어로 KPI) |

### 4-9. 반응형

| 브레이크포인트 | 이름 | 용도 |
|--------------|------|------|
| 799px | mobile | 모바일 레이아웃 전환 |
| 800-1279px | tablet | 태블릿 |
| 1280px+ | desktop | 데스크톱 |
| 1080px | landing | 랜딩 페이지 전용 |

### 4-10. 여백 패턴

| 영역 | 여백 |
|------|------|
| 히어로 | gap 24px |
| 섹션 간 | gap 48-80px |
| 폼 카드 | p-4, gap-6 |
| Nav | px-10, py-6 |
| 앱 max-width | 672px |

### 4-11. 숫자 표기 규칙

- 천 단위 구분: 쉼표 (1,234,567)
- 소수점: 점 (0.1234)
- 단위 위치: 숫자 뒤 (0 BFC)
- 교환 비율: 소수점 4자리 (1 BFC = 1.0234 sBFC)

### 4-12. 페이지별 구성

| 페이지 | 핵심 구성 |
|--------|---------|
| /unstaking | Everdex 배너 + 언스테이킹 폼 + 출금 대기 테이블(flex 5열) + FAQ 아코디언 |
| /wrapping | 래핑/언래핑 탭(pill 332×48px) + from/to 방향 전환 + 교환 정보 박스 |
| /dashboard | 3열 KPI(bg #080808 + border) + 보상 테이블(flex 5열, border-bottom) + 잔고+예상보상 2열 grid + 출금 대기 + FAQ |

### 4-13. 빈 상태/비활성 패턴

| 상태 | 표현 |
|------|------|
| 수치 빈 상태 | 0 표시 (대시나 — 아님) |
| 버튼 disabled | bg #303030, color #888888, cursor not-allowed |
| 테이블 빈 영역 | 빈 영역 + 안내 텍스트 |
| 토큰 셀렉터 | 고정 라벨 (드롭다운 아님), 페이지별 토큰 고정 |

### 4-14. 사용 라이브러리

| 라이브러리 | 용도 |
|-----------|------|
| Framer Motion | 등장 애니메이션, 뷰포트 트리거 |
| React Toastify | 토스트 알림 |
| React Tooltip | 툴팁 표시 |

---

## 5. boost.btcfi.one — BTC 수익 어그리게이터

### 5-1. 개요

- **테마**: 라이트/다크 전환 지원 (`html class="light"` / `"dark"` 토글, body에 transition 적용)
- **기술**: Tailwind CSS
- **페이지**: / (랜딩), /dashboard, /vaults
- **Footer**: "(c) 2026 PiLab Co., Ltd"

### 5-2. 테마 토큰 매핑 (다크 ↔ 라이트)

| 시맨틱 토큰 | 다크 | 라이트 | 가변 여부 |
|------------|------|--------|----------|
| bg-bg-grey-300 | #1C2130 | #EAEDF6 | 가변 |
| bg-surface-grey-50 | #293042 | #FFFFFF | 가변 |
| text-grey-300 (다크) / text-grey-700 (라이트) | 밝은 회색 | 어두운 회색 | 반전 |
| Primary (#3467F4) | #3467F4 | #3467F4 | **불변** |
| 보조 텍스트 (#7986AA) | #7986AA | #7986AA | **불변** |
| Positive (#00C267) | #00C267 | #00C267 | **불변** |

### 5-3. 라이트 테마 컬러

| 용도 | Hex |
|------|-----|
| 배경 | #EAEDF6 (연한 라벤더) |
| 카드 | #FFFFFF |
| 주요 텍스트 | #292929 |
| 보조 텍스트 | #7986AA |
| **Primary** | **#3467F4** (블루) |
| Positive | #00C267 |
| border | #C9D2E8 |
| shadow | rgba(5,30,97,0.06) 0px 10px 4px |

### 5-4. 다크 테마 컬러

| 용도 | Hex |
|------|-----|
| 배경 | #1C2130 (짙은 네이비) |
| 카드 | #293042 |
| 주요 텍스트 | #FFFFFF |
| 보조 텍스트 | #7986AA **(라이트와 동일)** |
| **Primary** | **#3467F4** **(라이트와 동일)** |
| border | #40485F |
| shadow | rgba(20,23,31,0.2) 0px 14px 4px |

> **관찰**: Primary 컬러(#3467F4)와 보조 텍스트 컬러(#7986AA)가 라이트/다크 모드에서 변하지 않습니다.

### 5-5. 버튼

| 타입 | border-radius | 비고 |
|------|-------------|------|
| "시작하기" CTA | 32px (pill) | 메인 CTA, primary-200 bg |
| "지갑 연결하기" | 16px | Header |
| "입출금하기" | 12px | 카드 내부 |
| Secondary | 32px | grey-600 bg |
| Primary | 32px | primary-200 bg |
| Max 버튼 | 8px | Input 내부 |
| 이자 내역 | 8px | 소형 액션 |
| Disabled | — | opacity 50%, cursor not-allowed |

### 5-6. 주요 컴포넌트

| 컴포넌트 | 실측 값 |
|---------|--------|
| Card | border-radius 16px, padding 12px, shadow-panel (커스텀 유틸리티) |
| Vault 행 | 카드형, 16px radius, 12px padding, UL flex-column gap 16px, 헤더 행 없음 |
| KPI 카드 | 296×160px, bg surface-grey-50, 상품명+네트워크+APY+버튼 |
| Popover (설정) | 200×122px, surface-grey-50 bg, 16px radius, Floating UI 기반 |
| Badge | primary-200 bg, 8px radius, 12px font, 96×24px |

### 5-7. 특징적 UI 요소

- **3D 버블 히어로 이미지**: 라이트/다크 각각 별도 이미지
- **다크 테마 파형 배경**: dark-wave.png 적용
- **포트폴리오 도넛 차트**: Recharts 라이브러리, SVG viewBox 120×120, 빈 상태 fill #F1F3F9
- **사이드바 네비게이션**: 대시보드 내 좌측 사이드바
- **Toast**: React Toastify, 320px 너비

### 5-8. 대시보드 레이아웃

| 요소 | 실측 |
|------|------|
| 사이드바 | flex-basis 320px, sticky, padding 68px 24px, border-l/r, mobile:hidden |
| 메인 영역 | max-width 960px, padding 72px 24px |
| KPI 카드 그리드 | 3열 flex, gap 12px, md-screen → flex-col |
| 카드 | 16px radius, 12px padding |
| Vault 리스트 | UL flex-column, gap 16px |

### 5-9. 반응형

| 브레이크포인트 | 이름 | 용도 |
|--------------|------|------|
| 654px | mobile | 모바일 레이아웃 |
| 768px | sm | 소형 태블릿 |
| 1024px | md | 그리드 전환 (3열→1열) |
| 1440px | lg | 대형 데스크톱 |

- 모바일: 사이드바 숨김 → 하단 고정 네비게이션 바
- 카드 그리드: 3열 → 1열 (flex-col)

### 5-10. 여백 패턴

- **기본 단위**: 4px (4, 8, 12, 16, 20, 24, 40)
- 사이드바: padding 68px(상) 24px(좌우)
- 메인: padding 72px(상) 24px(좌우)
- 카드: padding 12px
- 카드 간 gap: 12px
- 리스트 gap: 16px

### 5-11. 테마 전환 상세

| 속성 | 값 |
|------|-----|
| 전환 속도 | duration 0s (즉시 전환, 애니메이션 없음) |
| 구현 | html class 토글 ("light" / "dark") |
| 불변 토큰 | Primary #3467F4, 보조 텍스트 #7986AA, Positive, border-radius |
| 가변 토큰 | 배경, 카드, 텍스트, border, shadow |

### 5-12. 빈 상태

- 텍스트만 표시: "진행중인 거래가 없어요."
- 배경: rgb(34, 40, 58) / #222A3A
- 일러스트/아이콘 없음, CTA 버튼 미동반

---

## 6. 사이트 간 비교 분석

### 6-1. 서비스별 브랜드 컬러

| 서비스 | Primary 컬러 | 계열 |
|--------|-------------|------|
| Storybook 컴포넌트 라이브러리 | #5F5BE2 | 보라 |
| Bifrost Network (공식 사이트) | #FF474C | 레드 |
| Biquid (스테이킹 DApp) | #FF474C | 레드 |
| BTCFi Boost (수익 어그리게이터) | #3467F4 | 블루 |

### 6-2. border-radius 비교

| 사이트 | 버튼 | 카드 | Input | CTA |
|--------|------|------|-------|-----|
| Storybook | 8~12px | 16px | 8px | — |
| bifrostnetwork.com | **4px** | **4px** | — | **4px** |
| biquid.io | 6~8px | 24px | 16px | 48~9999px |
| boost.btcfi.one | 8~16px | 16px | — | 32px |

> **관찰**: bifrostnetwork.com의 border-radius(4px 통일)가 다른 사이트들(8~48px)과 현저히 다릅니다.

### 6-3. 다크 모드 배경색 비교

| 사이트 | 기본 배경 | 카드 배경 | 방식 |
|--------|----------|----------|------|
| bifrostnetwork.com | #1A1A1A | rgba(26,26,26,0.8) | 투명도로 레이어링 |
| biquid.io | #000000 | #1E1E1E | 5단계 명도 차이 |
| boost.btcfi.one (다크) | #1C2130 | #293042 | 네이비 계열 명도 차이 |

### 6-4. Depth 표현 방식

| 사이트 | 방법 |
|--------|------|
| bifrostnetwork.com | 배경색 투명도 + 최소한의 border |
| biquid.io | 배경색 명도 5단계, box-shadow 미사용 |
| boost.btcfi.one | 배경색 명도 + 커스텀 shadow-panel |

### 6-5. 3D 비주얼 요소

| 사이트 | 비주얼 |
|--------|--------|
| bifrostnetwork.com | 메탈릭 3D 렌더링 (B 로고, 토러스, 큐브) |
| biquid.io | 비디오 라바(용암) 애니메이션 |
| boost.btcfi.one | 3D 유리 버블 (라이트/다크 각각 별도) |

### 6-6. 반응형 브레이크포인트 비교

| 사이트 | 모바일 | 태블릿/중간 | 데스크톱 | 특이 BP |
|--------|--------|-----------|---------|---------|
| bifrostnetwork.com | 768px↓ | 900px | — | 900px(only-desktop) |
| biquid.io | 799px↓ | 800-1279px | 1280px+ | 1080px(landing) |
| boost.btcfi.one | 654px↓ | 768-1024px | 1024px+ | 1440px(lg) |

### 6-7. 모션/트랜지션 비교

| 사이트 | 주요 방식 | 대표 값 |
|--------|---------|---------|
| Storybook | CSS transition | 150-200ms, Tailwind 기본 easing |
| bifrostnetwork.com | CSS transition | 0.3s cubic-bezier(0.4, 0, 0.2, 1), 마퀴 300s |
| biquid.io | Framer Motion | translateY(8/16px) + opacity, 뷰포트 진입 트리거 |
| boost.btcfi.one | Tailwind 기본 | 테마 전환 duration 0s (즉시) |

### 6-8. 네비게이션 패턴 비교

| 사이트 | 데스크톱 | 모바일 |
|--------|---------|--------|
| bifrostnetwork.com | 상단 fixed nav, 80px | 56px + 햄버거 → 전체화면 아코디언 |
| biquid.io | 상단 sticky nav, 81px | 풀스크린 오버레이 |
| boost.btcfi.one | 좌측 사이드바 320px | 사이드바 숨김 → 하단 고정 nav |

### 6-9. 여백 체계 비교

| 사이트 | 기본 단위 | 섹션 간격 | 특징 |
|--------|---------|----------|------|
| bifrostnetwork.com | 40px 배수 | 80-160px | 대형 여백, 풀스크린 지향 |
| biquid.io | Tailwind scale | 48-80px | 싱글 컬럼 672px |
| boost.btcfi.one | 4px 단위 | 사이드바+메인 분할 | 컴팩트한 대시보드 |

### 6-10. 빈 상태 패턴 비교

| 사이트 | 빈 상태 표현 |
|--------|------------|
| biquid.io | 수치 0 표시, 테이블 빈 영역 + 안내 텍스트 |
| boost.btcfi.one | "진행중인 거래가 없어요." 텍스트만, 일러스트/CTA 없음 |
| 공통 | 최소한의 텍스트만. 일러스트나 CTA 동반하지 않음 |

### 6-11. 숫자 표기 비교

| 항목 | biquid.io | boost.btcfi.one |
|------|----------|----------------|
| 천 단위 구분 | 쉼표 (1,234,567) | 쉼표 |
| 소수점 | 점 (0.1234) | 점 |
| 단위 위치 | 숫자 뒤 (0 BFC) | 숫자 뒤 |
| 교환 비율 소수점 | 4자리 | — |

---

## 7. 관찰된 패턴 및 디자이너 확인 요청

> **이 섹션의 목적**: 섹션 1~6의 실측 데이터에서 반복적으로 나타나는 패턴을 정리했습니다. 각 항목에 대해 **"맞다 / 아니다 / 부분적으로 맞다"**로 피드백해 주시면, AI 에이전트가 새 화면을 디자인할 때 적용할 원칙으로 확정합니다.

### 7-1. 공식 사이트 vs DApp 시각 언어 차이

**관찰된 사실**:

| 구분 | 공식 사이트 (bifrostnetwork.com) | DApp (biquid, boost) |
|------|-------------------------------|---------------------|
| border-radius | 4px 통일 | 16~48px (pill 포함) |
| 타이포 weight | 900 (Black) 위주 | 400~700 혼합 |
| 레이아웃 | 풀스크린 섹션, 정보 전달 중심 | 싱글 컬럼, 태스크 수행 중심 |

(근거: 섹션 6-2 border-radius 비교, 섹션 3-3/4-1 타이포)

→ **질문**: 이 차이가 의도된 것인지? 새 서비스 제작 시, 서비스 성격(공식 vs DApp)에 따라 어느 기조를 적용해야 하나요?
→ 답변: Storybook brand-point의 컬러 기준은 Pockie 서비스 컬러 기준으로 제작됨. 새로운 서비스의 Primary 컬러는 해당 브랜드의 기준 컬러에 결정되나, 기존 BTCFi 컬러가 블루였고, BTCFi Boost/Partners 등 서브 브랜드들이 생기면서 또 다른 브랜딩을 만드는 것이 아니라 파생되는 구조이기 때문에 BTCFi 서비스의 브랜드와 에셋을 그대로 사용하게됨.

### 7-2. 서비스별 브랜드 컬러

**관찰된 사실**:

| 서비스 | Primary |
|--------|---------|
| Storybook | #5F5BE2 (보라) |
| Bifrost Network | #FF474C (레드) |
| Biquid | #FF474C (레드) |
| BTCFi Boost | #3467F4 (블루) |

Storybook의 brand-point(#5F5BE2)는 어떤 프로덕션 사이트에서도 Primary로 사용되지 않음. (근거: 섹션 6-1)

→ **질문**: Storybook brand-point의 역할은? 새 서비스의 Primary 컬러를 결정하는 기준이 있나요?

### 7-3. Depth 표현 — 배경색 명도 vs box-shadow

**관찰된 사실**:
- biquid.io: 5단계 명도 레이어(#000 → #080808 → #1E1E1E → #303030 → #3D3D3D), shadow 완전 배제
- bifrostnetwork.com: rgba 투명도로 레이어링, shadow 최소
- boost.btcfi.one: 명도 차이 + 미세 shadow(rgba 0.06~0.2)
- Storybook Layout Demo: shadow-lg 사용

(근거: 섹션 6-3, 6-4)

→ **질문**: 다크 모드에서 shadow 배제, 라이트 모드에서 미세 shadow 허용이 원칙인지? 아니면 사이트별 독립 판단인지?
→ 답변:  	Light 모드 — Elevation Shadow 허용, 레이어감 표현 	Dark 모드 — Shadow 배제, 배경색 차이로 레이어 구분 	이유는 다크모드에서 Shadow가 시각적으로 효과가 거의 없어서 의미가 없고, 원칙이 없으면 컴포넌트마다 Shadow 쓸지 말지 매번 고민해야 함.

### 7-4. 타이포그래피 위계

**관찰된 사실**:
- bifrostnetwork.com 히어로: 64px / 900 (Black)
- 본문: 16px / 400~500
- DApp 탭: 활성 bold, 비활성 regular
- size 스케일(48→40→32→24→20→16→12)은 보수적, weight 범위(300~900)가 넓음

(근거: 섹션 2-2, 3-3)

→ **질문**: 정보 위계를 size보다 weight로 주로 표현하는 것이 의도된 패턴인지?
→ 답변:  size만으로 위계를 표현하는게 모바일 환경에서는 제약이 있어서 weight를 함께 섞어서 사용했음. Mobile → Tablet → Desktop으로 브레이크포인트 넘어갈 때 Weight가 바뀌면 어색해저서. Size만 유동적으로 커지는 게 자연스러움. 그래서 반응형 기준으로는: Weight → 고정 (Mobile/Web 동일), Size → 브레이크포인트마다 유동적으로 증가 하는게 좋아보임.


### 7-5. 다크 모드 배경 색온도

**관찰된 사실**:

| 서비스 | 다크 배경 | 색온도 |
|--------|----------|--------|
| bifrostnetwork.com | #1A1A1A | 순수 무채색 |
| biquid.io | #000000 | 순수 블랙 |
| boost.btcfi.one | #1C2130 | 네이비 틴트 |

(근거: 섹션 6-3)

→ **질문**: 서비스별 다크 배경 색온도를 결정하는 기준이 있나요?
→ 답변: 기준은 따로 없으나, Brand color와 어울리는 다크 배경(쿨톤/웜톤 비교 필요)이면 됨.

### 7-6. DApp 버튼 border-radius와 중요도

**관찰된 사실**:

| 곡률 | 용도 예시 |
|------|----------|
| pill (32~9999px) | 히어로 CTA, 메인 액션 |
| 16px | 헤더 지갑 연결 |
| 8~12px | 카드 내부 액션, 소형 버튼 |

bifrostnetwork.com에서는 모든 버튼이 4px 통일. (근거: 섹션 6-2)

→ **질문**: DApp에서 border-radius가 클수록 CTA 강도가 높다는 해석이 맞는지?
→ 답변: Bifrostnetwork.com에서는 모든 버튼이 4px로 통일 되어있음. 당시 프로젝트를 생성할때 다양한 베리어블 또는 컴포넌트를 제작할 리소스 부족으로 웬만한 모든 요소들을 통일하여 사용함. DApp또는 다른 프로젝트들 처럼 border-radius가 다양해지는 해석이 맞음. 

### 7-7. 히어로 3D/비디오 비주얼

**관찰된 사실**:
- bifrostnetwork.com: 메탈릭 3D 렌더링
- biquid.io: 라바 비디오 (autoplay, loop, muted)
- boost.btcfi.one: 3D 유리 버블 (라이트/다크 별도)
- 마퀴(무한 스크롤)도 3곳 모두 존재

(근거: 섹션 6-5, 3-6, 4-6, 5-7)

→ **질문**: 새 서비스에서도 히어로에 3D/비디오 비주얼 + 마퀴 배치를 유지해야 하나요?
→ 답변: 서비스의 특성/용도에 따르는게 맞음. 모든 프로젝트에 3D 비주얼이 들어갈 필요가 없음. UX와 정보의 전달이 중요. 마퀴의 여부는 항상 기획자의 결정에 따랐음. 

### 7-8. 여백과 정보 밀도

**관찰된 사실**:
- bifrostnetwork.com: 100vh 근접 섹션, 섹션 gap 80-160px
- biquid.io: 싱글 컬럼 max-width 672px, 섹션 gap 48-80px
- boost.btcfi.one: 대시보드이지만 카드 padding 12px, gap 12-16px

(근거: 섹션 6-9, 3-10, 4-10, 5-10)

→ **질문**: 데이터가 많은 대시보드(예: vault 목록 20+)에서도 넉넉한 여백을 유지하나요, 아니면 밀도를 높이는 예외가 있나요?
→ 답변:  	넉넉한 밀도를 유지하는게 좋음. 너무 많은 정보를 밀도있게 집어 넣으면 가독성과 정보 전달에 영향이 감. 다만 데이터 집약 UI에서는 여백을 줄이고 밀도를 높여야함. 실제로 이를 제대로 활용하기 위해서는 spacing density 베리어블을 따로 만들어서 2단계로 사용해야하나 (Compact UI에서는 Spacing Primitive에서 한 단계 아래 값 사용), 디자인 시스템이 제대로 갖춰지지 않았기에 다양한 gap/padding이 생기기 시작함.  

### 7-9. 유채색 사용 범위

**관찰된 사실**:
- 모든 사이트에서 무채색(흑/백/회색) 위주
- 유채색은 Primary 1가지 + Semantic(positive/negative)만 관찰됨
- 그라디언트, 멀티컬러 배경 미사용
- 유채색 사용 맥락: CTA, positive/negative 수치, 에러/경고

(근거: 섹션 3-2, 4-2/4-3, 5-3/5-4)

→ **질문**: 장식적 유채색을 3D 비주얼 영역 외에는 쓰지 않는 것이 원칙인지?
→ 답변: UI컴포넌트에는 유채색 장식을 사용하면 안됨(너무 많은 컬러는 정보전달에 매우 안좋음). 다만, 3D 비주얼, 히어로섹션에 들어가는 메인 그래픽, 마케팅 배너등에는 사용 가능함. 

### 7-10. 페이지 레이아웃 아키타입

실측에서 반복 관찰된 레이아웃 패턴을 유형화:

#### 아키타입 A: 랜딩 페이지 (bifrostnetwork.com /, biquid.io /, boost.btcfi.one /)
```
[반투명 Header + backdrop-blur]
[풀스크린 히어로: 3D/비디오 비주얼 + 대형 타이틀(900) + CTA pill 버튼]
[마퀴 또는 파트너 로고 스트립]
[100vh 섹션 반복: 좌우 2분할 또는 중앙 정렬]
[Footer: 멀티 컬럼 링크 + 소셜 아이콘]
```

#### 아키타입 B: 태스크 페이지 (biquid.io /staking, boost.btcfi.one /vaults)
```
[Header with 지갑 연결 버튼]
[싱글 컬럼 중앙 정렬, max-width 제한(672px 등)]
[메인 카드 1개: 큰 border-radius, padding 넉넉]
  ├─ 탭으로 모드 전환 (stake/unstake 등)
  ├─ Input 필드 + Max 버튼
  ├─ 요약 정보 (key-value 쌍)
  └─ Primary CTA (pill)
```

#### 아키타입 C: 대시보드 (boost.btcfi.one /dashboard)
```
[사이드바 네비게이션]
[메인 영역]
  ├─ 요약 카드 그리드 (KPI)
  ├─ 차트/비주얼 (도넛 등)
  └─ 테이블/리스트
```

#### 아키타입 D: 정보 페이지 (bifrostnetwork.com /about, /developer)
```
[Header]
[텍스트 중심 콘텐츠, 대형 섹션 gap (80-160px)]
[pill 링크 버튼 또는 외부 링크]
[Footer]
```

#### 아키타입 E: 유틸리티 페이지 (bifrostnetwork.com /bridge, /faucet)
```
[Header]
[싱글 컬럼 중앙 정렬, max-width 480px]
[폼 카드 1개: Input + Action 버튼]
[Footer]
```

→ **질문**: 이 분류가 맞는지? 이 외에 다른 아키타입(예: 설정, 거버넌스, 상세 페이지 등)이 있다면 추가해 주세요.
→ 답변: 이건 항상 기획의 여부에 따라 달라지기 때문에 어떤게 더 추가될지 디자이너도 알 수 없음. 다만 기존의 것에서 크게 달라지지는 않을 예정.

### 7-11. DApp 카드 내부 구성

**관찰된 사실**:
```
Card (bg Level 2, border-radius 24px)
├─ Tab 그룹 (모드 전환)
├─ Sub-card / Input 영역 (bg Level 3, border-radius 16px)
│   ├─ 토큰 셀렉터
│   ├─ Input + Max 버튼
│   └─ 잔액 표시
├─ 정보 행 (key: value, 구분선 border)
└─ CTA 버튼 (full-width, pill)
```

- 카드 내부 depth는 bg 색상 한 단계 올려서 표현 (Level 2 → Level 3)
- 태스크 페이지에서 메인 카드는 보통 1개

(근거: 섹션 4-5, 4-2)

→ **질문**: 카드가 독립적인 "태스크 단위"로 설계된 것이 맞는지? 한 화면에 메인 카드 2개 이상이 필요한 경우가 있는지?
→ 답변: 독립접인 태스크 단위 설계가 맞음. 일반적인 메인 플로우를 진행하는 화면에서 메인액션을 진행하는 카드는 2개 이상 나오는 경우는 없음. 다만 Dashboard에서 Infographic 요소들을 bento ui로 보여줄 수 는 있음.


### 7-12. 유채색과 상태 표시

**관찰된 사실**:

| 유채색 사용 맥락 | 색상 |
|----------------|------|
| CTA 버튼 | Primary (서비스별) |
| Positive 수치 | 녹색 계열 |
| Negative 수치 | 빨강 계열 |
| 경고/에러 | semantic color |
| 일반 텍스트, 레이블 | 무채색(#FFF, #888, #4A4A4A) |
| 비활성 요소 | 극저채도 무채색 |

(근거: 섹션 4-3, 5-3/5-4, 2-1)

→ **질문**: 유채색은 행동 유도나 상태 표시에만 사용한다는 해석이 맞는지?
→ 답변: 맞음.

### 7-13. Header 처리

**관찰된 사실**:
- bifrostnetwork.com: fixed, rgba(26,26,26, 0.92) + backdrop-blur 2px, 80px/56px
- biquid.io: sticky, #080808 (bg #000000 대비 미세 차이), 81px
- boost.btcfi.one: 사이드바 방식 (좌측 320px)
- Storybook Layout: bg white/80 + backdrop-blur-sm
- 강한 border-bottom이나 shadow 미사용

(근거: 섹션 3-7, 4-7, 5-8)

→ **질문**: Header가 콘텐츠와 시각적으로 분리되지 않게 처리하는 것이 의도인지?
→ 답변: 맞음.

### 7-14. DApp Input 필드 구성

**관찰된 사실**:
```
[Input 영역 (bg Level 3)]
├─ 좌: 토큰 아이콘 + 이름
├─ 중: 숫자 입력
├─ 우: Max 버튼
└─ 하단: 잔액 표시 (보조 텍스트)
```

- 토큰 셀렉터는 고정 라벨 (드롭다운 아님)
- 잔액, 단위, 최대값을 Input 바로 옆/아래에 배치

(근거: 섹션 4-5, 4-13)

→ **질문**: 이 구성이 모든 DApp Input에 적용되는 표준인지?
→ 답변: 표준이 아님. 기존 DApp에 이용된 인풋은 용도에 따라 다르게 만들어짐.
	1. 토큰 선택+수량입력+max버튼+잔액표시 (Send Token, Receive Token, Swap Token 등 수량을 입력할때 사용).
	2. 일반 적인 input (이름 입력, 기능 검색 등).


### 7-15. 네비게이션 depth

**관찰된 사실**:
- biquid.io: Header 탭으로 모든 기능 접근 (staking, wrapping, dashboard, unstaking)
- boost.btcfi.one: 사이드바에 전체 메뉴 노출 (dashboard, vaults)
- bifrostnetwork.com: 상단 nav에 모든 주요 페이지
- 데스크톱에서 드롭다운/다단계 계층 구조 미관찰
- 모바일: 햄버거(bifrost 전체화면 아코디언, biquid 풀스크린 오버레이) 또는 하단 nav(boost)

(근거: 섹션 6-8)

→ **질문**: 기능이 많아질 경우(10+ 메뉴)에는 어떤 전략을 취하나요?
→ 답변:  	모바일:  		햄버거 메뉴로 숨기기, 탭바는 5개 이하로 제한, 나머지는 더보기로 묶어서 depth를 추가. 	웹:  		LNB:그룹핑 (카테고리로 묶어서 접기/펼치기). 		Header: 2depth 네비게이션 메인 카테고리 + 서브 메뉴. 		메뉴 수가 20~30개 이상이면 검색으로 대체 (메뉴가 너무 많으면 검색이 더 효율적).

### 7-16. 텍스트 컬러 3단계

**관찰된 사실**:

| 단계 | 다크 모드 | 라이트 모드 (boost) | 역할 |
|------|----------|-------------------|------|
| Primary | #FFFFFF | #292929 | 핵심 정보, 제목, 수치 |
| Secondary | #888888 | #7986AA | 레이블, 설명, 보조 정보 |
| Tertiary / Disabled | #4A4A4A | (미확인) | 비활성, 힌트, placeholder |

다크 모드 기준 primary-secondary 명도비 약 2:1 (#FFF 100% vs #888 53%)

(근거: 섹션 4-3, 5-3/5-4)

→ **질문**: 텍스트 컬러가 3단계로 충분한지, 추가 단계가 있는지?
→ 답변:  	Primary → 제목, 본문 	Secondary → 보조, 설명
	Tertiary →  힌트, 비활성 (읽을 수 있지만 중요도 낮음) 	Disabled →  비활성화 (아예 비활성화된 UI 요소)
	Brand → 강조
	Danger → 에러
	Success → 성공
	Warning → 경고

### 7-17. border 사용

**관찰된 사실**:
- 대부분 1px solid, 배경보다 약간 밝은 무채색 (#4A4A4A, #3D3D3D, #888)
- 컬러 border는 Input focus 상태(brand 계열)에서만 관찰
- hover에서 border 색상 → brand 전환이 인터랙션 피드백
- 굵은 border(2px+)나 장식적 border 미관찰

(근거: 섹션 4-2, 2-4)

→ **질문**: 이 border 사용 패턴이 맞는지?
→ 답변: 현재 디자인 시스템상 그렇게 되어있음.

### 7-18. 라이트/다크 전환 — 불변 vs 가변 토큰

**관찰된 사실** (boost.btcfi.one):

| 불변 (테마 전환 시 유지) | 가변 (테마 전환 시 변경) |
|-----------------|----------------|
| Primary #3467F4 | 배경색 (라벤더 ↔ 네이비) |
| 보조 텍스트 #7986AA | 카드 배경 (흰 ↔ 짙은 네이비) |
| Positive 컬러 | 주요 텍스트 (검정 ↔ 흰) |
| border-radius | border 색상 |
| 컴포넌트 구조 | shadow 강도 |

(근거: 섹션 5-2, 5-11)

→ **질문**: 이 불변/가변 구분이 의도된 것인지? 다른 서비스에서 라이트/다크를 추가할 때도 이 원칙을 따르나요?
→ 답변: 그렇게 되어 있으나, 더 나은 방향이 있으면 변경해도 좋음. 다만 배경의 명도와 대비, 가독성, 라이트/다크 모드에서 shadow가 시각적으로 구분 되어야 하고 자연스러워야함.


### 7-19. Hover 인터랙션 — 사이트별 피드백 강도 차이

**관찰된 사실**:
- bifrostnetwork.com: 강한 피드백 — scale(1.05), saturate 증가, pill 변형+화살표 출현, 로고 opacity 변경
- biquid.io: 중간 피드백 — 텍스트 색상 전환 (text-point #FF474C 또는 text-white-100)
- boost.btcfi.one: 약한 피드백 — 눈에 띄는 hover 변화 미미

(근거: 섹션 3-8, 4-8)

→ **질문**: 사이트 성격에 따라 hover 강도를 다르게 한 것인지? 새 서비스의 기본 hover 수준은?
→ 답변:  	브랜드 컬러의 성격과 배경색 대비 강도를 다르게 한것임. 기존은 컬러로만 표현했지만. 이것도 정형화 되면 좋을 듯 함. 	GrayAlpha.50 4% → 중립 요소 	BrandAlpha.50 4% → 브랜드 요소

### 7-20. 모션/애니메이션 패턴

**관찰된 사실**:
- Framer Motion: translateY 8/16px + opacity fade-in, 뷰포트 진입 시 트리거 (biquid.io)
- 마퀴: 300s slide 무한 반복 (bifrostnetwork.com), 160px 텍스트 (biquid.io)
- 카운트업: 0 → 목표값 숫자 증가 (biquid.io 히어로)
- Storybook 컴포넌트: 150-200ms transition
- 테마 전환: duration 0s 즉시 (boost.btcfi.one)
- 페이지 전환: 트랜지션 없음(컷)

(근거: 섹션 6-7, 4-8, 2-28)

→ **질문**: 등장 애니메이션(translateY + opacity)은 모든 새 서비스에 적용해야 하는 공통 패턴인지?
→ 답변: 모든 서비스에 적용되어야 하는 공통 패턴은 아님. 다만 화면이 refresh되었을때 자연스럽게 하기 위해 사용했던거 같음.

### 7-21. 모바일 처리

**관찰된 사실**:
- boost.btcfi.one: 사이드바 → 하단 고정 nav, 카드 그리드 3열 → 1열
- biquid.io: 이미 싱글 컬럼(672px)이므로 모바일 변화 적음, 마퀴 hidden
- bifrostnetwork.com: 타이포 64→24px 축소, 4열→2열→1열, 햄버거 메뉴
- 모바일에서 기능 제거(숨김)는 관찰되지 않음 (밀도 조정만)

(근거: 섹션 3-11, 4-9, 5-9, 6-6)

→ **질문**: 모바일에서 기능을 숨기는 경우가 있는지? 항상 모든 기능을 노출하는 원칙인지?
→ 답변: 항상 노출하는걸 원칙으로함.

### 7-22. 카피/언어

**관찰된 사실**:
- DApp (biquid.io, boost.btcfi.one): 한국어 UI
- 공식 사이트 (bifrostnetwork.com): 영어 UI
- Storybook: 영어

→ **질문**: 다국어 지원 계획이 있는지? 새 DApp은 기본 한국어인지?
→ 답변: 서비스 기획자의 요구사항에 따라 다름. 


### 7-23. FAQ 아코디언

**관찰된 사실**:
- biquid.io /unstaking, /dashboard: 하단에 FAQ 아코디언 배치
- DApp 태스크 페이지에 공통으로 존재

→ **질문**: 모든 태스크 페이지에 FAQ를 필수 배치하는 규칙인지?
→ 답변: 아님.


### 7-24. 테이블/리스트

**관찰된 사실**:
- biquid.io: flex 기반 행, 5열, border-bottom 구분, 헤더 12px grey
- boost.btcfi.one: Vault 카드형 행(16px radius, 12px padding), 헤더 행 없음, UL flex-column gap 16px
- 배경 교대(stripe) 미사용

(근거: 섹션 4-12, 5-6)

→ **질문**: 데이터가 많은 테이블(20+ 행)에서도 이 방식을 유지하는지?
→ 답변: 같은 방식을 유지할 필요 없음, 더 정형화 되어있는 방식이 있다면 그걸 더 선호.


### 7-25. 빈 상태/비활성 패턴

**관찰된 사실**:
- biquid.io: 수치 0 표시, 버튼 disabled(bg #303030, color #888, cursor not-allowed), 테이블 빈 영역 + 안내 텍스트
- boost.btcfi.one: "진행중인 거래가 없어요." 텍스트만, 일러스트/CTA 없음
- 도넛 차트 빈 상태: fill #F1F3F9

(근거: 섹션 4-13, 5-12, 6-10)

→ **질문**: 빈 상태에 일러스트나 CTA를 추가하지 않는 것이 의도인지?
→ 답변: 리소스 부재 및 기획자의 의도.


### 7-26. 미확인 정보 — 디자이너 확인 필요

실측 데이터에서 확인할 수 없었지만, AI 에이전트가 디자인 결정을 내리려면 필요한 항목들:

**구조/레이아웃**:
1. ~~**Spacing Scale**~~ → **확인됨**: bifrost 40px 배수, biquid Tailwind 기본(4px), boost 4px 단위. 섹션 3-10, 4-10, 5-10 참조
2. ~~**반응형 브레이크포인트**~~ → **확인됨**: 사이트별 커스텀 BP. 섹션 1-3, 6-6 참조
3. ~~**모바일 레이아웃 전략**~~ → **확인됨**: 섹션 3-11, 4-9, 5-9 참조
4. **그리드 시스템**: 12컬럼? 자유 배치? max-width 외 규칙이 있는지? 따로 없음. 4배수 디자인 규칙만 지키면됨

**모션/인터랙션**:
5. ~~**트랜지션 기본값**~~ → **확인됨**: 150ms 또는 200ms, 섹션 2-28 참조
6. ~~**호버 상태**~~ → **확인됨**: 섹션 3-8 참조
7. ~~**페이지 전환**~~ → **확인됨**: 트랜지션 없음(컷)
8. ~~**로딩 상태**~~ → **확인됨**: Skeleton + Spinner, 섹션 2-14, 2-15 참조

**컴포넌트**:
9. ~~**아이콘 세트**~~ → **확인됨**: 커스텀 SVG 100+개, 섹션 2-24 참조
10. ~~**아이콘 기본 크기**~~ → **확인됨**: 기본 24px
11. **모달/다이얼로그 스타일**: Storybook에 미존재. overlay 색상, 모달 border-radius, 닫기 패턴?
12. ~~**테이블/리스트 패턴**~~ → **부분 확인**: 섹션 7-24 참조. 대량 데이터 시 가이드 필요
13. ~~**Tooltip**~~ → **확인됨**: 섹션 2-12 참조
14. ~~**폼 유효성 검사**~~ → **확인됨**: text-red-500, 12px, mt-1 ml-7

**콘텐츠 전략**:
15. ~~**카피 톤**~~ → **부분 확인**: DApp 한국어, 공식 영어. 혼용 규칙 미확인
16. ~~**숫자 표기**~~ → **확인됨**: 섹션 4-11, 6-11 참조
17. ~~**빈 상태**~~ → **확인됨**: 섹션 4-13, 5-12 참조

---

## 8. 주요 발견 사항

### 8-1. 사이트 간 불일치 사항

아래는 Storybook 기준값과 프로덕션 사이트 실측값 사이에서 발견된 차이입니다.

| 항목 | Storybook 기준 | 프로덕션 실측 | 사이트 | 비고 |
|------|---------------|-------------|--------|------|
| Primary Color | #5F5BE2 (보라) | #FF474C (레드) | bifrostnetwork.com | 완전 상이 |
| Primary Color | #5F5BE2 (보라) | #FF474C (레드) | biquid.io | 완전 상이 |
| Primary Color | #5F5BE2 (보라) | #3467F4 (블루) | boost.btcfi.one | 완전 상이 |
| Positive Color | #0C9D61 | #00FF66 (네온 그린) | biquid.io | 계열 상이 |
| border-radius 기조 | 8~16px | 4px 통일 | bifrostnetwork.com | DApp 사이트와 상이 |
| Dark BG 기조 | — | #000000 (순수 블랙) | biquid.io | boost와 상이 |
| Dark BG 기조 | — | #1C2130 (네이비) | boost.btcfi.one | biquid와 상이 |
| font-weight 600 | 토큰 없음 | 네비게이션 등에서 관찰 | 복수 사이트 | 토큰 체계에 미포함 |
| 기술 스택 | — | biquid.io "React SPA" 실제는 Next.js | biquid.io | 문서 수정 완료 |

> 위 테이블은 DevTools 실측 기준이며, Figma 스펙과의 차이 여부는 디자이너님의 판단 영역입니다.

### 8-2. 디자이너 확인 필요 항목 (질문 종합)

섹션 7에서 개별 패턴별로 질문을 달았으나, 핵심 질문을 여기 모아둡니다:

1. **Storybook brand-point(#5F5BE2)의 역할** — 프로덕션에서 사용되지 않는 이유? (7-2)
2. **공식 사이트 vs DApp 시각 톤 분리 기준** — 새 서비스는 어느 쪽? (7-1)
3. **Biquid Positive 컬러 차이** — Storybook #0C9D61 vs biquid #00FF66, 의도적 변형인지? (8-1)
4. **서비스별 브랜드 컬러 공식 매핑** — 실측값이 맞는지 대조 필요 (7-2)
5. **다크 배경 색온도 결정 기준** — 무채색 vs 네이비 틴트 (7-5)
6. **모바일 네비게이션 패턴 선택 기준** — 햄버거 vs 하단 nav (7-15)
7. **등장 애니메이션 적용 범위** — biquid만인지 공통인지 (7-20)
8. **테마 전환 duration 0s** — 의도적인지? (5-11)
9. **DApp 한국어 / 공식 영어** — 다국어 계획? (7-22)
10. **모달/다이얼로그 디자인** — Storybook 미존재, 가이드 필요 (7-26)
11. **그리드 시스템** — 12컬럼? 자유 배치? (7-26)
12. **대량 데이터 테이블** — 20+ 행 시 디자인 가이드 (7-24)

### 8-3. 추가 확인 요청

- 이 문서에서 누락된 디자인 토큰, 컴포넌트, 또는 디자인 원칙이 있다면 알려주세요. 
→ 답변: 4배수 디자인을 원칙으로 함.

- 실측 값과 디자인 스펙 사이에 불일치가 발견되는 항목이 있다면 표시해주세요.

### 8-4. 후속 제안

이 문서를 사전 공유드리며, 30분 내외의 싱크 미팅에서 8-1의 불일치 항목과 8-2의 질문 목록을 함께 검토하면 효율적일 것 같습니다. 검토 결과를 반영하여 AI 코딩 에이전트용 디자인 가이드 문서를 별도 제작할 예정입니다.
