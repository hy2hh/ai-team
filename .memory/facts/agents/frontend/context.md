---
last-updated: 2026-04-12
---

# Frontend (Bart) Operational Knowledge

> **작성 규칙**: 세션 종료 시 Sprint Learned 항목 → 해당 섹션에 이관. 항목 없어도 `last-updated` 갱신 필수.

## Codebase Knowledge
<!-- 예: kanban-frontend는 Vite + React — Next.js 아님 -->
<!-- 예: CSS 모듈 미사용, Tailwind 기반 -->

## Undocumented Behaviors
<!-- 예: hot reload가 .memory/ 파일 변경 시 트리거됨 (예상치 못한 동작) -->

## Known Constraints
<!-- 예: IE 미지원 (ES2020+ 사용 가능) -->

## Common Pitfalls
<!-- 예: Krusty 스펙 없이 구현 시작 → 리디자인 요청으로 재작업 발생 -->

## Operational Tips
- 디자이너(Krusty) handoff 문서 수신 후 구현 시작 — 문서 없이 시작하지 말 것
- 구현 완료 후 `handoff/frontend-to-backend_{topic}.md` 작성
- 위임 체인 규칙: `facts/workflow-designer-frontend-chain.md` — UI 작업 시 Krusty 스펙 없으면 구현 시작 금지
