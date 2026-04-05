# 카드 상세 모달 UI/UX 스펙 (v2)

> **작성자**: Krusty (Designer)
> **작성일**: 2026-04-02
> **이전 버전**: 2026-03-29 초안
> **대상**: Bart (Frontend 구현)

---

## 1. 현재 구현 상태 요약

`CardDetailModal.tsx` (651줄) 가 이미 존재하며 핵심 기능이 구현되어 있다.
이 스펙은 현재 구현의 **갭 항목**과 **개선 사항**에 집중한다.

### 구현 완료 항목

- 오버레이 + backdrop blur + 클릭 외부 닫기
- 헤더: 컬럼명 브레드크럼, 제목 인라인 편집, 닫기 버튼
- 바디: 담당자(select), 우선순위(select), 생성일/수정일, 마감일 상태 뱃지
- 태그 추가/삭제, 진행률 range slider, 설명 인라인 편집
- 푸터: 저장 중 indicator, 닫기 버튼
- 토스트: 모달 내부 하단 표시 (2.5초)
- 포커스 트랩 + ESC 키
- 반응형: 모바일 bottom sheet (≤479px), 태블릿 (480–767px)
- 애니메이션: 데스크톱 fadeIn, 모바일 slideUp

### 갭 — 구현 필요 항목

- 카드 삭제 버튼 없음
- 컬럼 이동(칸반 열 변경) UI 없음
- 활동 로그가 더미 데이터 (실제 API 연동 필요)
- 카드 ID 표시 없음
- 삭제 확인 단계 없음

---

## 2. 레이아웃 구조

```
CardDetailModal
├── Overlay (position: fixed, inset: 0, z-index: 50)
│   ├── backdrop: rgba(0,0,0,0.72) + blur(4px)
│   └── ModalContainer (maxWidth: 560px, maxHeight: 88vh)
│       ├── ModalHeader
│       │   ├── BreadcrumbRow (컬럼명 + 카드 ID)
│       │   ├── TitleRow (제목 인라인 편집 + 편집 힌트 아이콘)
│       │   └── CloseButton (32×32px)
│       ├── ModalBody (overflow-y: auto, flex: 1)
│       │   ├── MetaRow (담당자, 우선순위, 날짜)
│       │   ├── DueDateRow (마감일 + 상태 뱃지)
│       │   ├── TagRow
│       │   ├── ProgressRow
│       │   ├── DescriptionRow
│       │   └── ActivityRow
│       └── ModalFooter
│           ├── Left: SavingIndicator + DeleteButton
│           └── Right: CloseButton
```

---

## 3. 필드 목록 및 편집 가능 여부

| 필드 | 편집 가능 | 방식 | 트리거 | 저장 시점 |
|------|-----------|------|--------|-----------|
| 제목 | ✅ | 인라인 input | 클릭 | onBlur / Enter |
| 설명 | ✅ | 인라인 textarea | "✎ 편집" 버튼 | "저장" 버튼 클릭 |
| 담당자 | ✅ | select dropdown | 즉시 | onChange |
| 우선순위 | ✅ | select dropdown | 즉시 | onChange |
| 마감일 | ✅ | date input | 즉시 | onChange |
| 태그 | ✅ | text input + Enter | Enter / "추가" 버튼 | 즉시 |
| 진행률 | ✅ | range slider (0–100, step 10) | 즉시 | onMouseUp / onTouchEnd |
| 컬럼 위치 | ✅ (신규) | select dropdown | 즉시 | onChange |
| 생성일 | ❌ | 텍스트 표시 | — | — |
| 수정일 | ❌ | 텍스트 표시 | — | — |
| 카드 ID | ❌ | 텍스트 표시 | — | — |

---

## 4. 신규 추가 — 컬럼 이동 필드

헤더 브레드크럼 영역에서 컬럼명을 클릭 가능한 select로 변경하거나,
메타 행에 "컬럼" 항목을 별도로 추가한다.

### 위치
메타 행 (담당자, 우선순위와 동일 row) 또는 헤더 브레드크럼 select 변환.

### 시각 처리
```
현재 컬럼:  [📋 In Progress ▾]
```
- 선택 시 PATCH /cards/:id/move 호출
- 색상: 해당 컬럼의 accent 색상 사용
  - Todo → --color-col-todo (#4f7ef0)
  - In Progress → --color-col-inprogress (#fbbf24)
  - Review → --color-col-review (#c084fc)
  - Done → --color-col-done (#4ade80)

---

## 5. 신규 추가 — 삭제 버튼

### 위치
푸터 왼쪽 영역 (저장 중 indicator 오른쪽)

### 시각 처리
- 기본 상태: 텍스트 색상 --color-text-muted, 배경 없음
- Hover: --color-priority-high (rgba(248,113,113,0.12)) 배경, #f87171 텍스트
- 아이콘: 🗑 또는 텍스트 "삭제"
- aria-label: "카드 삭제"

### 삭제 확인 플로우
버튼 클릭 시 모달 내부 confirm 단계로 전환 (별도 팝업 금지):

```
[삭제] 클릭
  → 버튼이 [정말 삭제하시겠어요?] [취소] 로 교체
  → 3초 후 자동으로 원래 상태 복귀
  → 확인 클릭 시 DELETE /cards/:id → onDelete() → 모달 닫기
```

삭제 확인 중 상태 컬러:
- 배경: rgba(248,113,113,0.08)
- 테두리: rgba(248,113,113,0.25)

---

## 6. 카드 ID 표시

### 위치
헤더 브레드크럼 행 우측

### 포맷
`#42` (카드 id를 # prefix로 표시)

### 스타일
- fontSize: 11px
- color: --color-text-muted
- fontFamily: monospace

---

## 7. 색상 토큰 활용 계획

기존 5종 제한 색상 시스템 준수. 신규 색상 추가 없이 기존 토큰 재사용.

### 컬럼 accent
- Todo: `--color-col-todo` (#4f7ef0)
- In Progress: `--color-col-inprogress` (#fbbf24)
- Review: `--color-col-review` (#c084fc)
- Done: `--color-col-done` (#4ade80)

### 우선순위
- 높음: `--color-priority-high` (#f87171) — bg rgba(248,113,113,0.12)
- 보통: `--color-priority-medium` (#fbbf24) — bg rgba(251,191,36,0.12)
- 낮음: `--color-priority-low` (#4ade80) — bg rgba(74,222,128,0.12)

### 마감일 상태
- 기한 초과: `--color-due-overdue` + `--color-due-overdue-bg`
- 임박 (3일 이내): `--color-due-warning` + `--color-due-warning-bg`
- 정상: #4ade80 (--color-progress-high 재사용)

### 배경 레이어
- 오버레이: `--color-bg-overlay` (rgba(0,0,0,0.7))
- 모달: `--color-bg-surface`
- 푸터: `--color-bg-elevated`
- 입력 필드: `--color-bg-elevated`
- 활동 로그 아이템: `--color-bg-elevated`

### 텍스트
- 제목: `--color-text-primary`
- 레이블: `--color-text-muted` (11px, uppercase)
- 본문: `--color-text-secondary`
- 비어있음 상태: `--color-text-muted` + italic

### 액션
- 기본 버튼 테두리: `--color-border-strong`
- 포커스 링: `--color-focus-ring` (#4f7ef0)
- CTA (저장): rgba(79,126,240,0.15) bg / rgba(79,126,240,0.3) border / #4f7ef0 text
- 삭제 hover: rgba(248,113,113,0.12) bg / #f87171 text

---

## 8. 버튼 구성

### 헤더
- `CloseButton` (×): 32×32px, border-radius 8px, --color-text-muted → hover --color-text-primary

### 설명 영역 (편집 모드)
- `취소`: secondary 스타일 — --color-bg-elevated bg, --color-border border
- `저장`: primary 스타일 — rgba(79,126,240,0.15) bg, rgba(79,126,240,0.3) border, #4f7ef0 text

### 태그 영역
- `추가`: input이 비어 있으면 비활성 — --color-text-muted
- 태그 삭제 `×`: inline, hover 시 opacity 1

### 푸터
- `DeleteButton`: 왼쪽, 기본 ghost → hover danger
- `닫기Button`: 오른쪽, secondary — padding 8px 20px, border-radius 8px

---

## 9. 애니메이션

### 데스크톱 (≥480px)
- 등장: `detailFadeIn` 200ms cubic-bezier(0.16,1,0.3,1)
  ```
  from: opacity 0, scale(0.96), translateY(12px)
  to:   opacity 1, scale(1), translateY(0)
  ```
- 방향: 중앙에서 약간 아래에서 올라오는 느낌

### 모바일 (<480px)
- 등장: `slideUp` 280ms cubic-bezier(0.16,1,0.3,1)
  ```
  from: opacity 0, translateY(100%)
  to:   opacity 1, translateY(0)
  ```
- 방향: 아래에서 위로 (bottom sheet 패턴)

### 토스트
- 등장: `toastIn` 200ms cubic-bezier(0.16,1,0.3,1)
  ```
  from: opacity 0, translateX(-50%) translateY(8px)
  to:   opacity 1, translateX(-50%) translateY(0)
  ```
- 위치: 모달 내부 bottom: 70px, 수평 중앙
- 지속: 2500ms 후 사라짐

### 삭제 확인 상태 전환
- 버튼 텍스트 교체: opacity transition 150ms
- 배경색 변경: background transition 150ms

---

## 10. 모달 크기 및 반응형

### 데스크톱 (≥768px)
- 크기: maxWidth 560px, maxHeight 88vh
- 위치: 화면 중앙 (align-items: center)
- border-radius: 18px 전체

### 태블릿 (480–767px)
- 크기: calc(100vw - 40px), maxHeight 92vh
- border-radius: 18px 전체

### 모바일 (<480px)
- 크기: 100vw, maxHeight 95dvh
- 위치: 화면 하단 (align-items: flex-end, padding 0)
- border-radius: 18px 18px 0 0 (상단만)
- 오버레이 padding: 0

---

## 11. 접근성

### Role 및 ARIA

```
<div role="dialog" aria-modal="true" aria-labelledby="detail-modal-title">
  <h2 id="detail-modal-title">카드 제목</h2>
  ...
</div>
```

### 포커스 관리
- 모달 열림 시 CloseButton에 즉시 focus()
- Tab 순환: 포커스 트랩 (첫/마지막 요소에서 순환)
- Shift+Tab 역방향 지원
- ESC: 모달 닫기

### 입력 필드 레이블
- 모든 input/select/textarea에 `aria-label` 필수
- 진행률 슬라이더: `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- 진행률 바: `role="progressbar"` + 동일 aria 속성

### 컬러 대비
- 모달 배경 (`--color-bg-surface` #0d1526) 위 텍스트
  - Primary 텍스트 #e2e8f5: 대비율 약 12:1 ✅
  - Secondary 텍스트 #7a90b8: 대비율 약 4.5:1 ✅
  - Muted 텍스트 #3d506e: 대비율 약 2.8:1 — 레이블(11px)/힌트용으로만 사용 ⚠️

### 터치 타겟
- 닫기 버튼: 32×32px (최소 기준 미달 — 44×44px 권장)
  → 내부 아이콘 20px + 패딩 확장으로 터치 타겟 44×44px 확보 필요
- 태그 삭제 버튼: 인라인 × 버튼 → 최소 24px 이상 확보

---

## 12. Column 이동 — Props 업데이트

현재 Props에 없는 항목 추가 필요:

```typescript
interface Props {
  card: Card;
  columnName: string;
  columns: Column[];          // 신규 — 이동 가능한 컬럼 목록
  onClose: () => void;
  onUpdate?: (id: number, data: Partial<...>) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;  // 신규 — 삭제 핸들러
  onMove?: (cardId: number, toColumnId: number) => Promise<void>; // 신규 — 컬럼 이동
}
```

---

## 13. 활동 로그 — API 연동 방향

현재 더미 데이터. 실제 연동 시:

### 표시 항목
- 에이전트 아바타 (28px) + 이름
- 액션 아이콘 + 설명 텍스트
- 상대 시간 (방금 전 / N분 전 / N시간 전 / N일 전)

### 빈 상태
- "아직 활동 기록이 없습니다." — italic, --color-text-muted

### 스크롤
- maxHeight: 200px, overflow-y: auto
- 스크롤바 스타일: 얇은 커스텀 스크롤바 (기존 스크롤바 스타일 준용)

---

## 14. 구현 우선순위

| 항목 | 우선순위 | 예상 공수 |
|------|----------|-----------|
| 삭제 버튼 + 확인 플로우 | P0 | 1h |
| 카드 ID 표시 | P0 | 30m |
| 컬럼 이동 select | P1 | 2h |
| 닫기 버튼 터치 타겟 44px | P1 | 30m |
| 활동 로그 API 연동 | P2 | 3h |

---

## 15. 핸드오프 체크리스트 (Bart 확인용)

- [ ] Props에 `onDelete`, `onMove`, `columns` 추가
- [ ] 푸터 좌측에 DeleteButton 추가 (ghost → hover danger 스타일)
- [ ] 삭제 확인 상태 구현 (3초 자동 복귀)
- [ ] 헤더 브레드크럼에 카드 ID 표시 (#42 포맷)
- [ ] 메타 행에 컬럼 이동 select 추가 (컬럼 accent 색상 적용)
- [ ] 닫기 버튼 터치 타겟 44×44px 확보 (padding 조정)
- [ ] 모든 신규 인터랙션 요소에 aria-label 추가
- [ ] tsc --noEmit 통과
