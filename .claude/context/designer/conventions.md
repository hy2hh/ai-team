# Designer Conventions

v0 (Vercel) 디자인 시스템 기반으로 정립된 디자인 생성 규칙.
모든 디자인 산출물(스펙, 토큰, 컴포넌트 정의)은 이 규칙을 따른다.

---

## 1. Color System

### Hard Rules
- **팔레트는 정확히 3-5색으로 제한** (사용자 허락 없이 초과 금지)
- 구성: 1 primary brand color + 2-3 neutrals (white, grays, black 계열) + 1-2 accents
- **purple/violet을 주색으로 사용 금지** (명시적 요청 시만 허용)
- **임의의 파란색을 기본 primary로 사용 금지** — primary는 반드시 프로젝트 디자인 시스템에서 도출
- 배경색을 변경하면 **반드시 텍스트 색상도 함께 지정** (대비 보장)

### Gradient Rules
- 기본적으로 gradient 사용 금지 — solid color 우선
- gradient가 필요한 경우:
  - 미묘한 accent 용도로만 (primary 요소에 사용 금지)
  - **유사색 조합만 허용**: blue->teal, purple->pink, orange->red
  - **반대 온도 혼합 금지**: pink->green, orange->blue, red->cyan
  - 최대 2-3 color stop, 복잡한 gradient 금지

### Semantic Design Tokens
- 직접 색상 지정(white, black, #hex) 대신 **시맨틱 토큰** 사용
- 필수 토큰: `--background`, `--foreground`, `--primary`, `--secondary`, `--accent`, `--muted`, `--destructive`, `--border`, `--ring`, `--radius`
- 다크 모드 대응을 위해 토큰 기반 설계 필수
- 프로젝트에 맞는 추가 토큰 정의 가능

---

## 2. Typography

### Hard Rules
- **최대 2개 폰트 패밀리** (heading 1개 + body 1개)
- body text line-height: **1.4-1.6** (Tailwind: `leading-relaxed` 또는 `leading-6`)
- **decorative 폰트를 body text에 사용 금지**
- **14px 미만 폰트 사이즈 금지**

### Typography Scale
```
xs:  12px (보조 텍스트, 라벨)
sm:  14px (캡션, 메타데이터)
base: 16px (본문)
lg:  18px (강조 본문)
xl:  20px (소제목)
2xl: 24px (제목)
3xl: 30px (대제목)
4xl: 36px (히어로)
```

### Text Wrapping
- 제목과 중요 카피에는 `text-balance` 또는 `text-pretty` 적용 지시
- 본문 최대 너비: 65-75ch 권장

---

## 3. Layout & Responsive

### Mobile-First (CRITICAL)
- **모바일이 PRIMARY, 데스크톱이 SECONDARY**
- 모든 디자인은 모바일부터 시작하여 확장

### Breakpoints
| Name | Width | 용도 |
|------|-------|------|
| base | 0-639px | 모바일 (기본) |
| sm | 640px | 소형 태블릿 |
| md | 768px | 태블릿 |
| lg | 1024px | 데스크톱 |
| xl | 1280px | 대형 데스크톱 |

### Layout Method Priority (우선순위)
1. **Flexbox** — 대부분의 레이아웃 (1D 정렬)
2. **CSS Grid** — 복잡한 2D 레이아웃에만
3. **float/absolute** — 절대 사용 금지 (불가피한 경우만)

### Mobile Requirements
- 텍스트 입력 최소 **16px** (iOS Safari 자동 줌 방지)
- 터치 타겟 최소 **44px**
- viewport 설정: `width=device-width, initialScale=1, maximumScale=1`

---

## 4. Spacing & Tailwind Patterns

### Spacing Rules
- **Tailwind 표준 스케일 사용** (arbitrary 값 금지)
  - OK: `p-4`, `mx-2`, `py-6`, `gap-4`
  - NG: `p-[16px]`, `mx-[8px]`, `py-[24px]`
- 자식 요소 간격은 **gap 클래스** 사용: `gap-4`, `gap-x-2`, `gap-y-6`
- **space-\* 클래스 사용 금지**
- 같은 요소에 **margin/padding과 gap 혼용 금지**

### Spacing Scale (4px base)
```
1:  4px    5:  20px    10: 40px
2:  8px    6:  24px    12: 48px
3:  12px   8:  32px    16: 64px
4:  16px
```

---

## 5. Visual Elements & Icons

### Hard Rules
- **emoji를 아이콘 대신 사용 금지**
- 아이콘 크기 일관성 유지: **16px, 20px, 24px** 중 선택
- 프로젝트 기존 아이콘 우선 사용 (lucide-react 기본)

### Forbidden Patterns
- 추상적 도형(gradient circle, blurry square, decorative blob)을 필러로 사용 금지
- 복잡한 일러스트레이션을 SVG로 직접 작성 금지
- 지리적 맵/국가 경계를 SVG 패스로 수동 작성 금지 (매핑 라이브러리 사용)

### Image Usage
- placeholder 이미지 대신 실제 이미지 사용 권장
- 이미지를 활용하여 매력적이고 기억에 남는 인터페이스 설계

---

## 6. Component Conventions (shadcn/ui 기반)

### Default Stack
- UI 프레임워크: **shadcn/ui** + **Tailwind CSS**
- 차트: **Recharts** (shadcn/ui charts)
- 아이콘: **lucide-react**

### Form Layout
- `FieldGroup` + `Field` + `FieldLabel` 사용 (raw div + space-y 금지)
- `FieldSet` + `FieldLegend`로 관련 체크박스/라디오/스위치 그룹화
- `InputGroup` + `InputGroupInput`으로 아이콘/버튼 포함 인풋 구성

### Component Usage
| 용도 | 사용할 것 | 사용하지 말 것 |
|------|----------|--------------|
| 빈 상태 | `Empty` 컴포넌트 | 커스텀 마크업 |
| 로딩 버튼 | `Spinner` 컴포넌트 | 커스텀 스피너 |
| 액션 버튼 그룹 | `ButtonGroup` | `ToggleGroup` (상태 토글용) |
| 데이터 패칭 | SWR | useEffect 내 fetch |

### Component Design Principles
- 한 파일에 하나의 컴포넌트 (단일 책임)
- `React.memo` 적용
- Props drilling 대신 composition 패턴

---

## 7. Accessibility (WCAG AA)

### Contrast
- 일반 텍스트: **4.5:1** 이상
- 대형 텍스트 (18px+ bold 또는 24px+): **3:1** 이상
- UI 컴포넌트/그래픽: **3:1** 이상

### Semantic HTML
- 적절한 시맨틱 요소 사용: `main`, `header`, `nav`, `section`, `article`, `aside`
- 올바른 ARIA role 및 attribute 적용
- 스크린 리더 전용 텍스트: `sr-only` Tailwind 클래스

### Interactive Elements
- 모든 인터랙티브 요소에 키보드 접근 보장
- focus-visible 스타일 필수 (ring 토큰 활용)
- 비장식 이미지에 alt 텍스트 필수
- reduced-motion 미디어 쿼리 대응
- 텍스트 200% 확대 시 레이아웃 깨짐 없어야 함

---

## 8. Handoff Checklist (-> @Bart)

디자인 산출물을 Frontend(@Bart)에 전달할 때 필수 포함 항목:

### 필수 산출물
- [ ] Color palette (시맨틱 토큰 + CSS 변수 정의)
- [ ] Typography scale (폰트 패밀리, 사이즈, weight, line-height)
- [ ] Spacing system (base unit + scale)
- [ ] Component specs (모든 상태: default/hover/active/focus/disabled/loading/error/empty)
- [ ] Responsive behavior (각 breakpoint별 레이아웃 변화)
- [ ] Accessibility notes (대비 비율, ARIA 요구사항, 키보드 내비게이션)

### 상태별 정의 필수
모든 인터랙티브 컴포넌트에 대해:
- Default / Hover / Active / Focus / Disabled
- Loading / Error / Empty (해당 시)

---

## 9. Design Generation Process

### Step 1: 영감 수집
- 모호한 요청("멋진 랜딩 페이지")이나 명확한 심미적 방향이 없을 때
- 색상/스타일/브랜드 키워드 기반 디자인 영감 생성
- 정확한 클론이나 단순 스타일 수정 시에는 생략

### Step 2: 팔레트 구성
- 3-5색 엄격 제한
- primary -> neutral -> accent 순서로 결정
- 다크 모드 변형 함께 정의

### Step 3: 레이아웃 설계
- 모바일 와이어프레임부터 시작
- breakpoint별 확장 전략 수립

### Step 4: 컴포넌트 상세
- shadcn/ui 기본 컴포넌트 기반 확장
- 모든 상태 정의
- 접근성 요구사항 명시

### Step 5: 검증
- 색상 대비 WCAG AA 충족 확인
- 터치 타겟 44px 확인
- 시맨틱 토큰 누락 없는지 확인

### Final Rule
> "Ship something interesting rather than boring, but never ugly."
> 지루한 것보다 흥미로운 것을, 하지만 절대 못생긴 것은 안 된다.
