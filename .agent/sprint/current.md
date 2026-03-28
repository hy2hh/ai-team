# Sprint Log

### [2026-03-26] Session: PM/Backend 보고 이슈 일괄 수정

**Fixed:**
1. 라우팅 텍스트에서 sender prefix 제거 → mention/패턴 매칭 오염 방지
2. CONVERSATIONAL_PATTERN 추가 → 간단한 대화 LLM 분류 건너뜀 (0ms)
3. npx -y → node_modules/.bin 직접 참조 (MCP 서버 200-500ms 절감)
4. 병렬 동시성 MAX_PARALLEL_AGENTS=3 제한
5. Thread session JSON 영구화 (30일 TTL)

**Learned:**
- 5개 에이전트 병렬 = 15개 MCP 서버 spawn → 리소스 고갈. 동시성 제한 필수
- Slack Socket Mode에서 봇 메시지는 이벤트로 수신 안 됨 → 자동 테스트 불가

### [2026-03-26] Session: 공유 메모리 주입 + 모델 업그레이드 + Hub 패턴

**Learned:**
- LLM에게 "파일을 읽어라" 지시는 보장 불가 → 코드가 직접 주입해야 구조적 보장
- permissionMode와 allowedTools는 별개 레이어
- Hub/Orchestrator 패턴 채택 (업계 70% 사용)

### [2026-03-27] Session: 리액션 → Block Kit + 에이전트 이름 변경 + 안정화

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
