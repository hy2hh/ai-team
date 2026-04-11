---
date: 2026-04-10
topic: testing
roles: [all]
summary: E2E 테스트에서 발견된 FAIL 5건 상세 — 원인, 증거, 수정 방향
---

# FAIL 상세

## BUG-1: `learnings/` deprecated 위반 {#bug-1}

- **심각도**: LOW
- **섹션**: 35 (메모리 R/W 권한)
- **증상**: `lisa-learnings.jsonl`이 `.memory/learnings/`에 존재
- **원인**: Lisa가 `facts/agents/researcher/` 대신 deprecated 경로에 기록
- **수정**: Lisa persona에 `learnings/` 사용 금지 명시, 기존 파일 `facts/agents/researcher/`로 이동

## BUG-2: PM 승인 요청에 Block Kit 버튼 없음 {#bug-2}

- **심각도**: HIGH
- **섹션**: B-1-1, 15 (Auto-Proceed)
- **증상**: "(대기 중 — sid 승인 후)" 텍스트만 전송, 승인/거절 버튼 없음
- **영향**: sid가 별도 메시지로 "해줘"라고 보내야 함 → 워크플로 지연
- **수정**: PM 위임 전 `pending_approvals` 테이블에 등록 + Block Kit 버튼 메시지 게시

## BUG-3: MCP slack_post_message 직접 호출 → 채널 본문 게시 {#bug-3}

- **심각도**: HIGH
- **섹션**: A-5-2, A-6-1
- **증상**: PM/QA 응답이 스레드가 아닌 채널 본문에 별도 메시지로 게시 (2중 포스팅)
- **원인**: `permissionMode: 'bypassPermissions'` + `mcpServers` 조합으로 `allowedTools` 필터가 MCP 도구 차단 못 함
- **증거**: 채널 TOP(ts=1775781173) vs 스레드(ts=1775781182) 내용 다름 — 에이전트 자체 MCP 호출 + bridge 포스팅 2회
- **코드**: `agent-runtime.ts:2301` `allowedTools: baseTools` / `agent-runtime.ts:1061` 주석에 이미 인지
- **수정**: MCP 서버에서 `slack_post_message`, `slack_reply_to_thread` 제거 또는 Agent SDK `toolFilter`로 차단

## BUG-4: SESSION_TTL 스펙 불일치 {#bug-4}

- **심각도**: LOW
- **섹션**: 12 (세션 관리)
- **증상**: 체크리스트 72시간 vs 코드 30일
- **코드**: `config.ts:22` — `SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000`
- **수정**: 체크리스트 갱신 또는 코드 값 72시간으로 변경 (의도 확인 필요)

## BUG-5: Lisa 비-리서치 질문에 리서치 모드 진입 {#bug-5}

- **심각도**: MEDIUM
- **섹션**: 55, B-5-2
- **증상**: "@Lisa bridge 코드 분석해줘" → 리서치 A/B 선택 대기 진입
- **기대**: 코드 분석 = 즉시 답변 (리서치 아님)
- **수정**: 리서치 모드 판정 로직에서 "코드 분석/확인/설명" 패턴 제외

## BUG-6: QA 완료 후 다른 스펙으로 2차 QA 재트리거 {#bug-6}

- **심각도**: MEDIUM
- **섹션**: 6, 50
- **증상**: PM 완료 보고 후 cross-verify→QA 자동 트리거가 **다른 스펙 파일**(notification-system-v2.md)로 2차 QA 실행. 같은 스레드에서 Chalmers 2중 응답
- **증거**: B-1-4 스레드 — `[4]` 1차 QA PASS → `[5]` PM 완료 → `[6]` 2차 QA "All Layer 1 checks failed" (다른 스펙)
- **원인**: `extractSpecPath()`가 스레드 컨텍스트가 아닌 `docs/specs/` 최근 파일을 감지하여 무관한 스펙으로 QA 실행
- **수정**: QA 완료 후 동일 스레드에서 재트리거 방지 (이미 QA PASS/WARN인 스레드는 skip)

## BUG-7: "진행할까요?" 안티패턴 감지만 하고 차단 안 함 {#bug-7}

- **심각도**: HIGH
- **섹션**: E-6-1, B-2-3
- **증상**: Homer 3회, PM 3회, Bart 1회 — "진행할까요?/시작할까요?/승인 후 진행" 패턴 반복
- **bridge 로그**: `[enforcement] backend "진행할까요?" 안티패턴 감지` — 감지는 됨
- **문제**: 감지 후 경고만 붙이고(`> ⚠️ [bridge 자동 경고]`) 응답은 그대로 전달됨. 사용자에게 승인 질문이 도달
- **영향**: sid가 매번 "해줘"라고 추가 메시지 → 불필요한 왕복 + 토큰 낭비
- **수정 방향**:
  1. enforcement에서 감지 시 응답을 차단하고 에이전트에게 "승인 없이 즉시 실행하세요" 재요청
  2. 또는 에이전트 persona에 "진행할까요?" 패턴 사용 시 자동 실행으로 전환하는 규칙 강화
  3. PM의 경우 LOW 리스크 작업은 auto-proceed 자동 적용 (현재 veto window만 있고 PM 자체 판단에서 승인을 구함)
