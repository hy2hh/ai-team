# 카드 상세 보기 모달 디자인 스펙

> **작성자**: Krusty (Designer)
> **작성일**: 2026-03-29
> **대상**: Frontend 구현팀 (Bart)

---

## 1. 컴포넌트 구조

```
CardDetailModal
├── Overlay (fixed 전체화면)
└── ModalContainer (중앙 카드)
    ├── ModalHeader
    │   ├── CardTitle (편집 가능 h2)
    │   └── CloseButton (× 아이콘)
    ├── ModalBody (스크롤 영역)
    │   ├── MetaRow
    │   │   ├── AssigneeSection (아바타 + 이름)
    │   │   └── DateSection (생성일 / 마감일)
    │   ├── ProgressSection
    │   │   ├── ProgressLabel (진행률 % + 상태)
    │   │   └── ProgressBar
    │   ├── TagSection (라벨/태그 목록)
    │   ├── DescriptionSection (textarea)
    │   └── ActivitySection
    │       ├── ActivityHeader
    │       └── ActivityList (댓글 및 로그)
    └── ModalFooter
        ├── PriorityBadge
        └── ActionButtons (저장 + 닫기)
```

---

## 2. 레이아웃 스펙

### Overlay
- `position: fixed`
- `inset: 0`
- `background: var(--color-bg-overlay)` → `rgba(0,0,0,0.4)` / 다크: `rgba(0,0,0,0.6)`
- `z-index: 50`
- `display: flex; align-items: center; justify-content: center`
- 클릭 시 모달 닫힘

### ModalContainer
- `background: var(--color-bg-surface)`
- `border: 1px solid var(--color-border)`
- `border-radius: 16px` (rounded-2xl)
- `box-shadow: 0 20px 60px rgba(0,0,0,0.3)`
- `width: 560px` (max-w-xl)
- `max-height: 85vh`
- `display: flex; flex-direction: column`
- `overflow: hidden`
- 진입 애니메이션: `scale(0.95) → scale(1)` + `opacity 0 → 1`, `duration: 200ms ease-out`

### ModalHeader
- `padding: 20px 24px 16px`
- `display: flex; align-items: flex-start; justify-content: space-between; gap: 12px`
- `border-bottom: 1px solid var(--color-border)`

### ModalBody
- `padding: 20px 24px`
- `overflow-y: auto`
- `flex: 1`
- `display: flex; flex-direction: column; gap: 20px`

### ModalFooter
- `padding: 16px 24px`
- `border-top: 1px solid var(--color-border)`
- `display: flex; align-items: center; justify-content: space-between`

---

## 3. 개별 섹션 상세 스펙

### 3-1. ModalHeader — 카드 제목

**CardTitle**
- `font-size: 18px; font-weight: 600; line-height: 1.4`
- `color: var(--color-text-primary)`
- `flex: 1`

**CloseButton**
- `width: 32px; height: 32px`
- `border-radius: 8px` (rounded-lg)
- `background: transparent`
- `color: var(--color-text-muted)`
- `hover: background var(--color-bg-card), color var(--color-text-primary)`
- `transition: colors 150ms`
- `aria-label: "모달 닫기"`
- 아이콘: `×` 또는 XMarkIcon (24px)

---

### 3-2. AssigneeSection — 담당자

**레이아웃**
- `display: flex; align-items: center; gap: 10px`

**Avatar**
- `width: 36px; height: 36px`
- `border-radius: 50%`
- `background: var(--color-agent-{name})` (아래 에이전트 색상 참조)
- `display: flex; align-items: center; justify-content: center`
- `font-size: 14px; font-weight: 700; color: #ffffff`
- `border: 2px solid var(--color-bg-surface)` (배경과 구분)
- 이니셜 표시: assignee 이름의 첫 글자 대문자

**에이전트 색상 매핑 (globals.css 토큰)**
- homer → `#3b82f6` (Blue 500)
- bart → `#06b6d4` (Cyan 500)
- marge → `#a855f7` (Purple 500)
- lisa → `#22c55e` (Green 500)
- krusty → `#f97316` (Orange 500)
- sid → `#ec4899` (Pink 500)
- 미배정 → `var(--color-border-strong)` 배경 + 👤 아이콘

**AssigneeName**
- `font-size: 14px; font-weight: 500`
- `color: var(--color-text-primary)`

---

### 3-3. DateSection — 날짜 정보

**레이아웃**
- `display: flex; gap: 16px`

**DateItem**
- `display: flex; flex-direction: column; gap: 2px`

**DateLabel**
- `font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em`
- `color: var(--color-text-muted)`

**DateValue**
- `font-size: 13px; font-weight: 500`
- `color: var(--color-text-secondary)`
- 포맷: `YYYY.MM.DD` (예: 2026.03.29)
- 마감일이 오늘 이전이면: `color: var(--color-priority-high)` (#ef4444)
- 마감일이 3일 이내이면: `color: var(--color-priority-medium)` (#eab308)

---

### 3-4. ProgressSection — 진행률 바

**ProgressHeader**
- `display: flex; justify-content: space-between; align-items: center`
- `margin-bottom: 8px`

**ProgressLabel**
- `font-size: 13px; font-weight: 500`
- `color: var(--color-text-secondary)`
- 텍스트: "진행률"

**ProgressValue**
- `font-size: 13px; font-weight: 700`
- 색상 동적 적용:
  - 67% 이상 → `#22c55e` (Green)
  - 34–66% → `#eab308` (Yellow)
  - 33% 이하 → `#ef4444` (Red)
- 텍스트: `"75%"` 형식

**ProgressTrack (배경)**
- `height: 8px`
- `border-radius: 4px`
- `background: var(--color-border-strong)`
- `overflow: hidden`

**ProgressFill (채움)**
- `height: 100%`
- `border-radius: 4px`
- `transition: width 400ms ease-out`
- 색상:
  - 67% 이상 → `background: #22c55e`
  - 34–66% → `background: #eab308`
  - 33% 이하 → `background: #ef4444`

---

### 3-5. TagSection — 태그/라벨

> Card 타입에 `tags` 필드가 없으므로 추후 백엔드 확장 고려. 현재는 `priority`를 라벨로 표시.

**레이아웃**
- `display: flex; flex-wrap: wrap; gap: 6px`

**Tag (PriorityBadge)**
- `padding: 4px 10px`
- `border-radius: 999px` (pill)
- `font-size: 12px; font-weight: 600`
- `display: inline-flex; align-items: center; gap: 4px`
- 스타일 (배경/텍스트):
  - high → `background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.3)`
  - medium → `background: rgba(234,179,8,0.12); color: #ca8a04; border: 1px solid rgba(234,179,8,0.3)` (다크: `#eab308`)
  - low → `background: rgba(34,197,94,0.12); color: #16a34a; border: 1px solid rgba(34,197,94,0.3)` (다크: `#22c55e`)
- 우선순위 아이콘 (컬러 도트 4px):
  - high → `●` red
  - medium → `●` yellow
  - low → `●` green

---

### 3-6. DescriptionSection — 설명

**SectionLabel**
- `font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em`
- `color: var(--color-text-muted)`
- `margin-bottom: 8px`
- 텍스트: "설명"

**DescriptionText (읽기 모드)**
- `font-size: 14px; line-height: 1.6`
- `color: var(--color-text-secondary)`
- `background: var(--color-bg-elevated)`
- `border-radius: 8px`
- `padding: 12px`
- 내용 없을 때: `color: var(--color-text-muted); font-style: italic` + "설명이 없습니다." 표시

---

### 3-7. ActivitySection — 활동 로그

**SectionLabel**
- 동일 SectionLabel 스타일, 텍스트: "활동"

**ActivityList**
- `display: flex; flex-direction: column; gap: 12px`
- `max-height: 200px; overflow-y: auto`

**ActivityItem**
- `display: flex; gap: 10px; align-items: flex-start`

**ActivityAvatar** (소형)
- `width: 28px; height: 28px; border-radius: 50%`
- 동일 에이전트 색상 적용
- `font-size: 11px; font-weight: 700; color: #fff`
- `flex-shrink: 0`

**ActivityContent**
- `flex: 1`

**ActivityMeta**
- `display: flex; gap: 6px; align-items: baseline`
- 이름: `font-size: 13px; font-weight: 600; color: var(--color-text-primary)`
- 시간: `font-size: 11px; color: var(--color-text-muted)`

**ActivityText**
- `font-size: 13px; line-height: 1.5`
- `color: var(--color-text-secondary)`

**활동 유형 아이콘 (prefix)**
- 카드 이동 → 🔀 `컬럼 이동`
- 진행률 변경 → 📊 `진행률 업데이트`
- 담당자 변경 → 👤 `담당자 변경`
- 생성 → ✨ `카드 생성`

**빈 상태**
- `font-size: 13px; color: var(--color-text-muted); font-style: italic; padding: 12px 0`
- 텍스트: "아직 활동 기록이 없습니다."

---

### 3-8. ModalFooter

**좌측 — 컬럼 위치 표시**
- `font-size: 12px; color: var(--color-text-muted)`
- 텍스트: `"📋 {columnName}"` (현재 속한 컬럼)

**우측 — ActionButtons**
- `display: flex; gap: 8px`

**CloseButton (Secondary)**
- `padding: 8px 16px`
- `border-radius: 8px`
- `background: var(--color-action-secondary)`
- `color: var(--color-text-primary)`
- `font-size: 14px; font-weight: 500`
- `hover: background var(--color-action-secondary-hover)`
- `transition: colors 150ms`
- 텍스트: "닫기"

---

## 4. 반응형 동작

### 데스크탑 (768px 이상)
- `width: 560px; max-height: 85vh`

### 태블릿 (480–767px)
- `width: calc(100vw - 48px)`
- `max-height: 90vh`

### 모바일 (480px 미만)
- `width: 100vw`
- `max-height: 100dvh`
- `border-radius: 16px 16px 0 0` (하단 시트 스타일)
- `position: fixed; bottom: 0; left: 0; right: 0`
- 진입 애니메이션: `translateY(100%) → translateY(0)`

---

## 5. 접근성 (WCAG AA)

- `role="dialog"; aria-modal="true"; aria-labelledby="modal-title"`
- ESC 키로 모달 닫기
- 모달 오픈 시 닫기 버튼으로 포커스 이동
- 모달 닫힘 시 트리거 버튼으로 포커스 복귀
- 포커스 트랩: Tab 키가 모달 내부에서만 순환
- `aria-label` 적용: CloseButton, ProgressBar (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`)

---

## 6. 색상 체크리스트 (WCAG AA 4.5:1)

- 제목 (`#0f172a` on `#ffffff`) → ✅ 21:1
- 보조텍스트 (`#475569` on `#ffffff`) → ✅ 5.9:1
- 약한텍스트 (`#94a3b8` on `#ffffff`) → ⚠️ 2.8:1 (장식용으로만 사용)
- 다크 제목 (`#f8fafc` on `#1e293b`) → ✅ 14.5:1
- 다크 보조 (`#94a3b8` on `#1e293b`) → ✅ 4.6:1

---

## 7. TypeScript 인터페이스 확장 제안

```typescript
// 기존 Card 인터페이스에 추가 (백엔드 협의 필요)
export interface CardActivity {
  id: number;
  card_id: number;
  agent: string;
  action: 'created' | 'moved' | 'progress_updated' | 'assignee_changed' | 'commented';
  detail: string;
  created_at: string;
}

export interface CardDetail extends Card {
  column_name: string;      // 현재 컬럼 이름
  due_date: string | null;  // 마감일 (현재 미구현)
  tags: string[];           // 태그 목록 (현재 미구현)
  activities: CardActivity[];
}
```

---

## 8. 컴포넌트 파일 위치

```
components/
├── CardDetailModal.tsx     # 신규 생성
└── Card.tsx                # 카드 클릭 핸들러 추가 필요
```

---

## 9. 구현 우선순위

**P0 (필수)**
- 모달 레이아웃 + 오버레이
- 제목, 담당자 아바타, 진행률 바
- 우선순위 태그
- 생성일 표시
- 닫기 버튼 + ESC

**P1 (권장)**
- 설명 섹션
- 활동 로그 (정적 더미 데이터로 시작)
- 마감일 (백엔드 스키마 확장 후)

**P2 (향후)**
- 실시간 활동 피드
- 태그 추가/제거 기능
- 인라인 편집
