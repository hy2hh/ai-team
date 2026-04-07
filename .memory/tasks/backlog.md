# Backlog

<!-- Format: - [ ] task description | priority | requested by | added -->
<!-- 이 백로그는 현재 진행 중인 요구사항과 연결된 대기 작업만 보관합니다. -->
<!-- 진행 중인 요구사항이 없으면 백로그도 비워두세요. -->

## 칸반 UI — 미완료 (코드 검증 기준, 2026-04-06)

- [ ] 모바일 반응형 — Bottom Sheet, Tab Bar, safe-area CSS 미구현 | P0 | sid | 2026-04-06
- [ ] WCAG 자동 검증 도구 통합 (Lighthouse CI 또는 axe-core) | P2 | sid | 2026-04-06
- [ ] 키보드 접근성 — Tab 순서, Enter/Space 트리거 부분 미구현 | P1 | sid | 2026-04-06
- [ ] 스크린리더 접근성 — live region, 동적 콘텐츠 알림 부분 미구현 | P1 | sid | 2026-04-06
- [ ] 스트리밍 응답 UI — 부분 구현, 에러 복구 미완 | P1 | sid | 2026-04-06
- [ ] 결제 배너 — 부분 구현 | P2 | sid | 2026-04-06

## Guard Hook 마일스톤

- [ ] Tier 2 warn 로그 분석 → deny 전환 여부 결정 | P1 | Homer | 2026-04-06 | 📅 마일스톤: 2026-04-20 (2주 후)

## SecOps — 미완료

- [ ] Slack Bot Token 권한 범위 검토 (Slack App 관리 콘솔 직접 확인 필요) | MEDIUM | Wiggum | 2026-03-27
- [ ] 에이전트 실행 샌드박스 검토 — 런타임 격리 가능 여부 (장기 과제) | MEDIUM | Wiggum | 2026-03-27

## 에이전트 자율 진화 시스템 (Adaptive Harness 리서치 기반)
> 출처: docs/2026-04-04_adaptive-harness-research.md

- [ ] DSPy I/O 시그니처: 에이전트별 산출물 입출력 계약 표준화 — 현재 에이전트 구조 변경 규모가 커서 별도 설계 필요 | medium | sid | 2026-04-04
- [ ] Rule Effectiveness 정량 측정 (Arize 패턴): 규칙별 준수율 자동 추적 인프라 구축 — qa-metrics.md 수동 기록을 자동화 | medium | sid | 2026-04-04
- [ ] agnix 에이전트 파일 린터 도입: 에이전트 파일 유효성 자동 검증 (200줄 상한, 필수 섹션 존재, 참조 경로 유효성) | low | sid | 2026-04-04
- [ ] Hook 실제 구현: react-process.md에서 Hook 후보로 분류한 규칙(수신 확인, 재작업 보고, 학습 파일 작성)을 settings.json hook으로 코드화 | medium | sid | 2026-04-04
