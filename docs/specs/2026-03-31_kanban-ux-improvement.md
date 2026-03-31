# 칸반보드 UI/UX 전면 개선 스펙
> 작성일: 2026-03-31
> 작성자: Marge (PM)
> 상태: IN_PROGRESS (승인: 2026-03-31, Phase 1-5 전체 진행)

---

## 배경 & 목표

최신 커밋(f78e106)에서 다크 모드 단일 테마 + 네이비 팔레트로 기초 개선이 완료됨.
이번 스펙은 **접근성 · 반응형 · 편집 기능 · 정보 밀도** 개선을 통해 실사용 품질을 끌어올리는 데 집중.

### 현재 주요 문제점 (코드 기반 확인)

- *접근성 미비*: aria-label, role, 포커스 트랩 미적용
- *인라인 스타일 남용*: CSS 토큰이 있음에도 inline style로 하드코딩 → 유지보수 어려움
- *CardDetailModal 편집 불가*: 카드 제목/설명 읽기 전용, 저장 버튼 없음
- *활동 로그 더미 데이터*: 실제 API 연동 없음 (due_date, tags, activities 미구현)
- *반응형 미적용*: 모바일/태블릿 레이아웃 없음
- *빈 상태(Empty State) UI 부재*: 카드 없을 때 안내 메시지 없음
- *보드 수평 스크롤 처리*: 컬럼 많을 때 레이아웃 깨짐

---

## Acceptance Criteria

### AC-1. 접근성 (WCAG AA)
- [ ] 모든 인터랙티브 요소에 `aria-label` 또는 시각적 레이블
- [ ] 모달: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, ESC 닫기, 포커스 트랩
- [ ] ProgressBar: `role="progressbar"`, `aria-valuenow/min/max`
- [ ] 드래그 카드: `aria-grabbed` + 키보드 이동 지원 (Space = grab, 방향키 = 이동, Enter = drop)
- [ ] 색상만으로 구분되는 상태값에 아이콘/텍스트 병행

### AC-2. 인라인 스타일 → CSS 토큰
- [ ] 모든 색상값을 `var(--color-*)` 토큰으로 교체
- [ ] 반복되는 패턴 → `globals.css` 유틸리티 클래스로 추출

### AC-3. CardDetailModal 편집 기능
- [ ] 카드 제목 인라인 편집 (클릭 → input, Enter/blur → 저장)
- [ ] 설명 텍스트 편집 (클릭 → textarea, 저장 버튼)
- [ ] 담당자 변경 드롭다운
- [ ] 진행률 슬라이더 편집
- [ ] 저장 시 `PATCH /cards/:id` 호출 + 낙관적 업데이트
- [ ] 저장 중 로딩 인디케이터 + 에러 시 롤백 & 토스트

### AC-4. 반응형 레이아웃
- [ ] 데스크탑(768px+): 현재 가로 스크롤 레이아웃 유지
- [ ] 태블릿(480–767px): 컬럼 너비 축소, 2컬럼 이하 wrap
- [ ] 모바일(~479px): 단일 컬럼 세로 스크롤, 카드 풀 너비
- [ ] CardDetailModal 모바일: 하단 시트(bottom sheet) 스타일

### AC-5. 빈 상태 UI
- [ ] 컬럼에 카드 없을 때: 안내 아이콘 + "카드를 추가해 보세요" 텍스트 + 카드 추가 버튼
- [ ] 보드 로딩 실패 시: 재시도 버튼 + 에러 메시지 (이미 일부 구현, 개선)

### AC-6. 필터 & 검색 (P1)
- [ ] 헤더에 담당자 필터 (에이전트 아바타 클릭 토글)
- [ ] 우선순위 필터 (High/Medium/Low 토글 칩)
- [ ] 필터 적용 시 해당 카드 하이라이트, 비해당 카드 opacity 낮춤

### AC-7. 마감일 & 태그 (P2, 백엔드 협업)
- [ ] Card 타입에 `due_date`, `tags` 필드 추가 (DB 스키마 확장)
- [ ] CardDetailModal에 마감일 입력 (date picker)
- [ ] 마감일 임박(3일 이내) 카드에 경고 뱃지
- [ ] 태그 추가/제거 (pill 입력 UI)

### AC-EC. 에러 케이스

#### EC-1. 카드 저장 실패
- Given: CardDetailModal에서 편집 후 저장 버튼 클릭
- When: `PATCH /cards/:id` API가 4xx/5xx 에러 반환
- Then: 낙관적 업데이트 롤백 + 에러 토스트 메시지 표시 ("저장에 실패했습니다. 다시 시도해 주세요.") + 편집 상태 유지

#### EC-2. 보드 로딩 실패
- Given: 보드 최초 진입 또는 새로고침
- When: `GET /boards/:id` API 네트워크 오류 또는 5xx 반환
- Then: 에러 메시지("보드를 불러오지 못했습니다.") + 재시도 버튼 표시, 이전 데이터 있으면 stale 표시와 함께 유지

#### EC-3. 드래그앤드롭 이동 실패
- Given: 카드를 다른 컬럼으로 드래그앤드롭
- When: 이동 API 호출 실패 (네트워크 오류 또는 5xx)
- Then: 카드 원래 위치로 복원(롤백) + 에러 토스트("카드 이동에 실패했습니다.")

#### EC-4. 마감일 & 태그 저장 실패 (Phase 5)
- Given: CardDetailModal에서 마감일/태그 입력 후 저장
- When: `PATCH /cards/:id` API 실패
- Then: 입력값 초기화 없이 편집 상태 유지 + 에러 토스트 표시

#### EC-5. 필터 적용 중 카드 없음 (Phase 4)
- Given: 특정 담당자 또는 우선순위 필터 적용
- When: 해당 조건에 맞는 카드가 없음
- Then: 각 컬럼에 "해당 조건의 카드가 없습니다" 빈 상태 메시지 표시 + 필터 초기화 버튼 노출

---

## 작업 분해 (Task Breakdown)

### Phase 1 — 접근성 + 인라인 스타일 정리 (Frontend)
> 담당: Bart (Frontend) | 예상: 1-2시간

- *T1-1.* `Board.tsx` — aria-label, 로딩 스피너 role, 에러 role="alert"
- *T1-2.* `Column.tsx` — 빈 상태 Empty State UI, aria-label
- *T1-3.* `Card.tsx` — `aria-grabbed`, `role="button"`, 키보드 이벤트 핸들러
- *T1-4.* `AddCardModal.tsx` — `role="dialog"`, `aria-modal`, ESC, 포커스 트랩, `aria-label`
- *T1-5.* `CardDetailModal.tsx` — `role="dialog"`, `aria-modal`, ESC, 포커스 트랩
- *T1-6.* 전체 컴포넌트 inline style → CSS 토큰(`var(--color-*)`) 교체
- *T1-7.* `globals.css` — 반복 패턴 유틸리티 클래스 추출 (`.card-base`, `.modal-overlay` 등)

### Phase 2 — CardDetailModal 편집 기능 (Frontend)
> 담당: Bart (Frontend) | 예상: 1.5시간

- *T2-1.* 카드 제목 인라인 편집 (클릭 → `<input>`, blur/Enter 저장)
- *T2-2.* 설명 편집 (`<textarea>`, 저장/취소 버튼)
- *T2-3.* 담당자 변경 드롭다운 (에이전트 6명 선택)
- *T2-4.* 진행률 range slider (0~100, 10 단위)
- *T2-5.* 저장 API 연동 (`PATCH /cards/:id`) + 낙관적 업데이트 + 에러 롤백
- *T2-6.* ProgressBar aria 속성 (`role="progressbar"`, `aria-valuenow/min/max`)

### Phase 3 — 반응형 레이아웃 (Frontend)
> 담당: Bart (Frontend) | 예상: 1시간

- *T3-1.* `Board.tsx` — 가로 스크롤 컨테이너 + 모바일 세로 스크롤 분기
- *T3-2.* `Column.tsx` — 반응형 너비 (데스크탑 280px / 태블릿 240px / 모바일 100%)
- *T3-3.* `CardDetailModal.tsx` — 모바일 bottom sheet 레이아웃 (`@media max-width: 479px`)
- *T3-4.* `AddCardModal.tsx` — 모바일 풀스크린 대응

### Phase 4 — 필터 기능 (Frontend)
> 담당: Bart (Frontend) | 예상: 1시간

- *T4-1.* 헤더 필터 UI — 에이전트 아바타 토글 + 우선순위 칩
- *T4-2.* `Board.tsx` — 필터 상태 관리 (Zustand 또는 useState)
- *T4-3.* `Column.tsx` / `Card.tsx` — 필터 적용 로직 + opacity 효과

### Phase 5 — 마감일 & 태그 (Backend + Frontend, P2)
> 담당: Homer (Backend) + Bart (Frontend) | 예상: 2시간

- *T5-1.* DB 스키마 확장: `cards` 테이블에 `due_date`, `tags` 컬럼
- *T5-2.* API 확장: `GET /cards/:id` 응답에 `due_date`, `tags` 포함
- *T5-3.* `types.ts` — `Card` 인터페이스에 `due_date`, `tags` 추가
- *T5-4.* `CardDetailModal.tsx` — 마감일 date input + 태그 pill 입력 UI
- *T5-5.* `Card.tsx` — 마감일 임박 뱃지 표시

---

## 구현 순서 (우선순위)

```
P0 (즉시): Phase 1 (접근성) + Phase 2 (편집 기능)
P1 (이번 주): Phase 3 (반응형) + Phase 4 (필터)
P2 (다음 스프린트): Phase 5 (마감일·태그)
```

---

## 검증 기준 (DoD)

- [ ] 빌드 통과 (`next build`)
- [ ] 린트 통과 (`eslint`)
- [ ] 런타임 실행 확인 (`npm run dev`)
- [ ] 모든 모달 ESC 닫기 동작
- [ ] 포커스 트랩 동작 (Tab 키 모달 내 순환)
- [ ] CardDetailModal 카드 편집 → 저장 → 보드 반영
- [ ] 모바일(375px) 레이아웃 깨짐 없음
- [ ] aria-label 누락 없음 (axe 또는 수동 확인)

---

## 관련 파일

- `kanban-frontend/components/Board.tsx`
- `kanban-frontend/components/Column.tsx`
- `kanban-frontend/components/Card.tsx`
- `kanban-frontend/components/AddCardModal.tsx`
- `kanban-frontend/components/CardDetailModal.tsx`
- `kanban-frontend/app/globals.css`
- `kanban-frontend/lib/types.ts`
- `kanban-frontend/lib/api.ts`
- `kanban-frontend/design/dark-mode-spec.md`
- `kanban-frontend/design/card-detail-modal-spec.md`
