# 회의 결정: Krusty 에이전트 토스(Toss) 스타일 디자이너로 업그레이드 — 디자인 시스템 전환 전략
> 회의 ID: 8
> 유형: architecture
> 일시: 2026-04-09T06:22:31.992Z
> 참여자: designer, frontend, backend

## 의견 요약
### designer
현재 파일 구조와 스펙을 모두 확인했습니다. 디자이너 관점에서 전환 전략 의견을 제출합니다.

---

*1. 핵심 의견*

토스 스타일로 *전면 교체*를 추천합니다. 병존(dual system)은 디자인 일관성을 파괴하고 매 작업마다 "어떤 시스템?" 판단 비용이 발생합니다. 현재 에이전트 프롬프트(`designer.md`)에 Apple 토큰이 하드코딩된 곳이 *최소 5군데*(Identity, 핵심 토큰 표, 절대 금지 목록, Workflow, Deliverables)이므로, 부분 패치가 아닌 구조적 전환이 필요합니다.

---

*2. 근거 — 변경 범위 분석*

전환 시 수정해야 할 파일과 영역을 정확히 식별했습니다:

• *`designer.md` (에이전트 프롬프트)* — `designer.md:2-3` description, `designer.md:7` vibe, `designer.md:16-25` Identity 전체, `designer.md:36-43` Context 파일 참조 테이블, `designer.md:61-70` Workflow (apple.com → toss.im 참조로 변경), `designer.md:74-106` 핵심 토큰 및 절대 금지 목록 전면 교체

• *`apple-design-system.md`* → `toss-design-system.md`로 교체 신규 작성 (232줄 규모)

• *`component-guide.md`* — `component-guide.md:7-33` 색상 규칙, `component-guide.md:37-51` 타이포, `component-guide.md:55-64` radius, `component-guide.md:70-95` elevation/레이아웃, `component-guide.md:160-197` 자가 체크리스트 — 전면 교체

• *`conventions.md`* — `conventions.md:9-26` 서비스 타입별 가이드 테이블 및 기본값 블록

• *`toss-design-guide.md`* — Deprecated 태그 제거 후 신규 콘텐츠로 교체 (또는 삭제 후 `toss-design-system.md` 신규 생성)

*토큰 값 차이 요약 (핵심 충돌점):*

| 항목 | Apple (현재) | Toss (전환 후) |
| --- | --- | --- |
| Primary Blue | `#0071e3` | `#3182F6` |
| 배경 (secondary) | `#f5f5f7` | `#F4F4F4` |
| 카드 radius | `8px` | `16px` |
| 버튼 radius | `980px` (pill) | `12px` |
| 버튼 높이 | 44px 터치타겟 | `54px` 명시 |
| 폰트 | SF Pro (Helvetica fallback) | Toss Product Sans (Pretendard fallback) |
| Hero 크기 | `56px` | `32px` |
| 네비게이션 | Glass blur 반투명 | 하단 탭 바 (모바일), 미니멀 상단 |
| 로딩 | Skeleton (동일) | Skeleton shimmer (동일) |
| 모션 | 없음 (정적) | Spring 애니메이션, 바텀시트, 카운트업 |
| 여백 단위 | 8px 기반, 섹션 80px | 좌우 20px, 섹션 간격 32px |

---

*3. 리스크/우려사항*

• *철학적 차이가 큼* — Apple은 "제품이 주인공, UI는 후퇴"이고 토스는 "카드 기반 정보 구조화 + 모션으로 맥락 유지". 단순 색상·수치 교체로 끝나지 않고 *컴포넌트 선택 의사결정 트리 자체를 재설계*해야 합니다 (`component-guide.md:98-121`)

• *모션 시스템 신규 추가 필요* — 현재 Apple 시스템에는 모션 스펙이 없음. 토스는 spring 애니메이션, 바텀시트, 스와이프, 숫자 카운트업이 핵심이므로 모션 가이드 섹션을 새로 만들어야 합니다

• *기존 프로젝트 산출물 호환성* — 이전에 Apple 스타일로 핸드오프한 CSS 토큰 파일이 있다면
### frontend
이제 현황을 파악했습니다. Frontend 관점에서 의견을 제시합니다.

---

*[회의 #8] Bart 의견 — 토스 디자인 시스템 전환, Frontend 영향 분석*

*1. 핵심 의견*

토스 스타일 전환은 프론트엔드 구현 레이어에서 *시맨틱 토큰 재정의 + 컴포넌트 스타일 오버라이드 + 폰트 교체* 3가지가 핵심이며, 현재 아키텍처(시맨틱 토큰 기반 + shadcn/ui)가 이미 디자인 시스템 교체에 유리한 구조입니다. 전환 비용은 생각보다 낮지만, *모션/인터랙션 패턴 변경*이 가장 큰 작업량을 차지할 것입니다.

*2. 근거 — 구체적 변경 필요 사항*

• *시맨틱 토큰 재정의 (낮은 비용)*
현재 `conventions.md:80-86`에서 `--background`, `--foreground`, `--primary` 등 시맨틱 토큰 체계를 사용 중. 토스 컬러로 전환 시 `globals.css`의 토큰 값만 변경하면 전체 앱에 반영됩니다.

```
--primary: #3182F6 (토스 블루)
--background: #F4F4F4
--foreground: #191F28
--muted: #F2F4F6
--destructive: #F04452
```

다크 모드도 토큰 재정의로 대응 가능 (`#17171C`, `#2C2C35`).

• *폰트 교체 (중간 비용)*
현재 Inter 폰트 사용 중 (`conventions.md:88-104`). Toss Product Sans는 자체 서체로 라이선스 확인이 필요합니다. fallback으로 Pretendard(오픈소스)를 쓸 수 있으나, `next/font`에서 로컬 폰트로 등록해야 합니다.

```tsx
// 변경: next/font/google → next/font/local
import localFont from 'next/font/local';
const tossFont = localFont({ src: '...', variable: '--font-toss' });
```

• *컴포넌트 스타일 오버라이드 (중간 비용)*
shadcn/ui 컴포넌트의 radius, 높이, 패딩 조정 필요:

| 항목 | 현재 (Apple) | 토스 |
| --- | --- | --- |
| 카드 radius | 12px | 16px |
| 버튼 radius | 8~12px | 12px |
| 버튼 높이 | 44px | 54px |
| 인풋 높이 | 44px | 54px |
| 좌우 패딩 | 16px | 20px |
| 섹션 간격 | 24px | 32px |
| 로딩 패턴 | Spinner 허용 | Skeleton shimmer 전용 |

`--radius` 토큰과 shadcn 테마 파일에서 일괄 조정 가능. 단, Spinner → Skeleton 전환은 컴포넌트별 개별 작업 필요.

• *모션/인터랙션 패턴 (높은 비용 — 가장 큰 작업)*
토스의 핵심 차별점인 spring 애니메이션, 바텀시트, 숫자 카운트업 등은 새로운 구현이 필요합니다:
  - 바텀시트 패턴: 기존 모달 → 바텀시트 전환 (framer-motion 또는 vaul 라이브러리)
  - 숫자 카운트업: 금액 표시에 카운트업 애니메이션 구현
  - spring 애니메이션: CSS ease-in-out → spring physics 기반 전환

• *터치 타겟 호환*
현재 제 컨벤션에서 최소 44px 터치 타겟을 강제하고 있는데, 토스는 48px 기준. `agent prompt`의 44px → 48px 상향 조정 필요.

*3. 리스크/우려사항*

• *Toss Product Sans 라이선스*: 토스 자체 서체라 외부 사용 가능 여부 확인 필수. 불가 시 Pretendard로 대체해야 하며, 시각적 차이 발생.
• *shadcn/ui 호환성*: 버튼 높이 54px, 인풋 높이 54px는 shadcn 기본값(36~40px)과 큰 차이. 테마 오버라이드가 깊어지면 유지보수 부담 증가.
• *기존 프로젝트 영향*: Apple 디자인으로 이미 구현된 화면이 있다면 마이그레이션 범위 결정 필요.
• *"카드
### backend
백엔드 관점 의견을 스레드에 제출했습니다.

*요약:* 현재 칸반 백엔드는 데이터만 반환하고 색상·테마는 전부 프론트엔드 CSS 토큰에서 처리하는 클린한 분리 구조이므로, 토스 디자인 시스템 전환 시 *백엔드 API/DB 변경은 불필요*합니다. 코드 확인 결과 API 응답에 색상값을 포함하는 엔드포인트도, 테마 저장 DB 스키마도 없어 영향도가 최소입니다. 향후 테마 preference 서버 저장 요구사항이 나올 경우에만 백엔드 참여가 필요합니다.

## 최종 결정
전체 작업이 완료되었습니다.

*완료 요약:*

• *Lisa 리서치* → 토스 TDS 스펙, 디자인 토큰, AI 에이전트 스타일 주입 best practice 조사
• *회의 #8* → Krusty·Bart·Homer 전원 *전면 교체* 합의
• *파일 수정 6개 완료:*
  - `designer.md` — 토스 디자이너 페르소나로 전면 교체
  - `toss-design-system.md` — 신규 생성 (토스 전체 스펙)
  - `component-guide.md` — 토스 의사결정 트리·체크리스트로 교체
  - `conventions.md` — 기본값 블록 토스로 업데이트
  - `toss-design-guide.md` — active 참조로 변경
  - `apple-design-system.md` → `archive/`로 이동 보존
• *결정사항 기록* + `_index.md` 업데이트 완료

이제 Krusty에게 디자인을 요청하면 토스 스타일로 산출물이 생성됩니다. 기존 프로젝트의 CSS 토큰 마이그레이션이 필요하시면 Bart에게 별도 위임하겠습니다.