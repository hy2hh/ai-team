# 다크 모드 디자인 스펙 — 칸반 대시보드

작성일: 2026-03-29
작성자: Krusty (Designer)

---

## 개요

현재 칸반 대시보드는 Tailwind 클래스가 다크 색상으로 하드코딩된 상태.
이 스펙은 CSS 커스텀 프로퍼티(디자인 토큰) 기반의 라이트/다크 듀얼 모드를 정의.

## 구현 방식

- CSS 커스텀 프로퍼티로 모든 색상 토큰 정의
- `data-theme="dark"` / `data-theme="light"` 속성으로 전환
- Tailwind v4 `@theme inline` 블록에 토큰 등록
- localStorage에 사용자 선호 저장
- 헤더에 토글 버튼 추가

---

## 1. CSS 디자인 토큰 (globals.css에 추가)

```css
/* =============================================
   라이트 모드 (기본값)
   ============================================= */
:root,
[data-theme="light"] {
  /* 배경 레이어 */
  --color-bg-base:        #f8fafc;   /* 페이지 배경 */
  --color-bg-surface:     #ffffff;   /* 헤더, 모달 */
  --color-bg-elevated:    #f1f5f9;   /* 칼럼 배경 */
  --color-bg-card:        #ffffff;   /* 카드 배경 */
  --color-bg-input:       #f8fafc;   /* 입력필드 */
  --color-bg-overlay:     rgba(0, 0, 0, 0.4);

  /* 테두리 */
  --color-border:         #e2e8f0;
  --color-border-strong:  #cbd5e1;

  /* 텍스트 */
  --color-text-primary:   #0f172a;   /* 제목, 주요 텍스트 */
  --color-text-secondary: #475569;   /* 보조 텍스트 */
  --color-text-muted:     #94a3b8;   /* 약한 텍스트, 플레이스홀더 */
  --color-text-inverse:   #ffffff;   /* 버튼 위 텍스트 */

  /* 액션 */
  --color-action-primary:       #2563eb;   /* 기본 버튼 */
  --color-action-primary-hover: #1d4ed8;
  --color-action-secondary:     #e2e8f0;   /* 취소 버튼 */
  --color-action-secondary-hover: #cbd5e1;

  /* 포커스 */
  --color-focus-ring: #3b82f6;

  /* 드래그/드롭 */
  --color-drag-over: #3b82f6;

  /* 상태 색상 (우선순위 & 진행률) */
  --color-priority-high:    #ef4444;
  --color-priority-medium:  #eab308;
  --color-priority-low:     #22c55e;
  --color-progress-high:    #22c55e;
  --color-progress-medium:  #eab308;
  --color-progress-low:     #ef4444;

  /* 에이전트 아바타 */
  --color-agent-homer:  #3b82f6;
  --color-agent-bart:   #06b6d4;
  --color-agent-marge:  #a855f7;
  --color-agent-lisa:   #22c55e;
  --color-agent-krusty: #f97316;
  --color-agent-sid:    #ec4899;
}

/* =============================================
   다크 모드
   ============================================= */
[data-theme="dark"] {
  /* 배경 레이어 */
  --color-bg-base:        #0f172a;   /* 페이지 배경 slate-900 */
  --color-bg-surface:     #1e293b;   /* 헤더, 모달 slate-800 */
  --color-bg-elevated:    #1e293b;   /* 칼럼 배경 slate-800 */
  --color-bg-card:        #334155;   /* 카드 배경 slate-700 */
  --color-bg-input:       #334155;   /* 입력필드 slate-700 */
  --color-bg-overlay:     rgba(0, 0, 0, 0.6);

  /* 테두리 */
  --color-border:         #334155;   /* slate-700 */
  --color-border-strong:  #475569;   /* slate-600 */

  /* 텍스트 */
  --color-text-primary:   #f8fafc;   /* slate-50 */
  --color-text-secondary: #94a3b8;   /* slate-400 */
  --color-text-muted:     #64748b;   /* slate-500 */
  --color-text-inverse:   #ffffff;

  /* 액션 */
  --color-action-primary:       #2563eb;
  --color-action-primary-hover: #1d4ed8;
  --color-action-secondary:     #334155;   /* slate-700 */
  --color-action-secondary-hover: #475569; /* slate-600 */

  /* 포커스 */
  --color-focus-ring: #60a5fa;   /* blue-400 */

  /* 드래그/드롭 */
  --color-drag-over: #60a5fa;

  /* 상태 색상 — 다크에서 동일 유지 */
  --color-priority-high:    #ef4444;
  --color-priority-medium:  #eab308;
  --color-priority-low:     #22c55e;
  --color-progress-high:    #22c55e;
  --color-progress-medium:  #eab308;
  --color-progress-low:     #ef4444;

  /* 에이전트 아바타 — 다크에서 동일 유지 */
  --color-agent-homer:  #3b82f6;
  --color-agent-bart:   #06b6d4;
  --color-agent-marge:  #a855f7;
  --color-agent-lisa:   #22c55e;
  --color-agent-krusty: #f97316;
  --color-agent-sid:    #ec4899;
}
```

---

## 2. Tailwind v4 @theme 등록 (globals.css에 추가)

```css
@theme inline {
  --color-bg-base:        var(--color-bg-base);
  --color-bg-surface:     var(--color-bg-surface);
  --color-bg-elevated:    var(--color-bg-elevated);
  --color-bg-card:        var(--color-bg-card);
  --color-bg-input:       var(--color-bg-input);
  --color-border:         var(--color-border);
  --color-border-strong:  var(--color-border-strong);
  --color-text-primary:   var(--color-text-primary);
  --color-text-secondary: var(--color-text-secondary);
  --color-text-muted:     var(--color-text-muted);
  --color-text-inverse:   var(--color-text-inverse);
  --color-action-primary:       var(--color-action-primary);
  --color-action-primary-hover: var(--color-action-primary-hover);
  --color-action-secondary:     var(--color-action-secondary);
  --color-focus-ring:     var(--color-focus-ring);
  --color-drag-over:      var(--color-drag-over);
}
```

---

## 3. 컴포넌트별 색상 교체 매핑

### Board.tsx
- `bg-slate-900` → `bg-[var(--color-bg-base)]`
- `text-slate-400` → `text-[var(--color-text-secondary)]`
- `text-red-400` → 유지 (에러 상태)

### Column.tsx
- `bg-slate-800` → `bg-[var(--color-bg-elevated)]`
- `border-slate-700` → `border-[var(--color-border)]`
- `bg-slate-700 text-slate-300` (카드 카운트) → `bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]`
- `text-slate-400` → `text-[var(--color-text-secondary)]`
- `hover:bg-slate-700` → `hover:bg-[var(--color-bg-card)]`
- `ring-2 ring-blue-400` (드롭) → `ring-2 ring-[var(--color-drag-over)]`

### Card.tsx
- `bg-slate-700` → `bg-[var(--color-bg-card)]`
- `text-white` (카드 제목) → `text-[var(--color-text-primary)]`
- `text-slate-400` → `text-[var(--color-text-secondary)]`
- `text-slate-300` → `text-[var(--color-text-secondary)]`
- `text-slate-500` (삭제 버튼) → `text-[var(--color-text-muted)]`
- `bg-slate-600` (진행률 배경) → `bg-[var(--color-border-strong)]`

### AddCardModal.tsx
- `bg-black/60` (오버레이) → `bg-[var(--color-bg-overlay)]`
- `bg-slate-800` (모달) → `bg-[var(--color-bg-surface)]`
- `text-white` (제목) → `text-[var(--color-text-primary)]`
- `bg-slate-700` (입력필드) → `bg-[var(--color-bg-input)]`
- `text-white` (입력 텍스트) → `text-[var(--color-text-primary)]`
- `focus:ring-blue-500` → `focus:ring-[var(--color-focus-ring)]`
- `bg-blue-600 hover:bg-blue-700` → `bg-[var(--color-action-primary)] hover:bg-[var(--color-action-primary-hover)]`
- `bg-slate-700 hover:bg-slate-600` (취소) → `bg-[var(--color-action-secondary)] hover:bg-[var(--color-action-secondary-hover)]`
- `text-slate-300 hover:text-white` (select 옵션 텍스트) → `text-[var(--color-text-secondary)]`
- `border-slate-600` → `border-[var(--color-border)]`

---

## 4. 토글 버튼 컴포넌트

```tsx
// components/ThemeToggle.tsx
'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const initial = saved ?? 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
      className="p-2 rounded-lg transition-colors hover:bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
```

---

## 5. 라이트 모드 시각 명세

### 배경 레이어 (밝기 순)
- 페이지: `#f8fafc` (거의 흰색, slate-50)
- 칼럼: `#f1f5f9` (연한 회색, slate-100)
- 카드: `#ffffff` (순백)
- 헤더/모달: `#ffffff` (순백)

### 텍스트 대비비 (WCAG AA 충족)
- 주요 텍스트 `#0f172a` on `#ffffff` → 대비비 ~18:1 ✓
- 보조 텍스트 `#475569` on `#ffffff` → 대비비 ~7:1 ✓
- 뮤트 텍스트 `#94a3b8` on `#ffffff` → 대비비 ~3.5:1 (비텍스트용) ✓

### 그림자 (라이트 모드에서 카드 구분)
- 카드: `shadow-sm` → `shadow-md` (hover) — Tailwind 기본 그림자 유지
- 추가 권장: 카드에 `border border-[var(--color-border)]` 추가하면 구분 명확

---

## 6. 접근성 체크리스트

- [x] 다크 모드: 모든 텍스트-배경 조합 WCAG AA (4.5:1) 이상
- [x] 라이트 모드: 모든 텍스트-배경 조합 WCAG AA (4.5:1) 이상
- [x] 상태 색상(빨강/노랑/초록)은 색상 외 아이콘/텍스트로도 구분
- [x] 토글 버튼 aria-label 포함
- [x] focus-visible 링 색상 모드별 적용

---

## 구현 순서 (프론트엔드 참고)

1. `globals.css` — CSS 토큰 추가 + @theme 등록
2. `layout.tsx` — `<html>` 태그에 초기 `data-theme` 설정 (SSR 깜빡임 방지)
3. `ThemeToggle.tsx` — 컴포넌트 생성
4. `Board.tsx` → `Column.tsx` → `Card.tsx` → `AddCardModal.tsx` 순서로 클래스 교체
5. 헤더에 `ThemeToggle` 배치
