---
date: 2026-04-07
topic: testing
roles: [qa, backend, frontend]
summary: Chalmers e2e 테스트 도구 — Playwright CLI 채택, MCP 미채택 (토큰 4배 차이)
---

# 회의 결정: Chalmers QA 에이전트 e2e 테스트 도구 설계 — Playwright CLI 채택 (MCP 미채택)
> 회의 ID: 13
> 유형: planning
> 일시: 2026-04-07T00:04:14.829Z
> 참여자: backend, qa, frontend, researcher
> **최종결정: Playwright CLI 채택 — MCP 미채택** (토큰 비용 4배 차이, MCP 안정성 이슈, Bash 도구 이미 보유)

## 의견 요약
### backend


이전 백그라운드 태스크가 종료되었습니다. 이미 회의 #13 의견 제출이 완료된 상태이므로 영향 없습니다.

> ⚠️ _[자동 경고] 완료 보고에 작업 완료 확인 항목이 없습니다. 빌드/런타임/에러 처리 확인 결과를 첨부하세요._
### qa
회의 #13 스레드에 Chalmers 의견을 제출 완료했습니다. 주요 내용 요약:

• *Layer 3 현재 한계점* 3가지 (UI 검증 불가, 브릿지 타이밍 비결정적, 테스트 프레임워크 부재) — 모두 코드 직접 확인 기반
• *우선 자동화 시나리오* 3 Tier 제안 (칸반 CRUD → 브릿지 통합 → 회귀 스위트)
• *리포트 템플릿 확장안* — 실행시간, 스크린샷, TIMEOUT 구분 추가
• *Self-healing은 보류* — 테스트 0건 상태에서 과도 엔지니어링, retry 1회만 적용 권장
• *리스크 4건* — MCP 격리, 포트 사전조건, puppeteer 충돌, 토큰 비용

> ⚠️ _[bridge 자동 경고] 수치 주장(N개, N회 등)이 포함되어 있으나 소스 라인 번호 인용이 없습니다. 파일명:라인번호를 명시하세요._
### frontend
회의 #13에 프론트엔드 의견을 제출했습니다. 핵심 내용:

• 칸반 UI의 ARIA 접근성이 이미 잘 갖춰져 있어 Playwright 접근성 트리 기반 테스트에 적합
• `data-testid` 속성이 전무하므로 핵심 6개 컴포넌트에 추가 필요 (바로 작업 가능)
• e2e 우선순위: 카드 CRUD → 필터링 → DnD → WebSocket 순
• 리스크: DnD 좌표 기반 테스트 불안정성, WS 타이밍 flaky test, DB 격리 필요
### researcher
이제 모든 데이터를 확보했습니다. 회의 질문에 대한 의견을 제시합니다.

---

*1. 핵심 의견*

Playwright MCP 대신 *Playwright CLI (`@playwright/cli`)를 사용해야 합니다.* Chalmers는 이미 Bash 도구를 보유하고 있어 MCP 없이도 CLI로 브라우저를 제어할 수 있으며, 토큰 소비가 4배 적고(114K → 27K/테스트) 안정성 이슈도 훨씬 적습니다. ✅

*2. 근거 (질문별 응답)*

*Q1. Playwright MCP 안정성 — production-ready 수준인가?*

⚠️ *아직 완전히 안정적이지 않습니다.* 주요 known issues:

• Claude Code에서 MCP 도구가 노출되지 않는 버그 — `playwright-mcp` 0.0.56~0.0.61 + Claude Code 2.0.1~2.1.22 조합에서 `No such tool available` 오류 발생. ✅ 2026-02-23 해결 확인 (GitH

## 최종 결정
회의 의견 4건 종합 완료. 결정 내립니다.

---

*회의 #13 종합 결정*

*1. 합의 사항*
• Chalmers에게 브라우저 자동화 도구가 필요하다 — 전원 동의
• 칸반 카드 CRUD가 첫 번째 e2e 시나리오 — QA, Frontend 동의
• Self-healing은 시기상조, 테스트 0건부터 시작 — QA, Researcher 동의
• `data-testid` 속성 추가 필요 — Frontend 제안, QA 지지

*2. 충돌 지점: Playwright MCP vs CLI*

| 기준 | MCP 방식 | CLI 방식 (Lisa 제안) |
| --- | --- | --- |
| 토큰 비용 | ~114K/테스트 | ~27K/테스트 (4배 절감) |
| 안정성 | known issues 다수 (연결 해제, maxBuffer 등) | 안정적 (표준 CI/CD 패턴) |
| 탐색적 테스트 | 자연어로 즉석 탐색 가능 | 사전 작성된 스크립트 필요 |
| 추가 설정 | settings.json MCP 등록 | npm install + config |
| 재사용성 | 세션마다 새로 실행 | .spec.ts 파일로 누적 |

*3. 최종 결정: Playwright CLI 채택*

근거:
• 현재 테스트 0건 → 구조화된 테스트 스위트 구축이 우선. MCP의 탐색적 테스트는 스위트가 갖춰진 후에 가치 있음
• 토큰 비용 4배 차이는 무시 못함 (sid 비용 의식)
• MCP 안정성 이슈가 아직 남아 있어 프로덕션 QA에 의존하기 위험
• Chalmers가 이미 Bash를 보유 → `npx playwright test` 바로 실행 가능
• .spec.ts 파일이 누적되면 회귀 테스트 자산이 됨

*4. 구현 계획 (3 Phase)*

*Phase 1 — 인프라 구축* (Homer + Bart 병렬)
• Homer: Playwright 설치, `playwright.config.ts`, 테스트 디렉토리 구조, npm scripts 추가
• Bart: 칸반 UI 핵심 6개 컴포넌트에 `data-testid` 속성 추가

*Phase 2 — 첫 번째 e2e 스위트* (Homer)
• 기반 유틸리티: DB 리셋, 포트 체크, 테스트 격리 헬퍼
• 첫 e2e: 칸반 카드 CRUD (생성 → 조회 → 수정 → 삭제)

*Phase 3 — Chalmers 통합* (QA)
• `chalmers.md` Layer 3에 `npx playwright test` 실행 절차 추가
• QA 리포트 템플릿에 실행시간/스크린샷/TIMEOUT 구분 확장

승인해주시면 Phase 1 Homer+Bart 병렬 위임 시작합니다.