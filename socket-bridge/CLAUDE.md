# Socket Bridge

`socket-bridge/src/` 파일 작업 시 적용되는 규칙.

## Bridge 재시작 규칙

`src/` 파일을 수정한 후에는 반드시 `/restart-bridge` 스킬로 bridge를 재시작해야 변경사항이 반영됩니다. 수동 재시작 금지 — 스킬이 WebSocket 대기 시간을 자동 처리합니다.
