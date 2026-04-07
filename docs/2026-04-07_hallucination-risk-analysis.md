# AI-Team 환각 위험 지점 분석 보고서

**작성일**: 2026-04-07  
**분석 범위**: 에이전트 페르소나 파일, 공유 협업 규칙, 역할별 컨텍스트/도구 파일, 메모리 및 핸드오프 시스템  
**분석 방법**: 4개 병렬 서브에이전트 독립 조사 후 종합

---

## 요약

총 4개 도메인에서 **50+개의 환각 유발 위험 지점**을 발견함. 가장 심각한 문제는 컨텍스트 파일 미완성, 스킬 마이그레이션 후 충돌 규칙 잔존, 협업 규칙 내 직접 모순임.

---

## 🔴 Critical — 즉시 수정 필요

### 1. Conventions 파일 3개가 완전히 비어있음

**파일**:
- `.claude/context/backend/conventions.md`
- `.claude/context/pm/conventions.md`
- `.claude/context/researcher/conventions.md`

**문제**: 세 파일 모두 "작성 예정 항목" 리스트만 있고 실제 컨벤션 없음.

**환각 시나리오**:
- Backend 에이전트가 API 설계, 에러 처리, DB 컨벤션을 모르고 임의 구현 → 코드리뷰에서 Critical 위반
- Researcher가 보고서 포맷과 소스 신뢰도 기준 없이 조사 결과 작성 → PM이 신뢰할 수 없는 데이터로 기획

---

### 2. 스킬 마이그레이션 후 .md 파일과 스킬 규칙 충돌

**파일들**:
- `.claude/agents/shared/processes/definition-of-done.md` → `/agent-verify`로 이전 경고
- `.claude/agents/shared/processes/verification-before-completion.md` → 동일
- `.claude/agents/shared/processes/code-review-protocol.md` → `/agent-review`로 이전
- `.claude/agents/shared/processes/implementation-pipeline.md` → `/agent-implement`로 이전
- `.claude/agents/shared/processes/planning-process.md` → `/agent-plan`로 이전

**문제**: 이전 경고만 달고 내용이 그대로 남아있음. 스킬과 .md 파일의 규칙이 다를 경우 어느 것이 source of truth인지 불명확.

**환각 시나리오**: 에이전트가 `definition-of-done.md`의 완료 조건을 읽고 따르지만, 실제 `/agent-verify` 스킬은 다른 기준을 적용 → 불완전한 검증 통과

---

### 3. Claims 시스템 deprecation이 에이전트에게 전달되지 않음

**파일**: `.claude/agents/shared/collision-prevention.md`만 명시, `session-bootstrap.md`에 언급 없음

**문제**: `.memory/claims/*.md` 파일 방식이 폐기됐지만 이 사실이 세션 부트스트랩 프로토콜에 포함되지 않음.

**환각 시나리오**: `collision-prevention.md`를 로드하지 않은 에이전트가 `.memory/claims/{ts}.md` 파일 생성 시도 → bridge와 충돌, 중복 처리 발생

---

### 4. 협업 규칙 내 직접 모순 — facts/ 쓰기 권한

**파일들**:
- `collaboration-rules.md` L69: "facts/는 Marge 소유, 다른 에이전트는 제안만 가능"
- `.memory/index.md` (full-index): "Each agent can write their own facts directly — no PM approval needed"

**문제**: 두 규칙이 정반대. 에이전트마다 다르게 해석.

---

## 🟠 High — 우선 처리 필요

### 5. decision-ops 스킬 호출 조건 불명확

**문제**: "decisions 조회·작성 시 `/decision-ops` 호출"이라고 했지만 읽기만 할 때도 스킬을 불러야 하는지 불명확. frontmatter 자동 생성 여부, `_index.md` 업데이트 책임이 스킬인지 에이전트인지 불명확.

**환각 시나리오**: 에이전트가 decisions 파일을 직접 생성 (스킬 우회) → frontmatter 누락, _index.md 미갱신

---

### 6. Handoff 파일 명명 규칙 두 가지 공존

**파일들**:
- `handoff/index.md`: `{from}-to-{to}_{topic}.md` 형식 사용
- `cross-domain-coordination.md`: `chain-{id}.md` 형식 언급

**문제**: 언제 어느 형식을 사용하는지 기준 없음. 실제 파일은 `designer-to-frontend_kanban-design-spec.md` 형식 사용 중.

---

### 7. QA 체크리스트의 `{project}` 추상 변수

**파일**: `.claude/context/qa/frontend-review-checklist.md`

**문제**: bash grep 명령어가 `{project}` placeholder를 사용함. 에이전트가 실제 경로를 추론해야 하므로 오탐/누락 발생 가능.

---

### 8. 병렬 핸드오프에서 "통합 에이전트" 역할 모호

**파일**: `.claude/agents/shared/cross-domain-coordination.md`

**문제**: 병렬 step 완료 후 다음 step 트리거를 "보통 Marge"가 한다고 명시했지만 강제 규칙이 아님. 누가 current_step을 업데이트하는지 불명확.

**환각 시나리오**: 모든 에이전트가 "다른 에이전트가 트리거하겠지"라고 대기 → 데드락

---

### 9. @mention Override 시 Triage와 race condition

**파일**: `.claude/agents/shared/collision-prevention.md`

**문제**: @mention된 에이전트와 Triage가 동시에 메시지를 처리하려 할 때 누가 먼저 claim을 잡는지 불명확. "먼저 tryClaim() 성공한 쪽"이라는 설명이 에이전트 입장에서는 예측 불가능.

---

### 10. Tier 2 키워드 라우팅의 도메인 중첩

**파일**: `.claude/agents/shared/routing-rules.md`

**문제**:
- "보안" + "인증" → Wiggum인데, "OAuth 구현"은 Homer와 Wiggum 중 누구?
- "접근성" → Bart인데, "시각 장애자 접근성 디자인"은 Krusty?
- 키워드 중첩 시 우선순위 기준 없음

---

## 🟡 Medium — 지속적 개선 필요

### 에이전트별 주요 위험 지점

#### PM (pm.md)
| 번호 | 위험 지점 | 구체적 내용 |
|------|----------|-----------|
| 11 | Rule 충돌 | Rule 45 "순차 워크플로 중 Slack 메시지 절대 금지" vs Rule 9 "보고 없는 완료는 완료가 아니다" — 완료 시점 알림 방법 불명확 |
| 12 | PM 권한 범위 불명확 | "PM 권한 내 후속 작업은 즉시 실행"에서 facts/ 쓰기, spec status 업데이트 등이 PM 권한인지 불명확 |
| 13 | delegate_sequential 판단 기준 | "순서가 필요한" 작업인지 PM이 임의 판단 → Designer 없이 Frontend 호출 가능 |

#### Frontend (frontend.md)
| 번호 | 위험 지점 | 구체적 내용 |
|------|----------|-----------|
| 14 | Designer 스펙 없이 구현 착수 | "구현 착수 전 체크"만 있고 "Designer 스펙 없으면 구현 금지"가 명시되지 않음 |
| 15 | useEffect 허용 범위 모호 | "데이터 페칭 useEffect 금지"인데 localStorage 로드, global state 업데이트는 fetch인지 non-fetch인지 불명확 |

#### Backend (backend.md)
| 번호 | 위험 지점 | 구체적 내용 |
|------|----------|-----------|
| 16 | 완료 선언 형식 검증 부재 | `git diff --stat`, `curl 결과` "첨부" 요구사항이 텍스트로만 기재해도 통과 가능 |
| 17 | "오류 없이 시작됨" 정의 모호 | Warning, Deprecation 경고, DB 연결 실패 로그가 있어도 "시작됨"으로 간주 가능 |
| 18 | 도구 스택 불명확 | `backend/tools.md`에 Bash/Read/Write만 있고 DB, ORM, HTTP 클라이언트 선택 기준 없음 |

#### Designer (designer.md)
| 번호 | 위험 지점 | 구체적 내용 |
|------|----------|-----------|
| 19 | Apple 스펙 로드 추적 불가 | "반드시 먼저 Read로 로드"라고 했지만 실제 로드 여부를 아무도 검증하지 않음 |
| 20 | CSS 토큰 파일 생성 누락 감지 불가 | "CSS 토큰 파일 없이 핸드오프 금지"라고 했지만 검증 메커니즘 없음 → Bart가 Tailwind arbitrary 값으로 구현 |
| 21 | weight 800/900 금지 예외 없음 | 강조가 필요한 hero heading 등에도 절대 금지인지 불명확 |

#### Researcher (researcher.md)
| 번호 | 위험 지점 | 구체적 내용 |
|------|----------|-----------|
| 22 | 리서치 모드 질문 스킵 조건 과복잡 | 예외 조건이 너무 많아서 실제로 언제 질문해야 하는지 모호 |
| 23 | 오래된 리서치 재사용 기준 없음 | "스레드 히스토리에 이미 완료된 Lisa 리서치"가 얼마나 오래된 것까지 재사용 가능한지 불명확 |
| 24 | 보고서 저장 강제성 검증 없음 | "`.memory/research/`에 저장 필수"인데 실제로 Slack에만 올리고 파일 미생성 가능 |

#### SecOps (secops.md)
| 번호 | 위험 지점 | 구체적 내용 |
|------|----------|-----------|
| 25 | 보안 리뷰 범위 불명확 | "OWASP Top 10 focusing"인데 이것만 검토하는지, 이 외도 포함하는지 불명확 |
| 26 | 보안 도구 스택 부재 | `secops/tools.md`에 SAST, DAST, 의존성 검사기 등 실제 보안 도구 명시 없음 |

#### Triage (triage.md)
| 번호 | 위험 지점 | 구체적 내용 |
|------|----------|-----------|
| 27 | Do/Spec 분류 기준 모호 | "React 컴포넌트 버그 수정" = Do인지, "아키텍처 변경" = Spec인지 경계 불명확 |
| 28 | SQLite claim 갱신 책임 불명확 | Triage가 SQLite를 직접 관리하는지, bridge만 관리하는지 불명확 → zombie claim 발생 가능 |

#### Chalmers (chalmers.md)
| 번호 | 위험 지점 | 구체적 내용 |
|------|----------|-----------|
| 29 | Layer 1 FAIL 시 다른 AC 스킵 위험 | "Layer 1 FAIL 시 Layer 2/3 실행하지 않음" → 5개 AC 중 AC 1 실패 시 AC 2-5 검증 안 됨 |
| 30 | "모든 검증 항목 완료" 타임아웃 없음 | "모든 검증 항목 완료할 때까지 반복"인데 AC 100개면 무한 루프 위험 |

---

## 메모리 시스템 특이 위험 지점

### 31. react-process ↔ cross-domain-coordination 상호 참조 없음

재작업 중 다른 에이전트 피드백이 필요할 때 어느 프로세스를 따르는지 정의되지 않음.

**환각 시나리오**: Frontend가 "디자인 스펙 위반" 피드백을 받았을 때 — react-process §3 이의 제기를 수행할지, Designer에게 직접 @mention할지, 재작업 전 승인을 받아야 하는지 불명확.

### 32. Walkthrough vs Decisions 저장 경계 모호

- Walkthrough: `.memory/walkthroughs/YYYY-MM-DD_{topic}.md`
- Decisions: `.memory/decisions/YYYY-MM-DD_lesson-{topic}.md`
- 둘 다 "작업 완료 후 영구 기록"인데 리팩토링, 버그 수정, 기능 구현 시 어디에 써야 하는지 기준 없음

### 33. conversations/ 자동 만료 실행 주체 없음

7일 자동 만료라고 명시했지만 이를 실행하는 주체(에이전트/bridge/cron)가 없음. 수동으로 삭제해야 하는가?

---

## 권장 조치 우선순위

| 우선순위 | 대상 파일 | 조치 |
|---------|---------|------|
| 🔴 1 | `backend/conventions.md`, `pm/conventions.md`, `researcher/conventions.md` | 실제 컨벤션 내용 작성 |
| 🔴 2 | `session-bootstrap.md` | claims 폐기 내용 추가 (`.memory/claims/*.md` 생성 금지 명시) |
| 🔴 3 | `collaboration-rules.md` + `full-index.md` | facts/ 쓰기 권한 단일화 |
| 🔴 4 | 스킬 마이그레이션된 .md 파일 5개 | 내용 삭제 후 스킬 경로 링크만 남기기 |
| 🟠 5 | `decision-ops` 스킬 설명 또는 CLAUDE.md | 읽기/쓰기 각각의 호출 조건 명시 |
| 🟠 6 | `frontend-review-checklist.md` | `{project}` 변수 → 실제 bash 명령어로 교체 |
| 🟠 7 | `cross-domain-coordination.md` | 통합 에이전트 역할 강제화, chain 파일 형식 단일화 |
| 🟡 8 | `pm.md` Rule 9 vs Rule 45 | 순차 워크플로 중 완료 알림 방법 명시 |
| 🟡 9 | `backend/tools.md` | DB, ORM, HTTP 클라이언트 표준 스택 명시 |
| 🟡 10 | `routing-rules.md` | 키워드 중첩 케이스 우선순위 규칙 추가 |
