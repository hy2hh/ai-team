# Homer 4개 커밋 검증 계획 및 재테스트 전략

> 대상 커밋 (최신순):
> 1. `116636fc` — BUG-6: QA PASS/WARN 스레드 재트리거 skip 로직
> 2. `cbdf78d4` — BUG-3: MCP Slack 쓰기 도구 이중 포스팅 차단
> 3. `54579820` — BUG-2/BUG-7: Block Kit 승인 버튼 및 안티패턴 재실행 차단
> 4. `b488a7c1` — BUG-4/BUG-5: SESSION_TTL 수정 + 비-리서치 패턴 제외

---

## 1단계: 커밋 정적 검증 (코드 리뷰)

각 커밋에 대해 아래 명령으로 변경 범위를 확인한다.

### 1-1. 변경 파일 목록 확인

```bash
# 4개 커밋의 변경 파일 목록 일괄 확인
git show --stat 116636fc cbdf78d4 54579820 b488a7c1
```

**확인 포인트:**
- `socket-bridge/src/` 경로의 파일만 변경되었는지
- 의도하지 않은 파일(설정, 문서 등)이 함께 수정되지 않았는지
- 각 커밋이 단일 버그에 집중하는 atomic commit인지

### 1-2. 커밋별 diff 리뷰

```bash
# 개별 커밋 diff 상세 확인
git show 116636fc   # BUG-6
git show cbdf78d4   # BUG-3
git show 54579820   # BUG-2/BUG-7
git show b488a7c1   # BUG-4/BUG-5
```

**리뷰 체크리스트:**
- [ ] 변수/함수명이 camelCase 컨벤션을 따르는지
- [ ] 새로 추가된 함수에 TSDoc이 있는지
- [ ] 조건문에 반드시 중괄호가 있는지
- [ ] `any` 타입 사용이 없는지
- [ ] 하드코딩된 매직 넘버가 상수로 추출되었는지
- [ ] 에러 핸들링이 적절한지 (try-catch 누락 없는지)

### 1-3. 타입 체크

```bash
cd socket-bridge && npx tsc --noEmit
```

---

## 2단계: 버그별 재테스트 계획

### BUG-2/BUG-7 — Block Kit 승인 버튼 + 안티패턴 재실행 차단 (`54579820`)

**변경 예상 파일:** `agent-control-buttons.ts`, `auto-proceed.ts` 등

**테스트 시나리오:**

| # | 시나리오 | 기대 결과 | 검증 방법 |
|---|---------|----------|----------|
| 1 | Slack에서 승인 버튼 클릭 | 버튼 동작 정상, Block Kit 메시지 업데이트 | Slack 채널에서 버튼 클릭 후 응답 확인 |
| 2 | 동일 승인 버튼 2회 연속 클릭 | 두 번째 클릭은 무시 또는 "이미 처리됨" 표시 | 중복 실행이 발생하지 않는지 bridge 로그 확인 |
| 3 | 안티패턴 감지 후 재실행 시도 | 차단되어 재실행 불가 | bridge 로그에 차단 메시지 확인 |
| 4 | 정상 패턴은 여전히 실행 가능 | 차단 없이 정상 동작 | 정상 요청 시 bridge 로그 확인 |

**실행 명령 (예정):**
```bash
# bridge 로그 실시간 모니터링
tail -f socket-bridge/logs/*.log

# 또는 bridge 프로세스 stdout 확인
# Slack #ai-team 채널에서 승인 버튼 테스트 메시지 전송
```

---

### BUG-3 — MCP Slack 이중 포스팅 차단 (`cbdf78d4`)

**변경 예상 파일:** `config.ts` 또는 `router.ts` (disallowedTools 설정)

**테스트 시나리오:**

| # | 시나리오 | 기대 결과 | 검증 방법 |
|---|---------|----------|----------|
| 1 | 에이전트가 MCP로 Slack 메시지 전송 | bridge를 통한 1회만 전송, MCP 직접 전송 차단 | Slack 채널에서 메시지 중복 여부 확인 |
| 2 | disallowedTools에 등록된 도구 호출 시도 | 호출 차단됨 | bridge 로그에서 차단 로그 확인 |
| 3 | 허용된 MCP 도구 사용 | 정상 동작 | 기존 기능 정상 확인 (회귀 테스트) |

**핵심 확인:**
- `disallowedTools` 목록에 Slack 쓰기 도구(`slack_post_message`, `slack_reply_to_thread` 등)가 포함되어 있는지
- 읽기 전용 도구(`slack_get_channel_history` 등)는 차단되지 않는지

---

### BUG-4/BUG-5 — SESSION_TTL + 비-리서치 패턴 제외 (`b488a7c1`)

**변경 예상 파일:** `config.ts`, `qa-loop.ts` 또는 관련 체크리스트 파일

**테스트 시나리오:**

| # | 시나리오 | 기대 결과 | 검증 방법 |
|---|---------|----------|----------|
| 1 | SESSION_TTL 값 확인 | 30일(2592000000ms 또는 동등 값)로 설정 | `git show b488a7c1`에서 값 직접 확인 |
| 2 | 30일 이내 세션 접근 | 정상 유지, 만료되지 않음 | 기존 세션 데이터 접근 가능 여부 확인 |
| 3 | 비-리서치 패턴 메시지 전송 | QA 체크리스트에서 제외 | bridge 로그에서 skip 로그 확인 |
| 4 | 리서치 패턴 메시지 전송 | 정상적으로 QA 체크리스트에 포함 | bridge 로그에서 처리 로그 확인 |

**핵심 확인:**
- 이전 값 72h에서 30일로 정확히 변경되었는지
- 비-리서치 패턴 제외 조건이 너무 넓지 않은지 (정상 리서치도 제외될 위험)

---

### BUG-6 — QA PASS/WARN 스레드 재트리거 skip (`116636fc`)

**변경 예상 파일:** `qa-loop.ts`

**테스트 시나리오:**

| # | 시나리오 | 기대 결과 | 검증 방법 |
|---|---------|----------|----------|
| 1 | QA 루프에서 PASS 판정 후 동일 스레드에 새 메시지 | 재트리거 skip, QA 루프 재시작 안 됨 | bridge 로그에서 skip 로그 확인 |
| 2 | QA 루프에서 WARN 판정 후 동일 스레드에 새 메시지 | 재트리거 skip | bridge 로그에서 skip 로그 확인 |
| 3 | QA 루프에서 FAIL 판정 후 동일 스레드에 새 메시지 | 재트리거 허용 (FAIL은 재검토 필요) | bridge 로그에서 정상 트리거 확인 |
| 4 | 새 스레드에서 QA 루프 시작 | 정상 트리거 | bridge 로그에서 정상 동작 확인 |

**핵심 확인:**
- skip 판단 기준이 스레드 ID + 판정 결과 조합인지
- skip 로그가 디버깅 가능한 수준으로 남는지

---

## 3단계: 통합 재테스트 (E2E)

개별 버그 재테스트 이후, 아래 통합 시나리오로 상호작용 검증:

### 3-1. Bridge 재시작 후 전체 동작 확인

```bash
# /restart-bridge 스킬로 재시작 (수동 재시작 금지)
# 재시작 후 WebSocket 연결 정상 확인
```

### 3-2. E2E 체크리스트 항목 (기존 체크리스트 활용)

```bash
# e2e-test 스킬 실행으로 전체 체크리스트 순회
# 특히 아래 영역 집중:
# - Slack 메시지 송수신
# - 에이전트 위임 및 응답
# - QA 루프 정상 동작
# - 승인 버튼 인터랙션
```

### 3-3. 회귀 테스트

변경된 파일과 의존 관계가 있는 모듈 확인:

```bash
# import 관계 추적
grep -r "from './" socket-bridge/src/qa-loop.ts
grep -r "from './" socket-bridge/src/config.ts
grep -r "qa-loop" socket-bridge/src/*.ts
grep -r "config" socket-bridge/src/*.ts
```

기존 기능 중 영향받을 수 있는 항목:
- `queue-processor.ts` — 큐 처리 시 SESSION_TTL 참조 여부
- `router.ts` — 메시지 라우팅 시 disallowedTools 체크
- `auto-proceed.ts` — 자동 진행 시 안티패턴 차단과 충돌 여부

---

## 4단계: 최종 판정 기준

| 판정 | 조건 |
|------|------|
| PASS | 모든 버그별 시나리오 통과 + 회귀 없음 + bridge 정상 동작 |
| WARN | 일부 시나리오 미확인이나 핵심 기능 정상 |
| FAIL | 버그 재현 또는 새 회귀 발생 |

---

## 실행 순서 요약

```
1. git show --stat (4개 커밋 변경 범위 확인)
2. git show (각 커밋 diff 코드 리뷰)
3. tsc --noEmit (타입 체크)
4. /restart-bridge (bridge 재시작)
5. 버그별 개별 재테스트 (BUG-2→3→4/5→6 순서)
6. E2E 체크리스트 통합 테스트
7. 회귀 테스트
8. 최종 판정 및 결과 기록
```
