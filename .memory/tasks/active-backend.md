# Active Tasks — Backend Homer

<!-- Format: - [ ] task description | created | priority -->

## 구조 개선 (2026-04-11 이관)

- [ ] Sprint log 강제 업데이트 메커니즘 도입 | 2026-04-11 | MEDIUM
  - queue-processor에서 세션 완료 후 sprint/current.md mtime 체크
  - 업데이트 미발생 시 에이전트에 재주입하는 자동화 로직
  - [2026-04-11] 검증 세션에서 sprint log 수동 업데이트 정상 확인. 자동화 로직은 아직 미구현.

## Enqueue 경로 개선 (2026-04-01 이관)

- [ ] syncEnqueuedTasksToKanban 제거 + queue-processor가 result.kanbanCardId 사용 | 2026-04-01 | LOW
  - 변경 파일: queue-manager.ts, agent-runtime.ts, queue-processor.ts
  - 에이전트가 create_kanban_card 직접 호출하는 단일 경로로 일원화
