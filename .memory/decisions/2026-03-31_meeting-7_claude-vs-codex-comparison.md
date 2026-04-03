# 회의 결정: Claude vs Codex 비교 분석
> 회의 ID: 7
> 유형: ad-hoc
> 일시: 2026-03-31
> 참여자: pm, backend, researcher

## 의견 요약

### pm
현 시점에서 Codex로의 전환은 비추천. 현재 ai-team 인프라가 Claude Code CLI + MCP 기반으로 성숙해 있으며, 전환 비용 대비 실질적 이득이 불분명. 다만, 특정 작업(DevOps 스크립팅, 대량 반복 작업)에 대한 하이브리드 활용은 중장기 검토 가치 있음.

### backend
현재 ai-team 시스템에서 Claude 유지가 합리적. `@anthropic-ai/claude-agent-sdk`로 전체 인프라 구축, MCP 프로토콜 네이티브 지원, 3-tier 모델 라우팅이 Claude 생태계에 깊이 통합. 마이그레이션 비용 > 기대 이익.

### researcher
현재 ai-team 아키텍처에는 Claude Code 유지가 최적. Codex는 토큰 효율성에서 3~4배 우위이나, MCP 프로토콜 기반 멀티 에이전트 협업과 프론트엔드 코드 품질에서 Claude Code가 명확히 앞섬. SWE-bench Verified: Claude 80.8% vs Codex 64.7%.

## 최종 결정

**Claude Code 기반 유지 — Codex 전환 비추천**

### 근거
- 전원 합의: 3개 에이전트가 독립적으로 동일 결론 도달
- 전환 비용 6-8주 예상 (MCP 재구현 + 프롬프트 재작성 + 라우팅 수정)
- 품질 우선 철학 정합성: Claude "measure twice, cut once" ↔ 팀의 완료 조건, cross-verify, QA 루프
- SWE-bench 성능: Claude 80.8% vs Codex 64.7% (복잡한 멀티파일 작업)

### Codex 재검토 트리거 조건
- 월간 토큰 비용 > 예산의 70%
- Terminal/DevOps 작업 > 전체 워크로드의 50%
- Claude API 장애 월 2회 이상
- MCP 프로토콜 OpenAI 공식 지원 발표

### 하이브리드 파일럿 (Q2 2026 조건부)
- 대상: DevOps 스크립팅, 대량 파일 생성
- 기준: 토큰 비용 30%+ 절감 + 품질 동등 시 확대

## 행동 항목
- [ ] 토큰 비용 모니터링 대시보드 설계 — Homer (P1)
- [ ] 월간 비용 리포트 자동화 검토 — Homer (P1)
- [ ] Codex 하이브리드 파일럿 스펙 (조건 충족 시) — PM (P2)
- [ ] 분기별 벤치마크 리뷰 일정 등록 — PM (P2)

## 핵심 인사이트
> "작동하는 시스템을 바꾸는 비용은 항상 과소평가된다."

Codex의 토큰 효율성(~4배)과 Terminal-Bench 우위는 매력적이나, 우리 시스템의 핵심 가치(코드 품질, 멀티 에이전트 협업, MCP 통합)에서 Claude가 우위이고, 전환 비용을 정당화할 명확한 병목이 현재 없다.
