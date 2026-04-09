# 회의 결정: Krusty 토스 스타일 디자이너 업그레이드 — 잔여 갭 분석 및 구현 계획
> 회의 ID: 9
> 유형: planning
> 일시: 2026-04-09T06:30:24.189Z
> 참여자: designer, frontend, backend

## 의견 요약
### designer
이제 전체 갭을 정확히 파악했습니다. 디자이너 관점에서 의견을 제출합니다.

---

*1. 핵심 의견*

6가지 갭 중 즉시 실행 가능한 것과 결정이 필요한 것을 분리해야 합니다. 브랜드 컬러 이슈(`#0064FF` vs `#3182F6`)는 *제품 UI 블루 `#3182F6` 유지*를 강력히 추천하며, `design-tokens.md` 토스 전환과 TDS 11종 컴포넌트 반영은 즉시 실행할 수 있습니다. Closed Token Layer 전략은 현재 "절대 금지" 목록을 확장하는 형태로 자연스럽게 구현 가능합니다.

---

*2. 근거 — 갭별 분석*

*갭 1: 색상 토큰 3계층 체계 (Base→Semantic→Component)*

현재 `toss-design-system.md:242-289`의 Quick Reference CSS에는 플랫한 변수만 존재합니다. 예를 들어:

```
--toss-blue: #3182F6      (현재: 원시값과 시맨틱이 혼재)
--bg-page: #F4F4F4         (시맨틱이지만 Layer 구분 없음)
```

Lisa 리서치(`research:178-191`)의 3계층 구조를 적용하면:

```
/* Layer 1: Base (원시) */
--color-blue-500: #3182F6;
--color-gray-50: #F4F4F4;

/* Layer 2: Semantic (용도) */
--fill-brand-primary: var(--color-blue-500);
--bg-page: var(--color-gray-50);

/* Layer 3: Component (컴포넌트 전용) */
--button-fill-primary: var(--fill-brand-primary);
--card-bg: var(--bg-surface);
```

이 구조는 `design-tokens.md` 전환 시 함께 적용하면 됩니다. 기존 `toss-design-system.md`의 Quick Reference는 *변경 불필요* — `design-tokens.md`가 CSS 구현 예시를 담당하는 것이 역할 분리상 맞습니다.

*갭 2: TDS 11종 공개 컴포넌트*

현재 `component-guide.md`의 의사결정 트리(`:98-121`)에는 토스 컴포넌트가 일반 명칭으로 되어 있습니다. TDS 공식 11종과 매핑하면:

| 현재 component-guide.md 명칭 | TDS 공식 컴포넌트 | 반영 방식 |
| --- | --- | --- |
| Full-width Button | `BottomCTA` + `Button` | 분리 (하단 고정 CTA vs 범용 버튼) |
| Secondary Button | `Button` variant | Props 추가 |
| 카드 내부 리스트 | `ListRow` + `ListHeader` | 핵심 추가 (토스 UI의 근간) |
| Skeleton shimmer | (TDS 미포함) | 유지 |
| 바텀시트 | (TDS 미포함) | 유지 |
| Toast | (TDS 미포함) | 유지 |
| — | `Badge` | 신규 추가 |
| — | `Border` | 신규 추가 |
| — | `Asset` | 신규 추가 |
| — | `Navigation` | 기존 스펙 강화 |
| — | `Paragraph` | 신규 추가 |
| — | `Tab` | 신규 추가 |
| — | `TopPager` | 신규 추가 |

추천 구조: `component-guide.md`에 *§6. TDS 공식 컴포넌트 카탈로그* 섹션을 추가하고, 각 컴포넌트를 리서치에서 제안한 8섹션 템플릿(메타데이터/개요/해부도/토큰/Props/상태/코드예제/교차참조)의 *축약 버전*(4섹션: 개요/토큰/상태/코드예제)으로 작성. 전체 8섹션은 토큰 비용이 과다합니다.

*갭 3: Closed Token Layer 전략*

현재 `designer.md:117-126`의 "절대 금지" 목록이 이미 Closed Token Layer 역할을 하고 있으나, *허용 토큰 화이트리스트*가 명
### frontend
*[회의 #9] Bart 의견 — CSS 3계층 토큰 전환 & Tailwind 정합성*

*1. 핵심 의견*

3계층 토큰 체계(Base→Semantic→Component) 도입은 현재 프론트엔드 아키텍처와 *자연스럽게 맞물리며*, 오히려 디자인-구현 간 불일치를 구조적으로 방지할 수 있는 좋은 기회입니다. 단, 현재 `design-tokens.md`(`examples/design-tokens.md`)가 *Apple 스타일 그대로*이고(`#0071e3`, SF Pro, 8px 기반 spacing), `toss-design-system.md`의 Quick Reference CSS(`toss-design-system.md:244-289`)는 *1계층 flat 구조*이므로, 두 파일 모두 3계층으로 재설계해야 합니다.

*2. 근거 — 구체적 영향 분석*

• *질문 1: 3계층 CSS 변수 전환의 기존 코드 영향*

현재 `conventions.md:83-85`에서 시맨틱 토큰(`--background`, `--foreground`, `--primary` 등)을 이미 사용 중이므로 *Semantic 레이어는 이미 존재*합니다. 변경 포인트는:

```
[현재] globals.css에서 바로 정의
--primary: #3182F6;
--background: #F4F4F4;

[3계층 전환 후]
/* Base (값 자체) */
--toss-blue-500: #3182F6;
--gray-50: #F4F4F4;

/* Semantic (의미 부여) */
--color-primary: var(--toss-blue-500);
--color-bg-page: var(--gray-50);

/* Component (컴포넌트 바인딩) */
--btn-primary-bg: var(--color-primary);
--card-bg: var(--color-bg-surface);
```

기존 코드에서 `bg-primary`, `text-foreground` 등 Tailwind 시맨틱 클래스를 사용하고 있다면, *Tailwind config의 참조 대상만 Semantic 레이어로 맞추면* 컴포넌트 코드 변경은 최소화됩니다.

| 계층 | 변경 장소 | 코드 영향 |
| --- | --- | --- |
| Base | `globals.css` `:root` | 없음 (내부 변수) |
| Semantic | `globals.css` + `tailwind.config.ts` | Tailwind extend 키 매핑만 업데이트 |
| Component | shadcn/ui 테마 파일 | 각 컴포넌트 CSS 변수 추가 |

*기존 컴포넌트 코드(`className="bg-primary"`)는 변경 불필요* — Tailwind config에서 `primary`가 참조하는 CSS 변수만 바꾸면 됩니다.

• *질문 2: Tailwind 설정 정합성 이슈*

현재 문제점 3가지:

*① Spacing 기반 단위 불일치*
`design-tokens.md:93-103` — Apple은 *8px 기반* (`--space-1: 8px`)
`toss-design-system.md:99-108` — 토스는 *4px 기반* (`--space-1: 4px`)
Tailwind 기본값도 4px 기반이므로 토스와 자연스럽게 정렬됩니다. 커스텀 spacing 오버라이드를 *제거*하고 Tailwind 기본 스케일에 맞추는 게 최선입니다.

```ts
// tailwind.config.ts — 커스텀 spacing 불필요
// Tailwind 기본: p-1=4px, p-2=8px, p-3=12px, p-4=16px, p-5=20px
// 토스 기준과 완벽 일치
```

*② Radius 토큰명 충돌*
Apple: `--radius-micro: 5px`, `--radius-md: 8px`, `--radius-pill: 980px`
토스: `--radius-micro: 4px`, `--radius-sm: 8px`, `--radius-card: 16px`

토큰명은 비슷하지만 *값이 다
### backend
회의 #9 스레드에 백엔드 관점 의견을 제출했습니다.

*요약:* 회의 #8과 동일한 결론 — 디자인 토큰 3계층 전환, TDS 11종 컴포넌트 반영, 브랜드 컬러 결정, 다크모드 지원 모두 *백엔드 영향 없음*입니다. 백엔드는 `priority: "high"` 같은 의미론적 데이터만 반환하고, 색상 매핑은 프론트엔드 CSS 토큰에서 처리하는 클린한 분리 구조가 확인되었습니다. 향후 멀티 디바이스 테마 동기화 요구사항이 나올 경우에만 `user_preferences` API 추가가 필요합니다.

## 최종 결정
모든 작업이 완료되었습니다. 최종 요약:

---

✅ *회의 #9 종합 결정 및 실행 완료*

*결정 6건 — 전원 합의*

• *브랜드 컬러*: `#3182F6` 유지 — 토스 앱 제품 UI 기준 (Krusty 의견 채택)
• *3계층 토큰*: Base→Semantic→Component 구조 도입 — Tailwind config 자연스럽게 정렬
• *TDS 11종 컴포넌트*: 4섹션 축약으로 카탈로그 추가 (BottomCTA, ListRow, Badge, Tab 등)
• *Closed Token Layer*: 허용 토큰 화이트리스트로 LLM 유사값 발명 차단
• *컴포넌트 템플릿*: 8섹션 full 템플릿 생성 (필요 시 로드)
• *백엔드 영향*: 없음 확인

*수정 파일 4개*:

| 파일 | 변경 |
| --- | --- |
| `examples/design-tokens.md` | Apple 1계층 → 토스 3계층 전면 재작성 + Tailwind config 매핑 |
| `designer.md` | Closed Token Layer 화이트리스트 추가 (절대 금지 상단) |
| `component-guide.md` | §6 TDS 11종 컴포넌트 카탈로그 추가 |
| `templates/component-spec.md` | 신규 생성 — 8섹션 full 스펙 템플릿 |

*Krusty 토스 전환 전체 완료 현황*:
• 회의 #8: 에이전트 정체성·핵심 토큰·스펙·체크리스트 전환 ✅
• 회의 #9: 3계층 토큰·TDS 컴포넌트·Closed Token Layer 보완 ✅

다음 단계 추천: 기존 프로젝트 CSS 토큰 마이그레이션이 필요하면 Bart에게 위임 가능합니다.

> ⚠️ _[bridge 자동 경고] 수치 주장(N개, N회 등)이 포함되어 있으나 소스 라인 번호 인용이 없습니다. 파일명:라인번호를 명시하세요._