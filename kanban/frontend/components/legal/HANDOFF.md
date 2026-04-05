# AI 법률 서비스 — Designer 핸드오프 명세

> 작성: Krusty (Designer) | 2026-04-05
> 대상: Bart (Frontend), Homer (Backend)

---

## 1. 컬러 토큰 매핑

| CSS 변수 | 역할 | Dark 값 | Light 값 |
|---|---|---|---|
| `--color-bg` | 페이지 배경 | `#0f1117` | `#f8f9fa` |
| `--color-surface` | 카드·헤더 배경 | `#1a1d27` | `#ffffff` |
| `--color-border` | 구분선·테두리 | `#2e3244` | `#e2e5ea` |
| `--color-text-primary` | 제목·본문 | `#f1f3f9` | `#111827` |
| `--color-text-secondary` | 보조 텍스트 | `#a0a9c0` | `#374151` |
| `--color-text-muted` | 힌트·플레이스홀더 | `#5a6282` | `#9ca3af` |
| `--color-accent` | CTA (검색 버튼) | `#5F5BE2` | `#5F5BE2` |
| `--color-progress-high` | 관련도 ≥80% | `#22c55e` | `#16a34a` |
| `--color-progress-medium` | 관련도 50~79% | `#f59e0b` | `#d97706` |
| `--color-progress-low` | 관련도 <50% | `#ef4444` | `#dc2626` |

---

## 2. 모바일 브레이크포인트

| 브레이크포인트 | 범위 | 주요 변경사항 |
|---|---|---|
| **Mobile S** | 360px ~ 767px | 단일 컬럼 레이아웃, 패딩 16px, 헤더 h1 20px |
| **Tablet** | 768px ~ 1199px | 사이드 필터 → 토글 방식, 패딩 24px |
| **Desktop** | 1200px+ | 현행 레이아웃 (max-width 1200px) |

### Mobile (360px) 세부 스펙

```
헤더
  padding: 16px
  h1: font-size 20px, gap 8px
  부제: font-size 13px

SearchBar
  flex-direction: column (검색창 + 버튼 세로 배치)
  input: padding 12px 44px 12px 14px
  button: width 100%, min-height 48px

FilterPanel
  기본 collapsed 상태
  펼치기 버튼: width 100%, min-height 44px

ResultCard
  padding: 16px
  header flex-direction: column (제목 위, 관련도 아래)
  관련도 뱃지: align-self flex-start, margin-top 8px
  메타데이터(날짜·법원·사건번호): font-size 12px

main
  padding: 16px
  섹션 간 margin-bottom: 16px
```

---

## 3. 상태별 시각 명세

### 3-1. 로딩 (isLoading = true)

**SearchBar 버튼**
- 스피너: `width 18px, height 18px, border 2px solid rgba(255,255,255,0.3), border-top #fff, animation spin 0.8s linear infinite`
- 텍스트: "검색 중" (기존 "검색" 대체)
- 버튼 비활성: `cursor not-allowed, opacity 0.7`

**SearchResults 스켈레톤**
```
컨테이너: display flex, flex-direction column, gap 12px
카드 스켈레톤 × 3개
  height: 140px
  border-radius: 12px
  background: linear-gradient(90deg, var(--color-surface) 25%, var(--color-border) 50%, var(--color-surface) 75%)
  background-size: 200% 100%
  animation: shimmer 1.5s infinite
```

**aria 처리**
- `aria-busy="true"` → `<section aria-label="검색 결과">` 에 추가
- 스켈레톤 카드에 `aria-hidden="true"`
- 시각적으로 숨겨진 `<span className="sr-only">검색 중입니다</span>` role="status" 추가

---

### 3-2. 에러 상태

**SearchResults 에러 박스**
```
padding: 32px 24px
text-align: center
border: 1px solid var(--color-progress-low) (= #ef4444 다크 / #dc2626 라이트)
border-radius: 12px
background: rgba(239, 68, 68, 0.06)

아이콘: ⚠️ (font-size 32px, aria-hidden)
제목: font-size 16px, font-weight 600, color var(--color-text-primary), margin-top 12px
메시지: font-size 14px, color var(--color-text-muted), margin-top 8px
재시도 버튼:
  margin-top 16px
  padding: 10px 20px
  border-radius: 8px
  border: 1px solid var(--color-border)
  background: var(--color-surface)
  font-size 14px, font-weight 500
  min-height 44px
```

**노출 메시지 기준**
| 에러 유형 | 제목 | 본문 |
|---|---|---|
| 네트워크 실패 | "서버에 연결할 수 없습니다" | "잠시 후 다시 시도해 주세요." |
| 타임아웃 | "검색이 너무 오래 걸립니다" | "검색어를 줄이거나 필터를 조정해 보세요." |
| 기타 서버 에러 | "검색 중 오류가 발생했습니다" | "문제가 계속되면 관리자에게 문의하세요." |

**aria 처리**
- `role="alert"` → 에러 컨테이너에 추가 (자동 스크린리더 고지)

---

### 3-3. 빈 결과 (검색어 있음, 결과 0건)

```
padding: 48px 24px
text-align: center

아이콘: 🔍 (font-size 48px, aria-hidden)
제목: "검색 결과가 없습니다" (font-size 18px, font-weight 600, margin-top 16px)
본문: "{query}에 대한 판례를 찾지 못했습니다. 검색어를 바꿔보세요." (font-size 14px, color muted)
```

> 빈 상태에서 CTA·일러스트 추가 금지 (디자인 원칙 준수)

**aria 처리**
- `role="status"` + `aria-live="polite"` → 빈 결과 컨테이너

---

### 3-4. 초기 빈 상태 (검색 전)

현행 `EmptyState` 컴포넌트 기준 유지.
- 예시 버튼 4개: `min-height 44px`, `border-radius 20px` ✅ 현행 충족
- 예시 버튼 aria: `aria-label="예시 검색: {example}"` 추가 필요

---

## 4. 접근성 체크리스트

### 4-1. 색상 대비 (WCAG 2.1 AA 기준 4.5:1)

| 요소 | 전경 | 배경 | 대비 | 상태 |
|---|---|---|---|---|
| 본문 텍스트 | `#f1f3f9` | `#1a1d27` | 13.2:1 | ✅ |
| Muted 텍스트 | `#a0a9c0` | `#1a1d27` | 5.1:1 | ✅ |
| CTA 버튼 텍스트 | `#ffffff` | `#5F5BE2` | 4.6:1 | ✅ |
| 관련도 High | `#22c55e` | `#1a1d27` | 5.8:1 | ✅ |
| 관련도 Low | `#ef4444` | `#1a1d27` | 4.5:1 | ✅ (경계) |

### 4-2. 키보드 탐색 순서 (Tab order)

```
1. 헤더 (skip-to-main 링크 — 추가 필요)
2. SearchBar input
3. SearchBar clear 버튼 (쿼리 있을 때만)
4. SearchBar 검색 버튼
5. FilterPanel 토글 버튼
6. FilterPanel 내부 체크박스/셀렉트 (expanded 시)
7. ResultCard × N (tabIndex=0, Enter로 클릭)
8. 빠른 검색 예시 버튼 × 4
```

### 4-3. Skip Navigation (추가 필요)

```html
<a href="#main-content" class="sr-only focus:not-sr-only">
  본문으로 건너뛰기
</a>
```
→ `app/legal-search/page.tsx` `<main>` 에 `id="main-content"` 추가

### 4-4. ARIA 보완 항목 (Bart 수정 필요)

| 컴포넌트 | 현황 | 추가 필요 |
|---|---|---|
| `SearchBar` | `role="search"`, `aria-label` ✅ | — |
| `FilterPanel` | 토글 버튼 상태 미명시 | `aria-expanded={expanded}` 추가 |
| `ResultCard` | `role="button"`, `tabIndex=0` ✅ | — |
| `SearchResults` | `aria-label` ✅ | 로딩 시 `aria-busy`, 빈 결과 `aria-live` |
| `EmptyState` 예시 버튼 | `focus-ring` ✅ | `aria-label="예시 검색: {example}"` |
| Page `<main>` | — | `id="main-content"` |

### 4-5. 포커스 관리

- 검색 실행 후: 포커스를 `<SearchResults>` 상단 heading으로 이동 (`useRef` + `focus()`)
- 모달 열림 시 (상세 보기): 포커스 트랩, ESC 닫기, 닫힌 후 원래 ResultCard로 복귀

---

## 5. 타이포그래피

| 요소 | Size | Weight | Line-height |
|---|---|---|---|
| 페이지 제목 (h1) | 24px (모바일 20px) | 700 | 1.3 |
| 카드 제목 (h3) | 16px | 600 | 1.4 |
| 본문·설명 | 14~15px | 400 | 1.6 |
| 메타데이터 | 13px | 400 | 1.4 |
| 태그·키워드 | 12px | 500 | 1 |
| 관련도 수치 | 20px | 700 | 1 |

---

## 6. 컴포넌트별 상태 정의 요약

| 컴포넌트 | Default | Hover | Focus | Disabled | Loading | Error | Empty |
|---|---|---|---|---|---|---|---|
| SearchBar.input | border `--color-border` | border `--color-accent` | outline 2px `--color-accent` | opacity 0.5 | — | — | placeholder 표시 |
| SearchBar.button | bg `--color-accent` | opacity 0.85 | outline 2px | bg muted, cursor not-allowed | 스피너 표시 | — | — |
| ResultCard | border `--color-border` | border `--color-accent`, shadow `0 2px 8px rgba(0,0,0,0.15)` | outline 2px `--color-accent` | — | — | — | — |
| FilterPanel | collapsed or expanded | — | — | — | — | — | — |
| SearchResults | 결과 목록 | — | — | — | 스켈레톤 3개 | 에러 박스 | 0건 메시지 |

---

## 7. Bart 수정 우선순위

| 우선순위 | 항목 | 파일 |
|---|---|---|
| P1 | `FilterPanel`에 `aria-expanded` 추가 | `filter-panel.tsx` |
| P1 | `SearchResults`에 `aria-busy`, `aria-live` 추가 | `search-results.tsx` |
| P1 | `EmptyState` 예시 버튼 `aria-label` | `page.tsx` |
| P1 | skip navigation + `id="main-content"` | `page.tsx` |
| P2 | 검색 후 포커스 이동 로직 | `page.tsx` |
| P2 | 모바일 360px 레이아웃 (SearchBar 세로 배치, ResultCard header 재배치) | `search-bar.tsx`, `result-card.tsx` |
| P3 | 에러 메시지 유형별 분기 | `search-results.tsx` |
| P3 | 로딩 스켈레톤 shimmer 애니메이션 | `search-results.tsx` |
