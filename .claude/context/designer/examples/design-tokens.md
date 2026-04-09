# Design Token System — 토스 스타일 (3계층 구조)

토스 디자인 시스템 CSS 변수는 3계층 구조(Base→Semantic→Component)로 구성됩니다.
Tailwind 클래스로 노출되며, Semantic 계층이 Tailwind config의 참조 대상입니다.

> 전환 이력: Apple 8px 기반 → 토스 4px 기반 (2026-04-09)

---

## 계층 구조 개요

```
Layer 1: Base (원시값)     — 색상·크기의 절대값. 직접 사용 금지.
Layer 2: Semantic (의미)   — 용도별 매핑. Tailwind config 연결 대상.
Layer 3: Component (바인딩) — 컴포넌트 전용. shadcn/ui 테마와 통합.
```

---

## 색상 토큰

### Layer 1: Base (원시값)

```css
:root {
  /* Blue 스케일 */
  --color-blue-500: #0064FF;
  --color-blue-600: #0052CC;
  --color-blue-700: #0041A3;
  --color-blue-400: #4D9BFF;

  /* Gray 스케일 */
  --color-gray-50: #F4F4F4;
  --color-gray-100: #F2F4F6;
  --color-gray-200: #E5E8EB;
  --color-gray-300: #D1D6DB;
  --color-gray-400: #B0B8C1;
  --color-gray-500: #8B95A1;
  --color-gray-600: #6B7684;
  --color-gray-700: #4E5968;
  --color-gray-800: #333D4B;
  --color-gray-900: #191F28;

  /* Semantic 원시 */
  --color-white: #FFFFFF;
  --color-black: #17171C;
  --color-green-500: #00C471;
  --color-orange-500: #FF9500;
  --color-red-500: #F04452;

  /* Dark Surface */
  --color-dark-surface: #2C2C35;
  --color-dark-elevated: #3C3C45;
}
```

### Layer 2: Semantic (의미 부여)

```css
:root {
  /* 배경 */
  --fill-bg-page: var(--color-gray-50);
  --fill-bg-surface: var(--color-white);
  --fill-bg-elevated: var(--color-white);
  --fill-bg-input: var(--color-gray-100);

  /* 브랜드 */
  --fill-brand-primary: var(--color-blue-500);
  --fill-brand-hover: var(--color-blue-600);
  --fill-brand-pressed: var(--color-blue-700);

  /* 텍스트 */
  --text-primary: var(--color-gray-900);
  --text-secondary: var(--color-gray-700);
  --text-tertiary: var(--color-gray-500);
  --text-disabled: var(--color-gray-400);
  --text-on-brand: var(--color-white);
  --text-inverse: var(--color-white);

  /* 시맨틱 */
  --fill-success: var(--color-green-500);
  --fill-warning: var(--color-orange-500);
  --fill-error: var(--color-red-500);

  /* 경계선 */
  --border-default: var(--color-gray-200);
  --border-light: var(--color-gray-100);
  --border-focus: var(--color-blue-500);

  /* 그림자 */
  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-elevated: 0 4px 16px rgba(0, 0, 0, 0.12);
  --shadow-none: none;
}

/* Dark Mode */
[data-theme="dark"] {
  --fill-bg-page: var(--color-black);
  --fill-bg-surface: var(--color-dark-surface);
  --fill-bg-elevated: var(--color-dark-elevated);

  --fill-brand-primary: var(--color-blue-400);

  --text-primary: #ECECEC;
  --text-secondary: var(--color-gray-500);
  --text-tertiary: var(--color-gray-600);
}
```

### Layer 3: Component (컴포넌트 바인딩)

```css
:root {
  /* 버튼 */
  --btn-primary-bg: var(--fill-brand-primary);
  --btn-primary-hover: var(--fill-brand-hover);
  --btn-primary-pressed: var(--fill-brand-pressed);
  --btn-primary-text: var(--text-on-brand);
  --btn-secondary-bg: var(--color-gray-100);
  --btn-secondary-text: var(--color-gray-700);

  /* 카드 */
  --card-bg: var(--fill-bg-surface);
  --card-shadow: var(--shadow-card);
  --card-radius: 16px;
  --card-padding: 20px;

  /* 인풋 */
  --input-bg: var(--fill-bg-input);
  --input-border: var(--border-default);
  --input-border-focus: var(--border-focus);
  --input-radius: 8px;
  --input-height: 54px;

  /* 네비게이션 */
  --nav-bg: var(--color-white);
  --nav-border: #F0F0F0;
  --nav-height: 56px;

  /* 바텀시트 */
  --bottomsheet-bg: var(--fill-bg-surface);
  --bottomsheet-radius: 24px 24px 0 0;
  --bottomsheet-shadow: var(--shadow-elevated);
}
```

---

## Tailwind Config 매핑

```ts
// tailwind.config.ts
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  theme: {
    extend: {
      colors: {
        primary: 'var(--fill-brand-primary)',
        'primary-hover': 'var(--fill-brand-hover)',
        background: 'var(--fill-bg-page)',
        surface: 'var(--fill-bg-surface)',
        foreground: 'var(--text-primary)',
        'foreground-secondary': 'var(--text-secondary)',
        'foreground-tertiary': 'var(--text-tertiary)',
        success: 'var(--fill-success)',
        warning: 'var(--fill-warning)',
        destructive: 'var(--fill-error)',
      },
      fontFamily: {
        sans: [
          'var(--font-toss)',
          'Pretendard',
          ...defaultTheme.fontFamily.sans,
        ],
      },
      letterSpacing: {
        toss: '-0.3px',
        'toss-sm': '-0.2px',
        'toss-lg': '-0.4px',
      },
      borderRadius: {
        micro: '4px',
        sm: '8px',
        DEFAULT: '12px',
        card: '16px',
        lg: '24px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        elevated: 'var(--shadow-elevated)',
      },
    },
  },
}
```

---

## 타이포그래피 토큰

```css
:root {
  /* Toss Product Sans (제목 계열) */
  --text-display-hero:    32px;  /* weight 700, lh 1.3, ls -0.4px */
  --text-section-heading: 24px;  /* weight 700, lh 1.4, ls -0.3px */
  --text-title:           20px;  /* weight 700, lh 1.4, ls -0.3px */
  --text-subtitle:        17px;  /* weight 600, lh 1.4, ls -0.3px */

  /* Pretendard (본문 계열) */
  --text-body:            16px;  /* weight 400, lh 1.5, ls -0.3px */
  --text-body-em:         16px;  /* weight 600, lh 1.5, ls -0.3px */
  --text-caption:         13px;  /* weight 400, lh 1.4, ls -0.2px */
  --text-micro:           11px;  /* weight 400, lh 1.3, ls 0px */
}
```

---

## Border Radius 토큰

```css
:root {
  --radius-micro:  4px;   /* 태그, 배지 */
  --radius-sm:     8px;   /* 인풋, 작은 요소 */
  --radius-md:     12px;  /* 버튼 */
  --radius-card:   16px;  /* 카드, 바텀시트 */
  --radius-lg:     24px;  /* 큰 카드 */
  --radius-circle: 50%;   /* 아바타 */
}
```

---

## Spacing 토큰 (4px 기반)

```css
/* Tailwind 기본 스케일과 동일 — 커스텀 정의 불필요 */
/* p-1 = 4px, p-2 = 8px, p-3 = 12px, p-4 = 16px, p-5 = 20px */

:root {
  --space-1:  4px;   /* 미세 간격 */
  --space-2:  8px;   /* 기본 소단위 */
  --space-3:  12px;  /* 아이템 간격, 카드 간 간격 */
  --space-4:  16px;  /* 섹션 내부 */
  --space-5:  20px;  /* 카드 내부 패딩, 좌우 패딩 */
  --space-6:  24px;  /* 그룹 간격 */
  --space-8:  32px;  /* 섹션 간격 */
  --space-10: 40px;  /* 큰 섹션 */
}
```

> 토스 = 4px grid. Tailwind 기본 spacing과 자연스럽게 정렬됩니다.
