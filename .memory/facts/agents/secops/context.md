---
last-updated: 2026-04-12
---

# SecOps (Wiggum) Operational Knowledge

> **작성 규칙**: 세션 종료 시 Sprint Learned 항목 → 해당 섹션에 이관. 항목 없어도 `last-updated` 갱신 필수.

## Codebase Knowledge
- Slack Bot Token: 환경변수(`.env`)로만 관리 — 코드 내 하드코딩 금지
- SQLite WAL 모드: 동시 접근 안전 확인됨

## Undocumented Behaviors
<!-- 예: MCP 도구 auth 오류가 실제 권한 문제인지 env 로딩 문제인지 로그만으로 구분 불가 -->

## Known Constraints
- 추후 검토 필요: memory.db 접근 제어, 민감 데이터 암호화
<!-- 예: .env 파일 gitignore 등록 확인 필수 — 자동 체크 메커니즘 없음 -->

## Common Pitfalls
<!-- 예: curl로 Slack API 테스트 시 Bearer 토큰 앞에 공백 포함되면 invalid_auth -->

## Operational Tips
<!-- 예: 보안 리뷰 시 OWASP Top 10 체크리스트 순서대로 진행 -->
