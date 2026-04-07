---
date: 2026-04-06
topic: architecture
roles: [all]
summary: gstack 패턴 ai-team 도입 방안 — 에이전트별 적용 범위 검토 및 단계적 도입 결정
---

# 회의 결정: gstack 패턴 ai-team 도입 방안 — 에이전트별 적용 검토
> 회의 ID: 9
> 유형: planning
> 일시: 2026-04-06T02:41:20.543Z
> 참여자: backend, frontend, designer, secops, qa, researcher

## 의견 요약
### backend
회의 #9에 백엔드 관점 의견을 제출했습니다. 요약:

• *Top 3*: Learnings System(1위 동의), Investigate 5-Phase + Scope Lock(5위→3위 상향 제안), 자동 결정 원칙(당장 적용 가능)
• *추가 제안*: Debug Report `.memory/` 자동 저장, API Contract 변경 시 양방향 학습 트리거, careful Hook 우선순위 상향(11위→6위)
• *핵심 우려*: 컨텍스트 비용 증가 — 스킬화 전략과 병행 필요, JSONL 상한선/decay 동시 구현 권장
### frontend
회의 #9 스레드에 프론트엔드 관점 검토 의견을 제출했습니다. 핵심 내용:

• *Top 3*: Learnings System(즉시), Benchmark 패턴(레포트 12위→프론트엔드는 ★★★★로 상향 제안), Health Check(tsc+lint 즉시 가능)
• *추가 제안*: 디자인-구현 시각적 검증 자동화, Confidence decay 필수 적용, Scope Lock 도입
• *리스크*: 컨텍스트 과적합 재발 주의 → 스킬 분리 필수, 활성 프로젝트에서 파일럿 후 표준화
### designer
회의 #9 스레드에 디자이너 관점 검토 의견을 제출했습니다.

*요약:*

• *Top 3*: Learnings System(★5) > 0-10 채점 프레임워크(★4) > design-consultation 워크플로(★3)
• *핵심 갭*: 디자인 판단의 정량화와 디자인→구현 간 품질 손실 측정 메커니즘 부재
• *추가 제안*: 디자인 준수 리뷰를 Chalmers가 아닌 Krusty가 직접 수행하는 파이프라인 단계 삽입, 핸드오프 체크리스트에 "10점 기준" 명세 추가
• *리스크 완화*: 채점 인플레이션 → Chalmers 교차 검증, Learnings 과적합 → `service` 필드 추가, 컨텍스트 비용 → 스킬화
### secops
회의 #9 스레드에 SecOps 관점 검토 의견을 게시했습니다.

*요약:*
• *Top 3*: CSO 15단계 감사 프로토콜(8위→3위 상향 제안), Learnings System(1위 동의), Guard/Careful Hook(11위→5위 상향 제안)
• *추가 제안*: 에이전트 간 학습 파일 오염 방어, Health Check에 인증/인가·rate limiting·감사 추적 카테고리 추가
• *즉시 적용 가능*: CSO 체크리스트를 `conventions.md`에 추가, Confidence Gate 페르소나 반영, PreToolUse Hook 전환 — 모두 프롬프트/설정 변경만으로 구현 가능
### qa
QA 관점의 gstack 패턴 도입 검토 의견을 스레드에 회신 완료했습니다.

핵심 요약:

• *Top 3*: Learnings System(1순위) → Review Specialists(2순위, 레포트 6순위에서 상향 제안) → Health Check(3순위)
• *추가 제안*: 대칭 학습(FAIL→수정→재검증 사이클 학습), QA 오탐 추적(`false-positive` 타입), 발견 사항별 confidence 점수
• *당장 가능*: Learnings JSONL 구조 정의, specialists/ 체크리스트 4개 작성, confidence 필드 추가
• *핵심 리스크*: 컨텍스트 과적합(specialist 선택적 로드 필요), Learnings 노이즈(prune 메커니즘), 오탐 루프 방지
### researcher


회의 #9에 리서처 관점 의견을 제출했습니다. 핵심 요약:

*Top 3*: Learnings System > Session Bootstrap 강화 > 자동 결정 원칙

*추가 제안*: 출처별 접근성/신뢰도를 구조화한 소스 신뢰도 레지스트리(`source-registry.jsonl`)와, 보고서 완성 후 핵심 인사이트를 자동 학습으로 변환하는 `/learn export` 패턴

*주요 우려*: 회의 #2에서 결정한 컨텍스트 60% 절감 목표와 충돌하지 않도록, 학습 로드 시 relevance 기반 상위 N개 필터링 필수

## 최종 결정
