# Collision Prevention Protocol

## 핵심 원칙: Single-Responder 보장

모든 인바운드 메시지는 **반드시 1개 에이전트만** 처리한다. 6개 에이전트가 동시에 같은 메시지에 반응하는 것을 방지한다.

## Claim Lock 메커니즘 (SQLite 기반)

SQLite `memory.db`의 `claims` 테이블이 단일 소스다. `.memory/claims/*.md` 파일 방식은 폐기됨.

### 동작 흐름

```
메시지 수신 → bridge의 tryClaim(messageTs, agentName) 호출
  → INSERT OR IGNORE 성공: 해당 에이전트가 처리권 획득
  → 이미 존재: 다른 에이전트가 처리 중 → 무시
```

### Claims 테이블 스키마

```sql
CREATE TABLE claims (
  message_ts  TEXT    PRIMARY KEY,
  agent       TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'processing',
  version     INTEGER NOT NULL DEFAULT 1,
  channel     TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
```

### 상태 값

| status | 설명 |
|--------|------|
| `processing` | 작업 중 |
| `completed` | 완료 |
| `failed` | 실패 또는 orphan 처리됨 |

## Timeout / Orphan 규칙

- **2시간 초과 processing**: bridge의 `cleanupOrphanClaims()`가 자동으로 `failed` 전환 + Slack 알림
- `updated_at` 기준으로 마지막 활동 시점 판단 (created_at 기준 아님)
- 최대 2회 재큐잉(`requeueClaim()`) 후 완전 실패 처리

## 정리 규칙

- **24시간 후 만료**: `completed` 또는 `failed` 상태 claim은 bridge `cleanupExpiredClaims()`가 자동 삭제
- 에이전트가 직접 claim을 삭제하거나 `.md` 파일을 생성하지 않는다

## @mention Override

명시적 `@에이전트명` 멘션이 있는 메시지는 claim 불필요:
- @mention된 에이전트가 즉시 반응
- 다른 에이전트는 반응하지 않음
- Triage Agent도 해당 메시지를 bypass

## Race Condition 대응

Bridge가 단일 라우팅을 수행하므로 충돌은 거의 발생하지 않는다.
SQLite INSERT OR IGNORE가 **원자적 잠금**으로, 다음 시나리오에서 작동한다:

1. Triage Agent 다운 시 → bridge가 직접 claim 후 위임
2. 네트워크 지연으로 Triage 라우팅이 늦어질 때 → claim이 중복 작업 방지
3. 수동 @mention과 Triage 라우팅이 동시에 발생할 때 → 먼저 tryClaim() 성공한 쪽이 작업

## 에이전트 행동 규칙

1. **@mention 없는 일반 메시지에 직접 반응하지 않는다** — Bridge/Triage의 라우팅을 대기
2. Bridge로부터 위임받았을 때만 작업 시작
3. `.memory/claims/*.md` 파일 생성 절대 금지 — SQLite가 단일 소스
4. 작업 완료 시 bridge의 `updateClaim(ts, 'completed')` 호출 (bridge가 처리)
