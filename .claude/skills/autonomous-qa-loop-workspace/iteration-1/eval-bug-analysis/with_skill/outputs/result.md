# Autonomous QA Loop — 버그 분석 & 위임 계획

> 생성 시각: 2026-04-10
> 모드: 계획만 (Slack 전송 없음)
> 대상: BUG-3 (HIGH), BUG-5 (MEDIUM), BUG-4 (LOW)

---

## Phase 1: 버그 분석 & 분류

### BUG-3: MCP slack_post_message 직접 호출 → 채널 본문 2중 포스팅

| 항목 | 내용 |
|------|------|
| 심각도 | **HIGH** |
| 증상 | PM/QA 응답이 스레드가 아닌 채널 본문에 별도 메시지로 게시 (2중 포스팅) |
| 원인 | `permissionMode: 'bypassPermissions'` + `mcpServers` 조합으로 `allowedTools` 필터가 MCP 도구 차단 불가 |
| 증거 | 채널 TOP(ts=1775781173) vs 스레드(ts=1775781182) 내용 상이 — 에이전트 자체 MCP 호출 + bridge 포스팅 2회 |
| 코드 위치 | `agent-runtime.ts:2301` allowedTools: baseTools / `agent-runtime.ts:1061` 주석에 이미 인지 |
| 수정 방향 | MCP 서버 설정에서 `slack_post_message`, `slack_reply_to_thread`를 `disallowedTools`에 추가 |
| 담당 에이전트 | **Homer (Backend)** — socket-bridge 소유자 |
| 위임 방식 | 단독 즉시 위임 (HIGH, 사용자 워크플로 중단) |

### BUG-5: Lisa 비-리서치 질문에 리서치 모드 진입

| 항목 | 내용 |
|------|------|
| 심각도 | **MEDIUM** |
| 증상 | "@Lisa bridge 코드 분석해줘" → 리서치 A/B 선택 대기 진입 |
| 기대 동작 | 코드 분석 = 즉시 답변 (리서치 아님) |
| 수정 방향 | 리서치 모드 판정 로직에서 "코드 분석/확인/설명" 패턴 제외 |
| 담당 에이전트 | **Homer (Backend)** — bridge 라우팅 로직 소유 |
| 위임 방식 | 배치 위임 가능 (BUG-3과 동일 담당) |

### BUG-4: SESSION_TTL 체크리스트 72h vs 코드 30일

| 항목 | 내용 |
|------|------|
| 심각도 | **LOW** |
| 증상 | 체크리스트 문서는 72시간, 코드(`config.ts:22`)는 30일 |
| 수정 방향 | 스펙 불일치 → 의도 확인 필요. 코드 값(30일)이 실제 운영 기준이므로 체크리스트를 30일로 갱신 |
| 담당 에이전트 | **Marge (PM)** — 체크리스트/문서 소유자 |
| 위임 방식 | 다른 버그 완료 후 배치 처리 |

---

## Phase 2: 의존관계 분석

```
BUG-3 (HIGH, Homer) ← 독립적. 선행 의존 없음
    ↓ (동일 담당)
BUG-5 (MEDIUM, Homer) ← BUG-3과 동일 파일(agent-runtime.ts) 수정 가능성
    → BUG-3 커밋 후 착수 (같은 파일 충돌 방지)

BUG-4 (LOW, Marge) ← 코드 변경과 독립. 문서만 수정
    → BUG-3/5와 병렬 가능
    → 단, LOW이므로 HIGH/MEDIUM 완료 후 배치 처리 권장
```

### 의존관계 요약

| 관계 | 유형 | 이유 |
|------|------|------|
| BUG-3 → BUG-5 | **순차** | 동일 담당(Homer) + 동일 코드 영역(agent-runtime.ts) 수정 가능성. BUG-3 커밋 확인 후 BUG-5 착수 |
| BUG-3 → BUG-4 | 독립 | 담당 다름(Homer vs Marge), 수정 파일 겹치지 않음 |
| BUG-5 → BUG-4 | 독립 | 담당 다름, 수정 파일 겹치지 않음 |

---

## Phase 3: 위임 순서 결정

### 실행 순서

```
Round 1 (즉시):
  ├─ [위임 1] BUG-3 → @Homer (HIGH, 즉시 실행)
  │
Round 2 (BUG-3 커밋 확인 후):
  ├─ [위임 2] BUG-5 → @Homer (MEDIUM, BUG-3 완료 후)
  │
Round 3 (BUG-5 커밋 확인 후 또는 병렬):
  └─ [위임 3] BUG-4 → @Marge (LOW, 배치 처리)
```

### 위임 메시지 초안 (Slack 전송하지 않음)

**위임 1 — BUG-3 → @Homer:**

```
@Homer BUG-3 수정 요청입니다.

**문제:** MCP slack_post_message 직접 호출로 채널 본문에 2중 포스팅
**원인:** permissionMode: 'bypassPermissions'가 allowedTools 필터를 우회하여 MCP 도구 차단 불가
**위치:** agent-runtime.ts:2301 allowedTools: baseTools / agent-runtime.ts:1061 주석에 이미 인지된 이슈
**수정 방향:** MCP 서버 설정에서 slack_post_message, slack_reply_to_thread를 disallowedTools에 추가
**참고:** agent-runtime.ts:1061 주석에 이미 인지된 이슈

승인 없이 즉시 구현하고 커밋해주세요.
```

**위임 2 — BUG-5 → @Homer (BUG-3 커밋 후):**

```
@Homer BUG-5 수정 요청입니다.

**문제:** Lisa가 비-리서치 질문("bridge 코드 분석해줘")에 리서치 모드 진입
**증상:** 코드 분석/확인 요청인데 리서치 A/B 선택 대기 상태 진입
**위치:** bridge 라우팅 로직 — 리서치 모드 판정 함수
**수정 방향:** 리서치 모드 판정 로직에서 "코드 분석", "코드 확인", "코드 설명", "분석해줘" 등의 패턴을 제외 조건에 추가
**기대:** "@Lisa bridge 코드 분석해줘" → 즉시 코드 분석 응답 (리서치 A/B 선택 없음)

승인 없이 즉시 구현하고 커밋해주세요.
```

**위임 3 — BUG-4 → @Marge (배치):**

```
@Marge BUG-4 스펙 정정 요청입니다.

**문제:** SESSION_TTL 체크리스트에 72시간으로 기재, 실제 코드는 30일
**위치:** E2E 체크리스트 섹션 12 (세션 관리)
**코드 참조:** config.ts:22 — SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
**수정 방향:** 체크리스트의 SESSION_TTL 값을 72시간 → 30일로 갱신
**근거:** 코드 값(30일)이 실제 운영 기준. Sprint Log [2026-03-26]에 "Thread session JSON 영구화 (30일 TTL)" 기록 있음

승인 없이 즉시 수정하고 커밋해주세요.
```

---

## Phase 4: 모니터링 계획

### 감시 포인트

| 버그 | 감시 대상 | 이상 패턴 | 개입 행동 |
|------|----------|----------|----------|
| BUG-3 | Homer Slack 스레드 + git log -- socket-bridge/src/ | "진행할까요?" 응답 | "승인 없이 즉시 실행하세요" 재지시 |
| BUG-5 | Homer Slack 스레드 + git log -- socket-bridge/src/ | 리서치 모드 진입 | "코드 수정 작업입니다, 리서치 불필요" 교정 |
| BUG-4 | Marge Slack 스레드 + git log -- docs/ | 의도 확인 질문 | "코드 30일이 정답, 체크리스트만 수정" 명시 |

### 감시 주기

- 위임 직후: 30초 후 첫 확인 (수신 여부)
- 진행 중: 2분 간격
- 장기 미응답: 5분 초과 시 재촉

---

## Phase 5: 검증 계획 (재테스트)

모든 커밋 확인 후, 수정된 버그만 선택적 검증:

| 버그 | 검증 방법 |
|------|----------|
| BUG-3 | 에이전트 응답 후 `conversations.history`에서 채널 본문 중복 포스팅 없는지 확인 |
| BUG-5 | "@Lisa bridge 코드 분석해줘" 전송 → 리서치 A/B 선택 없이 즉시 응답하는지 확인 |
| BUG-4 | 체크리스트 문서에서 SESSION_TTL 값이 30일로 갱신되었는지 파일 확인 |

---

## 기존 커밋 참고

> 주의: context-handoff에 따르면 이 3건은 이미 수정 커밋이 존재합니다:
> - `cbdf78d4` — fix(BUG-3): MCP Slack 쓰기 도구 이중 포스팅 차단
> - `b488a7c1` — fix(bridge): BUG-4 체크리스트 SESSION_TTL 72h→30일 수정, BUG-5 비-리서치 패턴 제외 로직 추가
>
> 실제 위임이 필요한 경우, 위 커밋의 수정 내용을 먼저 검증하여 재위임 필요 여부를 판단해야 합니다.
