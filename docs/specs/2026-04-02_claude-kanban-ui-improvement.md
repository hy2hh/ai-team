# claude-kanban UI 개선 — 디자인 시스템 토큰 적용
> 작성일: 2026-04-02
> 작성자: Marge (PM)
> 상태: COMPLETED

---

## 배경 & 목표

사용자 요청: 내부 디자인 시스템(ui-kit-front)을 참조하여 칸반 보드 UI 개선.

프로젝트 경로: `/Users/hangheejo/git/claude-kanban`
현재 globals.css: 55줄, CSS 변수 토큰 없음 (Tailwind 유틸리티만 사용 중)
ui-kit-front 참조 경로: `/Users/hangheejo/git/ui-kit-front`

---

## Acceptance Criteria

### AC-1. 타이포그래피 토큰 정의
- [x] `globals.css`에 `--text-h3` ~ `--text-label` 토큰 추가
- [x] `--line-height-*`, `--font-weight-*` 토큰 추가

### AC-2. Border Radius 토큰 정의
- [x] `globals.css`에 `--radius-sm` ~ `--radius-full` 토큰 추가

### AC-3. 포인트컬러 토큰 정의
- [x] 다크: `--color-point: #818cf8` (및 hover/subtle/border/glow 변형)
- [x] 라이트: `--color-point: #4f46e5` (및 변형)
- [x] 다크/라이트 분기 적용

### AC-4. 모달 공통 클래스
- [x] `.modal-container`, `.modal-header`, `.modal-body`, `.modal-footer` 클래스 정의
- [x] `AddCardModal`, `CardDetailModal`에 해당 클래스 적용

### AC-5. 버튼·입력 공통 클래스
- [x] `.btn-primary`, `.btn-secondary`, `.input-field`, `.textarea-field` 정의
- [x] 포인트컬러 토큰 사용

### AC-6. 상수 통합
- [x] `src/lib/constants.ts` 생성: AGENTS, AGENT_COLORS, PRIORITY_CONFIG 통합
- [x] 컴포넌트에서 중복 정의 제거

### AC-7. 빌드 안정성
- [x] `next build` 통과
- [x] TypeScript 컴파일 에러 없음

---

## 에러 케이스

### EC-1. CSS 변수 누락 시 렌더링
- Given: `--color-point` 토큰이 `globals.css`에 없는 상태에서 `.btn-primary`가 렌더링됨
- When: `next dev` 실행
- Then: CSS fallback이 작동해 기존 색상으로 렌더링되며 런타임 에러 없음

### EC-2. 라이트 테마 포인트컬러 대비
- Given: 사용자가 라이트 테마로 전환
- When: 포인트컬러가 흰색 배경 위에 렌더링됨
- Then: 라이트용 `--color-point: #4f46e5` 적용으로 WCAG AA 4.5:1 이상 대비비 유지

### EC-3. 모달 클래스 누락 시
- Given: `.modal-container` 클래스가 globals.css에 없음
- When: AddCardModal이 렌더링됨
- Then: 컴포넌트가 깨지지 않고 인라인 fallback 스타일로 표시

### EC-4. constants.ts import 오류
- Given: `src/lib/constants.ts`가 없는 상태에서 컴포넌트가 import
- When: TypeScript 컴파일 실행
- Then: 명시적 컴파일 에러 표시, 런타임에서 undefined 전파 없음

---

## 스코프 제외

- Pretendard 폰트 — 번들 사이즈 측정 후 재논의
- 카드 순서 변경 (drag reorder) — Backend order 필드 필요
- 터치 드래그앤드롭 — 별도 태스크
