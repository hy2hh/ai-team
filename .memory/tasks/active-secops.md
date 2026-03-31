# Active Tasks — SecOps Wiggum

<!-- Format: - [ ] task description | created | priority -->

## 보안 체크리스트

- [x] `bypassPermissions` + 파일 수정 권한 조합 보안 리뷰 | 2026-03-27 | HIGH
  - 검토 완료 (2026-03-31): 의도된 설계 — SDK query() 방식에서 도구 실행을 위해 필수
  - settings.json 권한 허용 범위가 .memory/, .claude/agents/ 로 한정됨
  - 현재 구조상 허용 가능 수준으로 판단. 프로덕션 배포 전 재검토 권고

- [x] 프롬프트 인젝션 공격 표면 평가 | 2026-03-27 | HIGH
  - 검토 완료 (2026-03-31): Slack 신뢰 경계 내 운영 (사내 workspace)
  - 자체 봇 필터, 중복 방지, subtype 필터, MIME 타입 검증 모두 정상 작동
  - **신규 발견 및 수정 완료:** permission_approve/deny 버튼에 user_id 검증 없음
    → `index.ts` 핸들러에 `SID_USER_ID` 기반 클리커 검증 추가 (2026-03-31)
    → `.env.example`에 `SID_USER_ID` 항목 추가

- [ ] Slack Bot Token 권한 범위 검토 | 2026-03-27 | MEDIUM
  - Bot Token 스코프 설정 파일 직접 확인 필요 (Slack App 관리 콘솔)
  - settings.local.json MCP 스코프는 적절한 수준으로 확인됨

- [ ] 에이전트 실행 샌드박스 검토 | 2026-03-27 | MEDIUM
  - SDK query() 방식은 의도된 실행 방식으로 확인
  - 런타임 격리 가능 여부는 장기 과제로 유지
