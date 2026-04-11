---
name: restart-bridge
description: Socket bridge + AI 에이전트 전체를 안전하게 재시작. Slack WebSocket 세션 정리 대기를 자동 처리하여 pong 타임아웃 방지. 트리거: "재시작", "restart", "bridge 재시작", "에이전트 재시작", 코드 변경 후 반영 필요 시.
---

# Socket Bridge 안전 재시작

## 실행

```bash
# 기본 (.env의 Claude OAuth token 사용 — BRIDGE_ANTHROPIC_AUTH_MODE=claude_oauth)
bash .claude/skills/restart-bridge/scripts/restart.sh

# 로컬 claude login 키체인 계정 사용 (로컬로 실행하라는 지시가 있을 때만)
bash .claude/skills/restart-bridge/scripts/restart.sh local
```

스크립트가 stop → WebSocket 대기(5초) → start → 연결 확인(최대 60초 폴링)을 자동 처리.

**연결 7/7 확인 후 즉시 종료. 추가 코드 탐색·수정 금지.**

## 활성 작업 있을 때 강제 재시작

실행 중인 작업이 있어 재시작이 차단된 경우 `force` 옵션 사용:

```bash
bash .claude/skills/restart-bridge/scripts/restart.sh force
bash .claude/skills/restart-bridge/scripts/restart.sh local force
```

재시작 후 startup-recovery가 미완료 작업의 ⚒️ 리액션을 자동 정리하고 Slack에 알림.

## 연결 실패 시 재시도

pong 타임아웃으로 일부 에이전트가 연결 안 되면 대기 시간을 늘려서 재시도:

```bash
bash .claude/skills/restart-bridge/scripts/restart.sh 10
bash .claude/skills/restart-bridge/scripts/restart.sh local 10
```

## 크래시 진단

스크립트가 크래시를 보고하면:

```bash
tmux capture-pane -t ai-team-bridge -p | tail -30
```

- TypeScript 에러 → 코드 수정 필요
- 토큰 누락 에러 → `.env` 확인 안내
