# Socket Bridge

`socket-bridge/src/` 파일 작업 시 적용되는 규칙.

## Dependencies

- Claude API 호출: `claude-agent-sdk` 사용 (표준 anthropic SDK, CLI subprocess 금지)
- 인증: `.env`의 `BRIDGE_ANTHROPIC_AUTH_MODE=claude_oauth` + `CLAUDE_CODE_OAUTH_TOKEN`
- 런타임: Node.js + TypeScript (`tsx`로 실행)

## Bridge 재시작 규칙

`src/` 파일을 수정한 후에는 반드시 `/restart-bridge` 스킬로 bridge를 재시작해야 변경사항이 반영됩니다. 수동 재시작 금지 — 스킬이 WebSocket 대기 시간을 자동 처리합니다.

## Testing

- `tsc`만으로 완료 선언 금지 — bridge 재시작 + tmux 로그 확인 필수
- E2E 테스트: `/e2e-test` 스킬 사용
