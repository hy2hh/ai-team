# Memory Viewer — 전체 디자인 스펙 (Krusty)

> 작성: 2026-04-07 | 상태: Bart 구현 핸드오프용
> Bifrost 디자인 시스템 기준 전면 재설계

---

## 0. 기존 WARN 목록 (Chalmers 리뷰 → 6건 + 추가)

| # | 항목 | 현재 | 수정 |
|---|------|------|------|
| 1 | 폰트 | `-apple-system, Roboto...` | Pretendard Variable |
| 2 | 터치 타겟 | `min-h-[32px]` | `min-h-[44px]` (전체) |
| 3 | 이모지 아이콘 | ☰ 🔍 📁 📄 🧠 ⟦⟧ | lucide-react SVG |
| 4 | 포인트 컬러 | `#7C7AE8` (임의 밝힘) | `#5F5BE2` (brand-point 정확) |
| 5 | 반응형 미지원 | 3패널 고정 | 모바일 드로어 / 태블릿 2패널 |
| 6 | 빈 상태 | 🧠 이모지 장식 | 텍스트만 |
| 7 | Hover | 인라인 JS style | CSS 변수 + Tailwind |
| 8 | 배경 색온도 | 진한 네이비(#080d17~) | Bifrost 다크 표준화 |

---

## 1. 색상 토큰 전체 재정의 (globals.css)

### 철학
- 블루-퍼플 계열 → Bifrost 네이비 틴트 (#0d1117 계열) 유지, 단 표준화
- Primary: brand-point `#5F5BE2` (Pockie/ai-team 전용)
- Shadow 완전 배제 (다크모드 원칙), 배경색 명도 차이로 레이어 구분

```css
:root,
[data-theme="dark"] {
  /* 폰트 */
  --font-family: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;

  /* 타이포그래피 */
  --text-h4: 16px;       /* 파일명 등 헤딩 */
  --text-body: 14px;     /* 본문 기본 */
  --text-body-sm: 13px;  /* 파일트리 항목 */
  --text-caption: 12px;  /* 보조 정보 */
  --text-label: 11px;    /* 메타데이터 */

  --line-height-tight: 1.3;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.65;

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Border Radius */
  --radius-xs: 4px;    /* 배지, 인라인 코드 */
  --radius-sm: 6px;    /* 버튼, 입력 내부 요소 */
  --radius-md: 8px;    /* 사이드바 항목, Input */
  --radius-lg: 12px;   /* 검색 드롭다운, 패널 */

  /* ─── 배경 레이어 (네이비 틴트 표준화) ─── */
  --color-bg-base:     #0d1117;   /* 페이지 최하단 */
  --color-bg-surface:  #161b27;   /* 사이드바/우측패널 */
  --color-bg-elevated: #1c2333;   /* 호버 강조, 검색 드롭다운 */
  --color-bg-card:     #212d40;   /* 카드 내부, 백링크 행 */
  --color-bg-input:    #1c2333;   /* 검색 Input 배경 */
  --color-bg-overlay:  rgba(0, 0, 0, 0.6);

  /* ─── 테두리 ─── */
  --color-border:        rgba(255, 255, 255, 0.08);  /* 일반 구분선 */
  --color-border-strong: rgba(255, 255, 255, 0.14);  /* 강조 구분선 */

  /* ─── 텍스트 6단계 ─── */
  --color-text-primary:   #e6edf3;   /* 제목·본문 */
  --color-text-secondary: #8b949e;   /* 보조·설명 */
  --color-text-tertiary:  #6e7681;   /* 힌트·중요도 낮음 */
  --color-text-muted:     #484f58;   /* 비활성에 가까운 힌트 */
  --color-text-disabled:  #30363d;   /* 완전 비활성 */
  --color-text-inverse:   #0d1117;   /* 역전 (밝은 배경 위) */

  /* ─── 브랜드 (brand-point) ─── */
  --color-point:        #5F5BE2;                     /* brand-point */
  --color-point-light:  #7B78EC;                     /* 다크모드 텍스트용 (대비 확보) */
  --color-point-hover:  #4A47C8;                     /* 버튼 hover */
  --color-point-subtle: rgba(95, 91, 226, 0.12);     /* 선택 배경 */
  --color-point-border: rgba(95, 91, 226, 0.30);     /* 포커스 링 */

  /* ─── 포커스 ─── */
  --color-focus-ring: rgba(95, 91, 226, 0.50);

  /* ─── 시맨틱 ─── */
  --color-negative: #ec2d30;
  --color-warning:  #fe9b0e;
  --color-positive: #0c9d61;
  --color-info:     #3a70e2;

  /* ─── 폴더 색상 ─── */
  --color-folder-facts:     #4ade80;
  --color-folder-decisions: #fbbf24;
  --color-folder-tasks:     #22d3ee;
  --color-folder-handoff:   #fb923c;
  --color-folder-design:    #c084fc;
  --color-folder-logs:      #6e7681;
  --color-folder-default:   #8b949e;

  /* ─── 에이전트 아바타 ─── */
  --color-agent-homer:    #4f7ef0;
  --color-agent-bart:     #22d3ee;
  --color-agent-marge:    #c084fc;
  --color-agent-lisa:     #4ade80;
  --color-agent-krusty:   #fb923c;
  --color-agent-sid:      #f472b6;
  --color-agent-chalmers: #f59e0b;
  --color-agent-wiggum:   #94a3b8;
}
```

---

## 2. 폰트 로드 (layout.tsx)

```html
<!-- <head> 추가 -->
<link rel="preconnect" href="https://cdn.jsdelivr.net" />
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
/>
```

globals.css body:
```css
html, body {
  font-family: var(--font-family);
  /* 나머지 동일 */
}
```

---

## 3. 아이콘 교체 매핑 (lucide-react)

| 현재 이모지 | 교체 아이콘 | 크기 |
|------------|------------|------|
| ☰ | `<Menu />` | 16px |
| ⟦⟧ | `<PanelRight />` | 16px |
| 🔍 | `<Search />` | 14px |
| ✕ | `<X />` | 12px |
| 📁 (폴더) | `<ChevronRight />` / `<ChevronDown />` + `<Folder />` | 14px |
| 📄 (md) | `<FileText />` | 14px |
| 📊 (jsonl) | `<FileJson />` | 14px |
| 📎 (기타) | `<File />` | 14px |
| 🧠 (빈 상태) | *제거 — 텍스트만* | — |
| ▾ ▸ | `<ChevronDown />` / `<ChevronRight />` | 12px |

---

## 4. 컴포넌트별 스펙

### 4-1. Header (page.tsx 상단 바)

```
높이: 48px (flex items-center)
배경: var(--color-bg-surface)
border-bottom: 1px solid var(--color-border)
padding: px-4
```

**사이드바 토글 버튼**
```
크기: 44×44px (min-w-[44px] min-h-[44px])
아이콘: <Menu size={16} />
Default: color = var(--color-text-secondary), background = transparent
Hover: background = var(--color-bg-elevated)   ← CSS :hover (인라인 JS 제거)
Active: background = var(--color-bg-card)
border-radius: var(--radius-md)
transition: background 150ms ease
```

**앱 타이틀**
```
폰트: 14px / weight 600 / color var(--color-text-primary)
이모지 제거 — 텍스트 ".memory/" 만
```

**백링크 패널 토글 버튼**
```
크기: 44×44px
아이콘: <PanelRight size={16} />
Default: color = var(--color-text-secondary)
Active (패널 열림): color = var(--color-point-light)
Hover: background = var(--color-bg-elevated)
```

---

### 4-2. 좌측 사이드바 (FileTree + SearchBar)

```
너비: 260px (데스크톱), 드로어 (모바일)
배경: var(--color-bg-surface)
border-right: 1px solid var(--color-border)
```

**SearchBar**
```
padding: p-3 (위아래)
Input 래퍼:
  background: var(--color-bg-input)
  border: 1px solid var(--color-border)
  border-radius: var(--radius-md)
  padding: px-3 py-2.5
  gap: 8px
  height: 36px

  Focus 상태:
    border-color: var(--color-point-border)
    outline: none

아이콘: <Search size={14} /> color var(--color-text-muted)
placeholder: "검색... (⌘K)" color var(--color-text-muted)
input text: 13px / var(--color-text-primary)
clear button: <X size={12} /> — 44px 터치타겟, color var(--color-text-muted)
```

**검색 결과 드롭다운**
```
background: var(--color-bg-elevated)
border: 1px solid var(--color-border-strong)
border-radius: var(--radius-lg)
shadow: none (다크모드 원칙)
max-height: 320px / overflow-y: auto

각 결과 행:
  padding: px-3 py-2.5
  min-height: 44px
  border-bottom: 1px solid var(--color-border)

  Hover: background var(--color-bg-card)

  파일명: 13px / weight 500 / var(--color-text-primary)
  경로: 12px / var(--color-text-muted)
  매치 라인: 12px / var(--color-text-secondary)
  라인번호: color var(--color-text-muted)
```

**FileTree 항목 (TreeNode)**
```
min-height: 44px  ← 32px에서 변경
padding: py-1.5 px-2
border-radius: var(--radius-md)

Default:
  color: var(--color-text-secondary)
  background: transparent
  border-left: 2px solid transparent

Hover (CSS :hover):
  background: var(--color-bg-elevated)

Selected:
  background: var(--color-point-subtle)
  color: var(--color-text-primary)
  border-left: 2px solid var(--color-point)

폴더 expand 아이콘:
  <ChevronRight size={12} /> / <ChevronDown size={12} />
  color: var(--color-text-muted)
  transition: transform 150ms ease (접기/펼치기 애니메이션)

파일 아이콘: size 14px / color var(--color-text-muted)
파일명: 13px / truncate
파일 크기 배지: 11px / var(--color-text-muted) / ml-auto

인덴트: depth * 16 + 8 (동일 유지)
```

**하단 통계 표시줄**
```
padding: px-3 py-2.5
font-size: 11px
color: var(--color-text-muted)
border-top: 1px solid var(--color-border)
```

---

### 4-3. 중앙 MarkdownViewer

**파일 헤더 바**
```
height: 48px
padding: px-6
border-bottom: 1px solid var(--color-border)
background: var(--color-bg-base)

파일명:
  font-size: 14px / weight 600 / var(--color-text-primary)

경로:
  font-size: 12px / var(--color-text-muted)

메타 (크기, 날짜):
  font-size: 12px / var(--color-text-muted)
  gap: 16px
```

**콘텐츠 영역**
```
padding: px-8 py-6
max-width: 720px (마크다운 최적 읽기 너비)
margin: 0 auto
```

**빈 상태 (EmptyState)**
```
이모지 제거 완전히

레이아웃: flex-col items-center justify-center gap-3

안내 텍스트:
  "파일을 선택하세요"
  font-size: 14px / color var(--color-text-secondary)
  weight: 500

보조 텍스트:
  "왼쪽 파일 트리에서 파일을 선택하거나 ⌘K로 검색"
  font-size: 12px / color var(--color-text-muted)

단축키 칩:
  background: var(--color-bg-card)
  border: 1px solid var(--color-border)
  border-radius: var(--radius-sm)
  padding: px-2 py-1
  font-size: 12px / font-mono
  color: var(--color-text-secondary)
  min-height: 44px (칩 컨테이너 클릭 영역)
```

**로딩 상태**
```
중앙 Spinner:
  width: 20px / height: 20px
  border: 2px solid var(--color-border)
  border-top-color: var(--color-point-light)
  border-radius: 50%
  animation: spin 600ms linear infinite

  (lucide <Loader2 size={20} /> + animate-spin 가능)
  color: var(--color-point-light)
```

---

### 4-4. 우측 BacklinksPanel

**탭 헤더**
```
height: 44px
padding-x: 0
border-bottom: 1px solid var(--color-border)

탭 버튼:
  flex-1 / height: 44px
  font-size: 12px / weight 500

  Default: color var(--color-text-muted)
  Active:
    color: var(--color-point-light)
    border-bottom: 2px solid var(--color-point)
  Hover: color var(--color-text-secondary)

  transition: color 150ms ease
```

**백링크 행**
```
padding: px-3 py-2.5
min-height: 44px
border-bottom: 1px solid var(--color-border)
cursor: pointer

Hover: background var(--color-bg-elevated)

파일명: 12px / weight 500 / var(--color-point-light)
컨텍스트: 12px / var(--color-text-muted) / truncate
라인번호: 11px / var(--color-text-muted)
```

**아웃라인 행**
```
padding: py-1.5
font-size: 12px

H1: color var(--color-text-primary) / weight 600
H2: color var(--color-text-primary) / weight 500
H3: color var(--color-text-secondary) / weight 400
H4+: color var(--color-text-muted) / weight 400

인덴트: (level - 1) * 12 + 12
```

**빈 상태**
```
padding: p-4
font-size: 12px / var(--color-text-muted)
텍스트만 — 아이콘/이모지 없음
```

---

## 5. 반응형 레이아웃

### 브레이크포인트
```
모바일:  < 768px
태블릿:  768px ~ 1023px
데스크톱: ≥ 1024px
```

### 데스크톱 (≥ 1024px)
```
3패널: [사이드바 260px] [콘텐츠 flex-1] [우측패널 260px]
```

### 태블릿 (768~1023px)
```
2패널: [사이드바 240px] [콘텐츠 flex-1]
우측 패널: 토글 시 콘텐츠 위에 오버레이 (width 280px, right: 0)
```

### 모바일 (< 768px)
```
1패널: [콘텐츠 100%]

사이드바: 드로어 오버레이
  position: fixed / left: 0 / top: 0 / bottom: 0
  width: 280px
  background: var(--color-bg-surface)
  z-index: 50
  열림 시 뒤에 overlay: rgba(0,0,0,0.6)
  transition: transform 250ms ease

우측 패널: 사이드바 토글로 교체 (바텀시트 아님 — 기능 유지)
  동일한 드로어 방식, right: 0

Header 토글 버튼: 둘 다 44px 보장
```

---

## 6. 마크다운 스타일 업데이트

```css
/* 폰트 패밀리 상속 */
.markdown-body {
  font-family: var(--font-family);
}

/* H1 — 구분선 유지 */
.markdown-body h1 {
  font-size: 1.625rem;  /* 26px */
  font-weight: 700;
  line-height: 1.3;
  margin: 1.5rem 0 0.75rem;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.5rem;
}

/* H2 */
.markdown-body h2 {
  font-size: 1.25rem;   /* 20px */
  font-weight: 600;
  line-height: 1.4;
  margin: 1.25rem 0 0.5rem;
  color: var(--color-text-primary);
}

/* H3 */
.markdown-body h3 {
  font-size: 1rem;      /* 16px */
  font-weight: 600;
  margin: 1rem 0 0.5rem;
  color: var(--color-text-primary);
}

/* 인라인 코드 */
.markdown-body code {
  background: var(--color-bg-elevated);
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-xs);
  font-size: 0.875em;
  color: var(--color-point-light);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

/* 코드 블록 */
.markdown-body pre {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1rem;
  margin: 0.75rem 0;
  overflow-x: auto;
}

/* 블록쿼트 */
.markdown-body blockquote {
  border-left: 2px solid var(--color-point);
  padding-left: 1rem;
  margin: 0.75rem 0;
  color: var(--color-text-secondary);
}

/* 테이블 */
.markdown-body th {
  background: var(--color-bg-elevated);
  font-weight: 600;
  font-size: 12px;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* 링크 */
.markdown-body a {
  color: var(--color-point-light);
  text-decoration: none;
}
.markdown-body a:hover {
  color: var(--color-point-light);
  text-decoration: underline;
  text-underline-offset: 3px;
}
```

---

## 7. 인터랙션 원칙

### Hover (CSS :hover 사용 — 인라인 JS 제거)
```css
/* 예시: 파일트리 항목 */
.tree-node:hover:not(.selected) {
  background: var(--color-bg-elevated);
}
.tree-node.selected {
  background: var(--color-point-subtle);
  border-left-color: var(--color-point);
}
```

### Transition
```
색상 변화: transition-colors / duration-150
크기·위치: transition-all / duration-200
폴더 chevron 회전: transition-transform / duration-150
사이드바 드로어: transition-transform / duration-250 / ease
```

### Focus (키보드 접근성)
```css
:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
```

---

## 8. 핸드오프 체크리스트 (Bart 확인용)

- [ ] Pretendard Variable CDN 로드 (layout.tsx `<head>`)
- [ ] globals.css 색상 토큰 전체 교체 (섹션 1)
- [ ] 이모지 아이콘 → lucide-react 전환 (섹션 3 매핑 기준)
- [ ] 모든 인터랙티브 요소 `min-h-[44px]` 적용
- [ ] Hover: `onMouseEnter/Leave` 인라인 JS → CSS `:hover` 클래스
- [ ] EmptyState 이모지 제거 → 텍스트만
- [ ] 반응형: 모바일 드로어, 태블릿 2패널 (섹션 5)
- [ ] 마크다운 스타일 업데이트 (섹션 6)
- [ ] `max-w-[720px] mx-auto` 콘텐츠 너비 제한
- [ ] Focus visible 링 추가 (섹션 7)
- [ ] 로딩 스피너 교체 (Loader2 아이콘)

---

## 9. 패키지 추가 필요

```bash
# lucide-react (이미 설치 확인 필요)
pnpm add lucide-react
```

> Pretendard는 CDN 사용 — 로컬 패키지 불필요
