---
last-updated: 2026-04-09
confidence: high
sources:
  - https://toss.tech/article/toss-design-system
  - https://toss.im/slash-21/sessions/3-3
---

# 토스 디자인 시스템 AI 에이전트 적용 리서치

> ⚠️ 이 보고서의 수치는 2026-04-09 기준입니다. 현재와 다를 수 있습니다.

**모드**: Practical (실행 가능한 권고 중심)

---

## 1. 토스 핵심 디자인 토큰

### 1-1. 브랜드 컬러

| 역할 | Hex | RGB | Pantone | 검증 |
|------|-----|-----|---------|------|
| **Toss Blue (Primary)** | `#0064FF` | R0 G100 B255 | 2175 C | ✅ brand.toss.im 원문 확인 |
| **Toss Gray (Secondary)** | `#202632` | R32 G38 B50 | 433 C | ✅ brand.toss.im 원문 확인 |

#### 시맨틱 컬러 토큰 체계 (TDS 내부)

TDS는 3계층 토큰 구조를 사용: ✅ (toss.tech 원문 확인)

| 계층 | 설명 | 예시 |
|------|------|------|
| **Base** | 원시 색상값 | `blue-500: #0064FF` |
| **Semantic** | 용도 기반 이름 | `fill-brand-primary`, `text-primary` |
| **Component** | 컴포넌트 전용 | `button-fill-primary` |

시맨틱 토큰 네이밍: `Target(fill/text/border)` + `Role(brand/neutral/primary)` + `Variant(weak/alt)` ✅

색공간: **OKLCH** 기반 — 인지적으로 균일한 명도 체계 ✅ (toss.tech 컬러 시스템 업데이트 기사)

#### 추정 UI 컬러 (앱 관찰 기반)

| 역할 | Light | Dark | 검증 |
|------|-------|------|------|
| 배경 Primary | `#FFFFFF` | `#1B1B1E` (추정) | ⚠️ (앱 관찰 기반, 공식 미공개) |
| 배경 Secondary | `#F4F4F4` (추정) | `#2C2C2E` (추정) | ⚠️ (앱 관찰 기반) |
| 본문 텍스트 | `#191F28` (추정) | `#FFFFFF` | ⚠️ (앱 관찰 기반) |
| 보조 텍스트 | `#8B95A1` (추정) | — | ⚠️ (앱 관찰 기반) |
| 비활성/3차 | `#B0B8C1` (추정) | — | ⚠️ (앱 관찰 기반) |
| 구분선 | `#E5E8EB` (추정) | — | ⚠️ (앱 관찰 기반) |
| Success | `#3CB371` (추정) | — | ⚠️ (앱 관찰 기반) |
| Error/Negative | `#E54459` (추정) | — | ⚠️ (앱 관찰 기반) |

> ⚠️ TDS UI 컬러 전체는 비공개입니다. 위 추정값은 토스 앱 스크린샷 및 클론 프로젝트에서 추출한 참고값입니다. 실제 적용 시 토스 앱에서 직접 색상 추출(color picker)을 권장합니다.

### 1-2. 타이포그래피

#### Toss Product Sans

| 항목 | 값 | 검증 |
|------|-----|------|
| 폰트명 | Toss Product Sans | ✅ |
| 개발사 | 비바리퍼블리카 × 산돌(1차) × 이도타입(2차) | ✅ (tossfeed 원문) |
| Weight 수 | 7종 | ✅ (tossfeed 원문) |
| 특징 | 금융 기호 최적화, 가변폭+고정폭 숫자 지원 | ✅ |
| 공개 범위 | 비공개 (토스 계열사 전용) | ✅ |
| Fallback | `"Pretendard", -apple-system, BlinkMacSystemFont, system-ui, sans-serif` | ⚠️ (클론 프로젝트 참고) |

#### 타이포 스케일 (TDS CSS 변수 기반)

TDS는 `f11`~`f42` (11px~42px) 세분화 크기 체계 사용 ✅ (toss.tech 원문)
- **Title 스케일**: `t1`(f30)~`t7`(f13) — 7단계
- **Subtitle 스케일**: `st1`~`st13` — 13단계
- 각 크기별 line-height, badge-fontSize, link 스펙 포함

| 용도 | 추정 크기 | 추정 Weight | 검증 |
|------|----------|------------|------|
| Hero/대형 제목 | 28~32px | Bold (700) | ⚠️ (앱 관찰) |
| 섹션 제목 | 22~24px | Bold (700) | ⚠️ |
| 카드 제목 | 17~18px | SemiBold (600) | ⚠️ |
| 본문 | 15~16px | Regular (400) | ⚠️ |
| 보조 텍스트 | 13~14px | Regular (400) | ⚠️ |
| 캡션 | 11~12px | Regular (400) | ⚠️ |

### 1-3. 여백 체계

| 항목 | 값 | 검증 |
|------|-----|------|
| 기본 그리드 | 8px 기반 (추정) | ⚠️ (업계 표준 + 앱 관찰) |
| 화면 좌우 패딩 | 20px (추정) | ⚠️ (앱 관찰) |
| 카드 내부 패딩 | 16~20px (추정) | ⚠️ |
| 섹션 간 간격 | 24~32px (추정) | ⚠️ |
| 리스트 아이템 간격 | 12~16px (추정) | ⚠️ |
| badge-padding | 3px~5px (크기별 차등) | ✅ (TDS CSS 변수) |
| badge-borderRadius | 8px~14px (크기별 증가) | ✅ (TDS CSS 변수) |

### 1-4. Border Radius

| 컴포넌트 | Radius | 검증 |
|----------|--------|------|
| 카드 | 16px (추정) | ⚠️ (앱 관찰) |
| 버튼 (CTA) | 12px 또는 pill(999px) (추정) | ⚠️ |
| 입력 필드 | 12px (추정) | ⚠️ |
| 뱃지 | 8~14px (크기별) | ✅ (TDS CSS) |
| 바텀시트 상단 | 24px (추정) | ⚠️ |
| 아바타/프로필 | 50% (원형) | ⚠️ |

---

## 2. 토스 브랜드 스타일 특징

### 핵심 디자인 원칙 ✅ (toss.tech 복수 기사 종합)

1. **한 화면 한 행동** — 복잡한 금융을 단순화, 사용자가 한 번에 하나만 결정
2. **카드 기반 정보 위계** — 모든 정보를 카드 단위로 구분, 스캔 가능한 UI
3. **감정적 미니멀리즘** — 단순하되 차갑지 않은, 3D 일러스트로 생동감 부여
4. **접근성 우선** — 보이스오버, 큰 텍스트, 동작 줄이기 모든 케이스 대응
5. **다크/라이트 모드** — 양 모드 모두 완전 지원, 금융 정보 보호 기능 겸비

### Apple 스타일 vs 토스 스타일 핵심 차이

| 요소 | Apple (현재 Krusty) | Toss (목표) |
|------|-------------------|-------------|
| 강조색 | `#0071e3` 단일 | `#0064FF` (Toss Blue) |
| 배경 | 순백/순흑 이진 리듬 | 밝은 회색 계열 배경 + 화이트 카드 |
| 카드 스타일 | border 없음, shadow 기반 | 경량 shadow 또는 배경 대비로 구분 |
| 내비게이션 | 반투명 blur bar | 고정 하단 탭바 (모바일 네이티브) |
| 타이포 | SF Pro / Helvetica Neue | Toss Product Sans / Pretendard |
| 여백 | 80px+ 대형 섹션 패딩 | 컴팩트, 정보 밀도 높음 |
| 일러스트 | 제품 사진 중심 | 3D 일러스트/아이콘 |
| CTA 버튼 | pill(980px) 또는 8px | 12px radius 또는 pill |
| 정보 밀도 | 낮음 (여백 강조) | 높음 (카드 적층) |

---

## 3. TDS 공개 컴포넌트 구조

### 앱인토스 공개 컴포넌트 11종 ✅ (developers-apps-in-toss.toss.im)

| 컴포넌트 | 용도 |
|----------|------|
| Badge | 상태 라벨, 카운터 |
| Border | 구분선 |
| BottomCTA | 하단 고정 액션 버튼 |
| Button | 범용 버튼 |
| Asset | 아이콘/이미지 에셋 |
| ListRow | 목록 행 (가장 핵심, 토스 UI의 근간) |
| ListHeader | 목록 섹션 헤더 |
| Navigation | 상단 내비게이션 바 |
| Paragraph | 텍스트 블록 |
| Tab | 탭 전환 |
| TopPager | 상단 페이저 |

### 가이드 구조 원칙 ✅ (toss.tech)

- 읽기 순서: 위→아래 선형 (정사각형 나열 지양)
- 정보 위계: 상위 옵션 → 구성 요소 → 상태 변화 → 접근성
- 최악 케이스 먼저 제시 → 옵션 단계별 검토
- 접근성: 가이드 하단 통일 섹션 (큰 텍스트, 보이스오버, 동작 줄이기)

---

## 4. AI 에이전트에 브랜드 스타일 주입 Best Practice

### 방법론 ✅ (hvpandya.com 원문 확인)

Hardik Pandya의 "Expose your design system to LLMs" 프레임워크:

#### 4-1. 4계층 스펙 파일 구조

```
specs/
├── foundations/
│   ├── color.md          — 색상 토큰 전체
│   ├── typography.md     — 타이포 스케일, weight, line-height
│   ├── spacing.md        — 그리드, 패딩 규칙
│   ├── radius.md         — 코너 radius 규칙
│   ├── elevation.md      — shadow/z-index
│   └── motion.md         — 애니메이션 규칙
├── token-reference.md    — CSS 변수 마스터 맵
├── components/
│   └── {component}.md    — 컴포넌트별 8섹션 스펙
└── patterns/
    └── layout.md         — 레이아웃 패턴
```

#### 4-2. 3계층 토큰 CSS 구조

```css
/* Layer 1: 원시 토큰 */
--toss-blue: #0064FF;
--toss-gray: #202632;

/* Layer 2: 시맨틱 별칭 (fallback 포함) */
--color-brand-primary: var(--toss-blue, #0064FF);
--color-text-primary: var(--toss-text, #191F28);

/* Layer 3: 컴포넌트가 시맨틱만 참조 */
.button-primary { background: var(--color-brand-primary); }
```

#### 4-3. 컴포넌트 스펙 8섹션 템플릿

1. 메타데이터 (이름, 카테고리, 상태)
2. 개요 (사용 시기 / 비사용 시기)
3. 해부도 (구성 요소)
4. **사용 토큰** (CSS 변수 명시) ← 핵심
5. Props/API
6. 상태 (default, hover, active, focus, disabled, error)
7. 코드 예제
8. 교차 참조

#### 4-4. 시스템 프롬프트 핵심 전략

1. **Closed Token Layer**: LLM이 토큰 외 값을 발명하지 못하도록 "이 토큰 목록 외 색상/크기 사용 금지" 규칙 명시
2. **시맨틱 네이밍**: `blue-500` 대신 `color-button-background-brand` 형태 — 용도를 이름에 포함
3. **절대 금지 목록**: 허용되지 않는 값/패턴을 명시적으로 나열
4. **코드 예제 필수**: 각 컴포넌트의 올바른 사용 예시를 포함해야 LLM 준수율 향상

---

## 5. Krusty 에이전트 업그레이드 권고사항

### 현재 상태 분석

현재 `designer.md`는 Apple 디자인 시스템 전문가로 설정되어 있으며, 다음 파일들이 Apple 기준:
- `designer.md` — Identity, 핵심 토큰, Workflow 모두 Apple
- `apple-design-system.md` — Apple 전체 스펙
- `component-guide.md` — Apple 컴포넌트 선택 가이드
- `conventions.md` — Apple 기반 핸드오프 규칙
- `toss-design-guide.md` — Deprecated 상태

### 수정 대상 파일 및 구체적 변경사항

#### 파일 1: `.claude/agents/designer.md` (전면 수정)

| 섹션 | 현재 (Apple) | 변경 (Toss) |
|------|-------------|-------------|
| YAML description | Apple HIG 전문가 | 토스 디자인 시스템(TDS) 전문가 |
| Identity | Apple 디자인 철학 | 토스 디자인 철학 (한 화면 한 행동, 카드 기반, 감정적 미니멀리즘) |
| 핵심 토큰 - 색상 | `#0071e3` Apple Blue | `#0064FF` Toss Blue |
| 핵심 토큰 - 배경 | `#ffffff` / `#000000` | `#FFFFFF` / `#F4F4F4`(추정) |
| 핵심 토큰 - 타이포 | SF Pro / Helvetica Neue | Toss Product Sans / Pretendard |
| 핵심 토큰 - CTA radius | `980px` pill 또는 `8px` | `12px` 또는 pill |
| 절대 금지 | Apple 유채색 금지 등 | 토스 브랜드 가이드 위반 금지 등 |
| Context 파일 참조 | `apple-design-system.md` | `toss-design-system.md` (신규) |
| Workflow | Apple 스펙 로드 | TDS 스펙 로드 |

#### 파일 2: `.claude/context/designer/toss-design-system.md` (신규 작성)

현재 Deprecated된 `toss-design-guide.md`를 완전 대체. `apple-design-system.md`와 동일한 구조로:
- Visual Theme & Atmosphere
- Color System (3계층 토큰 포함)
- Typography System
- Spacing & Grid
- Component Catalog (11종 기반)
- 절대 금지 목록
- 다크/라이트 모드 규칙

#### 파일 3: `.claude/context/designer/component-guide.md` (전면 수정)

- Apple 컴포넌트 → TDS 11종 컴포넌트로 교체
- 색상/타이포/radius 규칙 토스 기준으로 변경
- 컴포넌트 선택 트리 토스 패턴(카드 적층, 리스트 기반)으로 재구성

#### 파일 4: `.claude/context/designer/conventions.md` (부분 수정)

- 핸드오프 체크리스트의 색상/타이포 기준값 교체
- 서비스 타입별 가이드에 핀테크/금융 UI 패턴 추가

#### 파일 5: `examples/design-tokens.md` (전면 수정)

- CSS 변수 예시를 토스 토큰 체계로 교체
- 3계층 토큰 구조 (원시 → 시맨틱 → 컴포넌트) 예시

### 구현 우선순위

1. `designer.md` YAML + Identity + 핵심 토큰 수정 (즉시)
2. `toss-design-system.md` 신규 작성 (핵심)
3. `component-guide.md` 토스 기준 재작성
4. `examples/design-tokens.md` 토스 CSS 변수 예시
5. `conventions.md` 부분 수정

---

## 6. 리스크 및 한계

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| TDS 내부 토큰 비공개 | 높음 | 공개된 값(brand.toss.im) + 앱 관찰 추정값 병행. 추정값은 ⚠️ 표기 |
| Toss Product Sans 비공개 | 중간 | Pretendard를 대체 폰트로 사용, 타이포 스케일만 참조 |
| 컬러 토큰 불완전 | 중간 | 공식 2색(Blue, Gray) + 추정 UI 컬러로 시작, 실제 앱 색상 추출로 보정 |
| 다크모드 스펙 미확인 | 중간 | 라이트 모드 우선 구현, 다크모드는 토스 앱 참고로 점진 보완 |

---

## Sources

- [토스 브랜드 리소스 센터](https://brand.toss.im/) — 브랜드 컬러 hex 코드 공식 출처
- [달리는 기차 바퀴 칠하기: 7년만의 컬러 시스템 업데이트](https://toss.tech/article/tds-color-system-update) — TDS 컬러 토큰 체계
- [토스 디자이너가 제품에만 집중할 수 있는 방법](https://toss.tech/article/toss-design-system) — TDS 개요, 타이포 CSS 변수
- [제품이 커지면 디자인 시스템 가이드는 어떻게 개선돼야 할까?](https://toss.tech/article/toss-design-system-guide) — 가이드 구조 원칙
- [토스 디자인 시스템 (TDS) | 앱인토스](https://developers-apps-in-toss.toss.im/design/components.html) — 공개 컴포넌트 11종
- [Toss Product Sans 제작기](https://toss.im/tossfeed/article/beginning-of-tps) — 폰트 스펙
- [Expose your design system to LLMs](https://hvpandya.com/llm-design-systems) — AI 에이전트 디자인 토큰 주입 방법론
- [Toss Product Sans - 나무위키](https://namu.wiki/w/Toss%20Product%20Sans) — 폰트 배경 정보

> ⚠️ 이 보고서의 수치는 2026-04-09 기준입니다. 현재와 다를 수 있습니다.

---

## Archive

<!-- 300줄 초과 시 구버전 내용을 여기로 이동. 현재 없음 -->
