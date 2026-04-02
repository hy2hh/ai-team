# 칸반 보드 UI — 포인트컬러 중심 디자인 개선 스펙
> 작성일: 2026-04-02
> 작성자: Marge (PM)
> 상태: IN PROGRESS

---

## 배경 & 목표
사용자 요청: "포인트컬러 기준으로 느낌을 내줬으면 하는데"

현재 칸반 보드는 딥 네이비 다크 팔레트 + `#4f7ef0` 인디고 블루를 primary accent로 사용 중.
다양한 accent 색상이 분산 사용되어 전체적인 UI의 통일된 분위기가 부족함.
이번 개선의 목표는 **하나의 포인트컬러를 중심으로 UI 전체의 분위기를 통일**하는 것.

---

## Acceptance Criteria

### AC-1. 포인트컬러 선택
- [ ] Designer(Krusty)가 포인트컬러를 선택하고 이유를 스펙에 문서화
- [ ] 선택된 포인트컬러는 `--color-point` 토큰으로 globals.css에 정의
- [ ] 포인트컬러 hover/active 변형 (`--color-point-hover`, `--color-point-glow`) 정의

### AC-2. 포인트컬러 일관 적용
- [ ] 주요 버튼(Add Card, 저장 등)에 포인트컬러 적용
- [ ] 포커스 링, 드래그오버 상태에 포인트컬러 적용
- [ ] 필터 active state에 포인트컬러 적용
- [ ] 카드 hover border accent에 포인트컬러 반영

### AC-3. 기존 컬럼 accent 유지
- [ ] 컬럼별 accent(todo/inprogress/review/done) 색상은 그대로 유지
- [ ] 포인트컬러와 컬럼 accent가 시각적으로 충돌하지 않음

### AC-4. 빌드/런타임 안정성
- [ ] `next build` 통과
- [ ] `next dev` 실행 시 런타임 에러 없음

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

---

## 🎨 Designer 스펙 — 포인트컬러 디자인 결정 (Krusty)

> 작성일: 2026-04-02
> 담당: Krusty (Designer)

---

### 1. 포인트컬러 선택

| 항목 | 값 |
|---|---|
| **이름** | Lavender Indigo |
| **다크 테마 hex** | `#818cf8` |
| **라이트 테마 hex** | `#4f46e5` |

**선택 이유:**
- 기존 `#4f7ef0`은 `--color-col-todo`와 hex가 동일 → 포인트컬러 독립성 없음
- `#818cf8`은 인디고 계열이되 바이올렛 방향으로 기울어 todo 파랑(`#4f7ef0`)과 명확 구분
- review 컬럼 보라(`#c084fc`)보다 블루 방향이라 시각 충돌 없음
- 딥 네이비 배경(`#080d17`~`#172039`) 위에서 glow 효과 시 lavender 빛 산란이 세련되게 표현됨
- 라이트 테마 `#4f46e5`는 흰 배경 위 대비비 5.5:1로 WCAG AA 기준(4.5:1) 충족

**탈락 후보:**
- `#4f7ef0` (기존): todo 컬럼 색상과 동일, 포인트 역할 불가
- `#7c3aed` (violet): 딥 네이비에서 너무 어두워 존재감 부족
- `#06b6d4` (cyan): bart 에이전트 컬러(`#22d3ee`)와 충돌
- `#c084fc` (violet): 이미 review 컬럼 accent로 사용 중

---

### 2. globals.css 추가 CSS 변수 목록

#### 다크 테마 (`:root, [data-theme="dark"]` 블록에 추가)

```css
/* 포인트컬러 토큰 */
--color-point:          #818cf8;
--color-point-hover:    #a5b4fc;
--color-point-subtle:   rgba(129, 140, 248, 0.12);
--color-point-border:   rgba(129, 140, 248, 0.30);
--color-point-glow:     rgba(129, 140, 248, 0.20);
```

#### 라이트 테마 (`[data-theme="light"]` 블록에 추가)

```css
/* 포인트컬러 토큰 */
--color-point:          #4f46e5;
--color-point-hover:    #3730a3;
--color-point-subtle:   rgba(79, 70, 229, 0.10);
--color-point-border:   rgba(79, 70, 229, 0.25);
--color-point-glow:     rgba(79, 70, 229, 0.15);
```

#### `@theme inline` 블록에 추가

```css
--color-point:          var(--color-point);
--color-point-hover:    var(--color-point-hover);
--color-point-subtle:   var(--color-point-subtle);
--color-point-border:   var(--color-point-border);
--color-point-glow:     var(--color-point-glow);
```

---

### 3. 컴포넌트별 적용 범위 명세

#### 3-1. 버튼 (Primary / Add Card)

| 상태 | 적용 값 |
|---|---|
| Default background | `--color-point` |
| Hover background | `--color-point-hover` |
| Disabled | 기존 `--color-bg-card` + `--color-text-muted` 유지 |

- `.btn-primary` 클래스의 `background` 를 `--color-action-primary` → `--color-point` 로 교체
- hover 시 `--color-point-hover`
- 버튼 아래 subtle glow 추가: `box-shadow: 0 0 12px var(--color-point-glow)` (hover 시에만)

#### 3-2. 포커스 링

| 대상 | 적용 |
|---|---|
| `--color-focus-ring` 변수 | `--color-point` 값으로 업데이트 |
| `.focus-ring:focus-visible` | `outline: 2px solid var(--color-point)` |
| `.input-field:focus` | `border-color: var(--color-point)` + `box-shadow: 0 0 0 3px var(--color-point-subtle)` |
| `.textarea-field:focus` | 동일 |

#### 3-3. 카드 hover border & glow

| 대상 | 현재 | 변경 |
|---|---|---|
| card hover border-color | `--card-accent-border` (컬럼별) | 유지 — 컬럼 accent 우선 |
| card hover box-shadow | `0 4px 16px rgba(0,0,0,0.3)` | `0 4px 16px rgba(0,0,0,0.3), 0 0 8px var(--color-point-glow)` 추가 |

> 컬럼 accent border는 그대로 유지. 포인트컬러는 **glow shadow 레이어**로만 추가.

#### 3-4. 필터 active state

| 상태 | 적용 |
|---|---|
| `.filter-chip--active` border-color | `--color-point` |
| `.filter-chip--active` background | `--color-point-subtle` |
| `.filter-chip--active` color | `--color-point` |
| `.filter-chip:hover` border-color | `--color-point-border` |

#### 3-5. 태그 pill (기존 토큰 교체)

| 변수 | 현재 | 변경 |
|---|---|---|
| `--color-tag-bg` 다크 | `rgba(79,126,240,0.15)` | `--color-point-subtle` |
| `--color-tag-border` 다크 | `rgba(79,126,240,0.3)` | `--color-point-border` |
| `--color-tag-text` 다크 | `#6b95f5` | `--color-point-hover` |

#### 3-6. 로딩 스피너

```css
.loading-spinner {
  border-top-color: var(--color-point);  /* 기존 --color-action-primary 교체 */
}
```

#### 3-7. --color-action-primary 유지 여부

`--color-action-primary`는 **agent avatar homer** 색상과 연동되어 있어 직접 변경 시 사이드 이펙트 발생.
포인트컬러 적용은 `--color-point` 신규 토큰으로 분리하고, `--color-action-primary`는 현행 유지.

---

### 4. 컬럼 accent 유지 선언

아래 컬럼 accent 색상은 이번 개선에서 **변경하지 않는다:**

| 컬럼 | 다크 | 라이트 |
|---|---|---|
| todo | `#4f7ef0` | `#3b6fd4` |
| inprogress | `#fbbf24` | `#d97706` |
| review | `#c084fc` | `#9333ea` |
| done | `#4ade80` | `#16a34a` |

포인트컬러(`#818cf8`)와 시각 충돌 없음 — todo 파랑보다 밝고 review 보라보다 블루에 가까워 스펙트럼 상 중간 위치.

---

### 5. Bart 핸드오프 체크리스트

- [ ] `globals.css` `:root` 블록에 포인트컬러 5개 변수 추가
- [ ] `globals.css` `[data-theme="light"]` 블록에 포인트컬러 5개 변수 추가
- [ ] `globals.css` `@theme inline` 블록에 포인트컬러 5개 변수 추가
- [ ] `.btn-primary` → `background: var(--color-point)` / hover: `var(--color-point-hover)`
- [ ] `.btn-primary:hover` → `box-shadow: 0 0 12px var(--color-point-glow)` 추가
- [ ] `--color-focus-ring` 값을 `#818cf8` (다크) / `#4f46e5` (라이트) 로 교체
- [ ] `.input-field:focus`, `.textarea-field:focus` → `border-color: var(--color-point)` + subtle glow
- [ ] `.filter-chip--active` → point 컬러 3종 적용
- [ ] `.card-item:hover` box-shadow에 `0 0 8px var(--color-point-glow)` 레이어 추가
- [ ] 태그 토큰 3종 → `--color-point-*` 로 교체
- [ ] `.loading-spinner` → `border-top-color: var(--color-point)`
