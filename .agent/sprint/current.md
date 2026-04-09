# Sprint Log

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
