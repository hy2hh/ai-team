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

## 보안 이슈 — 신규 (2026-04-11 Wiggum STRIDE 분석)

- [ ] .env gitignore 적용 + .env.example 패턴 전환 | 2026-04-11 | HIGH
  - .env 파일이 git-tracked 상태 확인 (토큰 노출 위험 Critical)
  - Homer 협업 필요: .env.example 작성 + .gitignore 추가
- [ ] 토큰 로테이션 정책 수립 | 2026-04-11 | MEDIUM
  - SLACK_BOT_TOKEN, ANTHROPIC_API_KEY 등 주요 토큰 대상
- [ ] 에이전트별 메모리 접근 범위 제한 방안 검토 | 2026-04-11 | LOW
  - 현재 .memory/ 전체가 에이전트 간 접근 제어 없이 읽기/쓰기 가능
