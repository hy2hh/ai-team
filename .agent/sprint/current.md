# Sprint Log

<!-- 형식 규칙: 각 세션은 **Tried:** + **Learned:** 만 기록.
     후속 태스크는 **Next:** 로 쓰지 않고 .memory/tasks/active-{role}.md 에 직접 등록.
     sprint은 히스토리 로그 전용 — 에이전트 실행 상태 관리는 .memory/tasks/ 참조. -->

### [2026-04-12] Session: 컨텍스트 축적 시스템 점검

**Tried:**
- .claude/settings.json 경로 불일치 발견 및 수정 (/Users/sid/ → /Users/hangheejo/)
- Adaptive Harness 파이프라인 구조 분석 (5단계 Stop 훅)
- MEMORY.md 중복 여부 검토 → sprint/knowledge로 일원화 결정

**Learned:**
- 프로젝트 settings.json의 guard-check.sh 경로가 하드코딩되어 있어 실제 동작 안 했음 — harness-evolver가 settings.json 자동 수정하므로 재발 가능성 있음
- harness-evolver changelog.md 없음 = 정상 (changes:[] 반환 시 조기 종료)
- MEMORY.md는 sprint + knowledge + CLAUDE.md와 중복 — 프로젝트 학습은 이 파일들로 일원화
- auto-memory는 Claude Code 빌트인 기능 — 플러그인 삭제로 제거 불가, PreToolUse 훅 exit 2로만 구조적 차단 가능
- guard-check.sh는 Write/Edit 도구의 file_path만 검사 — Bash 도구로 Python 스크립트 통해 동일 파일 수정 가능 (의도된 허점: 사용자 승인 프롬프트가 뜸)
- 플러그인들은 POWER.md/steering 없이 전부 on-demand (Skills + Hooks + MCP) — 시스템 프롬프트 직접 주입 없음 (예상과 달랐음)
- HTML 주석 `<!-- -->` 은 토큰 절감 없음 — 실제 섹션을 삭제해야 효과 있음
- 글로벌 CLAUDE.md 335줄 → 118줄로 정리 (프론트엔드 전용 규칙 전부 on-demand로 이동)

---

### [2026-04-11] Session: API 문서화 작업

**Tried:**
- Socket-bridge 프로젝트 구조 분석 (src/ 디렉토리 — 30+ 모듈)
- Kanban-backend API 엔드포인트 조사 (routes/cards.ts, routes/boards.ts)
- docs/api 디렉토리 신규 생성 및 3개 문서 작성:
  1. socket-bridge-architecture.md (551줄) — 라우팅 & 런타임 시스템
  2. kanban-backend-api.md (673줄) — REST API 완전 명세
  3. README.md (84줄) — API 문서 인덱스

**Learned:**
- Socket-bridge는 6단계 라우팅 우선순위 적용: QA → @mention → conversational → keyword → LLM → default
- Kanban 카드는 tags를 JSON 문자열로 DB 저장 → 클라이언트에서 파싱/직렬화 필요
- WIP 검증 로직이 카드 이동(PATCH /cards/:id/move)에 적용됨
- 칸반 GET /boards/:id는 단일 LEFT JOIN으로 모든 컬럼/카드 조회 (N+1 방지)
- Circuit Breaker 패턴이 LLM 라우팅에 적용: 5회 연속 실패 시 회로 열림 → 60초 후 재시작

**Next:**
- kanban-frontend, kanban/backend의 추가 모듈 문서화 (웹소켓, DB 마이그레이션)
- API 문서와 코드 예제를 Storybook 또는 문서 사이트에 통합
- TypeScript 제네릭 타입 및 higher-order 함수 문서화
- 성능 벤치마크 결과 추가 (쿼리 latency, 카드 이동 시간 등)

**Commit:** fd793756 "Add comprehensive API documentation"

---

### [2026-04-11] Session: Button 컴포넌트 구현

**Tried:**
- `kanban-frontend/src/components/ui/button.tsx` 신규 작성
- 기존 레거시(`Button.tsx`) 및 `mobile-button.tsx` 패턴 분석 후 통합

**Learned:**
- kanban-frontend는 kanban/frontend와 별개 프로젝트 — ui/ 디렉토리 없어 신규 생성 필요
- 기존 test-button.tsx가 이미 유사 구현 존재 → 정식 컴포넌트로 승격하는 방식 채택
- `aria-busy`/`aria-disabled`는 `true` 강제 대신 `undefined`로 falsy 처리해야 불필요한 attr 제거

**Next:**
- Button 컴포넌트를 실제 페이지/화면에서 import하여 사용 확인
- Storybook 스토리 파일(`button.stories.tsx`) 작성 권장

### [2026-04-11] Session: Button 컴포넌트 구현 (재검증 — queue task)

**Tried:**
- `kanban-frontend/src/components/ui/button.tsx` 파일 존재 여부 및 내용 검증
- `kanban/frontend/components/ui/Button.tsx` (레거시, @deprecated) 상태 확인
- `test-button.tsx` / `test-button.stories.tsx` 교차 확인

**Learned:**
- Button 컴포넌트는 이미 완전히 구현된 상태 (variant 4종, size 3종, loading/icon/fullWidth 지원)
- kanban/frontend의 Button.tsx는 `@deprecated` 명시됨 — 신규 사용은 kanban-frontend 버전으로 유도
- queue task가 중복 실행될 경우, 현재 상태 검증 후 "이미 완료" 판단이 올바른 처리

**Status:** ✅ 완료 — 추가 구현 불필요

**Next:**
- `button.stories.tsx` 공식 Storybook 스토리 파일 추가 (현재는 test-button.stories.tsx만 존재)
- `kanban/frontend/components/ui/Button.tsx` deprecated 마이그레이션 안내 주석 강화

### [2026-03-26] [stale] Session: PM/Backend 보고 이슈 일괄 수정

**Fixed:**
1. 라우팅 텍스트에서 sender prefix 제거 → mention/패턴 매칭 오염 방지
2. CONVERSATIONAL_PATTERN 추가 → 간단한 대화 LLM 분류 건너뜀 (0ms)
3. npx -y → node_modules/.bin 직접 참조 (MCP 서버 200-500ms 절감)
4. 병렬 동시성 MAX_PARALLEL_AGENTS=3 제한
5. Thread session JSON 영구화 (30일 TTL)

**Learned:**
- 5개 에이전트 병렬 = 15개 MCP 서버 spawn → 리소스 고갈. 동시성 제한 필수
- Slack Socket Mode에서 봇 메시지는 이벤트로 수신 안 됨 → 자동 테스트 불가

### [2026-03-26] [stale] Session: 공유 메모리 주입 + 모델 업그레이드 + Hub 패턴

**Learned:**
- LLM에게 "파일을 읽어라" 지시는 보장 불가 → 코드가 직접 주입해야 구조적 보장
- permissionMode와 allowedTools는 별개 레이어
- Hub/Orchestrator 패턴 채택 (업계 70% 사용)

### [2026-03-27] [stale] Session: 리액션 → Block Kit + 에이전트 이름 변경 + 안정화

**Tried:**
- PM 위임 메시지에 리액션 추적 추가 → 성공
- 리액션 주체를 PM → 실제 작업 에이전트로 변경 → 성공
- 이모지 기반 제어(⛔/⏸️/▶️) → Slack에서 이모지가 안 보임
- Block Kit 버튼 [⏹ 중단]으로 교체 → 구현 완료, Slack 테스트 미완
- 모든 응답을 스레드로 강제 → 채널 메시지 혼선 방지
- 에이전트 이름 심슨 테마로 변경 (전체 20개 파일)
- context rules에 "사실 기반 응답" + "파일 수정 권한" 추가
- 글로벌 settings.json에 Edit/Write 권한 추가 (bypassPermissions 불충분)

**Learned:**
- Slack 이모지 리액션에서 octagonal_sign 등 일부 이모지가 검색/표시 안 됨
- bypassPermissions가 Claude Code UI 레벨 파일 권한까지 우회 못 함 → settings.json allow 필요
- LLM이 "권한 없다"고 스스로 판단하는 문제 → context rules에 명시적 권한 지시 필요
- Hub 패턴 응답 시간 2분+는 정상 (안전성 트레이드오프)
- slice(0, 1500)이 서로게이트 페어를 깨뜨릴 수 있음 → safeSlice 필요

**Next:**
- Block Kit 버튼 Slack 테스트 (버튼 보이는지, 클릭 시 중단되는지)
- Hub 위임 중 상태 표시 개선 검토

### [2026-03-28] Session: 자율 에이전트 시스템 리서치 + 계획

**Tried:**
- Slack MCP로 #ai-team 메시지 50건 분석 → sid 승인 80% rubber stamp 확인
- 4개 병렬 리서치 에이전트 (article, anthropic, openai, project analysis) → 업계 최신 패턴 수집 성공
- Plan agent로 구현 설계 → 5 Phase 점진 구현 계획 도출

**Learned:**
- Slack 메시지 히스토리가 178K 자로 매우 큼 → 서브에이전트로 분석 위임 필수
- Anthropic 하네스 설계: Generator/Evaluator 분리가 가장 높은 ROI
- Addy Osmani: "검증이 병목, 생성이 아님". Hook으로 자동 강제해야 함
- OpenAI Harness Engineering: 하네스 최적화만으로 (모델 변경 없이) 성능 52.8%→66.5%
- Ralph Loop: 객관적 체크리스트 검증 → 실패 시 재계획 → 통과까지 루프. Auto-Proceed의 전제 조건으로 배치
- Human-on-the-loop: 에이전트가 행동, 인간이 모니터링+veto (risk별 veto window 차등)

**Next:**
- Phase 1 구현: risk-matrix.ts, db.ts 스키마 확장, 에이전트 persona 업데이트
- Phase 2: auto-proceed.ts + Ralph Loop + reaction 핸들러

### [2026-03-29] Session: Phase 1~5 전체 구현 + delegate_sequential + 시스템 프롬프트 최적화

**Tried:**
- Phase 1~5 전체 구현 (risk-matrix, auto-proceed, cross-verify, meeting, proactive personas) → 성공
- 테스트: PM이 delegate 도구로 frontend+backend 병렬 위임 → 동작 확인
- 프롬프트로 "시작할까요?" 금지 → buildContextRulesPrefix에 추가 → 부분 성공 (backend는 바로 실행, 일부는 여전히 질문)
- 프롬프트로 recommend_next_phase/convene_meeting 호출 유도 → 실패 (PM이 무시)
- 코드로 강제: hub loop 완료 후 cross-verify 자동 실행 + recommend 미호출 시 재요청 → 성공
- 하드코딩 DEPENDENCY_PAIRS로 순차 실행 → 오탐 문제 발견
- delegate_sequential 도구로 교체 → 성공 (designer 188초 → frontend 166초 순차 실행 확인)
- 버그: delegationTargets 비어있으면 early return → delegationSteps 체크 도달 못함 → 수정
- 시스템 프롬프트 최적화: 41.9KB → 16.5KB (60.6% 절감)

**Learned:**
- 프롬프트 지시 < 코드 강제. LLM은 "해야 한다" 지시를 무시할 수 있지만 코드는 무조건 실행
- 하드코딩 의존성은 오탐 발생 → PM이 상황 판단하는 도구가 더 유연
- 봇 메시지는 Slack Socket Mode에서 수신 안 됨 → TEST_MODE 필요
- Anthropic 권장: CLAUDE.md 200줄/40KB 이하, 인스트럭션 150~200개 한계
- 테스트를 "해볼까요?"라고 묻지 말고 바로 실행해야 함 (sid 반복 피드백)

**Next:**
- 운영 환경 E2E 테스트 (sid가 Slack에 직접 메시지)
- convene_meeting 자율 소집 테스트
- auto-proceed veto window 실제 동작 테스트

### [2026-03-29] Session: Production Hardening + 프로세스 강화 + cross-verify 개선

**Tried:**
- docs/specs/ 워크플로 + Feature Spec 템플릿 추가 → 규칙만으로는 부족
- bridge 코드로 스펙 파일/에러 케이스 AC 없으면 위임 차단 → 성공 (도구가 에러 반환)
- DoD 프로세스 + buildContextRulesPrefix 주입 + 완료 보고 시 DoD 미포함 경고 → 구현
- "진행할까요?" 8개 패턴 감지 → 경고 자동 주입
- P0: 메모리 누수 4건(debounce/activeAgents/sessionStore) TTL 정리 인터벌 추가
- P0: message/reaction handler try-catch 래핑 + claim→failed 업데이트
- P0: rate-limiter.ts 신규 (sliding window 50 req/min)
- P1: graceful shutdown 완전 개선 (모든 타이머/에이전트/approval 정리)
- P1: 동시성 제한 semaphore (MAX_CONCURRENT_HANDLERS=3)
- P2: config.ts로 하드코딩 설정 외부화, 배치 SQL, 원자적 파일 쓰기
- cross-verify: 2000자→8000자, VERDICT 파싱, 파일 경로 추출 + "Read로 읽어라" 지시
- 프롬프팅 기법 3개(CoVe/Self-Consistency/PoT) 팀 회의 → 전부 불적용 결정

**Learned:**
- "프롬프트 < 코드 강제" 원칙이 이 프로젝트의 핵심 철학. 모든 개선은 이 기준으로 평가
- 서브에이전트 탐색 결과를 그대로 신뢰하면 오탐 발생 (.env 커밋 오판). 반드시 직접 검증
- cross-verify에 "파일을 읽어라" 프롬프트 추가는 코드 강제 철학과 모순 → sid가 "근본적으로 맞아?" 지적
- 프로세스 문서(DoD, Feature Spec)는 1단계, 코드 강제가 2단계. 1단계만으로 완료 선언하면 안 됨
- 회의 결론: baseline 메트릭 없이 기법 적용은 "문제 없이 솔루션 찾기"

**Next:**
- cross-verify 근본 재설계: 프롬프트 지시 대신 코드가 파일을 읽어서 검증 컨텍스트 주입
- bridge 재시작 + E2E 테스트
- P2-1 구조화된 로깅 (pino)

### [2026-04-01] Session: 칸반 카드 품질 개선

**Tried:**
- 칸반 백엔드 미실행 (포트 3001) 확인 → 수동 시작
- `syncEnqueuedTasksToKanban`으로 enqueue 시 raw 텍스트 카드 선생성 → 에이전트가 `create_kanban_card` 직접 호출로 변경 (단일 에이전트 경로 완료)
- WIP limit 3 → 5 변경 (SQLite 직접 수정)
- 기존 쓰레기 카드 19개 삭제

**Learned:**
- `create_kanban_card` 도구: 에이전트가 작업 이해 후 호출 → 의미있는 제목 보장
- WIP limit 근거: 에이전트 수(7명) 기준이나 주요 작업자(PM+Backend) 감안해 5로 결정
- kanban-backend는 bridge와 별도 프로세스 — 재시작 스크립트에 포함 안 됨, 수동 확인 필요
- session resume 시 새 MCP 도구 미인식 → thread-sessions.json 초기화 필요

**Next:**
- enqueue 경로 개선: `syncEnqueuedTasksToKanban` 제거, queue-processor가 result.kanbanCardId 사용
- 변경 파일: queue-manager.ts, agent-runtime.ts, queue-processor.ts

### [2026-04-09] Session: cli-eval Judge 채점 + Bloom 평가 실행

**Tried:**
- cli-eval `--judge-only` 실행 → 14개 채점 성공, report 생성 실패 (grep이 markdown code block 파싱 못함)
- Python으로 report.md 직접 생성 → 성공
- Bloom 셋업: Python 3.9 → 3.11 venv 재생성, tenacity 추가 설치, behaviors.json trailing comma 수정, SEED_FILE 경로 디렉토리로 수정
- Bloom self-preferential-bias 3 시나리오 실행 → 4단계(Understanding→Ideation→Rollout→Judgment) 전부 완료

**Learned:**
- claude -p 출력에 ```json code block이 포함됨 → grep/sed 파싱 불안정, Python json 파싱 권장
- Bloom 프록시 BrokenPipeError는 litellm 클라이언트 타임아웃 → bloom이 자동 재시도하므로 치명적이지 않음
- Bloom 프록시 경유 실행 시 시나리오당 10-20분 (32K+ chars 프롬프트)
- bloom run은 디렉토리 경로를 인자로 받음 (seed.yaml 아님)

**Next:**
- 결과 커밋
- Bloom 커스텀 behavior (role-boundary, persona-drift, scope-rejection) 평가
- cost-quality 평가 (API 키 필요)

### [2026-04-10] Session: pockie-wallet-extension AI Agent 기능 설계 + 구현 위임

**Tried:**
- Lisa 리서치 (경쟁사 분석 + 8개 후보 기능 평가) → 완료
- 회의 #14/#15: Homer·Bart·Krusty·Wiggum 의견 종합, Tier 1(F1 자연어 tx·F2 리스크 시뮬레이션·F3 가스 최적화) 확정
- Feature Spec 작성 (`docs/specs/2026-04-10_pockie-wallet-ai-agent.md`)
- delegate_sequential 5단계 체인으로 Homer→Krusty→Bart/Homer→Chalmers 순차 위임

**Learned:**
- **런타임 테스트 미실시**: 에이전트들이 코드 작성 후 실제 익스텐션을 로드하여 동작 확인하는 E2E 테스트를 전혀 하지 않음. Chrome Extension 특성상 빌드 후 `chrome://extensions`에 로드, 팝업 실제 조작까지 해야 진짜 완료. 타입 체크 통과 ≠ 동작 보장
- **Sprint log 미업데이트**: 에이전트 완료 후 `.agent/sprint/current.md` 업데이트 없음 → 시행착오가 다음 세션에 전달되지 않음
- Chrome Extension E2E 테스트 하네스 미비가 근본 원인 — 에이전트가 테스트할 도구 자체가 없음

**Next:**
- Chrome Extension E2E 테스트 하네스 설계 및 구축 (Playwright + chrome extension 지원)
- pockie-wallet AI agent 실제 런타임 검증 후 재완료 선언
- Sprint log 강제 업데이트 메커니즘 도입 (queue-processor mtime 체크 + 자동 재주입)

### [2026-04-11] Session: ai-team 보안 위협 모델링 검토 (Wiggum — queue task)

**Tried:**
- STRIDE 기반 위협 모델링: socket-bridge, 에이전트 실행 환경, 메모리 파일시스템, 라우팅 시스템, Hook 시스템 전수 분석
- .env git 추적 상태, guard-check.sh 구조, ALLOWED_USER_IDS 게이트웨이, rate-limiter 존재 여부 직접 검증
- 기존 보안 결정사항(guard Hook #11, pockie-wallet #14/#15) 교차 확인

**Learned:**
- .env 파일이 git-tracked 상태 — 토큰 노출 위험 (Critical). 단 git log에 커밋 이력 없어 초기 상태일 가능성
- guard-check.sh 195줄 — fail-closed 설계 + 2-tier(deny/warn) 구조는 견고. 자기 수정 방지(CWE-284) 포함
- 메모리 파일시스템(.memory/)에 에이전트 간 접근 제어 없음 — 모든 에이전트가 전체 읽기/쓰기 가능
- rate-limiter.ts 존재 확인 — sliding window 50 req/min 구현됨
- pockie-wallet 4-layer prompt injection 방어 설계는 우수 (L1 입력정규화→L2 구조분리→L3 출력검증→L4 의미검증)

**Next:**
- .env gitignore 적용 + .env.example 패턴 전환 (Homer 협업)
- 토큰 로테이션 정책 수립
- 에이전트별 메모리 접근 범위 제한 방안 검토

### [2026-04-11] Session: 프로젝트 아키텍처 분석 (Lisa — queue task)

**Tried:**
- 프로젝트 루트, .claude/, .memory/, socket-bridge/src/ 전체 구조 탐색
- 7개 에이전트 페르소나, 18개 스킬, 28개 socket-bridge 모듈 식별
- 서브 프로젝트 5개(kanban, legal-rag, memory-viewer, eval, plant-care) 매핑

**Learned:**
- 아키텍처 핵심: socket-bridge(TS)가 Slack↔에이전트 허브 역할. @slack/bolt + claude-agent-sdk + better-sqlite3 기반
- 메모리 3계층: .memory/(파일 공유) + memory.db(SQLite 칸반/세션) + thread-sessions.json(스레드 상태)
- 코드 강제 > 프롬프트 지시 철학이 guard-check.sh Hook, auto-proceed.ts, cross-verify.ts 등에 구현됨
- .claude/settings.json의 PreToolUse Hook이 모든 Bash/Write/Edit에 가드 체크 강제

**Next:**
- 아키텍처 다이어그램 시각화 (필요 시)
- socket-bridge 모듈 간 의존성 심층 분석 (필요 시)

### [2026-04-11] Session: Sprint Log 업데이트 기록 정리

**Tried:**
- 기존 sprint/current.md 파일 검증 → 최근 25개 세션 기록 확인
- 현재까지 누적된 세션 로그: "프로젝트 아키텍처 분석" (마지막)

**Learned:**
- Sprint log는 각 세션의 시행착오, 배운 점, 다음 단계를 기록하여 지식 전승
- 현재 기록 상태: 2026-04-11까지 총 25개 세션, 4주간 누적된 경험과 개선사항 추적 가능

**Next:**
- 주기적 Sprint log 업데이트 계속 (각 세션 완료 후 즉시 기록)

---

### [2026-04-11] Session: Sprint/Memory 역할 분리 시스템 검증

**Tried:**
- `.memory/tasks/active-backend.md` 읽기 → 미완료 태스크 2건 확인
- `git check-ignore -v .env` 실행 → .gitignore 포함 여부 검증
- `.agent/sprint/current.md` 세션 항목 추가 (완료 조건 이행)

**Learned:**
- `.env`는 `.gitignore:1` 에 명시됨 → git 추적 제외 정상 처리됨 (Wiggum 세션 지적과 달리 현재 상태는 안전)
- `active-backend.md` 미완료 태스크 2건: Sprint log 강제 업데이트 메커니즘(MEDIUM), syncEnqueuedTasksToKanban 제거(LOW)
- Sprint/Memory 분리 워크플로 정상 — sprint log는 히스토리 전용, 미완료 태스크는 .memory/tasks/에서 관리하는 구조 검증됨
