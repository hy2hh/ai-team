---
date: 2026-04-04
topic: process
roles: [frontend, backend, designer]
summary: 전 직군 React 프로세스 도입 + 평가 편향 수정 + 중복 제거
---

# Decision: 전 직군 React 프로세스 도입 + 평가 편향 수정 + 중복 제거

Date: 2026-04-04
Decided by: sid
Status: accepted

## Context

에이전트 시스템 분석 결과 3가지 구조적 문제 발견:

1. **React 프로세스 부재**: 피드백 수신→재작업→재검증→이의 제기→학습 루프가 대부분 미정의. 에이전트가 FAIL을 받아도 체계적 대응 절차 없음.
2. **평가 편향**: Frontend QA 체크리스트 189줄 vs Backend 5줄. Chalmers 무검증(메타검증 없음). 에스컬레이션 경로가 비논리적(모든 FAIL이 Homer에게만 위임).
3. **에이전트 파일 간 중복**: Team Context, TDD, Debug Log, 에스컬레이션 등 동일 내용이 6~7개 파일에 반복.

추가로 `docs/2026-04-04_adaptive-harness-research.md` 리서치 결과에서 12개 적용 가능한 인사이트 발견.

## Decision

### 1. 공통 피드백 대응 프로토콜 신설

`shared/react-process.md` (9개 섹션, ~150줄):
- §1 피드백 수신 (수신 확인 의무)
- §2 분석 (Reflexion 패턴: 도구 기반 독립 재현)
- §3 이의 제기 (24시간 내 응답, PM 중재)
- §4 재작업 (Self-Refine 자기 비판 루프)
- §5 자가 리뷰 (전 직군 의무, 동적 우선순위)
- §6 재검증 (유형별 담당자)
- §7 에스컬레이션 (도메인별 경로)
- §8 학습 루프 (Correction→Rule, 성공/실패 양방향, QA 메트릭, FAIL 패턴 분석, 라우팅 적응)
- §9 Hook/Skill 분류 (향후 자동화 대비)

### 2. 평가 편향 해소

- `context/qa/backend-review-checklist.md` 신설 (~140줄, Frontend와 동등 수준)
  - SQL/DB, 인증/인가, 입력 검증, API 설계, 성능, 에러 핸들링, 환경 설정 7개 섹션
- Chalmers 메타검증 섹션 추가: PM 프로세스 검증, 이의 제기 수용, 반복 FAIL 패턴 분석
- FAIL 에스컬레이션 도메인별 분리: Backend→Homer, Frontend→Bart, 디자인→Krusty

### 3. 중복 제거

- `shared/session-bootstrap.md` 신설: Team Context 공통 boilerplate 집중화
- 각 에이전트에서 공통 내용 제거 → 참조로 대체
- TDD/Debug Log → `code-quality-standards.md`로 이동
- QA/코드리뷰 보고 템플릿 → `context/qa/` 하위로 분리

### 4. 리서치 인사이트 적용 (12개)

| # | 인사이트 | 출처 | 적용 위치 |
|---|----------|------|-----------|
| 1 | Correction→Rule 자동 파이프라인 | Windsurf | react-process.md §8-1 |
| 2 | Grader + Self-Healing Loop | OpenAI Self-Evolving | chalmers.md 메타검증 |
| 3 | What/When/How 진화 프레임워크 | Self-Evolving Agents Survey | react-process.md §8 |
| 4 | Self-Refine 자기 비판 루프 | Reflexion/Self-Refine | react-process.md §4 |
| 5 | Accept/Reject 메트릭 누적 | Copilot NES | react-process.md §8-3 |
| 6 | Lesson→자가 리뷰 자동 승격 | Cline 자동 발견 | session-bootstrap.md + §8-1 |
| 7 | 라우팅 가중치 적응 | AdaptUI + NES | triage.md 라우팅 적응 |
| 8 | Hook/Skill 분류 | paddo.dev | react-process.md §9 |
| 9 | 자가 리뷰 동적 우선순위 | AdaptUI | session-bootstrap.md Step 4 |
| 10 | 반복 패턴→스킬 후보 | BabyAGI | react-process.md §8-2 |
| 11 | 에이전트 템플릿 구조 | ai-project-setup | session-bootstrap.md |
| 12 | Chalmers 반복 FAIL 분석 | OpenAI 확장 | react-process.md §8-4 |

## 변경 파일 목록

### 신규 (5개)
- `.claude/agents/shared/react-process.md` — 전 직군 피드백 대응 프로토콜
- `.claude/agents/shared/session-bootstrap.md` — 공통 세션 boilerplate
- `.claude/context/qa/backend-review-checklist.md` — Backend QA 체크리스트
- `.claude/context/qa/qa-report-template.md` — QA 보고 템플릿 (chalmers에서 분리)
- `.claude/context/qa/review-report-template.md` — 코드리뷰 보고 템플릿 (chalmers에서 분리)

### 수정 — 공유 파일 (3개)
- `.claude/agents/shared/code-quality-standards.md` — TDD/자가리뷰/피드백 대응 추가
- `.claude/agents/shared/collaboration-rules.md` — 에스컬레이션/학습/TDD 참조 추가
- `.claude/agents/shared/cross-domain-coordination.md` — 품질 이슈 에스컬레이션 확장

### 수정 — 에이전트 (8개)
| 에이전트 | 변경 전 | 변경 후 | 주요 변경 |
|----------|---------|---------|-----------|
| chalmers.md | 195줄 | 175줄 | 템플릿 분리, 메타검증 추가, 도메인별 에스컬레이션 |
| backend.md | 120줄 | 114줄 | 공통 제거, session-bootstrap/react-process 참조 |
| frontend.md | 144줄 | 139줄 | 공통 제거, 에스컬레이션 정상화 |
| secops.md | 180줄 | 182줄 | 자가 리뷰 추가 (OWASP/CWE) |
| designer.md | 108줄 | 113줄 | 자가 리뷰 추가 (디자인 시스템/접근성) |
| researcher.md | 162줄 | 165줄 | 자가 리뷰 추가 (출처 검증/면책 문구) |
| pm.md | 168줄 | 171줄 | 자가 리뷰 추가 (측정 가능 AC/위임 형식) |
| triage.md | 132줄 | 138줄 | 자가 리뷰 추가 + 라우팅 적응 규칙 |

### 백로그 추가
- `.memory/tasks/backlog.md` — 향후 과제 4건 기록

## 향후 과제

backlog.md에 기록됨:
1. DSPy I/O 시그니처: 산출물 계약 표준화
2. Rule Effectiveness 정량 측정: 규칙별 준수율 자동 추적 (Arize 패턴)
3. agnix 에이전트 파일 린터: 200줄 상한/필수 섹션 자동 검증
4. Hook 실제 구현: react-process.md §9에서 분류한 Hook 후보를 실제 Claude Code hook으로 구현

## 검증 결과

Ralph Loop 3라운드 실행:
- Round 1: 25 PASS / 4 FAIL (chalmers bootstrap 참조 누락, triage 자가 리뷰 누락 등)
- Round 2: 4건 수정
- Round 3: 전체 PASS (줄 수, 참조 경로, 자가 리뷰, 에스컬레이션 일관성 모두 통과)
