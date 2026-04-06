# Active Tasks — SecOps Wiggum

<!-- Format: - [ ] task description | created | priority -->
<!-- 완료 항목은 done.md로 이동됨 (2026-04-06 정리) -->

## 보안 체크리스트 — 미완료

- [ ] Slack Bot Token 권한 범위 검토 | 2026-03-27 | MEDIUM
  - Bot Token 스코프 설정 파일 직접 확인 필요 (Slack App 관리 콘솔)
  - settings.local.json MCP 스코프는 적절한 수준으로 확인됨

- [ ] 에이전트 실행 샌드박스 검토 | 2026-03-27 | MEDIUM
  - SDK query() 방식은 의도된 실행 방식으로 확인
  - 런타임 격리 가능 여부는 장기 과제로 유지
