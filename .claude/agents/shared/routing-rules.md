# Message Routing Rules

## 3-Tier 분류 체계

### Tier 1: @mention 직접 라우팅 (bypass)

`@에이전트명`이 포함된 메시지는 Triage를 거치지 않고 해당 에이전트가 직접 처리한다.

- `@Bart` → Bart 직접 반응
- `@Marge @Krusty` → 두 에이전트 모두 반응 (각자 소관 부분)
- sid가 직접 지정한 경우도 동일하게 bypass

### Tier 2: 키워드 매핑 (80% 처리)

Triage Agent가 메시지의 키워드를 아래 테이블과 매칭하여 라우팅한다.

| 키워드 / 패턴 | 라우팅 대상 |
|---------------|------------|
| 기능 요청, 요구사항, PRD, 스프린트, 로드맵, 우선순위, 백로그, 일정 | Marge |
| UI, UX, 디자인, Figma, 목업, 와이어프레임, 디자인 시스템, 색상, 타이포 | Krusty |
| React, 컴포넌트, 프론트엔드, CSS, 반응형, 상태관리, 렌더링, 번들, SEO, 성능 측정, Lighthouse, 접근성, Core Web Vitals | Bart |
| API, 데이터베이스, DB, 서버, 인프라, 백엔드, 마이크로서비스, 쿼리 | Homer |
| 시장 조사, 경쟁사, 트렌드, 리서치, 분석, 시장 규모, 벤치마크 | Lisa |
| 보안, 취약점, 인증, 인가, 암호화, OWASP, 위협, 해킹, 권한 | Wiggum |
| QA, 품질 검증, 테스트, 검수, 완료 확인, 완료 조건, 코드 리뷰, 산출물 리뷰 | Chalmers |

**매칭 규칙:**
- 복수 키워드가 같은 에이전트를 가리키면 → 해당 에이전트에게 라우팅
- 복수 에이전트의 키워드가 혼재하면 → 복합 태스크로 분류 (아래 참조)

### Verification Tier (QA 우선순위)

QA(Chalmers)는 도메인이 아닌 **검증 계층**이다. QA 키워드가 다른 도메인 키워드와 함께 나타나면 복합 태스크가 아닌 **검증 요청**으로 판단하여 QA에 직접 라우팅한다.

| 메시지 | 매칭 키워드 | 라우팅 |
|--------|-----------|--------|
| "Backend 완료했는데 검증해줘" | backend + qa | QA (검증 요청) |
| "프론트엔드 리뷰해줘" | frontend + qa | QA (리뷰 요청) |
| "API 테스트해줘" | backend + qa | QA (테스트 요청) |
| "구현하고 테스트해줘" | frontend + qa | PM (순차 작업 → 체이닝) |
| "디자인하고 구현해줘" | designer + frontend | PM (순차 작업 → 체이닝) |

**예외**: 순차 연결어("하고", "그리고", "후에")가 있으면 PM 체이닝 경로 유지.

### Tier 3: LLM 의미 분류 (fallback)

키워드 매칭이 불확실할 때 Triage Agent가 메시지 의미를 분석하여 판단한다.

판단 기준:
1. 메시지의 핵심 의도 (무엇을 원하는가?)
2. 각 에이전트의 `scope.handles` 대조
3. 가장 적합한 에이전트 선택

## 복합 태스크 감지

### 패턴 인식

| 메시지 패턴 | 감지 결과 |
|------------|----------|
| "디자인하고 구현해줘" | Designer → Frontend 체인 |
| "API 만들고 프론트에 연결" | Backend → Frontend 체인 |
| "시장 조사 후 기획" | Researcher → PM 체인 |
| "구현하고 보안 리뷰" | Frontend/Backend → SecOps 체인 |
| "전체 기능 개발" | PM → Designer → Frontend + Backend → SecOps 풀 체인 |
| "구현하고 QA 해줘" | Frontend/Backend → Chalmers 체인 |
| "코드 리뷰 해줘" | Chalmers 단독 |
| "SEO 점수 측정해줘" | Bart 단독 |
| "성능 측정 / Lighthouse 돌려줘" | Bart 단독 |

### 복합 태스크 처리

1. Triage가 체인 파일 생성 (`.memory/handoff/chain-{id}.md`)
2. 첫 번째 에이전트에게 위임
3. 이후 순서는 `cross-domain-coordination.md` 프로토콜을 따름

## 미분류 Fallback

라우팅을 결정할 수 없는 경우:
1. **Marge에게 라우팅** (기본 fallback)
2. PM이 분석 후 적절한 에이전트에게 재위임
3. PM도 판단 불가 시 sid에게 에스컬레이션

## 라우팅 우선순위

```
1. @mention (최우선 — 항상 bypass)
2. sid 직접 지정
3. 키워드 매핑 (Tier 2)
4. LLM 의미 분류 (Tier 3)
5. PM fallback (최후)
```

## Triage 결정 시간

- 목표: **5초 이내** 라우팅 결정
- Tier 1/2는 즉시, Tier 3는 최대 10초
- 10초 초과 시 PM fallback 적용
