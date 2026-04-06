---
name: restart-bridge
description: Socket bridge + AI 에이전트 전체를 안전하게 재시작. Slack WebSocket 세션 정리 대기를 자동 처리하여 pong 타임아웃 방지. 트리거: "재시작", "restart", "bridge 재시작", "에이전트 재시작", 코드 변경 후 반영 필요 시.
---

# Socket Bridge 안전 재시작

## 실행

```bash
# 기본 (API 키 모드)
bash .claude/skills/restart-bridge/scripts/restart.sh

# 로컬 claude 로그인 계정 요금제 사용
bash .claude/skills/restart-bridge/scripts/restart.sh local
```

스크립트가 stop → WebSocket 대기(5초) → start → 연결 확인(최대 60초 폴링)을 자동 처리.

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
