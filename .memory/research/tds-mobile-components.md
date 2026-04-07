# TDS Mobile Component Specs

수집일: 2026-04-07
출처: https://tossmini-docs.toss.im/tds-mobile/
패키지: `@toss/tds-mobile`, `@toss/tds-colors`

---

## Foundation

### Colors

패키지: `@toss/tds-colors`
Import: `import { colors } from '@toss/tds-colors'`

#### Grey Scale (10 shades)
| Token | Hex |
|-------|-----|
| grey50 | #f9fafb |
| grey100 | #f2f4f6 |
| grey200 | #e5e8eb |
| grey300 | #d1d6db |
| grey400 | #b0b8c1 |
| grey500 | #8b95a1 |
| grey600 | #6b7684 |
| grey700 | #4e5968 |
| grey800 | #333d4b |
| grey900 | #191f28 |

#### Blue (10 shades)
| Token | Hex |
|-------|-----|
| blue50 | #e8f3ff |
| blue100 | #c9e2ff |
| blue200 | #90c2ff |
| blue300 | #64a8ff |
| blue400 | #4593fc |
| blue500 | #3182f6 |
| blue600 | #2272eb |
| blue700 | #1b64da |
| blue800 | #1957c2 |
| blue900 | #194aa6 |

#### Red (10 shades)
| Token | Hex |
|-------|-----|
| red50 | #ffeeee |
| red100 | #ffd4d6 |
| red200 | #feafb4 |
| red300 | #fb8890 |
| red400 | #f66570 |
| red500 | #f04452 |
| red600 | #e42939 |
| red700 | #d22030 |
| red800 | #bc1b2a |
| red900 | #a51926 |

#### Orange (10 shades)
| Token | Hex |
|-------|-----|
| orange50 | #fff3e0 |
| orange100 | #ffe0b0 |
| orange200 | #ffcd80 |
| orange300 | #ffbd51 |
| orange400 | #ffa927 |
| orange500 | #fe9800 |
| orange600 | #fb8800 |
| orange700 | #f57800 |
| orange800 | #ed6700 |
| orange900 | #e45600 |

#### Yellow (10 shades)
| Token | Hex |
|-------|-----|
| yellow50 | #fff9e7 |
| yellow100 | #ffefbf |
| yellow200 | #ffe69b |
| yellow300 | #ffdd78 |
| yellow400 | #ffd158 |
| yellow500 | #ffc342 |
| yellow600 | #ffb331 |
| yellow700 | #faa131 |
| yellow800 | #ee8f11 |
| yellow900 | #dd7d02 |

#### Green (10 shades)
| Token | Hex |
|-------|-----|
| green50 | #f0faf6 |
| green100 | #aeefd5 |
| green200 | #76e4b8 |
| green300 | #3fd599 |
| green400 | #15c47e |
| green500 | #03b26c |
| green600 | #02a262 |
| green700 | #029359 |
| green800 | #028450 |
| green900 | #027648 |

#### Teal (10 shades)
| Token | Hex |
|-------|-----|
| teal50 | #edf8f8 |
| teal100 | #bce9e9 |
| teal200 | #89d8d8 |
| teal300 | #58c7c7 |
| teal400 | #30b6b6 |
| teal500 | #18a5a5 |
| teal600 | #109595 |
| teal700 | #0c8585 |
| teal800 | #097575 |
| teal900 | #076565 |

#### Purple (10 shades)
| Token | Hex |
|-------|-----|
| purple50 | #f9f0fc |
| purple100 | #edccf8 |
| purple200 | #da9bef |
| purple300 | #c770e4 |
| purple400 | #b44bd7 |
| purple500 | #a234c7 |
| purple600 | #9128b4 |
| purple700 | #8222a2 |
| purple800 | #73228e |
| purple900 | #65237b |

#### Grey Opacity (10 levels)
greyOpacity50 ~ greyOpacity900 (투명도 0.02~0.91)

#### Semantic/Background Colors
| Token | Value |
|-------|-------|
| background | #FFFFFF |
| greyBackground | grey100 |
| layeredBackground | #FFFFFF |
| floatedBackground | #FFFFFF |

---

### Typography

42개 폰트 스케일 (f11~f42) + 시맨틱 토큰 (t1~t7, st1~st13)

#### Primary Semantic Tokens (t1~t7)
| Token | Font Size | Line Height | 용도 |
|-------|-----------|-------------|------|
| t1 | 30px | 40px | 매우 큰 제목 |
| t2 | 26px | 35px | 큰 제목 |
| t3 | 22px | 31px | 일반 제목 |
| t4 | 20px | 29px | 작은 제목 |
| t5 | 17px | 25.5px | heading scale |
| t6 | 15px | 22.5px | heading scale |
| t7 | 13px | 19.5px | 안 읽어도 됨 (부가 정보) |

#### Subtitle Scales (st1~st13)
29px(st1) ~ 11px(st13) 범위의 세밀한 타이포그래피 계층

#### Font Weights
- regular (400), medium, semibold, bold

#### Border Radius (타이포그래피 연동)
4px ~ 10px (스케일에 비례)

#### Link Thickness
0.7px(light) ~ 2.5px(bold) (크기에 따라 증가)

#### 접근성: Larger Text 지원

iOS Scaling Ratios:
- 100% (Large) = baseline
- 110% (xLarge), 120% (xxLarge), 135% (xxxLarge)
- A11y_Medium (160%), A11y_Large (190%), A11y_xLarge (235%), A11y_xxLarge (275%), A11y_xxxLarge (310%)

Android Formula:
`base × NN% × coefficient` (coefficient: 0.0131~0.0142)

---

## Components

### Badge

목적: 항목 상태를 빠르게 인식할 수 있도록 강조

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| variant | `"fill"` \| `"weak"` | Yes | 색상 및 투명도 |
| size | `"xsmall"` \| `"small"` \| `"medium"` \| `"large"` | Yes | 컴포넌트 크기 |
| color | `"blue"` \| `"teal"` \| `"green"` \| `"red"` \| `"yellow"` \| `"elephant"` | Yes | 컬러 |

- fill: 고채도, 주요 항목 강조
- weak: 저채도, 덜 눈에 띄는 디자인

---

### BoardRow

목적: 아코디언 스타일 컨테이너 (Q&A 섹션 등)

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| title | ReactNode | Yes | — | 헤더 텍스트 |
| initialOpened | boolean | No | false | 초기 펼침 상태 |
| isOpened | boolean | No | false | 외부 제어 상태 |
| onOpen | () => void | No | — | 펼침 콜백 |
| onClose | () => void | No | — | 닫힘 콜백 |
| prefix | ReactNode | No | — | 제목 앞 요소 (BoardRow.Prefix) |
| icon | ReactNode | No | — | 제목 뒤 아이콘 (BoardRow.ArrowIcon) |
| children | ReactNode | No | — | 콘텐츠 영역 |

Sub-components:
- BoardRow.Text (typography: default "t6")
- BoardRow.Prefix (typography: default "st8", fontWeight, color)
- BoardRow.ArrowIcon (name, color, size: 24)

접근성: button 시맨틱 태그, aria-expanded 자동 관리

---

### Border

목적: UI 요소 간 시각적 구분선

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | `"full"` \| `"padding24"` \| `"height16"` | "full" | 테두리 스타일 |
| height | string | — | height16 variant용 높이 커스텀 |

- full: 전체 너비 라인
- padding24: 양쪽 24px 마진 라인
- height16: 섹션 구분용 스페이서

---

### BottomInfo

목적: 화면 하단 중요 정보/면책 조항 표시

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| bottomGradient | `"none"` \| `"linear-gradient(...)"` | linear-gradient(adaptive.greyBackground, rgba(255,255,255,0)) | 하단 그라데이션 배경 |

---

### BottomSheet

목적: 화면 하단에서 올라오는 패널

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| open | boolean | — | 표시 여부 (필수) |
| header | ReactNode | — | 제목 (BottomSheet.Header) |
| headerDescription | ReactNode | — | 부제 |
| cta | ReactNode | — | CTA 영역 |
| children | ReactNode | — | 메인 콘텐츠 |
| disableDimmer | boolean | false | 딤머 숨김 |
| hasTextField | boolean | false | 키보드 위 배치 |
| expandBottomSheet | boolean | false | 전체화면 확장 |
| maxHeight | number | — | 비확장 높이(px) |
| expandedMaxHeight | number | — | 확장 높이(px) |
| onClose | function | — | 닫기 콜백 |

Sub-components:
- BottomSheet.Header (children, className)
- BottomSheet.HeaderDescription (children, className)
- BottomSheet.CTA / BottomSheet.DoubleCTA
- BottomSheet.Select (options, onChange, value, animation)

---

### Bubble

목적: 대화형 UI 메시지 버블

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| background | `"blue"` \| `"grey"` | Yes | — | blue=내 메시지, grey=상대 메시지 |
| withTail | boolean | No | true | 꼬리 표시 여부 |
| children | ReactNode | No | — | 버블 내용 |

---

### Button

목적: 사용자 액션 트리거

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| as | `"button"` \| `"a"` | "button" | HTML 태그 |
| color | `"primary"` \| `"danger"` \| `"light"` \| `"dark"` | "primary" | 색상 |
| variant | `"fill"` \| `"weak"` | "fill" | 채도 |
| display | `"inline"` \| `"block"` \| `"full"` | "inline" | 레이아웃 |
| size | `"small"` \| `"medium"` \| `"large"` \| `"xlarge"` | "xlarge" | 크기 |
| loading | boolean | — | 로딩 스피너 |
| disabled | boolean | — | 비활성화 |

CSS Variables: --button-color, --button-background-color, --button-disabled-opacity-color, --button-gradient-color, --button-loader-color 등

---

### Checkbox

목적: 선택/해제 입력

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| inputType | `"checkbox"` \| `"radio"` | "checkbox" | 입력 타입 |
| size | number | 24 | 크기(px) |
| checked | boolean | — | 선택 상태 (제어) |
| onCheckedChange | (checked: boolean) => void | — | 변경 콜백 |
| defaultChecked | boolean | — | 초기 상태 (비제어) |
| disabled | boolean | — | 비활성화 |

Variants: Checkbox.Circle (원형), Checkbox.Line (라인)
접근성: role="checkbox", aria-checked, aria-disabled, aria-label 필수

---

### GridList

목적: 그리드 레이아웃으로 항목 표시

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| column | 1 \| 2 \| 3 | 3 | 열 수 |
| children | ReactNode | — | GridList.Item 컴포넌트 |

GridList.Item Props:
- image (ReactNode, 필수): 이미지 요소
- children (ReactNode): 이미지 아래 텍스트

디자인: 8px gap, 24px 수평 패딩, 9px border-radius, 72px min-height

---

### Highlight

목적: 특정 화면 영역을 어둡게 처리하여 강조

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| open | boolean | — | 하이라이트 표시 (필수) |
| padding | number | 0 | 내부 패딩(px) |
| delay | number | 0 | 표시 지연(초) |
| message | string \| function | — | 설명 메시지 |
| messageColor | string | colors.white | 메시지 색상 |
| messageXAlignment | `"left"` \| `"center"` \| `"right"` | auto | 수평 정렬 |
| messageYAlignment | `"top"` \| `"bottom"` | auto | 수직 정렬 |
| onClick | () => void | — | 외부 클릭 콜백 |

---

### IconButton

목적: 아이콘 기반 컴팩트 버튼

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| aria-label | string | — | Yes | 접근성 라벨 (필수) |
| variant | `"fill"` \| `"clear"` \| `"border"` | "clear" | No | 시각적 스타일 |
| src | string | — | No | 아이콘 URL (name과 배타적) |
| name | string | — | No | 아이콘 식별자 (src와 배타적) |
| color | string | — | No | 아이콘 색상 (-mono 접미사만) |
| bgColor | string | adaptive.greyOpacity100 | No | 배경색 |
| iconSize | number | 24 | No | 아이콘 크기(px) |

---

### ListFooter

목적: 리스트 끝 "더 보기" 기능

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| border | `"full"` \| `"indented"` \| `"none"` | "full" | 상단 구분선 |
| icon | string \| ReactElement | — | 아이콘 |
| textColor | string | adaptive.blue500 | 텍스트 색상 |
| iconColor | string | adaptive.blue500 | 아이콘 색상 |
| children | string \| ReactElement | — | 푸터 텍스트 |
| shadow | ReactElement | — | 그림자 효과 |

---

### ListHeader

목적: 페이지/섹션 상단 헤더

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| title | ReactNode | — | 제목 (필수) |
| titleWidthRatio | number | 0.66 | 제목-우측 너비 비율 |
| description | ReactNode | — | 설명 |
| descriptionPosition | `"top"` \| `"bottom"` | "top" | 설명 위치 |
| right | ReactNode | — | 우측 요소 |
| rightAlignment | `"bottom"` \| `"center"` | "center" | 우측 정렬 |

Sub-components:
- ListHeader.TitleParagraph (typography: t7/t5/t4, fontWeight, color)
- ListHeader.TitleTextButton (size: xsmall/medium/large, variant)
- ListHeader.TitleSelector (typography)
- ListHeader.RightText (typography: t7/t6, color)
- ListHeader.RightArrow (typography, color, textColor, onClick)
- ListHeader.DescriptionParagraph

---

### Loader

목적: 로딩 상태 표시

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| size | `"small"` \| `"medium"` \| `"large"` | "medium" | 크기 |
| type | `"primary"` \| `"dark"` \| `"light"` | "primary" | 색상 스킴 |
| label | string | — | 하단 텍스트 |

디자인: 1.8초 회전 주기, 0.7초 페이드인 지연

---

### Menu

목적: 드롭다운 메뉴

Sub-components:
- Menu.Trigger (open, defaultOpen, dropdown, placement, onOpen, onClose)
- Menu.Dropdown (header)
- Menu.DropdownItem (left, right, children)
- Menu.DropdownCheckItem (checked, onCheckedChange)
- Menu.DropdownIcon

placement: top/bottom/left/right + -start/-end (12가지)

---

### Modal

목적: 모달 인터페이스

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| open | boolean | false | 열림 상태 |
| onOpenChange | (open: boolean) => void | — | 상태 변경 콜백 |
| onExited | () => void | — | 닫기 애니메이션 완료 콜백 |
| portalContainer | HTMLElement | document.body | 렌더 대상 |

Sub-components: Modal.Overlay (onClick), Modal.Content
접근성: aria-hidden, tabIndex={0}, role="button"

---

### NumericSpinner

목적: 증감 버튼으로 정수 입력

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| size | `"tiny"` \| `"small"` \| `"medium"` \| `"large"` | — | 크기 (필수) |
| number | number | 0 | 현재 값 |
| defaultNumber | number | — | 초기 값 (비제어) |
| minNumber | number | 0 | 최소값 |
| maxNumber | number | 999 | 최대값 |
| disable | boolean | false | 비활성화 |
| onNumberChange | (number: number) => void | — | 변경 콜백 |

접근성: aria-live="polite", 커스텀 aria-label 지원

---

### Paragraph

목적: 유연한 텍스트 표시 (텍스트, 아이콘, 배지, 링크 합성)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| typography | t1~t7, st1~st13 | — | 텍스트 크기 (필수) |
| display | `"block"` \| `"inline"` | "block" | 디스플레이 |
| ellipsisAfterLines | number | — | 라인 클램핑 |
| fontWeight | `"regular"` \| `"medium"` \| `"semibold"` \| `"bold"` | "regular" | 굵기 |
| color | string | — | 텍스트 색상 |

Sub-components:
- Paragraph.Text (typography, fontWeight, color)
- Paragraph.Badge (style: fill/weak, type: blue/teal/green/red/yellow/elephant)
- Paragraph.Link (type: underline/clear, color: default blue500)
- Paragraph.Icon (typography → icon height 제어)

---

### Post

목적: 장문 텍스트 포스트 스타일링

Sub-components:
- Post.H1 (typography: default "t2", paddingBottom)
- Post.H2 (typography: default "t3")
- Post.H3 (typography: default "st8")
- Post.H4 (typography: default "t5")
- Post.Paragraph (typography, paddingBottom)
- Post.Ol / Post.Ul / Post.Li
- Post.Hr (paddingBottom)

---

### ProgressBar

목적: 진행률 시각화

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| progress | number | — | 0.0~1.0 완료율 (필수) |
| size | `"light"` \| `"normal"` \| `"bold"` | "normal" | 바 두께 (필수) |
| color | string | colors.blue400 | 채움 색상 |
| animate | boolean | false | 애니메이션 |

---

### ProgressStepper

목적: 단계별 진행 표시

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | `"compact"` \| `"icon"` | — | 스타일 (필수) |
| paddingTop | `"default"` \| `"wide"` | "default" | 상단 여백 |
| activeStepIndex | number | 0 | 현재 활성 단계 |
| checkForFinish | boolean | false | 완료 체크마크 |

ProgressStep Props: title (string), icon (ReactNode)

---

### Rating

목적: 별점 평가

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| readOnly | boolean | Yes | 읽기 전용 여부 |
| value | number | Yes | 현재 점수 |
| size | `"tiny"` \| `"small"` \| `"medium"` \| `"large"` \| `"big"` | Yes | 크기 |
| variant | `"full"` \| `"compact"` \| `"iconOnly"` | Yes | 표시 스타일 (읽기 전용만) |
| max | number | No | 최대 점수 (default: 5) |
| onValueChange | (value: number) => void | No | 변경 콜백 |
| disabled | boolean | No | 비활성화 |

대화형: medium/large/big만 지원
읽기 전용: 전체 크기 + full/compact/iconOnly variant 지원

---

### Result

목적: 성공/실패/상태 확인 화면

| Prop | Type | Description |
|------|------|-------------|
| figure | ReactNode | 상단 시각 요소 (아이콘/이미지) |
| title | ReactNode | 결과 제목 |
| description | ReactNode | 설명 텍스트 |
| button | ReactNode | 액션 버튼 (Result.Button) |

레이아웃: 수직 중앙 정렬, 32px 상단 패딩, 40px 좌우 패딩

---

### SearchField

목적: 검색 입력 필드

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| fixed | boolean | false | 상단 고정 |
| takeSpace | boolean | true | 고정 시 레이아웃 공간 확보 |
| onDeleteClick | () => void | — | 삭제 아이콘 클릭 콜백 |
| placeholder | string | — | 플레이스홀더 |

디자인: 44px 높이, 12px border-radius, adaptive grey 색상

---

### SegmentedControl

목적: 세그먼트 선택 컨트롤

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| children | ReactNode | — | SegmentedControl.Item (필수) |
| size | `"small"` \| `"large"` | "small" | 크기 |
| alignment | `"fixed"` \| `"fluid"` | "fixed" | 레이아웃 |
| value | string | — | 선택값 (제어) |
| defaultValue | string | — | 초기값 (비제어) |
| onChange | (v: string) => void | — | 변경 콜백 |

접근성: role="radiogroup", role="radio", aria-checked

---

### Skeleton

목적: 로딩 중 콘텐츠 구조 표시

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| height | string \| number | auto | 전체 높이 |
| pattern | string | "topList" | 레이아웃 패턴 |
| custom | array | — | 커스텀 레이아웃 |
| repeatLastItemCount | number \| "infinite" | 3 | 마지막 요소 반복 |
| play | `"show"` \| `"hide"` | "show" | 표시 상태 |
| background | `"white"` \| `"grey"` \| `"greyOpacity100"` | "grey" | 배경색 |

패턴: topList, topListWithIcon, amountTopList, amountTopListWithIcon, subtitleList, subtitleListWithIcon, listOnly, listWithIconOnly, cardOnly
커스텀 타입: title, subtitle, list, listWithIcon, card, spacer(N)

---

### Slider

목적: 범위 값 선택

| Prop | Type | Description |
|------|------|-------------|
| value | number | 현재 값 (제어) |
| defaultValue | number | 초기 값 (비제어) |
| onValueChange | (value: number) => void | 변경 콜백 |
| minValue | number | 최소값 |
| maxValue | number | 최대값 |
| color | string | 트랙 색상 (default: blue400) |
| label | { min, max, mid? } | 라벨 |
| tooltip | ReactElement | 툴팁 (Slider.Tooltip) |

---

### Stepper

목적: 순차 단계 표시

StepperProps:
- play (boolean, default: true): 진입 애니메이션
- delay (number, default: 0): 애니메이션 시작 지연(초)
- staggerDelay (number, default: 0.1): 순차 표시 간격(초)

StepperRow Props:
- left (ReactNode, 필수): 좌측 영역 (아이콘/이미지)
- center (ReactNode, 필수): 중앙 텍스트
- right (ReactNode): 우측 영역 (버튼/아이콘)
- hideLine (boolean): 연결선 숨김 (마지막 단계용)

StepperRow.Texts type: "A" (t5/t6) | "B" (t4/t6) | "C" (t5/t7)
StepperRow.NumberIcon: number (1~9)

---

### Switch

목적: 토글 스위치

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| checked | boolean | — | on/off 상태 (필수) |
| disabled | boolean | false | 비활성화 |
| hasTouchEffect | boolean | true | 터치 애니메이션 |
| onChange | (event, checked) => void | — | 변경 콜백 |

디자인: 50px × 30px, 16px 원형 thumb, 15px border-radius
접근성: role="switch", aria-checked, aria-disabled

---

### Tab

목적: 탭 인터페이스

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| children | ReactNode | — | Tab.Item (필수) |
| onChange | (index, key?) => void | — | 변경 콜백 (필수) |
| size | `"large"` \| `"small"` | "large" | 크기 |
| fluid | boolean | false | 가로 스크롤 |
| itemGap | number | — | 항목 간격(px) |
| ariaLabel | string | — | 접근성 라벨 |

Tab.Item Props:
- selected (boolean, 필수)
- redBean (boolean, default: false): 빨간 알림 배지

---

### TableRow

목적: 좌우 레이아웃 데이터 표시

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| left | ReactNode | Yes | 좌측 요소 |
| right | ReactNode | Yes | 우측 요소 |
| align | `"left"` \| `"space-between"` | Yes | 정렬 방식 |
| leftRatio | number | No | 좌측 영역 비율(%) |

---

### TextButton

목적: 텍스트 기반 버튼

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| size | `"xsmall"` \| `"small"` \| `"medium"` \| `"large"` \| `"xlarge"` \| `"xxlarge"` | Yes | — | 텍스트 크기 |
| variant | `"arrow"` \| `"underline"` \| `"clear"` | No | "clear" | 시각적 스타일 |
| disabled | boolean | No | — | 비활성화 (38% opacity) |

---

### Toast

목적: 간단한 알림 메시지

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| open | boolean | — | 표시 여부 (필수) |
| position | `"top"` \| `"bottom"` | — | 위치 (필수) |
| text | string | — | 메시지 (필수) |
| leftAddon | ReactNode | — | 좌측 아이콘/Lottie |
| button | ReactNode | — | 액션 버튼 (bottom only) |
| duration | number | 3000 | 자동 닫힘 시간(ms) |
| onClose | () => void | — | 닫기 콜백 |
| higherThanCTA | boolean | false | FixedBottomCTA 위 표시 |
| aria-live | `"assertive"` \| `"polite"` | "polite" | 스크린 리더 우선순위 |

Sub-components: Toast.Button, Toast.Icon, Toast.Lottie

---

### Tooltip

목적: 보충 정보 표시

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| size | `"small"` \| `"medium"` \| `"large"` | "medium" | 크기 |
| open | boolean | — | 외부 제어 |
| defaultOpen | boolean | false | 초기 상태 |
| message | ReactNode | — | 툴팁 내용 |
| messageAlign | `"left"` \| `"center"` \| `"right"` | "left" | 메시지 정렬 |
| placement | `"top"` \| `"bottom"` | "bottom" | 위치 |
| offset | number | — | 트리거와의 거리 |
| anchorPositionByRatio | number | 0.5 | 화살표 위치 (0~1) |
| openOnHover | boolean | false | 호버 시 열기 |
| openOnFocus | boolean | false | 포커스 시 열기 |
| dismissible | boolean | false | 외부 클릭/ESC 닫기 |
| autoFlip | boolean | false | 뷰포트 제한 시 반전 |

---

### Top

목적: 페이지 상단 헤더

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| title | ReactNode | — | 메인 제목 (필수) |
| upperGap | number | 24 | 상단 여백 |
| lowerGap | number | 24 | 하단 여백 |
| upper | ReactNode | — | 제목 위 콘텐츠 |
| lower | ReactNode | — | 제목 아래 콘텐츠 |
| subtitleTop | ReactNode | — | 제목 위 부제 |
| subtitleBottom | ReactNode | — | 제목 아래 부제 |
| right | ReactNode | — | 우측 콘텐츠 |
| rightVerticalAlign | `"center"` \| `"end"` | "center" | 우측 수직 정렬 |

Title variants: TitleParagraph (size: 22/28), TitleTextButton, TitleSelector
Subtitle: SubtitleParagraph (size: 13/15/17), SubtitleTextButton, SubtitleSelector, SubtitleBadges
Lower: LowerButton, LowerCTA, LowerCTAButton
Right: RightButton, RightAssetContent, RightArrow

---

## Feature Components

### Agreement V3 (Deprecated → V4 사용 권장)

Sub-components:
- SingleField (type: big/medium/medium-bold, arrowType: none/link/collapsible)
- SingleCheckboxField (necessity: none/mandatory/optional, checked, arrowType)
- Group / GroupItem
- CollapsibleGroup / Collapsible
- Button (inputType: checkbox/radio, size)
- Description (indent)
- Tag (color)

---

### Agreement V4

| Prop | Type | Description |
|------|------|-------------|
| variant | `"xLarge"` \| `"large"` \| `"medium"` \| `"medium-title"` \| `"small"` \| `"small-last"` | 크기 (필수) |
| indent | number | 들여쓰기 |
| left | ReactNode | 좌측 (체크박스) |
| middle | ReactNode | 중앙 (텍스트) |
| right | ReactNode | 우측 (배지/화살표) |

Sub-components:
- Text (necessity)
- Checkbox (variant: checkbox/dot/hidden, motionVariant: weak/strong)
- Badge (variant: fill/clear, textColor, bgColor)
- Necessity (variant: mandatory/optional)
- RightArrow (collapsed, onArrowClick)
- Description (variant: box/normal)
- Header (variant)
- Pressable (onPressEnd)
- IndentPushable (pushed, trigger, content)
- Collapsible (collapsed, trigger, content)
- Group (showGradient)

---

### Asset System

3계층 구조: Frame → Content → Union

#### Frame
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| content | ReactNode | — | 메인 콘텐츠 (필수) |
| shape | FrameShapeType | — | 프레임 형태 (필수) |
| backgroundColor | string | adaptive.grey100 | 배경색 |
| acc | ReactNode | — | 액세서리 요소 |
| accPosition | top-left/top-right/bottom-left/bottom-right | bottom-right | 액세서리 위치 |
| accMasking | circle/none | none | 액세서리 마스킹 |
| overlap | { color: string } | — | 오버랩 효과 |
| color | string | — | 콘텐츠 색상 |

Frame Shape Presets: Square(S/M/L), Rectangle(M/L), Circle(S/M/L), Card(S/M/L)

#### Wrapped Components
- Asset.Icon (name, color)
- Asset.Image (src, scaleType: fit/crop, alt)
- Asset.Video (src, autoPlay, loop, muted, controls)
- Asset.Lottie (src, scaleType)
- Asset.Text (children)

공통 Props: frameShape, backgroundColor, acc, accPosition, overlap

---

### BottomCTA

목적: 하단 고정 CTA 버튼

#### BottomCTA.Single
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| children | ReactNode | — | 버튼 콘텐츠 (필수) |
| showAfterDelay | { animation, delay } | — | 초기 애니메이션 |
| show | boolean | false | 표시/숨김 애니메이션 |
| hideOnScroll | boolean | false | 스크롤 시 숨김 |
| fixed | boolean | — | 하단 고정 |
| hasSafeAreaPadding | boolean | true | SafeArea 패딩 |
| background | `"default"` \| `"none"` | "default" | 배경 |
| topAccessory | ReactNode | — | 상단 부가 요소 |
| bottomAccessory | ReactNode | — | 하단 부가 요소 |
| fixedAboveKeyboard | boolean | — | 키보드 위 고정 |

animation: "slide" | "fade" | "scale"

#### BottomCTA.Double
| Prop | Type | Description |
|------|------|-------------|
| leftButton | ReactNode | 좌측 버튼 (필수) |
| rightButton | ReactNode | 우측 버튼 (필수) |
+ Single과 동일한 공통 Props

레이아웃: flex wrap-reverse, 50% 너비, 8px gap

#### FixedBottomCTA
항상 하단 고정된 CTA. Single/Double variant 지원
- hideOnScroll: 스크롤 시 자동 숨김/표시

---

### BarChart

목적: 막대 차트

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| data | BarChartData[] | — | 차트 데이터 (필수) |
| fill | AllBar \| SingleBar \| Auto | — | 바 스타일 (필수) |
| height | number | 205 | 차트 높이(px) |

BarChartData:
- value (number, 필수): 막대 길이
- maxValue (number): 최대값
- label (string): X축 라벨
- theme: blue/green/yellow/orange/red/grey/default
- barAnnotation (string/number): 막대 위 텍스트

Fill Types:
- AllBar (type: "all-bar", theme): 전체 동일 색상
- SingleBar (type: "single-bar", theme, barIndex): 특정 바 강조
- Auto (type: "auto", count): 우→좌 자동 색상 (blue→green→yellow→orange→red→grey)

12개 초과 시 첫/마지막 라벨만 표시

---

### Dialog

#### AlertDialog
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| open | boolean | — | 표시 여부 |
| title | ReactNode | — | 제목 |
| description | ReactNode | — | 설명 |
| alertButton | ReactNode | — | 확인 버튼 |
| closeOnDimmerClick | boolean | true | 배경 클릭 닫기 |
| closeOnBackEvent | boolean | true | 뒤로가기 닫기 |
| onClose | () => void | — | 닫기 콜백 |
| portalContainer | HTMLElement | document.body | 렌더 대상 |

Title: as="h3", color=adaptive.grey800, typography="t4", fontWeight="bold"
Description: color=adaptive.grey600, typography="t6", fontWeight="medium"
AlertButton: size="medium", color=colors.blue500, fontWeight="bold"

#### ConfirmDialog
AlertDialog + 두 개 버튼:
- cancelButton: type (primary/danger/light/dark), style (fill/weak), size
- confirmButton: extends Button
- 긴 버튼 텍스트 시 자동 수직 스태킹
- closeOnDimmerClick=false 시 wiggle 애니메이션

---

### Keypad

#### AlphabetKeypad
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| onKeyClick | (value: string) => void | Yes | — | 키 클릭 콜백 |
| onBackspaceClick | () => void | Yes | — | 백스페이스 콜백 |
| alphabets | string[] | No | ['A'~'Z'] | 표시할 알파벳 배열 |

#### FullSecureKeypad
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| onKeyClick | (value: string) => void | Yes | 키 클릭 콜백 |
| onBackspaceClick | () => void | Yes | 백스페이스 콜백 |
| onSpaceClick | () => void | Yes | 스페이스 콜백 |
| onSubmit | () => void | Yes | 제출 콜백 |
| submitDisabled | boolean | No | 제출 비활성화 |
| submitButtonText | string | No | 제출 버튼 텍스트 (default: "입력 완료") |

Ref: reorderEmptyCells() — 보안용 빈 셀 무작위 재배치

#### NumberKeypad
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| onKeyClick | (value: string) => void | Yes | — | 키 클릭 콜백 |
| onBackspaceClick | () => void | Yes | — | 백스페이스 콜백 |
| numbers | number[] | No | [1~9,0] | 숫자 배열 순서 |
| secure | boolean | No | false | 보안 모드 (클릭 숫자 + 무작위 2개 처리) |

---

### ListRow

목적: 3영역 리스트 아이템 (left, contents, right)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| border | `"indented"` \| `"none"` | "indented" | 구분선 |
| disabled | boolean | false | 비활성화 |
| disabledStyle | `"type1"` \| `"type2"` | "type1" | 비활성 스타일 |
| verticalPadding | `"small"` \| `"medium"` \| `"large"` \| `"xlarge"` | "medium" | 상하 패딩 |
| horizontalPadding | `"small"` \| `"medium"` | "medium" | 좌우 패딩 |
| left | ReactNode | — | 좌측 영역 |
| leftAlignment | `"top"` \| `"center"` | "center" | 좌측 정렬 |
| contents | ReactNode | — | 중앙 영역 |
| right | ReactNode | — | 우측 영역 |
| rightAlignment | `"top"` \| `"center"` | "center" | 우측 정렬 |
| withArrow | boolean | false | 화살표 아이콘 |
| withTouchEffect | boolean | false | 터치 피드백 |

#### Left Area Sub-components
- ListRow.AssetIcon (shape: original/squircle/card/circle-background/circle-masking, size: xsmall/small/medium)
- ListRow.AssetImage (src, shape, size, scaleType)
- ListRow.AssetLottie (src, shape, size)
- ListRow.AssetText (children, shape, size, color)
- ListRow.Icon / ListRow.FillIcon (shape, size)
- ListRow.Image (type: default/square/rectangle/circle/3d-emoji)

#### Contents Area
- ListRow.Texts (type: 1RowTypeA~C, 2RowTypeA~F, 3RowTypeA~F, Right1RowTypeA~E, Right2RowTypeA~E)
  - top (string/ReactElement, 필수)
  - middle (3Row 타입용)
  - bottom (2Row/3Row 타입용)

#### Right Area
- ListRow.Texts (Right* types)
- ListRow.IconButton (variant, iconSize, label, color)
- Switch, Badge, withArrow

ListRow.Loader: type (square/circle/bar), verticalPadding

---

### TextField

목적: 텍스트 입력 필드

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | `"box"` \| `"line"` \| `"big"` \| `"hero"` | — | 디자인 스타일 (필수) |
| label | string | — | 필드 라벨 |
| labelOption | `"appear"` \| `"sustain"` | "appear" | 라벨 동작 |
| help | ReactNode | — | 도움말 텍스트 |
| hasError | boolean | false | 오류 상태 |
| disabled | boolean | false | 비활성화 |
| placeholder | string | — | 플레이스홀더 |
| prefix | string | — | 접두사 (예: "$") |
| suffix | string | — | 접미사 (예: "원") |
| right | ReactNode | — | 우측 요소 |

Specialized:
- TextField.Clearable (clear 버튼 추가, onClear 콜백)
- TextField.Password (비밀번호 마스킹, onVisibilityChange)
- TextField.Button (클릭 가능 필드, onClick 콜백)

### SplitTextField
- SplitTextField.RRN13: 주민번호 13자리 분할 입력 (mask: true)
- SplitTextField.RRNFirst7: 주민번호 앞 7자리 (mask: false)

공통 Props: variant, label, labelOption, help, hasError, first, second

### TextArea
TextField 확장 (prefix, suffix, right 제외)
- minHeight: 최소 높이
- height: 고정 높이

---

## Overlay Extension Hooks

### useDialog
반환: { openAlert, openConfirm, openAsyncConfirm }

openAlert params: title, description?, alertButton?, closeOnDimmerClick?, onEntered?, onExited?
openConfirm params: title, description?, confirmButton?, cancelButton?, closeOnDimmerClick?
openAsyncConfirm params: + onConfirmClick (async), onCancelClick (async)

### useToast
반환: { openToast, closeToast }

openToast(message, options?)
options: type (top/bottom), gap, icon, iconType (circle/square), lottie, button, higherThanCTA, duration

### useBottomSheet
반환: { open, openOneButtonSheet, openTwoButtonSheet, openAsyncTwoButtonSheet, close }

공통 params: children, header?, closeOnDimmerClick?, onEntered?, onExited?
oneButton: button, closeOnButtonClick
twoButton: leftButton, rightButton, closeOnLeftButtonClick, closeOnRightButtonClick
async: + onRightButtonClick/onLeftButtonClick (async)
