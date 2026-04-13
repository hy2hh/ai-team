# Decisions Index

> **에이전트 사용 규칙**: 이 파일만 먼저 스캔. `roles` 또는 `topic`이 관련 있는 행만 선택해서 해당 파일 Read.
> 전체 파일을 무조건 읽지 말 것.

## 2026-04 결정사항

| 날짜 | 토픽 | 참여자 | 상태 | 한줄요약 | 파일 |
|------|------|--------|------|---------|------|
| 04-13 | architecture | backend | unknown | 회의 결정: 트리아지 라우터 Stage 2.5 — 회의 감지 패턴을 키워드 단독에서 "키워드 + 의도 동사" 조합으로 수정 | `2026-04-13_meeting-18_트리아지-라우터-Stage-25-회의-감지-패턴을-키워드-단독에서-키워드-의도-동사-조합으.md` |
| 04-13 | architecture | backend,researcher | unknown | 회의 결정: btcfi platform 예제 레포 — 스킬 vs CLI(쉘 스크립트) 적합성 결정 | `2026-04-13_meeting-17_btcfi-platform-예제-레포-스킬-vs-CLI쉘-스크립트-적합성-결정.md` |
| 04-13 | architecture | designer,frontend,backend,secops | unknown | 회의 결정: pockie-wallet-extension AI Agent 기능 설계 — v1 구현 범위 확정 및 아키텍처 결정 | `2026-04-13_meeting-19_pockiewalletextension-AI-Agent-기능-설계-v1-구현-범위-확정-및.md` |
| 04-13 | architecture | frontend,backend | unknown | 회의 결정: JSON vs XML API 형식 선택 | `2026-04-13_meeting-15_JSON-vs-XML-API-형식-선택.md` |
| 04-13 | architecture | frontend,backend | unknown | 회의 결정: REST vs GraphQL — API 방식 선택 | `2026-04-13_meeting-16_REST-vs-GraphQL-API-방식-선택.md` |
| 04-13 | architecture | frontend,backend,researcher | accepted | btcfi 예제 레포 에이전트 DX — 스킬 우선 + llms.txt 표준 병행, CLI는 스킬 내 bash 보조로만 | `2026-04-13_meeting-17_btcfi-platform-스킬-vs-CLI-적합성-결정.md` |
| 04-10 | architecture | backend,frontend,designer,secops | accepted | pockie-wallet-extension AI Agent 구현 범위 확정 및 아키텍처 결정 (회의 #14 에이전트 의견 취합) | `2026-04-10_meeting-14_pockiewalletextension-AI-Agent-기능-설계-구현-범위-확정-및-아키.md` |
| 04-10 | product | backend,frontend,designer,secops | accepted | pockie-wallet AI Agent Tier 1 기능 설계 — 자연어 tx·리스크 시뮬레이션·가스 최적화 (회의 #15) | `2026-04-10_meeting-15_pockie-wallet-AI-agent-기능-설계.md` |
| 04-10 | prompting | frontend,backend,designer,researcher,qa,pm | accepted | 프롬프트 개선 방향 논의 — 슬림화·유령참조 제거·SSOT·2-track 워크플로우 옵션 검토 (회의 #13) | `2026-04-10_meeting-13_에이전트-프롬프트-개선-방향-논의.md` |
| 04-10 | prompting | frontend,backend,designer,researcher,qa,pm | accepted | 프롬프트 슬림화·유령참조 제거·SSOT 단일화·2-track 워크플로우 결정 (회의 #14) | `2026-04-10_meeting-14_에이전트-프롬프트-개선-방향-결정.md` |
| 04-09 | architecture | backend,designer | accepted | 알림 시스템 DB 스키마(2-테이블·Partial Index) + UI 컴포넌트(Toast·Badge·알림 리스트) 설계 합의 | `2026-04-09_meeting-11_새로운-알림-시스템-설계-DB-스키마-및-UI-컴포넌트.md` |
| 04-09 | architecture | backend,designer | accepted | 알림 시스템 단일 테이블 스키마 + 토스 3계층 UI 설계 최종 조율 — Feature Spec 작성 완료 | `2026-04-09_meeting-12_새로운-알림-시스템-설계-DB-스키마-UI-컴포넌트.md` |
| 04-09 | design-system | designer,frontend,backend | accepted | Krusty 에이전트 Apple→토스 디자인 시스템 전면 전환 결정 — 회의 #8·#9 종합 | `2026-04-09_krusty-toss-style-upgrade.md` |
| 04-09 | design-system | designer,frontend,backend | accepted | Krusty 에이전트 토스 스타일 디자이너 업그레이드 — Apple→토스 전면 교체 전략 합의 | `2026-04-09_meeting-8_Krusty-에이전트-토스Toss-스타일-디자이너로-업그레이드-디자인-시스템-전환-전략.md` |
| 04-09 | design-system | designer,frontend,backend | accepted | 토스 디자이너 업그레이드 잔여 갭 6종 분석 및 구현 계획 — 3계층 토큰·TDS 컴포넌트 반영 | `2026-04-09_meeting-9_Krusty-토스-스타일-디자이너-업그레이드-잔여-갭-분석-및-구현-계획.md` |
| 04-09 | design-system | designer,frontend,backend | accepted | 토스 디자인 시스템 잔여 갭 해소 — 3계층 토큰·TDS 11종·Closed Token Layer 도입 | `2026-04-09_meeting-9_toss-design-gap-analysis.md` |
| 04-09 | design-system | designer,frontend,backend | accepted | 토스 디자인 에이전트 파일 구조 재설계 — SSOT 적용·중복 제거·참조 오류 수정 | `2026-04-09_meeting-10_Krusty-토스-디자인-에이전트-구현-계획-수립-재작업.md` |
| 04-07 | memory | all | accepted | 메모리 시스템 Read 비용 56K→12K 토큰(78%) 절감 — 파일시스템 기반 3단계 최적화 채택 | `2026-04-07_read-cost-optimization.md` |
| 04-07 | testing | qa,backend,frontend | accepted | Chalmers e2e 테스트 도구 — Playwright CLI 채택, MCP 미채택 (토큰 4배 차이) | `2026-04-07_meeting-13_Chalmers-QA-에이전트-e2e-테스트-도구-설계-Playwright-MCP-도입-및.md` |
| 04-06 | architecture | all | accepted | gstack 패턴 ai-team 도입 방안 — 에이전트별 적용 범위 검토 및 단계적 도입 결정 | `2026-04-06_meeting-9_gstack-패턴-aiteam-도입-방안-에이전트별-적용-검토.md` |
| 04-06 | architecture | backend,secops | accepted | guard Hook 트리거 조건 설계 — PreToolUse warn→deny 단계적 접근 채택 | `2026-04-06_meeting-11_guard-Hook-트리거-조건-설계-결정-Phase-2-Lisa-조사-요약-업계-표준-기.md` |
| 04-06 | memory | all | accepted | Learnings 세션 로드 하드캡 — 공통 10개 정책 채택 (에이전트별 차등 방식 보류) | `2026-04-06_meeting-10_Learnings-세션-로드-하드캡-정책-결정-공통-10개-vs-에이전트별-차등.md` |
| 04-06 | team | all | accepted | Frink AI 엔지니어 에이전트 신설 보류 — 기존 에이전트 scope 확장 3단계 점진 접근 | `2026-04-06_meeting-12_Frink-AI-엔지니어-에이전트-신설-보류-scope-확장-우선.md` |
| 04-06 | team | all | accepted | Frink 신설 필요성 평가 회의 — 기존 에이전트 대체 가능성 검토, 보류 결론 | `2026-04-06_meeting-12_AI-엔지니어-에이전트Frink-신설-필요성-평가-기존-에이전트-대체-가능성-vs-독립-전.md` |
| 04-05 | architecture | backend,frontend | accepted | 프롬프트 내 "xxx 모델로 작업" 파싱·실행 설계 — 모델 선택 동적 라우팅 | `2026-04-05_meeting-7_모델-선택-기능-설계-프롬프트-내-xxx-모델로-작업-파싱-및-실행.md` |
| 04-04 | process | frontend,backend,designer | accepted | 전 직군 React 프로세스 도입 + 평가 편향 수정 + 중복 제거 | `2026-04-04_react-process-and-evaluation-rebalance.md` |
| 04-04 | product | all | accepted | AI 법률 서비스 핵심 기능·구현 전략 결정 — 문서 분석·상담 자동화 우선순위 | `2026-04-04_meeting-6_AI-법률-서비스-제품-기획-핵심-기능과-구현-전략.md` |
| 04-03 | quality | researcher,qa | accepted | Lisa(sonnet) vs 외부(opus) 리서치 품질 차이 원인 — 모델 능력·프롬프트 구조 차이 분석 | `2026-04-03_meeting-5_AIEO-리서치-보고서-품질-차이-원인-분석-Lisasonnet-vs-외부-에이전트opus.md` |
| 04-02 | kanban | designer,frontend | accepted | 칸반 보드 UI 디자인 시스템 적용 계획 수립 — 컴포넌트 정리·색상 토큰 통일 | `2026-04-02_meeting-4_칸반-보드-UI-개선-디자인-시스템-적용-계획-수립.md` |
| 04-01 | kanban | frontend,backend | accepted | WebSocket 기반 실시간 알림 설계 — 기존 ws 인프라 활용, 별도 SSE 불필요 | `2026-04-01_meeting-3_칸반보드-실시간-알림-기능-설계-배경-칸반보드에-실시간-알림-기능을-추가하려-합니다-현재-.md` |

## Archive

### 2026-03

| 날짜 | 토픽 | 참여자 | 상태 | 한줄요약 | 파일 |
|------|------|--------|------|---------|------|
| 03-31 | architecture | backend,secops | unknown | Read 자동 허용·Write만 승인 요청 — 승인 노이즈 최소화 권한 분리 전략 | `archive/2026-03/2026-03-31_meeting-8_에이전트-승인-노이즈-최소화-설계-Read-vs-Write-권한-분리-전략.md` |
| 03-31 | tooling | all | unknown | Claude Code vs Codex vs Gemini CLI 비교 → Claude Code 유지 (멀티에이전트·MCP 우위) | `archive/2026-03/2026-03-31_meeting-1_Claude-Code-vs-Codex-vs-Gemini-CLI-3파전-비교-우리-aitea.md` |
| 03-31 | tooling | all | unknown | Claude vs Codex 상세 비교 — 파일 조작·MCP·비용 효율에서 Claude Code 우위 확인 | `archive/2026-03/2026-03-31_meeting-7_claude-vs-codex-comparison.md` |
| 03-30 | architecture | backend | unknown | index.ts QA 명령어 파싱 설계 — "QA 실행 docs/specs/xxx.md" → specPath 자동 추출 | `archive/2026-03/2026-03-30_meeting-5_indexts-QA-실행-명령어-파싱-설계-QA-실행-docsspecsxxxmd-형태의-명.md` |
| 03-30 | architecture | backend,researcher | unknown | QA specPath 자동 전달 — parseQACommand() Slack 명령어 경로 파싱 로직 설계 | `archive/2026-03/2026-03-30_meeting-6_QA-실행-명령어-파싱-로직-설계-specPath-자동-전달-방안.md` |
| 03-30 | operations | pm,backend,researcher | unknown | 컨설팅 진단 기반 운영 개선 — Ralph Loop 도입·검증 루프 강화 결정 | `archive/2026-03/2026-03-30_meeting-3_컨설팅-진단-결과-기반-팀-운영-개선-계획-수립.md` |
| 03-30 | prompting | all | unknown | Vercel v0 인사이트 → 역할 특화·출력 형식 명확화·간결성 강화 방향 결정 | `archive/2026-03/2026-03-30_meeting-2_Vercel-v0-시스템-프롬프트-인사이트-적용-우리-팀-에이전트-프롬프트-개선-방향-결정.md` |
| 03-30 | quality | all | unknown | Ralph Loop 근본 해결은 코드 강제 필요 — 컨텍스트 지시 추가만으로는 불충분 | `archive/2026-03/2026-03-30_meeting-4_팀-Ralph-Loop-구현-컨텍스트-지시-추가만으로는-근본-해결-불가하다는-결론의-타당성.md` |
| 03-29 | prompting | all | unknown | CoVe/SC/PoT 프롬프팅 기법 적용 가치 낮음 — "코드 강제 > 프롬프트 지시" 원칙 재확인 | `archive/2026-03/2026-03-29_prompting-techniques-evaluation.md` |
| 03-28 | quality | all | unknown | 에이전트 자율 실행 품질 개선 — 카드 상세 모달 회고, 검증 단계 강화·완료 기준 명확화 | `archive/2026-03/2026-03-28_meeting-1_에이전트-자율-실행-품질-개선-카드-상세-보기-모달-작업-회고-기반.md` |
| 03-27 | process | all | unknown | 코드 리뷰 시 실제 파일 직접 확인 필수 — 구조 추론·오탐 금지 | `archive/2026-03/2026-03-27_code-review-verification-rule.md` |
