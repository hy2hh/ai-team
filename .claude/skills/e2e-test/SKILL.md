---
name: e2e-test
description: Bridge E2E 테스트 실행. 체크리스트 기반으로 Slack 메시지를 전송하고 응답을 검증. 트리거: "e2e 테스트", "E2E", "체크리스트 테스트", "브리지 테스트"
---

# Bridge E2E 테스트 하네스

## Slack API 사용법

**항상 하네스 스크립트를 사용한다. MCP Slack 도구 사용 금지 (항상 `invalid_auth`).**

```bash
# 메시지 전송 → ts 반환
ts=$(bash .claude/skills/e2e-test/scripts/slack.sh send "메시지 내용")
ts=$(bash .claude/skills/e2e-test/scripts/slack.sh send "스레드 답글" "$parent_ts")

# 스레드 응답 확인 (JSON)
bash .claude/skills/e2e-test/scripts/slack.sh replies "$ts"

# PM 중복 포스팅 검증
bash .claude/skills/e2e-test/scripts/slack.sh pm_count "$ts"

# 특정 봇 메시지만 출력
bash .claude/skills/e2e-test/scripts/slack.sh bot_messages "$ts" "B0ANKFERR0R"

# 응답 대기 (최대 60초, 메시지 2개 이상 올 때까지)
bash .claude/skills/e2e-test/scripts/slack.sh wait_reply "$ts" 60 2

# 채널 최근 메시지
bash .claude/skills/e2e-test/scripts/slack.sh history 10
```

**주의: `reactions.get` API는 scope 없음 (`reactions:read` 미보유). 리액션 확인은 브리지 로그로 대체.**

## 에이전트 Bot User ID 맵

| 에이전트 | Bot User ID | Bot ID | role |
|----------|-------------|--------|------|
| PM (Marge) | U0AN037TU6P | B0AMR1CRC79 | pm |
| Designer (Krusty) | U0ANKD0C7RP | B0AN33BNWHK | designer |
| Frontend (Bart) | U0AP0SH3QRE | B0AN4GU6A8N | frontend |
| Backend (Homer) | U0AMR4WQMC7 | B0ANKFERR0R | backend |
| Researcher (Lisa) | U0ANA5X427N | B0ANKFAS725 | researcher |
| SecOps (Wiggum) | U0AP0RT4CUQ | B0AN4G42NCE | secops |
| QA (Chalmers) | U0APJTWBNMC | B0AP5GRNC79 | qa |
| sid (사용자) | U0AJ3T423RU | B0AQB3JN38E | - |

## 채널 정보

- **#ai-team 채널 ID**: `C0ANKEB4CRF`
- **memory.db 경로**: `.memory/memory.db`

## 동시 전송 규칙 (중요!)

### Debounce Batch 방지

브리지는 3초 이내 연속 메시지를 하나로 묶음 (debounce). 개별 테스트가 필요하면:

```bash
# 최소 5초 간격으로 전송 (debounce window 3초 + 여유)
send() {
  local msg="$1"
  ts=$(curl -s -X POST -H "Authorization: Bearer $SLACK_USER_TOKEN" -H "Content-Type: application/json" \
    "https://slack.com/api/chat.postMessage" \
    -d "{\"channel\":\"C0ANKEB4CRF\",\"text\":\"$msg\"}" 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('ts','err'))")
  echo "SENT: $ts → ${msg:0:60}"
  sleep 5
}
```

### 최대 동시 처리 제한

- **MAX_CONCURRENT_HANDLERS=5** — 동시 5개 에이전트만 실행
- 한 배치에 **최대 7개**까지만 전송 (5개 동시 처리 + 2개 큐 대기)
- 배치 간격: **이전 배치 응답 전부 완료 후** 다음 배치 전송

### 테스트 메시지 네이밍

```
:test_tube: [E2E-{섹션}-{번호}] 실제 메시지 내용
```

예: `:test_tube: [E2E-A-1-1] @Homer memory.db claims 테이블 스키마 설명해줘`

## 테스트 실행 절차

### Phase 1: 코드/DB/파일 검증 (Slack 불필요)

```bash
# 메모리 시스템 검증 (섹션 33-43)
# 에이전트 이름 확인 (Donald 없음)
head -3 .memory/tasks/active-designer.md  # "Krusty"
head -3 .memory/tasks/active-researcher.md  # "Lisa"
grep -c "Donald" .memory/tasks/active.md  # 0

# DB 상태
sqlite3 .memory/memory.db "SELECT status, COUNT(*) FROM claims GROUP BY status;"
sqlite3 .memory/memory.db "SELECT * FROM heartbeats;"
sqlite3 .memory/memory.db "SELECT * FROM schema_version;"

# decisions 정합성
ls .memory/decisions/2026-04-*.md | grep -v "_index" | wc -l  # 파일 수
# _index.md 행 수와 비교

# learnings deprecated 확인
ls .memory/learnings/*.jsonl  # 없어야 정상 (deprecated)
```

### Phase 2: 브리지 로그 검증

```bash
# 시작 로그
tmux capture-pane -t ai-team-bridge -p -S -2000 | head -30

# 라우팅 확인
tmux capture-pane -t ai-team-bridge -p | grep "\[route\]"

# 성능 로그
tmux capture-pane -t ai-team-bridge -p | grep "\[perf\] e2e"
```

### Phase 3: Slack E2E (5개씩 배치)

1. 5개 메시지를 5초 간격으로 전송
2. 브리지 로그에서 라우팅 확인: `tmux capture-pane -t ai-team-bridge -p | grep "\[route\]"`
3. 응답 확인: conversations.replies API
4. 전부 완료 후 다음 배치

### 결과 판정

| 상태 | 의미 |
|------|------|
| PASS | 기대 동작과 일치 |
| FAIL | 실패 징후 발생 |
| WARN | 동작하지만 체크리스트 기대와 미세한 차이 |
| SKIP | 전제 조건 미충족 |

## 체크리스트 파일 위치

- `docs/bridge-behavior-checklist.md` — 58개 섹션 (브리지 동작)
- `docs/test-checklist.md` — 73건 (A~E 섹션)
