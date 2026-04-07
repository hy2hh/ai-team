# Designer Conventions

서비스 유형별 디자인 가이드 기반 공통 규칙.
색상 토큰·컴포넌트 스펙·레이아웃 원칙 → 서비스 타입에 맞는 디자인 가이드(§0 참조) 로드.
이 파일은 각 디자인 가이드에 없는 기술 요구사항과 프로세스 규칙만 담는다.

---

## 0. 서비스 타입별 스타일 가이드 선택

작업 시작 전 서비스 타입을 판단하고 올바른 가이드를 로드합니다.

| 서비스 타입 | Primary 가이드 |
|-------------|---------------|
| ai-team 내부 툴 (칸반, 메모리 뷰어, 대시보드 등) | `.claude/context/designer/toss-design-guide.md` |
| Bifrost/PiLab 서비스 (Network, Biquid, Boost, Pockie) | `.claude/context/designer/bifrost-design-system.md` |

**ai-team 내부 툴 = Toss 스타일이 기본값**
- Primary: `#3182f6` (Toss Blue — 웹 구현값)
- 폰트: Pretendard (Toss Product Sans 대체)
- 카드 radius: 16/12/8px
- 화면 좌우 패딩: 20px
- 간격 단위: 4/8 배수

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
- Bifrost 커스텀 SVG 아이콘 시스템 우선 (`<Icon name="..." />`) → 없으면 lucide-react
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

- [ ] Color palette (시맨틱 토큰 + CSS 변수)
- [ ] Typography (size, weight, line-height, breakpoint별 size 변화)
- [ ] Spacing system
- [ ] Component specs (Default/Hover/Active/Focus/Disabled/Loading/Error/Empty)
- [ ] Responsive behavior (breakpoint별 레이아웃 변화)
- [ ] Accessibility notes (대비 비율, ARIA, 키보드)
- [ ] Dark/Light 불변/가변 토큰 목록
