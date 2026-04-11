# Autonomous QA Loop - Iteration 2: Intervention Evaluation

> Timestamp: 2026-04-10
> Phase: Step 3 (Monitoring Loop) → Step 4 (Anomaly Detection & Intervention)

## Current State

| Bug | Agent | Thread TS | Status |
|-----|-------|-----------|--------|
| BUG-7 | @Homer | 1775781639 | Reply received - anti-pattern detected |
| BUG-5 | @Lisa | 1775781644 | Reply received - anti-pattern detected |

## Anomaly Detection

```
[DETECTED] Homer: "진행할까요?" anti-pattern
  - Thread ts: 1775781639
  - Pattern match: "진행할까요?" → Step 4 table row 1 ("진행할까요?" 스레드에서 텍스트 매칭)
  - Rule: 위임 메시지에 "승인 없이 즉시 구현하고 커밋해주세요"를 포함했으므로, 재승인 요청은 anti-pattern

[ACTION 1] slack_reply_to_thread(
    channel="C0ANKEB4CRF",
    thread_ts="1775781639",
    text="@Homer 승인 불필요. 즉시 구현하고 커밋하세요."
)

[DETECTED] Lisa: research mode entry
  - Thread ts: 1775781644
  - Pattern match: "리서치 A/B" → Step 4 table row 2 ("리서치 A/B 선택" 스레드에서 텍스트 매칭)
  - Rule: 코드 수정 작업에 리서치 모드 진입은 anti-pattern

[ACTION 2] slack_reply_to_thread(
    channel="C0ANKEB4CRF",
    thread_ts="1775781644",
    text="@Lisa 코드 수정 작업입니다. 리서치 불필요. BUG-5에 해당하는 파일을 위임 메시지에 명시된 위치와 수정 방향대로 즉시 수정하고 커밋하세요."
)
```

## Exact MCP Tool Calls

### Action 1: Homer intervention

```
mcp__slack__slack_reply_to_thread(
    channel_id="C0ANKEB4CRF",
    thread_ts="1775781639",
    text="@Homer 승인 불필요. 즉시 구현하고 커밋하세요."
)
```

### Action 2: Lisa intervention

```
mcp__slack__slack_reply_to_thread(
    channel_id="C0ANKEB4CRF",
    thread_ts="1775781644",
    text="@Lisa 코드 수정 작업입니다. 리서치 불필요. BUG-5에 해당하는 파일을 위임 메시지에 명시된 위치와 수정 방향대로 즉시 수정하고 커밋하세요."
)
```

## Intervention Rationale

### Homer - "진행할까요?" anti-pattern
- SKILL.md Step 4 table row 1 명시: `"진행할까요?"` 텍스트 매칭 시 즉시 `"승인 불필요. 즉시 구현하고 커밋하세요."` 전송
- 원래 위임 메시지에 이미 "승인 없이 즉시 구현하고 커밋해주세요"가 포함되어 있었으므로, 재확인 요청은 불필요한 지연
- 재지시 횟수: 1/2 (2회 후에도 미해결 시 sid 에스컬레이션)

### Lisa - research mode entry
- SKILL.md Step 4 table row 2 명시: `"리서치 A/B 선택"` 텍스트 매칭 시 즉시 `"코드 수정 작업입니다. 리서치 불필요. {파일}을 수정하세요."` 전송
- BUG-5는 코드 수정 작업이지 리서치 태스크가 아님
- 재지시 횟수: 1/2 (2회 후에도 미해결 시 sid 에스컬레이션)

## Next Step

```
[NEXT] Monitor again in 2 minutes
  - slack_get_thread_replies(channel="C0ANKEB4CRF", thread_ts="1775781639")
  - slack_get_thread_replies(channel="C0ANKEB4CRF", thread_ts="1775781644")
  - Check: 에이전트가 교정 메시지 수신 후 작업 착수했는지 확인
  - If 5min no response after intervention → 2nd retry
  - If 2nd retry also fails → escalate to sid via DM
```
