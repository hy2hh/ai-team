# Designer Conventions

서비스 유형별 디자인 가이드 기반 공통 규칙.
색상 토큰·컴포넌트 스펙·레이아웃 원칙 → 서비스 타입에 맞는 디자인 가이드(§0 참조) 로드.
이 파일은 각 디자인 가이드에 없는 기술 요구사항과 프로세스 규칙만 담는다.

---

## 0. 서비스 타입별 스타일 가이드 선택

작업 시작 전 서비스 타입을 판단하고 올바른 가이드를 로드합니다.

| 서비스 타입 | Primary 가이드 |
|-------------|---------------|
| ai-team 내부 툴 (칸반, 메모리 뷰어, 대시보드 등) | `.claude/context/designer/apple-design-system.md` |

**ai-team 내부 툴 = Apple 스타일이 기본값**
- Primary: `#0071e3` (Apple Blue)
- 폰트: SF Pro Display/Text (fallback: Helvetica Neue, Arial)
- 배경: `#f5f5f7` (light) / `#000000` (dark section)
- 카드 radius: 8px (standard), no border, subtle shadow
- 최대 콘텐츠 너비: 980px, 중앙 정렬
- 간격 단위: 8px 기반

---

## 1. Layout 기본 규칙

- Layout 방식 우선순위: Flexbox → CSS Grid (2D 레이아웃에만)
- 모바일이 PRIMARY — 모든 디자인은 모바일부터 시작
- **텍스트 입력 최소 16px** (iOS Safari 자동 줌 방지)
- **터치 타겟 최소 44px**
- 자식 요소 간격: `gap` 클래스 사용 (`space-*` 금지)
- Tailwind arbitrary 값 지양 (`p-[16px]` → `p-4`)

---

## 2. Icons

- **emoji를 아이콘 대신 사용 금지**
- 아이콘 크기: **16px / 20px / 24px** 중 선택 (기본 24px)
- 아이콘 라이브러리: lucide-react 사용
- 추상적 도형(gradient circle, blurry blob)을 장식 필러로 사용 금지

---

## 3. Accessibility (WCAG AA)

- 일반 텍스트: **4.5:1** 이상
- 대형 텍스트 (18px+ bold 또는 24px+): **3:1** 이상
- 모든 인터랙티브 요소에 키보드 접근 보장
- 비장식 이미지에 alt 텍스트 필수
- `reduced-motion` 미디어 쿼리 대응

---

## 4. Handoff Checklist (→ @Bart)

- [ ] **[필수] CSS 토큰 파일 경로 명시** — `{project}/app/globals.css` 또는 `design-tokens.css`에 CSS 변수 블록 작성 완료 확인
- [ ] Color palette (시맨틱 토큰 + CSS 변수) — `var(--color-*)` 형태로 정의됨
- [ ] Typography (size, weight, line-height, letter-spacing, breakpoint별 size 변화)
- [ ] Spacing system
- [ ] Component specs (Default/Hover/Active/Focus/Disabled/Loading/Error/Empty)
- [ ] Responsive behavior (breakpoint별 레이아웃 변화)
- [ ] Accessibility notes (대비 비율, ARIA, 키보드)
- [ ] Dark/Light 불변/가변 토큰 목록

> ⚠️ CSS 토큰 파일 경로 미제공 시 핸드오프 완료로 인정하지 않음

---

## 5. 칸반 카드 관리 (필수 — 최우선)

**모든 작업에서 가장 먼저 `create_kanban_card`를 호출하세요.** 분석, 조사, 회의 소집, 코드 작성, 리뷰 등 어떤 작업이든 예외 없이 호출합니다.

- **title**: 사용자가 요청한 작업의 핵심 내용을 사용자 관점에서 요약. 에이전트 내부 프로세스(라우팅, 전달, 위임)가 아니라 실제 수행될 작업을 적을 것.
  - 좋은 예: "socket-bridge 코드 디버깅", "Slack 라우팅 키워드 테이블 리팩토링"
  - 나쁜 예: "Homer에게 디버깅 요청 전달", "사용자 요청 수신 및 라우팅"
- **description**: 구체적 실행 내용이나 작업 범위. 정보가 부족하면 비워두기
- **예외 없음**: "안녕"도, "1+1=?"도, 단답형 답변도 모두 카드를 먼저 생성합니다.
