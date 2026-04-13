# Feature Spec: pockie-wallet AI Agent v1.1

**상태**: in-progress
**작성자**: Marge  **날짜**: 2026-04-13
**담당 에이전트**: Homer(Backend), Krusty(Designer), Bart(Frontend), Chalmers(QA), Wiggum(SecOps)
**선행 완료**: v1 (Phase 0~3, QA ALL PASS, 커밋 6건)

---

## 배경

v1에서 의도적으로 제외된 항목 + QA 과정에서 확인된 미흡 사항을 v1.1로 통합한다.
v1 수치: 53파일, ~9,335줄, 58/58 단위 테스트 PASS.

---

## v1.1 범위

### F0 — AI 전용 e2e 테스트 환경 (Homer + Chalmers) 🔴 필수
v1 QA에서 Playwright e2e가 SKIP됨. LLM Proxy 모킹 기반 e2e 환경이 없어 전체 플로우 브라우저 검증 불가.

- [ ] LLM Proxy Server Mock 환경 구축 (Homer)
  - 자연어 파싱 mock (intent + parameters)
  - 시뮬레이션 결과 mock (Safe/Caution/Danger 3종)
  - 가스 최적화 mock (Fast/Normal/Slow 프리셋)
- [ ] AI Agent 전용 Playwright e2e 테스트 파일 작성 (Chalmers)
  - Phase 1: 자연어 TX 플로우 (Command Bar → Intent Preview → 승인)
  - Phase 2: 시뮬레이션 플로우 (Safe/Caution/Danger 3종)
  - Phase 3: 가스 최적화 플로우 (배지 → 프리셋 선택 → 절감 표시)
  - Prompt Injection 차단 케이스

**성공 지표**: e2e ALL PASS (브라우저 실행 기준)

---

### F1 — ENS/도메인 주소 Resolve 🟡 v1 의도적 제외 항목
`intent-bridge.ts:592`에서 `.eth` 주소는 시뮬레이션 스킵 처리 중.
"send 0.1 ETH to vitalik.eth" 같은 자연어 입력 시 ENS resolver 연동 필요.

- [ ] ENS resolver 연동 (`ethers.js` `resolveName()` 또는 직접 `eth_call`)
- [ ] `.eth` / `.lens` / `.cb.id` 등 주요 도메인 네임서비스 지원
- [ ] 해석 실패 시 사용자 피드백 UI ("주소를 찾을 수 없습니다")
- [ ] SecurityGuard ENS 주소 검증 (resolved address → blacklist 체크)

**성공 지표**: `.eth` 도메인 자연어 TX e2e PASS

---

### F2 — AI 포트폴리오 인사이트 🟡 신규
- [ ] 보유 자산 분석 → "이번 달 ETH 변동 +12.3%" 등 자연어 요약
- [ ] 주요 DeFi 포지션 리스크 레벨 표시
- [ ] Command Bar "내 포트폴리오 분석해줘" 인텐트 처리

**성공 지표**: 포트폴리오 인사이트 카드 1 DAU 이상

---

### F3 — 토큰 안전성 스코어링 🟡 신규
시뮬레이션 anomaly 감지(6종)와 별개로 토큰 자체의 안전성 점수 표시.

- [ ] Token Safety Score API 연동 (GoPlus Security 또는 De.Fi)
- [ ] 점수 기반 배지: ✅ Verified / ⚠️ Caution / 🚫 Scam
- [ ] 스왑 의도 파싱 시 대상 토큰 자동 검증

**성공 지표**: 사기 토큰 1건 이상 차단 (감사 로그 기준)

---

### F4 — DCA / 자동매매 🟢 중장기
자연어로 반복 매수 전략 설정. v1의 Approval Mode만 지원.

- [ ] "매주 월요일 USDC로 ETH 50달러 매수" 인텐트 파싱
- [ ] 예약 실행 스케줄러 (Service Worker 기반)
- [ ] 각 실행마다 시뮬레이션 → 사용자 사전 승인 요청
- [ ] 예약 목록 UI (활성/일시정지/취소)

**성공 지표**: DCA 예약 설정 완료율 80% 이상

---

## 우선순위

| 순위 | 항목 | 근거 |
|------|------|------|
| P0 | e2e 테스트 환경 (F0) | v1 QA 미완료 항목, 출시 전 필수 |
| P1 | ENS resolve (F1) | v1 스펙에서 의도적 제외 명시, 사용자 기대 높음 |
| P2 | 토큰 안전성 스코어링 (F3) | 보안 강화, GoPlus API 연동 상대적 용이 |
| P3 | AI 포트폴리오 인사이트 (F2) | 신규 UX, 디자인 선행 필요 |
| P4 | DCA/자동매매 (F4) | 복잡도 높음, 별도 스프린트 |

---

## 완료 조건 (v1.1 릴리즈 기준)

- [ ] F0: AI e2e ALL PASS (브라우저 실행)
- [ ] F1: ENS resolve e2e PASS
- [ ] Wiggum 보안 리뷰 ALL PASS (v1 전체 코드 대상)
- [ ] TS 에러 0건
- [ ] 단위 테스트 전체 PASS (기존 58개 + 신규)
