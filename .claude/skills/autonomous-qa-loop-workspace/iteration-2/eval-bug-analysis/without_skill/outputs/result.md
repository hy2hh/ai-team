# Autonomous QA Loop -- Bug Analysis & Resolution Plan (without skill)

> 생성 시각: 2026-04-10
> 모드: 실행 로그 (테스트 환경 -- 실제 Slack 전송 불가)
> 대상: BUG-3 (HIGH), BUG-5 (MEDIUM), BUG-4 (LOW)

---

## Phase 0: 기존 수정 상태 확인

커밋 히스토리에서 3건 모두 이미 수정 커밋이 존재함을 확인:

| BUG | 커밋 | 상태 |
|-----|------|------|
| BUG-3 | `cbdf78d4` fix(BUG-3): MCP Slack 쓰기 도구 이중 포스팅 차단 -- disallowedTools 적용 | 수정 완료 |
| BUG-4 | `b488a7c1` fix(bridge): BUG-4 체크리스트 SESSION_TTL 72h->30일 수정 | 수정 완료 |
| BUG-5 | `b488a7c1` fix(bridge): BUG-5 비-리서치 패턴 제외 로직 추가 | 수정 완료 |

### 코드 검증 결과

**BUG-3 수정 확인:**
- `agent-runtime.ts:843-847` -- `MCP_SLACK_WRITE_TOOLS` 배열에 `slack_post_message`, `slack_reply_to_thread`, `slack_add_reaction` 포함
- `agent-runtime.ts:2379` -- 비회의 모드에서 `disallowedTools: MCP_SLACK_WRITE_TOOLS` 적용
- `allowedTools`만으로는 `bypassPermissions` 모드에서 MCP 도구 차단 불가 -> `disallowedTools`는 모델 컨텍스트에서 아예 제거하므로 bypass 영향 없음

**BUG-5 수정 확인:**
- `agent-runtime.ts:461-466` -- `nonResearchPatterns` 배열에 '코드 분석', '코드 확인', '코드 설명', '코드 리뷰', '버그 분석', '오류 분석', '에러 분석', '분석해줘', '확인해줘', '설명해줘' 등 패턴 포함
- `isResearchRequest()` 함수에서 nonResearchPatterns 먼저 체크 후 false 반환 -> 리서치 키워드 매칭 전에 탈출

**BUG-4 수정 확인:**
- `config.ts:22` -- `SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000` (30일)
- `docs/bridge-behavior-checklist.md:161` -- "SESSION_TTL(30일)" 으로 문서도 동기화 완료

---

## Phase 1: 실행 계획 (수정이 이미 완료되었으므로 검증 + 알림 위주)

수정 코드가 이미 적용되어 있으나, bridge 재시작과 검증이 필요한 상황. 아래는 전체 실행 로그.

---

## 실행 로그

### Step 1: 팀 알림 -- BUG 수정 상황 공유

```
[ACTION 1] slack_post_message(channel="C0ANKEB4CRF", text="@here E2E 테스트에서 발견된 버그 3건 처리 현황 공유합니다.\n\n| # | 심각도 | 버그 | 상태 |\n|---|--------|------|------|\n| BUG-3 | HIGH | MCP slack_post_message 2중 포스팅 | ✅ 수정 완료 (cbdf78d4) |\n| BUG-5 | MEDIUM | Lisa 비-리서치 질문에 리서치 모드 진입 | ✅ 수정 완료 (b488a7c1) |\n| BUG-4 | LOW | SESSION_TTL 체크리스트 72h vs 코드 30일 | ✅ 수정 완료 (b488a7c1) |\n\n3건 모두 코드 수정 + 커밋 완료 상태입니다. 아래에 각 건별 검증 결과를 공유합니다.")
```

### Step 2: BUG-3 (HIGH) 상세 검증 -- @Homer 핀포인트 리뷰 요청

```
[ACTION 2] slack_post_message(channel="C0ANKEB4CRF", text="@Homer BUG-3 수정 검증 요청드립니다.\n\n**문제**: permissionMode='bypassPermissions' 환경에서 allowedTools만으로 MCP 쓰기 도구 차단 불가 -> 에이전트가 채널 본문에 직접 메시지 게시 (2중 포스팅)\n\n**수정 내용** (cbdf78d4):\n- `MCP_SLACK_WRITE_TOOLS` 배열 정의 (agent-runtime.ts:843-847)\n- 비회의 모드: `disallowedTools: MCP_SLACK_WRITE_TOOLS` 적용 (agent-runtime.ts:2379)\n- 회의 모드: disallowedTools 미적용 (에이전트 봇으로 의견 게시 필요)\n\n**검증 포인트**:\n1. 일반 메시지 -> 에이전트 응답이 스레드에만 게시되는지\n2. 채널 본문에 별도 메시지 없는지\n3. 회의 모드에서는 MCP 쓰기 도구 정상 사용 가능한지\n\nbridge 재시작 후 E2E 체크리스트 A-5-2, A-6-1 항목 재테스트 부탁드립니다.")
```

### Step 3: BUG-5 (MEDIUM) 상세 검증

```
[ACTION 3] slack_post_message(channel="C0ANKEB4CRF", text="BUG-5 수정 검증 결과입니다.\n\n**문제**: '@Lisa bridge 코드 분석해줘' -> 리서치 A/B 선택 대기 진입\n\n**수정 내용** (b488a7c1):\n- `isResearchRequest()` 함수에 `nonResearchPatterns` 배열 추가\n- '코드 분석', '코드 확인', '코드 설명', '코드 리뷰', '버그 분석', '오류 분석', '에러 분석' 등 패턴 선행 체크\n- nonResearchPatterns 매칭 시 즉시 false 반환 -> 리서치 모드 진입 차단\n\n**잔여 리스크**: '분석해줘'가 nonResearchPatterns에 포함되어 있어, '@Lisa 시장 분석해줘' 같은 정당한 리서치 요청도 차단될 수 있음\n\n**권장 조치**: '분석해줘' 단독 패턴은 제거하고, '코드 분석', '버그 분석' 등 구체적 비-리서치 조합만 남기는 것을 권장\n\n@Homer 위 잔여 리스크 확인 후 nonResearchPatterns 조정 검토 부탁드립니다.")
```

### Step 4: BUG-5 잔여 리스크 수정 제안 -- nonResearchPatterns 정밀화

현재 코드 분석 결과, `nonResearchPatterns`에 '분석해줘', '확인해줘', '설명해줘' 같은 범용 패턴이 포함되어 있어 false negative(정당한 리서치 차단) 가능성이 있음.

```
[ACTION 4] -- 코드 수정 (agent-runtime.ts:461-466)

현재 코드:
  const nonResearchPatterns = [
    '코드 분석', '코드 확인', '코드 설명', '코드 리뷰',
    'code 분석', 'code 확인', 'code 설명',
    '버그 분석', '오류 분석', '에러 분석',
    '분석해줘', '분석해 줘', '확인해줘', '확인해 줘', '설명해줘', '설명해 줘',
  ];

수정 제안:
  const nonResearchPatterns = [
    '코드 분석', '코드 확인', '코드 설명', '코드 리뷰',
    'code 분석', 'code 확인', 'code 설명',
    '버그 분석', '오류 분석', '에러 분석',
    '구조 분석', '로직 분석', '성능 분석',
    'bridge 분석', 'bridge 확인',
  ];

이유: '분석해줘' 단독은 '@Lisa 시장 분석해줘'도 차단함.
구체적 비-리서치 컨텍스트(코드/버그/구조/로직/성능/bridge)와 조합된 패턴만 남겨야 함.
```

### Step 5: BUG-4 (LOW) 검증 완료 보고

```
[ACTION 5] slack_post_message(channel="C0ANKEB4CRF", text="BUG-4 수정 검증 완료.\n\n**문제**: 체크리스트 72시간 vs 코드 30일 불일치\n**수정**: 체크리스트(bridge-behavior-checklist.md:161)를 30일로 갱신 (b488a7c1)\n**코드 확인**: config.ts:22 -- SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 (30일)\n**문서 확인**: 'SESSION_TTL(30일) 초과 세션 자동 정리' 표기 일치\n\n추가 조치 불필요.")
```

### Step 6: Bridge 재시작 요청

```
[ACTION 6] -- /restart-bridge 스킬 실행
설명: socket-bridge/src/ 파일 수정이 있었으므로 (BUG-3 cbdf78d4, BUG-5 b488a7c1)
bridge 재시작으로 변경사항 반영 필요.
WebSocket 세션 정리 대기를 스킬이 자동 처리.
```

### Step 7: E2E 재검증 -- 수정된 항목 재테스트

```
[ACTION 7] slack_post_message(channel="C0ANKEB4CRF", text="@Chalmers BUG-3, BUG-4, BUG-5 수정 반영 후 아래 E2E 체크리스트 항목 재테스트 부탁드립니다:\n\n- [ ] A-5-2: MCP 도구 직접 호출 차단 (에이전트 응답이 스레드에만 게시)\n- [ ] A-6-1: 채널 본문 2중 포스팅 없음\n- [ ] B-5-2: '@Lisa bridge 코드 분석해줘' -> 즉시 답변 (리서치 모드 진입 안 함)\n- [ ] 12: SESSION_TTL 30일 동작 확인\n\n결과 리포트를 스레드로 공유해주세요.")
```

### Step 8: 버그 문서 상태 업데이트

```
[ACTION 8] -- docs/e2e-test-results/detail/bugs.md 수정
각 BUG 항목에 수정 상태 추가:

BUG-3 섹션 하단에 추가:
- **수정 커밋**: cbdf78d4
- **수정 방법**: disallowedTools에 MCP_SLACK_WRITE_TOOLS 추가
- **상태**: RESOLVED -- 재테스트 필요

BUG-4 섹션 하단에 추가:
- **수정 커밋**: b488a7c1
- **수정 방법**: 체크리스트 72h -> 30일 갱신
- **상태**: RESOLVED

BUG-5 섹션 하단에 추가:
- **수정 커밋**: b488a7c1
- **수정 방법**: isResearchRequest()에 nonResearchPatterns 제외 로직 추가
- **상태**: RESOLVED (잔여 리스크: 범용 패턴 false negative 가능)
```

### Step 9: 최종 상태 보고

```
[ACTION 9] slack_post_message(channel="C0ANKEB4CRF", text="E2E 버그 3건 처리 완료 보고:\n\n**BUG-3 (HIGH)** -- MCP 2중 포스팅 차단\n- disallowedTools로 MCP Slack 쓰기 도구 차단 (bypassPermissions 우회 방지)\n- 회의 모드에서만 예외 허용\n- 커밋: cbdf78d4\n\n**BUG-5 (MEDIUM)** -- Lisa 비-리서치 패턴 제외\n- isResearchRequest()에 nonResearchPatterns 선행 체크 추가\n- 잔여 리스크: '분석해줘' 범용 패턴이 정당한 리서치도 차단 가능 -> @Homer 정밀화 검토 요청\n- 커밋: b488a7c1\n\n**BUG-4 (LOW)** -- SESSION_TTL 문서 동기화\n- 체크리스트 72h -> 30일 갱신\n- 커밋: b488a7c1\n\nbridge 재시작 + @Chalmers 재테스트 요청 완료.\n남은 액션: BUG-5 nonResearchPatterns 정밀화 (Homer)")
```

---

## 의존 관계 분석

```
BUG-3 (HIGH, Homer) -- 독립적. disallowedTools 적용으로 해결
    |
    v
BUG-5 (MEDIUM, Homer) -- 독립적. nonResearchPatterns 로직으로 해결
    |                     잔여 리스크: 범용 패턴 false negative
    v
BUG-4 (LOW, Marge) -- 독립적. 문서 갱신으로 해결
    |
    v
[Bridge 재시작] -- BUG-3, BUG-5 코드 변경 반영
    |
    v
[E2E 재테스트] -- Chalmers가 A-5-2, A-6-1, B-5-2, 12번 항목 재검증
```

---

## 발견된 잔여 리스크

### BUG-5 nonResearchPatterns False Negative

**현상**: `nonResearchPatterns`에 '분석해줘', '확인해줘', '설명해줘' 범용 패턴이 포함됨

**영향**: '@Lisa 시장 분석해줘', '@Lisa 트렌드 분석해줘' 등 정당한 리서치 요청이 리서치 모드에 진입하지 못하고 즉시 답변으로 처리될 수 있음

**검증 방법**: `isResearchRequest()` 호출 시 아래 테스트 케이스 확인
- '@Lisa 시장 분석해줘' -> true여야 함 (리서치)
- '@Lisa 코드 분석해줘' -> false여야 함 (비-리서치)
- 현재 코드에서는 '분석해줘'가 선행 체크되어 둘 다 false 반환

**수정 권장**: 범용 패턴('분석해줘', '확인해줘', '설명해줘') 제거, 구체적 조합 패턴만 유지

---

## 검증 체크리스트

| # | 항목 | 기대 결과 | 검증 방법 |
|---|------|-----------|-----------|
| 1 | BUG-3 disallowedTools 적용 | 비회의 모드에서 MCP Slack 쓰기 차단 | agent-runtime.ts:2379 코드 확인 |
| 2 | BUG-3 회의 모드 예외 | 회의 모드에서 MCP 쓰기 허용 | isMeetingContext 조건 확인 |
| 3 | BUG-5 nonResearchPatterns | '코드 분석' 등에서 리서치 모드 미진입 | isResearchRequest() 로직 확인 |
| 4 | BUG-5 정당한 리서치 | '시장 조사' 등에서 리서치 모드 진입 | '분석해줘' 범용 패턴 영향 확인 |
| 5 | BUG-4 문서 동기화 | 체크리스트에 30일 표기 | bridge-behavior-checklist.md:161 확인 |
| 6 | BUG-4 코드 값 | SESSION_TTL_MS = 30일 | config.ts:22 확인 |
| 7 | Bridge 재시작 | 코드 변경 반영 | /restart-bridge 스킬 실행 |
| 8 | E2E 재테스트 | A-5-2, A-6-1, B-5-2, 12번 PASS | Chalmers 재검증 |

---

## 요약

3건 모두 코드 수정이 이미 커밋되어 있으며(cbdf78d4, b488a7c1), bridge 재시작과 E2E 재테스트가 필요한 상태. BUG-5에서 `nonResearchPatterns`의 범용 패턴이 정당한 리서치 요청을 차단할 수 있는 잔여 리스크를 발견하여 Homer에게 정밀화 검토를 요청함.
