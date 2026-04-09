# 회의 결정: Krusty 토스 디자인 에이전트 구현 계획 수립 (재작업)
> 회의 ID: 10
> 유형: planning
> 일시: 2026-04-09T07:23:51.448Z
> 참여자: designer, frontend, backend

## 의견 요약
### designer
전체 파일을 분석 완료했습니다. 디자이너 관점에서 구체적인 의견을 제시합니다.

---

*1. 핵심 의견*

현재 파일들의 가장 큰 문제는 *색상 불일치*와 *정보 중복으로 인한 충돌 가능성*입니다. Lisa 리서치에서 확인된 공식 브랜드 컬러 `#0064FF`와 현재 모든 파일에 하드코딩된 `#3182F6`이 다릅니다. 또한 동일한 색상·타이포 테이블이 3~4개 파일에 반복되어, 하나만 수정하면 나머지가 틀어지는 구조적 결함이 있습니다. *단일 진실 원천(Single Source of Truth)* 구조로 전면 재설계해야 합니다.

*2. 근거 (파일별 버그 특정)*

*버그 #1: Toss Blue 색상 불일치*
• Lisa 리서치: brand.toss.im 공식 = `#0064FF`
• 현재 모든 파일: `#3182F6` (출처 불명)
• 단, `#3182F6`은 토스 앱 UI에서 실제로 관찰되는 인터랙티브 블루일 가능성이 높음 (브랜드 블루 ≠ UI 블루)
• *결정 필요*: 브랜드 블루(`#0064FF`)를 Base 토큰으로, UI 블루(`#3182F6`)를 Semantic 토큰으로 분리할지, 아니면 UI 블루 하나로 통일할지

*버그 #2: 파일 간 정보 중복 (충돌 위험)*
동일한 색상 테이블이 반복되는 위치:

| 정보 | 반복 파일 수 | 위치 |
| --- | --- | --- |
| 색상 팔레트 | 4곳 | `designer.md:79-89`, `toss-design-system.md:25-69`, `component-guide.md:9-34`, `design-tokens.md:25-54` |
| 타이포 스케일 | 3곳 | `designer.md:92-96`, `toss-design-system.md:82-92`, `component-guide.md:40-51` |
| Radius 스케일 | 3곳 | `designer.md:120`, `toss-design-system.md:116-124`, `component-guide.md:57-64` |
| Shadow 값 | 3곳 | `designer.md:122`, `toss-design-system.md:67-68`, `component-guide.md:73-76` |

하나라도 수정 시 나머지를 동기화하지 않으면 Closed Token Layer 위반이 발생합니다.

*버그 #3: Context 파일 테이블의 참조 불일치* (`designer.md:45`)
• `templates/design-system-spec.md`를 참조하지만 실제 파일명은 `templates/component-spec.md`
• `examples/responsive-framework.md`는 존재하나, Context 테이블에서 로드 시점 설명이 모호

*버그 #4: toss-design-guide.md 잔재*
• `toss-design-guide.md`가 별도로 존재 — `toss-design-system.md`와 역할이 100% 중복
• conventions.md §0에서는 이 파일을 참조하지 않으므로 orphan 파일

*3. 리스크/우려사항*

• *토큰 토큰 중복 제거 시 Bart 영향*: `designer.md`의 인라인 토큰(`:79-133`)을 제거하면, context 파일 미로드 시 fallback이 사라짐. 에이전트 정의 파일에 최소 핵심값은 유지해야 함
• *`#0064FF` vs `#3182F6` 미결정 상태에서 작업 시작 시* 전체 재작업 발생 위험
• 파일 6개 동시 재작성은 상호 참조 오류 위험이 높음 — 의존 순서대로 순차 작성 필요

*4. 추천 행동 — 구체적 파일 구조 및 내용 명세*

*Phase 1: 색상 결정 (선행 필수)*
`#0064FF`(브랜드) vs `#3182F6`(UI) 이원화 여부 확정. 내 추천: *UI 블루 `#3182F6` 단일 사용*. 이유 — 우리는 브랜드 마케팅이 아니라 UI를 만들고, 토스 앱 관찰 결과 인터랙티브 요소에 `#3182F6` 계열이 실사용됨.

*Phase 2: 파일 구조 재설계 (정보 중복 제거)
### frontend
회의 #10 스레드에 프론트엔드 관점 의견을 제출했습니다.

*요약:*
• *가장 치명적 버그*: `component-guide.md` 코드 예시가 Tailwind 기본 색상 클래스(`text-gray-900` 등)를 사용 — 토스 커스텀 시맨틱 클래스(`text-foreground` 등)와 불일치. Krusty가 이 예시 기반으로 스펙을 내면 토스 색상이 아닌 Tailwind 기본 색상으로 구현됨
• *파일 참조 오류*: `designer.md`가 존재하지 않는 `templates/design-system-spec.md`를 참조 (실제: `component-spec.md`)
• *규칙 모순*: "arbitrary 값 금지" 규칙이면서 `h-[54px]` 사용 — Tailwind config 확장 필요
• *6개 파일 전체에 대한 구체적 수정 명세* 포함

> ⚠️ _[bridge 자동 경고] 수치 주장(N개, N회 등)이 포함되어 있으나 소스 라인 번호 인용이 없습니다. 파일명:라인번호를 명시하세요._
### backend
회의 스레드에 백엔드 관점 의견을 제출했습니다.

*요약:*
• 백엔드 직접 영향은 없지만, 현재 파일 6개를 전수 검토해서 *구조적 중복 문제 3가지*를 식별했습니다
• 동일 토큰값이 `designer.md`, `toss-design-system.md`, `component-guide.md`, `conventions.md` 4곳에 중복 정의 → 수정 시 동기화 실패가 버그의 근본 원인으로 추정
• *Single Source of Truth 원칙*을 적용해서 `toss-design-system.md`를 유일한 정본으로 두고, 나머지 파일은 참조만 하도록 구조를 개편할 것을 제안했습니다

## 최종 결정


순차 위임이 예약되었습니다. 현재 진행 상황:

*1단계* → Krusty(Designer): 토스 디자이너 에이전트 파일 전체 재작성 중
*2단계* → Chalmers(QA): Krusty 완료 후 SSOT·색상·참조·일관성 검증 예정

Krusty 작업 완료 → QA 검증 → 종합 보고 순으로 자동 진행됩니다. 전체 완료 후 결과를 보고드리겠습니다.