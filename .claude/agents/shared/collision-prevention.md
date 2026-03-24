# Collision Prevention Protocol

## 핵심 원칙: Single-Responder 보장

모든 인바운드 메시지는 **반드시 1개 에이전트만** 처리한다. 6개 에이전트가 동시에 같은 메시지에 반응하는 것을 방지한다.

## Claim Lock 메커니즘

### 동작 흐름

```
메시지 수신 → .memory/claims/{msg-id}.md 존재 확인
  → 없으면: claim 파일 생성 + 작업 시작
  → 있으면: 이미 다른 에이전트가 처리 중 → 무시
```

### Claim 파일 형식

파일명: `.memory/claims/{message-id}.md`

```markdown
---
agent: Frontend Donald
claimed_at: 2026-03-24T10:30:00+09:00
message_id: msg-12345
status: in_progress
---
메시지 요약: React 컴포넌트 성능 최적화 요청
```

### 상태 값

| status | 설명 |
|--------|------|
| `in_progress` | 작업 중 |
| `completed` | 완료 |
| `abandoned` | 포기 (timeout 또는 수동) |

## Timeout 규칙

- **5분 무응답**: claim이 생성되었으나 5분 내 Slack 응답이 없으면, 다른 에이전트가 재claim 가능
- 재claim 시 기존 claim의 status를 `abandoned`로 변경 후 새 claim 생성

## 정리 규칙

- **24시간 후 만료**: `completed` 또는 `abandoned` 상태의 claim 파일은 24시간 후 삭제 가능
- 정리 담당: Triage Agent 또는 작업 완료한 에이전트

## @mention Override

명시적 `@에이전트명` 멘션이 있는 메시지는 claim 불필요:
- @mention된 에이전트가 즉시 반응
- 다른 에이전트는 반응하지 않음
- Triage Agent도 해당 메시지를 bypass

## Race Condition 대응

Triage Agent가 단일 라우팅을 수행하므로 충돌은 거의 발생하지 않는다.
Claim은 **백업 안전장치**로, 다음 시나리오에서 작동한다:

1. Triage Agent 다운 시 → 에이전트가 직접 claim 후 작업
2. 네트워크 지연으로 Triage 라우팅이 늦어질 때 → claim이 중복 작업 방지
3. 수동 @mention과 Triage 라우팅이 동시에 발생할 때 → 먼저 claim한 쪽이 작업

## 에이전트 행동 규칙

1. **@mention 없는 일반 메시지에 직접 반응하지 않는다** — Triage Agent의 라우팅을 대기
2. Triage로부터 위임받았을 때만 작업 시작
3. 작업 시작 시 claim 파일 생성 (안전장치)
4. 작업 완료 시 claim status를 `completed`로 변경
