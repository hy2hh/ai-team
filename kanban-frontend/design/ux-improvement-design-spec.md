# 칸반보드 UI/UX 전면 개선 — 디자인 스펙
> 작성일: 2026-03-31
> 작성자: Krusty (Designer)
> 대상: Bart (Frontend 구현), Homer (Backend — Phase 5)
> 상태: READY_FOR_IMPLEMENTATION

---

## 0. 디자인 시스템 현황 & 추가 토큰

### 기존 토큰 (`globals.css`) — 유지

배경 레이어: `--color-bg-base`, `--color-bg-surface`, `--color-bg-elevated`, `--color-bg-card`, `--color-bg-input`
테두리: `--color-border`, `--color-border-strong`
텍스트: `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`
액션: `--color-action-primary` (#4f7ef0), `--color-action-primary-hover`
상태: `--color-priority-high/medium/low`, `--color-progress-high/medium/low`
에이전트: `--color-agent-homer/bart/marge/lisa/krusty/sid`

### Phase 5용 신규 토큰 추가 (`globals.css`에 추가)

```css
/* 마감일 상태 */
--color-due-warning:        #fb923c;        /* 3일 이내 임박 */
--color-due-warning-bg:     rgba(251, 146, 60, 0.12);
--color-due-warning-border: rgba(251, 146, 60, 0.3);
--color-due-overdue:        #f87171;        /* 마감 초과 */
--color-due-overdue-bg:     rgba(248, 113, 113, 0.12);

/* 태그 */
--color-tag-bg:     rgba(79, 126, 240, 0.15);
--color-tag-text:   #6b95f5;
--color-tag-border: rgba(79, 126, 240, 0.3);
```

### 팔레트 제약 준수
- Primary 1종: `#4f7ef0` (기존 유지)
- Neutral 3종: `#080d17` / `#0d1526` / `#172039` (bg 레이어)
- Accent 2종: `#f87171` (위험/high) / `#4ade80` (완료/low)
- 추가 시맨틱 컬러(에이전트, 컬럼 accent)는 카테고리형 색상으로 팔레트 5색 제한 외 취급
- 폰트 2종 유지: Geist Sans (본문) + Geist Mono (코드/수치)

---

## 1. Phase 1 — 접근성 + 유틸리티 클래스

### globals.css 추가 유틸리티 클래스

```css
/* 모달 공통 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-bg-overlay);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 16px;
}

.modal-box {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-strong);
  border-radius: 14px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.modal-box--wide {
  max-width: 560px;
  max-height: 88vh;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  flex-shrink: 0;
  border-radius: 0 0 14px 14px;
}

/* 카드 공통 */
.card-base {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  position: relative;
  overflow: hidden;
}

.card-base:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border-color: var(--color-border-strong);
}

.card-base:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

/* 빈 상태 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 80px;
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  color: var(--color-text-muted);
  font-size: 12px;
}

/* 배지 공통 */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
}

/* 포커스 링 (포커스 트랩 공통) */
.focus-trap-container:focus {
  outline: none;
}

/* 로딩 스피너 */
.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-action-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 진행률 바 */
.progress-bar-track {
  height: 3px;
  background: var(--color-border);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* 토스트 */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  backdrop-filter: blur(8px);
  animation: toastIn 0.2s ease;
}

.toast--error {
  background: var(--color-due-overdue-bg);
  border: 1px solid var(--color-due-warning-border);
  color: var(--color-priority-high);
}

.toast--success {
  background: rgba(74, 222, 128, 0.12);
  border: 1px solid rgba(74, 222, 128, 0.3);
  color: var(--color-priority-low);
}

@keyframes toastIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* 필터 칩 */
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-chip:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
}

.filter-chip--active {
  border-color: var(--color-action-primary);
  background: rgba(79, 126, 240, 0.12);
  color: var(--color-action-primary);
}

/* 태그 pill */
.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: var(--color-tag-bg);
  color: var(--color-tag-text);
  border: 1px solid var(--color-tag-border);
}
```

### Board.tsx ARIA 스펙

```
컨테이너 wrapping div: role="main", aria-label="칸반 보드"
로딩 상태 div: role="status", aria-live="polite", aria-label="보드 불러오는 중"
에러 상태 div: role="alert", aria-live="assertive"
컬럼 목록 영역: role="list", aria-label="보드 컬럼 목록"
재시도 버튼: aria-label="보드 다시 불러오기"
```

### Column.tsx ARIA 스펙

```
컬럼 컨테이너: role="listitem", aria-label="{컬럼명} 컬럼, 카드 {n}개"
카드 목록 ul: role="list"
빈 상태: role="status", aria-label="{컬럼명} 컬럼이 비어 있습니다"
카드 추가 버튼: aria-label="{컬럼명}에 카드 추가"
WIP 초과 시: aria-disabled="true", aria-label="{컬럼명}에 카드 추가 (WIP 한도 초과)"
```

Empty State 컴포넌트 마크업:
```jsx
<div className="empty-state" role="status" aria-label={`${column.name} 컬럼이 비어 있습니다`}>
  <svg aria-hidden="true"><!-- 플러스 아이콘 --></svg>
  <span>카드를 추가해 보세요</span>
</div>
```

### Card.tsx ARIA 스펙

```
카드 루트: role="button", tabIndex={isDragging ? -1 : 0}
           aria-label="{제목}, {우선순위} 우선순위, 담당자 {담당자}, 진행률 {progress}%"
           aria-grabbed={isDragging}
           aria-roledescription="드래그 가능한 카드"
삭제 버튼: aria-label="{제목} 카드 삭제"
우선순위 뱃지: aria-label="우선순위: {높음|보통|낮음}"
```

키보드 이벤트:
```
Space: 드래그 시작/끝 토글
ArrowLeft/ArrowRight: 이전/다음 컬럼으로 이동
Enter: 카드 상세 열기
Delete/Backspace: 포커스 중인 카드 삭제 확인 다이얼로그
```

### AddCardModal.tsx ARIA 스펙

```
오버레이 div: role="presentation" (클릭 시 닫기)
모달 box: role="dialog"
           aria-modal="true"
           aria-labelledby="add-card-title"
           aria-describedby="add-card-desc"
제목 h2: id="add-card-title"
설명 p (선택적): id="add-card-desc"
닫기 버튼: aria-label="모달 닫기"
제목 input: aria-label="카드 제목" aria-required="true"
설명 textarea: aria-label="카드 설명 (선택)"
우선순위 버튼 그룹: role="radiogroup" aria-label="우선순위 선택"
우선순위 버튼: role="radio" aria-checked={selected} aria-label="{높음|보통|낮음}"
담당자 버튼 그룹: role="radiogroup" aria-label="담당자 선택"
담당자 버튼: role="radio" aria-checked={selected} aria-label="{homer|bart|...} 담당자 선택"
슬라이더: aria-label="진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow={value}
저장 버튼: aria-label="카드 저장"
```

### CardDetailModal.tsx 기존 ARIA — 유지 + 보강

기존 `role="dialog"`, `aria-modal`, `aria-labelledby` 유지.
추가:
```
모달 body scrollable div: aria-label="카드 상세 내용"
편집 모드 input: aria-label="카드 제목 편집"
편집 모드 textarea: aria-label="카드 설명 편집"
```

---

## 2. Phase 2 — CardDetailModal 편집 기능

### 편집 인터랙션 흐름

```
[읽기 모드]
제목 텍스트 → hover 시 연필 아이콘 표시 → 클릭 시 인라인 input 전환

[제목 편집 모드]
- input: background=var(--color-bg-input), border=var(--color-action-primary)
- 키: Enter → 저장 / Escape → 취소 / blur → 저장
- placeholder: "카드 제목을 입력하세요"
- focus-visible: outline 2px var(--color-focus-ring)

[설명 편집 모드]
- 설명 영역 클릭 → textarea 전환
- textarea 최소 높이: 80px, resize: vertical
- 하단에 저장/취소 버튼 표시
- 저장: var(--color-action-primary) 배경, 흰색 텍스트
- 취소: var(--color-action-secondary) 배경, var(--color-text-secondary) 텍스트
```

### 담당자 변경 드롭다운

```
트리거 버튼: 현재 담당자 아바타 + 이름 + 화살표 아이콘
드롭다운 컨테이너: background=var(--color-bg-surface)
                   border=var(--color-border-strong)
                   border-radius=10px
                   box-shadow=0 8px 24px rgba(0,0,0,0.4)
                   z-index=10
에이전트 아이템: padding=8px 12px, gap=10px
                 hover: background=var(--color-bg-elevated)
선택된 아이템: background=rgba(79,126,240,0.1), color=var(--color-action-primary)
아바타: width=28px, height=28px, border-radius=50%
        background=var(--color-agent-{name})
        font-size=11px, font-weight=600, color=white
```

### 진행률 슬라이더

```
range input 커스텀 스타일:
- track height: 4px, background=var(--color-border), border-radius=2px
- fill 효과: linear-gradient(to right, 색상 {progress}%, var(--color-border) {progress}%)
  - 0~30%: var(--color-progress-low) (#f87171)
  - 31~70%: var(--color-progress-medium) (#fbbf24)
  - 71~100%: var(--color-progress-high) (#4ade80)
- thumb: width=16px, height=16px, border-radius=50%
          background=var(--color-action-primary)
          border=2px solid var(--color-bg-elevated)
          cursor=pointer
step=10, min=0, max=100
수치 표시: font-size=13px, font-family=var(--font-mono), color=var(--color-text-secondary)
```

### 저장 중 상태 인디케이터

```
저장 버튼 로딩 상태:
- aria-busy="true", aria-label="저장 중"
- 버튼 내 텍스트를 스피너(14px)로 교체
- disabled=true, opacity=0.7, cursor=not-allowed

저장 성공 피드백:
- .toast--success 클래스 사용
- 내용: "✓ 저장되었습니다"
- 2000ms 후 자동 사라짐

저장 실패 피드백:
- .toast--error 클래스 사용
- 내용: "저장에 실패했습니다. 다시 시도해 주세요."
- 편집 상태 유지, 낙관적 업데이트 롤백
```

---

## 3. Phase 3 — 반응형 레이아웃

### 브레이크포인트 정의

```
모바일:  ~479px   (단일 컬럼, 세로 스크롤)
태블릿:  480–767px (다중 컬럼 wrap, 수평 스크롤 유지)
데스크탑: 768px+  (현행 레이아웃)
```

### Board.tsx 반응형

```css
/* globals.css에 추가 */
.board-container {
  display: flex;
  gap: 16px;
  padding: 20px;
  overflow-x: auto;
  min-height: calc(100vh - 64px); /* 헤더 높이 제외 */
  align-items: flex-start;
}

@media (max-width: 479px) {
  .board-container {
    flex-direction: column;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 12px;
    gap: 12px;
  }
}
```

### Column.tsx 반응형

```css
.column-container {
  width: 288px;
  flex-shrink: 0;
  /* ... 기존 스타일 ... */
}

@media (max-width: 767px) {
  .column-container {
    width: 240px;
  }
}

@media (max-width: 479px) {
  .column-container {
    width: 100%;
    flex-shrink: 1;
  }
}
```

### CardDetailModal 모바일 Bottom Sheet

```css
/* 기존 모달은 데스크탑/태블릿에서 center 정렬 유지 */
/* 모바일에서만 bottom sheet로 전환 */

@media (max-width: 479px) {
  .modal-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .modal-box--wide {
    max-width: 100%;
    width: 100%;
    max-height: 92vh;
    border-radius: 20px 20px 0 0;
    border-bottom: none;
    /* 슬라이드업 애니메이션 */
    animation: slideUp 0.25s ease;
  }

  @keyframes slideUp {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }
}
```

Bottom sheet 드래그 핸들:
```jsx
/* 모바일에서만 표시되는 상단 핸들 */
<div
  className="drag-handle"
  aria-hidden="true"
  style={{
    width: 40,
    height: 4,
    borderRadius: 2,
    background: 'var(--color-border-strong)',
    margin: '10px auto 0',
    flexShrink: 0,
  }}
/>
```

### AddCardModal 모바일 풀스크린

```css
@media (max-width: 479px) {
  .modal-overlay {
    padding: 0;
    align-items: flex-end;
  }

  .modal-box {
    max-width: 100%;
    width: 100%;
    border-radius: 20px 20px 0 0;
    max-height: 90vh;
    animation: slideUp 0.25s ease;
  }
}
```

---

## 4. Phase 4 — 필터 기능

### 필터 바 컴포넌트 (`FilterBar.tsx` 신규)

위치: 보드 헤더 하단, 컬럼 목록 상단

```jsx
/* 레이아웃 */
<div
  role="toolbar"
  aria-label="카드 필터"
  className="filter-bar"
>
  {/* 담당자 필터 */}
  <div role="group" aria-label="담당자로 필터">
    {AGENTS.map(agent => (
      <button
        key={agent}
        className={`agent-filter-btn ${activeAssignees.includes(agent) ? 'active' : ''}`}
        role="checkbox"
        aria-checked={activeAssignees.includes(agent)}
        aria-label={`${agent} 담당자 필터 ${activeAssignees.includes(agent) ? '해제' : '적용'}`}
        onClick={() => toggleAssignee(agent)}
      >
        <span className="agent-avatar">{agent[0].toUpperCase()}</span>
      </button>
    ))}
  </div>

  {/* 우선순위 필터 */}
  <div role="group" aria-label="우선순위로 필터">
    {['high', 'medium', 'low'].map(priority => (
      <button
        key={priority}
        className={`filter-chip ${activePriorities.includes(priority) ? 'filter-chip--active' : ''}`}
        role="checkbox"
        aria-checked={activePriorities.includes(priority)}
        onClick={() => togglePriority(priority)}
      >
        <span className="priority-dot" />
        {PRIORITY_LABEL[priority]}
      </button>
    ))}
  </div>

  {/* 필터 초기화 */}
  {hasActiveFilters && (
    <button
      className="filter-clear-btn"
      aria-label="모든 필터 초기화"
      onClick={clearFilters}
    >
      ✕ 초기화
    </button>
  )}
</div>
```

### filter-bar CSS

```css
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.agent-filter-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s;
  padding: 0;
  background: none;
}

.agent-filter-btn .agent-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: white;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.agent-filter-btn.active .agent-avatar {
  opacity: 1;
}

.agent-filter-btn.active {
  border-color: var(--color-action-primary);
}

.filter-clear-btn {
  font-size: 12px;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: color 0.15s;
}

.filter-clear-btn:hover {
  color: var(--color-text-primary);
}
```

### 필터 적용 시 카드 시각 효과

```css
.card-base--filtered-out {
  opacity: 0.25;
  pointer-events: none; /* 드래그 비활성화 */
  filter: grayscale(0.5);
  transition: opacity 0.2s, filter 0.2s;
}

.card-base--filtered-in {
  opacity: 1;
  ring: 1px solid var(--color-action-primary); /* 선택된 카드 강조 선택적 */
}
```

### 필터 후 빈 상태

필터 적용 시 컬럼에 매칭 카드 없는 경우:
```jsx
<div className="empty-state" role="status" aria-live="polite">
  <svg aria-hidden="true"><!-- 필터 아이콘 --></svg>
  <span>해당 조건의 카드가 없습니다</span>
  <button onClick={clearFilters} aria-label="필터 초기화">필터 초기화</button>
</div>
```

---

## 5. Phase 5 — 마감일 & 태그 (Backend 협업 필요)

### Backend 요구사항 (Homer 담당)

DB 스키마 변경:
```sql
ALTER TABLE cards
  ADD COLUMN due_date DATE NULL,
  ADD COLUMN tags     TEXT NULL;  -- JSON 배열 문자열: '["태그1","태그2"]'
```

API 응답 확장 (GET /boards/:id, GET /cards/:id):
```json
{
  "id": 1,
  "title": "카드 제목",
  "due_date": "2026-04-03",   // null 허용
  "tags": ["기획", "v2.0"],   // null 허용
  ...
}
```

PATCH /cards/:id 요청 본문 수용:
```json
{
  "due_date": "2026-04-03",
  "tags": ["기획"]
}
```

### types.ts 변경

```typescript
interface Card {
  // ... 기존 필드 ...
  due_date?: string | null;   // ISO date string "YYYY-MM-DD"
  tags?: string[] | null;
}
```

### Card.tsx — 마감일 뱃지

```
마감일 표시 위치: 카드 하단 메타 행 (담당자 아바타 오른쪽)

마감 상태 판별:
- 정상 (7일 이상): 표시 안 함
- 임박 (1~3일 이내): .badge 에 .badge--warning 클래스
  - background: var(--color-due-warning-bg)
  - color: var(--color-due-warning)
  - border: 1px solid var(--color-due-warning-border)
  - 아이콘: ⏰ (aria-hidden)
  - 텍스트: "3일 후", "2일 후", "내일"
- 오늘 마감: "오늘 마감" — .badge--warning 동일 스타일 + bold
- 초과: "지연됨" — .badge--overdue
  - background: var(--color-due-overdue-bg)
  - color: var(--color-due-overdue) (#f87171)
  - border: 1px solid rgba(248,113,113,0.3)
```

```css
.badge--warning {
  background: var(--color-due-warning-bg);
  color: var(--color-due-warning);
  border: 1px solid var(--color-due-warning-border);
}

.badge--overdue {
  background: var(--color-due-overdue-bg);
  color: var(--color-due-overdue);
  border: 1px solid rgba(248, 113, 113, 0.3);
}
```

마감일 접근성:
```jsx
<span
  className={`badge ${dueBadgeClass}`}
  role="status"
  aria-label={`마감일: ${dueDateLabel}`}
>
  <span aria-hidden="true">⏰</span>
  {dueDateLabel}
</span>
```

### CardDetailModal.tsx — 마감일 날짜 입력

```
레이아웃: 기존 메타 섹션 내 "마감일" 행 추가
편집 모드 진입: 날짜 텍스트 클릭

날짜 input 스타일:
- type="date"
- background: var(--color-bg-input)
- border: 1px solid var(--color-border)
- border-radius: 6px
- padding: 4px 8px
- color: var(--color-text-primary)
- font-size: 13px
- color-scheme: dark (다크 모드 네이티브 달력)
- 선택 시: border-color var(--color-action-primary)

aria: aria-label="마감일 날짜 선택"
없음 표시: "마감일 없음" (색상: var(--color-text-muted))
```

### CardDetailModal.tsx — 태그 입력 UI

```
레이아웃: 설명 섹션 아래 "태그" 섹션 추가

현재 태그: .tag-pill 컴포넌트로 표시
           각 pill 오른쪽에 × 버튼 (aria-label="'{태그}' 태그 제거")

새 태그 입력:
- input type="text", placeholder="태그 입력 후 Enter"
- 폭: 120px → 타이핑 시 확장 (auto-grow)
- background: transparent
- border: none, border-bottom: 1px solid var(--color-border)
- 포커스 시 border-bottom-color: var(--color-action-primary)
- Enter 키 → 태그 추가 (공백 trim, 중복 무시, 빈 값 무시)
- 태그 최대 10개 제한 (초과 시 input 비활성화 + aria-label="태그 최대 개수 초과")

태그 섹션 전체 role="group" aria-label="카드 태그"
```

태그 섹션 마크업 구조:
```jsx
<section aria-label="태그">
  <h3 className="section-label">태그</h3>
  <div className="tags-container" role="group" aria-label="카드 태그 목록">
    {tags.map(tag => (
      <span key={tag} className="tag-pill">
        {tag}
        <button aria-label={`'${tag}' 태그 제거`} onClick={() => removeTag(tag)}>×</button>
      </span>
    ))}
    <input
      type="text"
      placeholder="태그 입력 후 Enter"
      aria-label="새 태그 추가"
      aria-disabled={tags.length >= 10}
      onKeyDown={handleTagInput}
    />
  </div>
</section>
```

---

## 6. 컴포넌트별 인라인 스타일 → CSS 토큰 교체 매핑

### Board.tsx

| 기존 인라인 | 교체 방법 |
|---|---|
| `display: flex, flexDirection: column, ...` | `.loading-center` 유틸리티 클래스 |
| `@keyframes rotate` (인라인) | `globals.css`의 `.loading-spinner` |
| `position: fixed, bottom: 20px, right: 20px` (드래그 토스트) | `.toast.toast--error` 클래스 |
| `display: flex, overflowX: auto` (메인 컨테이너) | `.board-container` 클래스 |

추가할 유틸리티:
```css
.loading-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 16px;
}
```

### Column.tsx

| 기존 인라인 | 교체 방법 |
|---|---|
| `width: 288px, flexShrink: 0` | `.column-container` 클래스 |
| `background: isOver ? rgba(79...) : ...` | CSS 변수 + data 속성 |
| 상단 accent 바 `height: 3px, linear-gradient` | `.column-accent-bar` 클래스 |
| WIP 뱃지 조건부 스타일 | `.badge.badge--wip` / `.badge.badge--wip-exceeded` |
| 빈 상태 div | `.empty-state` 클래스 |

```css
.column-container {
  width: 288px;
  flex-shrink: 0;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  transition: background 0.15s, border-color 0.15s;
}

.column-container[data-drag-over="true"] {
  background: color-mix(in srgb, var(--color-drag-over) 8%, var(--color-bg-surface));
  border-color: var(--color-drag-over);
}

.column-accent-bar {
  height: 3px;
  border-radius: 12px 12px 0 0;
  flex-shrink: 0;
}

.badge--wip {
  background: rgba(79, 126, 240, 0.1);
  color: var(--color-action-primary);
}

.badge--wip-exceeded {
  background: var(--color-due-overdue-bg);
  color: var(--color-priority-high);
}
```

### Card.tsx

| 기존 인라인 | 교체 방법 |
|---|---|
| 카드 컨테이너 전체 스타일 | `.card-base` 클래스 |
| `opacity: isDragging ? 0.4 : 1` | `data-dragging` 속성 |
| 우선순위 왼쪽 바 절대 위치 | `.card-priority-bar` 클래스 |
| hover 시 동적 style | CSS `:hover` (card-base에 포함) |
| 진행률 바 | `.progress-bar-track > .progress-bar-fill` |

```css
.card-base[data-dragging="true"] {
  opacity: 0.4;
}

.card-priority-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 10px 0 0 10px;
}
```

우선순위 바 색상은 `style` 속성에서 CSS 변수로만:
```jsx
// 기존: style={{ background: PRIORITY_CONFIG[priority].color }}
// 변경: style={{ background: `var(--color-priority-${priority})` }}
```

---

## 7. 모바일(375px) 검증 체크리스트

- [ ] 보드: 단일 컬럼, 세로 스크롤, 가로 오버플로 없음
- [ ] 카드: 풀 너비, 텍스트 잘림 없음
- [ ] CardDetailModal: bottom sheet 슬라이드업, 닫기 버튼 접근 가능
- [ ] AddCardModal: bottom sheet 또는 풀스크린, 키보드 올라올 때 모달 내용 스크롤 가능
- [ ] 필터 바: flex-wrap 적용, 가로 스크롤 없음
- [ ] 태그 pill: 줄바꿈 처리 (`flex-wrap: wrap`)

---

## 8. 접근성 최종 검증 기준

- [ ] 모든 버튼/링크: 시각적 레이블 또는 aria-label
- [ ] 모달: role="dialog", aria-modal, aria-labelledby, ESC 닫기, 포커스 트랩
- [ ] 색상만으로 구분하는 요소 없음 (우선순위 = 색상 + 텍스트/아이콘)
- [ ] 진행률 바: role="progressbar", aria-valuenow/min/max
- [ ] 드래그 카드: aria-grabbed, 키보드 이동 지원
- [ ] 필터 상태: aria-checked, aria-live 영역
- [ ] 마감일 뱃지: role="status", aria-label
- [ ] 태그: 제거 버튼 aria-label 포함
- [ ] 명도 대비 4.5:1 이상 (기존 팔레트 유지로 보장)

---

> 이 스펙에 명시된 CSS 클래스/토큰/ARIA 속성을 그대로 구현하면 됩니다.
> 스펙 외 시각 결정이 필요하면 이 파일에 추가 후 구현을 시작하세요.
