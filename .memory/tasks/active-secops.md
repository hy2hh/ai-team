# Active Tasks — SecOps Donald

<!-- Format: - [ ] task description | created | priority -->

## 보안 체크리스트 — 테스트 완료 후 검토

- [ ] `bypassPermissions` + 파일 수정 권한 조합 보안 리뷰 | 2026-03-27 | HIGH
  - `queryOptions`에 `permissionMode: 'bypassPermissions'` + `allowDangerouslySkipPermissions: true` 설정
  - 에이전트가 프로젝트 내 모든 파일 무제한 수정 가능한 상태
  - 프로덕션 전 최소 권한 원칙(least privilege) 적용 방안 검토 필요

- [ ] 프롬프트 인젝션 공격 표면 평가 | 2026-03-27 | HIGH
  - 신뢰 경계가 Slack 메시지 발신자까지 확장되는 구조
  - 악의적 Slack 메시지로 코드베이스 직접 변조 가능성 존재
  - 입력 검증 레이어(Slack 발신자 화이트리스트, 메시지 새니타이징) 설계 필요

- [ ] Slack Bot Token 권한 범위 검토 | 2026-03-27 | MEDIUM
  - `url_private` 다운로드를 위해 사용되는 Bot Token 스코프 최소화 여부 확인
  - 토큰 노출 시 피해 범위 평가

- [ ] 에이전트 실행 샌드박스 검토 | 2026-03-27 | MEDIUM
  - SDK `query()` 방식으로 실행 시 settings.local.json의 allow 배열이 무시됨
  - 런타임 격리 방안 (컨테이너, chroot 등) 가능 여부 검토
