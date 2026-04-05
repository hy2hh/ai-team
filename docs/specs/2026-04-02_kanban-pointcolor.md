# 칸반 보드 UI — 포인트컬러 중심 디자인 개선 스펙
> 작성일: 2026-04-02
> 작성자: Marge (PM)
> 상태: COMPLETED

---

## 배경 & 목표
사용자 요청: "포인트컬러 기준으로 느낌을 내줬으면 하는데"

현재 칸반 보드는 딥 네이비 다크 팔레트 + `#4f7ef0` 인디고 블루를 primary accent로 사용 중.
다양한 accent 색상이 분산 사용되어 전체적인 UI의 통일된 분위기가 부족함.
이번 개선의 목표는 **하나의 포인트컬러를 중심으로 UI 전체의 분위기를 통일**하는 것.

---

## Acceptance Criteria

### AC-1. 포인트컬러 선택
- [x] Designer(Krusty)가 포인트컬러를 선택하고 이유를 스펙에 문서화
  - **선택: Bifrost brand-point 계열** — 다크 `#7C7AE8` (밝기 +15% 조정), 라이트 `#5F5BE2` (원색)
  - 이유: Bifrost 디자인 시스템 표준 준수, 팀 칸반이 ai-team 내부 인프라 도구이므로 Bifrost brand 적용 자연스러움
- [x] 선택된 포인트컬러는 `--color-point` 토큰으로 globals.css에 정의
- [x] 포인트컬러 hover/active 변형 (`--color-point-hover`, `--color-point-glow`) 정의

### AC-2. 포인트컬러 일관 적용
- [x] 주요 버튼(Add Card, 저장 등)에 포인트컬러 적용
  - `.btn-primary` → `var(--color-point)`, hover → `var(--color-point-hover)`
  - UI kit `<Button variant="primary">` — `.bg-brand-point` 오버라이드로 `var(--color-point)` 적용
- [x] 포커스 링, 드래그오버 상태에 포인트컬러 적용
  - `--color-focus-ring: var(--color-point)` + 전역 `button:focus-visible`, `a:focus-visible` 규칙 추가
  - 드래그오버: Column이 `accentColor`(COLUMN_ACCENTS[0] = point color) 사용
- [x] 필터 active state에 포인트컬러 적용
  - `.filter-chip--active` → `var(--color-point-subtle)` 배경, `var(--color-point)` 텍스트/border
  - 담당자·우선순위 시맨틱 색상은 의미 명확성을 위해 유지 (AC-3 충돌 방지)
- [x] 카드 hover border accent에 포인트컬러 반영
  - `.card-item:hover` → `var(--color-point-glow)` glow 효과

### AC-3. 기존 컬럼 accent 유지
- [x] 컬럼별 accent(todo/inprogress/review/done) 색상은 그대로 유지
  - `COLUMN_ACCENTS = ['#7C7AE8', '#fbbf24', '#c084fc', '#4ade80', '#fb923c', '#f472b6']`
  - col-1(brand-point) ~ col-6까지 6색 순환 유지
- [x] 포인트컬러와 컬럼 accent가 시각적으로 충돌하지 않음

### AC-4. 빌드/런타임 안정성
- [x] `next build` 통과 — Bart(Frontend) 검증 완료
- [x] `next dev` 실행 시 런타임 에러 없음 — Bart(Frontend) 검증 완료

---

## 에러 케이스

### EC-1. 포인트컬러 CSS 변수 누락
- Given: 포인트컬러 토큰(`--color-point`)이 globals.css에 정의되지 않은 상태에서 컴포넌트가 해당 변수를 참조
- When: `next dev` 또는 `next build` 실행
- Then: CSS 변수 fallback이 작동해 기존 `--color-action-primary` 값으로 렌더링되어야 하며 런타임 에러 없음

### EC-2. 라이트 테마에서 포인트컬러 대비 부족
- Given: 사용자가 라이트 테마 전환
- When: 포인트컬러가 라이트 배경 위에 렌더링됨
- Then: 라이트 테마용 `--color-point` 값이 적용되어 WCAG AA 기준(4.5:1) 대비비 유지

### EC-3. 기존 accent 색상 충돌
- Given: 포인트컬러 적용 후 컬럼 accent(todo=파랑, inprogress=노랑 등)가 함께 표시
- When: 사용자가 보드를 조회
- Then: 포인트컬러와 컬럼 accent가 명확히 구분되며 혼동 없이 렌더링됨

---

## 작업 분해

### Step 1 — Designer (Krusty)
- 포인트컬러 선택 및 이유 문서화
- 다크/라이트 테마 각각 포인트컬러 hex 값 정의
- globals.css 추가/수정 사항 목록화
- 컴포넌트별 적용 범위 명세

### Step 2 — Frontend (Bart)
- Krusty 스펙 기반으로 globals.css 수정
- 컴포넌트 업데이트
- DoD 항목 검증

---

## 관련 파일
- `kanban/frontend/app/globals.css`
- `kanban/frontend/components/Board.tsx`
- `kanban/frontend/components/Column.tsx`
- `kanban/frontend/components/Card.tsx`
- `kanban/frontend/components/AddCardModal.tsx`
- `kanban/frontend/components/CardDetailModal.tsx`
