# Design Token System — @bifrost-platform/ui-kit-front 사용 예시

> 토큰 원본: `/Users/hangheejo/git/ui-kit-front/src/theme.ts`

---

## 설치 & 설정

```bash
npm install @bifrost-platform/ui-kit-front
```

```typescript
// tailwind.config.ts
import { createTailwindConfig } from '@bifrost-platform/ui-kit-front/config';

export default createTailwindConfig({
  content: ['./src/**/*.{ts,tsx}'],
});
```

```typescript
// 프로젝트 entry (main.tsx 또는 _app.tsx)
import '@bifrost-platform/ui-kit-front/index.css';
```

---

## 색상 토큰 — Tailwind 클래스

```tsx
// Gray Scale
<div className="bg-gray-100 text-gray-900" />       // #F7F7F7 / #1A1A1A
<div className="border border-gray-300" />            // #D9D9D9

// Brand (Pockie/Storybook)
<span className="text-brand-point" />                // #5F5BE2
<div className="bg-brand-100" />                     // #F3F3FF

// Semantic
<span className="text-negative-700" />               // #EC2D30 (에러)
<span className="text-positive-700" />               // #0C9D61 (성공)
<span className="text-warning-700" />                // #FE9B0E (경고)
<span className="text-message-700" />                // #3A70E2 (정보)
```

> 서비스별 Primary는 CSS 변수로 주입 — 토큰에 포함되지 않음.
> Bifrost Network/Biquid: `#FF474C` | BTCFi Boost: `#3467F4` | Pockie: `#5F5BE2 (brand-point)`

---

## 타이포그래피 토큰

```tsx
<h1 className="text-h1 font-bold" />       // 48px, line-height 1.17, weight 700
<h2 className="text-h2 font-bold" />       // 40px, 1.2
<h3 className="text-h3 font-medium" />     // 32px, 1.25
<h4 className="text-h4 font-medium" />     // 24px, 1.33
<p className="text-subtitle" />            // 20px, 1.4
<p className="text-body" />                // 16px, 1.5
<p className="text-bodySm" />              // 14px, 1.43
<span className="text-caption" />          // 12px, 1.33

// Font weight
// font-light (300) / font-regular (400) / font-medium (500) / font-bold (700) / font-black (900)
```

---

## TypeScript에서 토큰 직접 접근

```typescript
import { colors, fontSize, fontWeight } from '@bifrost-platform/ui-kit-front/types';

// 색상값 참조
const errorColor = colors.negative[700];   // '#EC2D30'
const grayBorder = colors.gray[300];       // '#D9D9D9'

// 타이포 참조
const bodySize = fontSize.body[0];         // '16px'
const bodyLineHeight = fontSize.body[1].lineHeight; // '1.5'
```

---

## 컴포넌트 사용 예시

```tsx
import { Button, Input, Badge, Spinner } from '@bifrost-platform/ui-kit-front';

// Button — primary는 서비스 컬러 적용
<Button variant="primary" size="lg">확인</Button>

// Input — focus 시 brand border
<Input placeholder="금액 입력" />

// 상태 배지
<Badge variant="positive">활성</Badge>
<Badge variant="negative">오류</Badge>
```

---

## 다크 모드 배경 레이어 (커스텀 CSS)

```css
/* biquid.io 기준 — 토큰에 포함되지 않음, 직접 정의 */
:root {
  --bg-0: #000000; /* 페이지 배경 */
  --bg-1: #080808; /* Header */
  --bg-2: #1E1E1E; /* 카드 */
  --bg-3: #303030; /* Input·서브카드 */
  --bg-4: #3D3D3D; /* 툴팁 */
}
```

> Dark 모드 shadow 사용 금지. 배경색 명도 차이로만 레이어 구분.
