# Design Token System — Apple 스타일 사용 예시

칸반보드 디자인 토큰은 CSS 변수 기반이며 Tailwind 클래스로 노출됩니다.
Apple 디자인 시스템 기준: `#f5f5f7` (light) / `#000000` (dark) 이진 배경, 단일 강조색 `#0071e3`.

---

## 색상 토큰 — CSS 변수

### 배경 레이어

```css
/* Light Section */
var(--color-bg-light)      /* #f5f5f7 — 정보형 섹션 배경 */
var(--color-bg-white)      /* #ffffff — 카드, 오버레이 */

/* Dark Section */
var(--color-bg-dark)       /* #000000 — 몰입형 섹션 배경 */
var(--color-bg-dark-1)     /* #272729 — 다크 서피스 1 */
var(--color-bg-dark-2)     /* #242426 — 다크 서피스 2 */
```

> Light / Dark 섹션을 교차하여 구분. Shadow로 레이어 구분하지 않음 (elevated card 제외).

### Apple Blue (인터랙티브 전용)

```css
var(--color-apple-blue)          /* #0071e3 — CTA, 버튼, 포커스 링 */
var(--color-link-light)          /* #0066cc — light bg 링크 */
var(--color-link-dark)           /* #2997ff — dark bg 링크 */
```

```tsx
// Apple Blue 유틸리티
<button className="bg-apple-blue text-white" />    // CTA 버튼
<a className="text-link-light" />                  // light 섹션 링크
<a className="text-link-dark" />                   // dark 섹션 링크
```

### 텍스트

```css
/* Light bg */
var(--color-text-primary)    /* #1d1d1f — 제목·본문 */
var(--color-text-secondary)  /* rgba(0,0,0,0.8) — 보조 */
var(--color-text-tertiary)   /* rgba(0,0,0,0.48) — 비활성 */

/* Dark bg */
var(--color-text-on-dark)    /* #ffffff — 다크 섹션 텍스트 */
```

### 그림자

```css
var(--shadow-card)   /* rgba(0,0,0,0.22) 3px 5px 30px 0px — elevated card */
var(--shadow-none)   /* none — 기본 (대부분 요소) */
```

---

## 타이포그래피 토큰

```css
/* SF Pro Display (20px+) */
var(--text-display-hero)    /* 56px, weight 600, lh 1.07, ls -0.28px */
var(--text-section-heading) /* 40px, weight 600, lh 1.10 */
var(--text-tile-heading)    /* 28px, weight 400, lh 1.14, ls 0.196px */
var(--text-card-title)      /* 21px, weight 700, lh 1.19, ls 0.231px */

/* SF Pro Text (19px 이하) */
var(--text-body)            /* 17px, weight 400, lh 1.47, ls -0.374px */
var(--text-body-em)         /* 17px, weight 600, lh 1.24, ls -0.374px */
var(--text-caption)         /* 14px, weight 400, lh 1.29, ls -0.224px */
var(--text-micro)           /* 12px, weight 400, lh 1.33, ls -0.12px */
var(--text-nav)             /* 12px, weight 400, lh normal */
```

---

## Border Radius 토큰

```css
var(--radius-micro)    /* 5px — 최소 요소 */
var(--radius-md)       /* 8px — 버튼, 카드 */
var(--radius-input)    /* 11px — 인풋 필드 */
var(--radius-panel)    /* 12px — 패널, 시트 */
var(--radius-pill)     /* 980px — CTA Pill */
var(--radius-circle)   /* 50% — 미디어 컨트롤 */
```

---

## Spacing 토큰 (8px 기반)

```css
var(--space-1)   /* 8px */
var(--space-2)   /* 16px */
var(--space-3)   /* 24px */
var(--space-4)   /* 32px */
var(--space-5)   /* 40px */
var(--space-6)   /* 48px */
var(--space-8)   /* 64px */
```

---

## CSS 변수 정의 예시

```css
:root {
  /* Backgrounds */
  --color-bg-light:     #f5f5f7;
  --color-bg-white:     #ffffff;
  --color-bg-dark:      #000000;
  --color-bg-dark-1:    #272729;
  --color-bg-dark-2:    #242426;

  /* Apple Blue */
  --color-apple-blue:   #0071e3;
  --color-link-light:   #0066cc;
  --color-link-dark:    #2997ff;

  /* Text */
  --color-text-primary:   #1d1d1f;
  --color-text-secondary: rgba(0,0,0,0.8);
  --color-text-tertiary:  rgba(0,0,0,0.48);
  --color-text-on-dark:   #ffffff;

  /* Shadow */
  --shadow-card: rgba(0,0,0,0.22) 3px 5px 30px 0px;

  /* Radius */
  --radius-micro:  5px;
  --radius-md:     8px;
  --radius-input:  11px;
  --radius-panel:  12px;
  --radius-pill:   980px;
  --radius-circle: 50%;
}
```

> Light / Dark 섹션 전환은 `data-section="dark"` 속성으로 제어.
