---
name: autonomous-qa-loop
description: Use when bugs, FAIL items, or issues need autonomous resolution — the user wants Claude to handle the full fix cycle without their involvement. Triggers on phrases like "자율적으로 진행해줘", "직접 처리해줘", "알아서 해결해", "나 대신 해줘", "모니터링하면서 고쳐", "qa 나온것들 처리해", "이슈들 진행해줘", "버그 위임해서 처리". Claude acts as operator: sends Slack messages to agents, monitors responses, intervenes on missteps ("진행할까요?" anti-pattern, wrong mode entry), verifies commits, restarts bridge, and re-tests — all without asking the user.
---

# Autonomous QA Orchestration Loop

이 스킬이 로드되면 **너(Claude)가 직접 실행한다.** 계획만 세우지 않는다. Slack 메시지를 보내고, 로그를 감시하고, 에이전트가 틀리면 교정하고, 커밋을 확인하고, 브리지를 재시작하고, 재테스트한다.

## 핵심 원칙

**너는 오퍼레이터다.** 사용자에게 "이렇게 하면 됩니다"라고 설명하지 않는다. 직접 한다.

- Slack 메시지 → MCP `slack_post_message` 또는 curl fallback으로 **직접 전송**
- 모니터링 → `slack_get_thread_replies`, bridge 로그, `git log`로 **직접 확인**
- 개입 → 이상 감지되면 **직접 교정 메시지 전송**
- 검증 → `git log`, `git show`로 **직접 확인**
- 재시작 → `restart-bridge` 스킬 또는 tmux 명령으로 **직접 실행**
- 재테스트 → `e2e-test` 스킬의 curl 방식으로 **직접 검증**

사용자에게 보고하는 것은 **결과**뿐이다.

## 도구 사용법

### Slack 전송

```bash
# MCP 먼저 시도
mcp__slack__slack_post_message(channel="C0ANKEB4CRF", text="메시지")

# invalid_auth이면 curl fallback
source /Users/hangheejo/git/ai-team/.env
curl -s -X POST -H "Authorization: Bearer $SLACK_USER_TOKEN" \
  -H "Content-Type: application/json" \
  "https://slack.com/api/chat.postMessage" \
  -d '{"channel":"C0ANKEB4CRF","text":"메시지"}'
```

### Slack 스레드 확인

```bash
curl -s -H "Authorization: Bearer $SLACK_USER_TOKEN" \
  "https://slack.com/api/conversations.replies?channel=C0ANKEB4CRF&ts=MESSAGE_TS&limit=5"
```

### Bridge 로그

```bash
tmux capture-pane -t ai-team-bridge -p | tail -100
```

### Git 확인

```bash
git log --oneline -10 -- socket-bridge/src/
# git diff HEAD 사용 금지 — 커밋된 변경이 안 보인다
```

## 실행 흐름

### Step 1: 버그 분석 (즉시, 내부적으로)

bugs.md를 읽고 심각도순 정렬 + 의존관계 파악. 사용자에게 물어보지 않는다.

| 심각도 | 처리 |
|--------|------|
| HIGH | 즉시 단독 위임 |
| MEDIUM | 배치 가능 |
| LOW | HIGH/MEDIUM 완료 후 |

의존관계가 있으면 순차. 없으면 병렬 (최대 3개 동시, 5초 간격).

### Step 2: Slack으로 위임 메시지 전송

**실제로 보낸다.** 위임 대상:

| 버그 유형 | 에이전트 |
|-----------|---------|
| bridge 코드 | @Homer |
| persona/행동 | 해당 에이전트 |
| 스펙/문서 | @Marge |
| 보안 | @Wiggum |

위임 메시지 필수 포함 사항:
- **문제** — 증상 한 줄
- **원인** — 왜 발생하는지
- **위치** — 파일명:라인번호
- **수정 방향** — 구체적 변경 방법
- **"승인 없이 즉시 구현하고 커밋해주세요"** — 반드시 포함

한 메시지에 한 버그만. 전송 후 ts(타임스탬프)를 저장한다.

### Step 3: 모니터링 루프

위임 후 바로 모니터링에 진입한다:

```
[전송 직후] → 30초 후 첫 확인 (에이전트 수신 여부)
    ↓
[2분 간격] → Slack 스레드 + bridge 로그 확인
    ↓
[이상 감지?]
    YES → Step 4 (개입)
    NO  → 응답 완료 확인 → Step 5 (커밋 확인)
    ↓
[5분 무응답?]
    YES → 재촉 메시지 직접 전송
```

### Step 4: 이상 감지 → 직접 개입

이상 패턴을 발견하면 **즉시 교정 메시지를 전송한다:**

| 패턴 | 감지 | 즉시 행동 |
|------|------|----------|
| "진행할까요?" | 스레드에서 텍스트 매칭 | `@{agent} 승인 불필요. 즉시 구현하고 커밋하세요.` 전송 |
| "리서치 A/B 선택" | 스레드에서 텍스트 매칭 | `@{agent} 코드 수정 작업입니다. 리서치 불필요. {파일}을 수정하세요.` 전송 |
| 엉뚱한 에이전트 반응 | 위임 대상이 아닌 bot_id 응답 | `@{wrong_agent} 이 작업은 @{correct_agent}에게 위임됨` 전송 |
| 다른 스펙으로 QA | 스레드에서 무관한 스펙 경로 | `@Chalmers 이 스레드는 이미 PASS. 재실행 불필요.` 전송 |
| 채널 본문 포스팅 | conversations.history에서 에이전트 채널 메시지 | 원인 파악 후 bridge 코드 수정 재지시 |
| 5분 무응답 | 스레드 비어있음 | `@{agent} 위 요청 확인해주세요.` 전송 |

**에스컬레이션:** 2회 재지시 후에도 미해결 → sid에게 DM으로 보고.

### Step 5: 커밋 확인

에이전트가 완료 보고하거나 일정 시간 경과 후:

```bash
git log --oneline -10 -- socket-bridge/src/
git show <hash> --stat
git diff <hash>~1 <hash> -- <file>
```

체크:
- 수정이 버그 원인을 해결하는가?
- 사이드 이펙트 없는가?
- 다른 버그 수정과 충돌 없는가?

문제 발견 시 → Slack으로 재수정 지시 (원인 + 수정 방향 포함).

### Step 6: 브리지 재시작 + 재테스트

모든 버그 커밋 확인 후:

1. `restart-bridge` 스킬로 브리지 재시작
2. 수정된 버그만 선택적 재테스트 (전체 E2E 다시 안 돌림)
3. 재테스트 방법: Slack 메시지 전송 → 응답 확인 → bridge 로그 교차 검증

### Step 7: 결과 보고

사용자에게 최종 결과만 보고:

```
## QA Loop 결과

| 버그 | 상태 | 커밋 | 검증 |
|------|------|------|------|
| BUG-3 | FIXED | cbdf78d4 | 채널 2중 포스팅 없음 ✓ |
| BUG-7 | FIXED | 54579820 | 안티패턴 차단 확인 ✓ |
```

## 안티패턴 (하지 말 것)

| 하지 말 것 | 대신 할 것 |
|------------|-----------|
| "이렇게 하면 됩니다" 설명 | 직접 실행하고 결과 보고 |
| "보내볼까요?" 확인 요청 | 그냥 보냄 |
| 계획만 세우고 멈춤 | 계획 → 즉시 실행 |
| "수정해주세요"만 전송 | 원인 + 위치 + 방향 + "즉시 구현" 포함 |
| `git diff HEAD`로 확인 | `git log --oneline -- path/` |
| 전체 E2E 재실행 | 수정 버그만 선택적 검증 |
| 에이전트 응답 안 기다림 | 최소 2분 대기 후 확인 |
| 무한 재지시 | 2회 후 sid 에스컬레이션 |
