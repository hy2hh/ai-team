# PRD: pockie-wallet-extension AI Agent v1.1

**Status**: Draft
**Author**: Marge  **Last Updated**: 2026-04-13  **Version**: 1.0
**Stakeholders**: Homer(Backend), Krusty(Designer), Bart(Frontend), Wiggum(SecOps), Chalmers(QA)

---

## 1. Problem Statement

v1 (Phase 0~3)에서 53파일, ~9,335줄, 58/58 단위 테스트 PASS를 달성했으나 다음 3가지 갭이 출시를 막고 있다.

1. **브라우저 e2e 미실시**: 단위 테스트는 전부 통과했으나 실제 브라우저 환경에서 AI 플로우 전체를 검증한 적 없음. Playwright e2e는 LLM Proxy 모킹 인프라 부재로 SKIP됨.
2. **보안 이슈 8건 미수정**: Wiggum STRIDE 분석 결과 HIGH 2건(S1: USD 가격 하드코딩, S2: 정적 서비스 ID 인증), MEDIUM 5건, LOW 1건 식별. v1 출시 전 S1·S5 두 건은 필수 수정.
3. **사용자 기대 기능 미구현**: v1 스펙에서 의도적으로 제외한 ENS resolve, 토큰 안전성 스코어링이 실사용에서 즉각 요구될 가능성 높음.

**Evidence:**
- Wiggum 코드 리뷰: 8건 보안 이슈 (`intent-bridge.ts`, `security-guard.ts`, `index.ts` 직접 확인)
- v1 QA 리포트: e2e SKIP 명시 (Mac Mini 디스플레이 미연결 사유)
- v1 스펙: `.eth` 주소 `intent-bridge.ts:592`에서 시뮬레이션 스킵 처리 중

---

## 2. Goals & Success Metrics

| Goal | Metric | Current Baseline | Target | Measurement Window |
|------|--------|-----------------|--------|--------------------|
| 브라우저 전체 플로우 검증 | e2e PASS 수 | 0 (미실행) | 32건 ALL PASS | v1.1 릴리즈 전 |
| 보안 이슈 해소 | STRIDE 미수정 건수 | 8건 | 0건 | v1.1 릴리즈 전 |
| ENS 지원 | `.eth` TX 성공률 | 0% (미지원) | ≥95% | 릴리즈 후 30일 |
| 토큰 안전성 감지 | 사기 토큰 차단 건수 | 0 (미구현) | ≥1건 (감사 로그 기준) | 릴리즈 후 30일 |

---

## 3. Non-Goals

- **Agent Mode 미지원**: v1.1에서도 Approval Mode Only 유지. 자율 실행은 별도 보안 검토 후 v2에서 논의.
- **DCA/자동매매 미포함**: 복잡도 높음 (Service Worker 스케줄러 + 사용자 사전 승인 루프). 별도 스프린트.
- **모바일(iOS/Android) 미지원**: Chrome Extension 전용 스코프 유지.
- **AI 포트폴리오 인사이트 미포함**: 디자인 선행 필요. v1.1 후속 스프린트로 분리.
- **멀티체인 ENS**: `.eth`(Ethereum) + `.lens`, `.cb.id` 지원만 포함. 기타 체인 도메인 서비스는 v2.

---

## 4. User Personas & Stories

**Primary Persona**: 암호화폐 초보~중급 사용자 — 지갑 주소를 외우기 어렵고, 스마트 컨트랙트 리스크를 직접 판단하기 어려운 사용자.

### Story 1 — ENS 주소 자연어 전송
As a 사용자, I want to "vitalik.eth에게 0.1 ETH 보내줘"라고 입력해서 전송할 수 있기를 원한다.
**Acceptance Criteria**:
- [ ] `.eth` 도메인 입력 시 ENS resolver로 실제 주소 해석 완료
- [ ] 해석된 주소가 Command Bar 확인 카드에 표시됨 (원본 도메인 + 16진 주소 함께)
- [ ] 해석 실패 시 "주소를 찾을 수 없습니다" 에러 메시지 표시
- [ ] resolved 주소가 SecurityGuard 블랙리스트에 체크됨
- [ ] e2e: ENS resolve → intent preview → 승인 플로우 PASS

### Story 2 — 토큰 안전성 자동 검증
As a 사용자, I want to 알 수 없는 토큰으로 스왑할 때 안전성 등급을 자동으로 알고 싶다.
**Acceptance Criteria**:
- [ ] 스왑 의도 파싱 시 대상 토큰 GoPlus Security API 자동 조회
- [ ] 결과에 따라 배지 표시: ✅ Verified / ⚠️ Caution / 🚫 Scam
- [ ] 🚫 Scam 토큰 TX는 차단 + 감사 로그 기록
- [ ] API 실패 시 "검증 불가 — 주의해서 진행하세요" 폴백 표시

### Story 3 — 브라우저 e2e 전체 플로우 검증
As a 개발팀, I want to AI 플로우 전체가 실제 브라우저에서 동작함을 보장하고 싶다.
**Acceptance Criteria**:
- [ ] LLM Proxy Mock 서버 기동 후 Extension 연결 성공
- [ ] 자연어 TX / 시뮬레이션(Safe·Caution·Danger) / 가스 최적화 3종 플로우 e2e PASS
- [ ] Prompt Injection 차단 케이스 e2e PASS
- [ ] 전체 32개 AI e2e 케이스 ALL PASS

---

## 5. Solution Overview

### F0 — AI 전용 e2e 테스트 환경 🔴 P0
LLM Proxy 서버의 Mock 버전을 구축해 실제 Claude API 호출 없이 Playwright e2e를 실행 가능하게 한다. Homer가 Mock 서버를 먼저 구축하면 Chalmers가 32개 AI e2e 케이스를 작성·실행한다.

**Mock 응답 3종**:
- 자연어 파싱 mock (intent + parameters)
- 시뮬레이션 결과 mock (Safe/Caution/Danger)
- 가스 최적화 mock (Fast/Normal/Slow 프리셋)

### F1 — ENS/도메인 주소 Resolve 🟡 P1
`intent-bridge.ts:592`의 `.eth` 스킵 처리를 제거하고 ENS resolver를 연동한다. `ethers.js` `resolveName()` 활용. 해석된 주소는 기존 SecurityGuard 블랙리스트·스캠 주소 DB 체크를 통과해야 TX가 진행된다.

### F2 — 토큰 안전성 스코어링 🟡 P2
스왑 의도 파싱 시 GoPlus Security API(무료 티어)로 토큰 CA를 조회해 안전성 등급을 부여한다. 기존 리스크 시뮬레이션(anomaly 감지 6종)과 레이어가 달라 상호 보완 관계다.

### 보안 이슈 수정 (S1~S8) — Homer 담당
Wiggum이 식별한 8건을 우선순위별로 수정한다.

**Key Design Decisions:**
- ENS resolve는 Extension 프로세스가 아닌 Proxy Server에서 처리: API 키 노출 방지 원칙 유지.
- GoPlus API 폴백 전략: 실패 시 차단이 아닌 경고 표시 (가용성 > 엄격성, 사용자 최종 승인 존재).
- DCA는 v1.1 스코프 제외: Service Worker 기반 스케줄러는 독립 보안 검토 필요.

---

## 6. Technical Considerations

**Dependencies**:
- GoPlus Security API — 토큰 스코어링 — Homer — 무료 티어 rate limit 확인 필요 (리스크: Low)
- `ethers.js` ENS resolver — ENS resolve — Homer — 이미 의존성 있음 (리스크: Low)
- LLM Proxy Mock 서버 — e2e 환경 — Homer — 신규 구축 (리스크: Medium)

**보안 이슈 수정 로드맵:**

| 이슈 | 심각도 | 파일:라인 | 조치 | 우선순위 |
|------|--------|-----------|------|---------|
| S1 USD 가격 하드코딩 | HIGH | `intent-bridge.ts:575` | PricesController 연동 | v1 출시 전 |
| S5 잔액 fromAddress 무시 | MEDIUM | `intent-bridge.ts:687-694` | `AccountTracker.accounts[fromAddress]` 직접 조회 | v1 출시 전 |
| S2 정적 서비스 ID 인증 | HIGH | `index.ts:136-142` | UUID 기반 HMAC-SHA256 서명 검증 | v1.1 전 |
| S3 IP Rate Limit 헤더 스푸핑 | MEDIUM | `index.ts:121` | Reverse Proxy 소켓 IP 또는 `cf-connecting-ip` 사용 | v1.1 전 |
| S4 CORS Extension ID 와일드카드 | MEDIUM | `index.ts:22-24` | 실제 Extension ID 명시 | v1.1 전 |
| S6 일일 한도 메모리 한정 | MEDIUM | `security-guard.ts:87-93` | IndexedDB에 일일 사용량 영속화 | v1.1 전 |
| S7 스캠 주소 DB 비어있음 | MEDIUM | `security-guard.ts:56-59` | Chainabuse/MetaMask 블랙리스트 초기화 로드 | v1.1 전 |
| S8 tool_choice auto | LOW | `intent-parser.ts:96` | `tool_choice: { type: 'any' }` 변경 | v1.1 |

**Known Risks**:

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| GoPlus API rate limit | Medium | Medium | 응답 캐시 (토큰 CA 기준 TTL 1시간) |
| ENS resolver 지연 (RPC 의존) | Medium | Low | 타임아웃 3초, 실패 시 16진 주소 직접 입력 유도 |
| Mock 서버와 실제 Proxy 응답 불일치 | Low | High | Mock 스키마를 Zod로 정의해 실제와 동기화 |

**Open Questions** (dev start 전 해결 필요):
- [ ] GoPlus API 무료 티어 rate limit 확인 — Homer — 2026-04-14
- [ ] Extension ID 확정 (S4 CORS 수정 시 필요) — Homer — 2026-04-14

---

## 7. Launch Plan

| Phase | 조건 | 담당 | 성공 게이트 |
|-------|------|------|------------|
| v1 출시 전 | S1·S5 수정 완료 + Chalmers 재검증 | Homer → Chalmers | 보안 이슈 HIGH 0건 |
| v1.1 개발 | F0(Mock+e2e) + F1(ENS) + S2~S7 수정 | Homer → Chalmers | e2e 32건 ALL PASS, 보안 0건 |
| v1.1 릴리즈 | F2(토큰 스코어링) + Wiggum 최종 리뷰 | 전팀 | 완료 조건 전항목 체크 |

**Rollback Criteria**: e2e FAIL 1건이라도 발생 시 해당 피처 플래그 비활성화 후 재배포.

---

## 8. 완료 조건 (v1.1 릴리즈 기준)

- [ ] F0: AI e2e 32건 ALL PASS (브라우저 실행 기준)
- [ ] F1: ENS resolve e2e PASS
- [ ] F2: 토큰 안전성 스코어링 e2e PASS
- [ ] S1~S8 보안 이슈 전건 수정 완료
- [ ] Wiggum 보안 재검증 ALL PASS
- [ ] TS 에러 0건
- [ ] 단위 테스트 전체 PASS (기존 58개 + 신규)

---

## 9. Appendix

- Feature Spec (선행): `docs/specs/2026-04-13_pockie-wallet-ai-agent-v1.1.md`
- 회의 결정 #15 (v1 설계): `.memory/decisions/2026-04-10_meeting-15_pockie-wallet-AI-agent-기능-설계.md`
- 회의 결정 #19 (v1 범위 확정): `.memory/decisions/2026-04-13_meeting-19_pockiewalletextension-AI-Agent-기능-설계-v1-구현-범위-확정-및.md`
- Wiggum 보안 리뷰: #ai-team 스레드 `ts: 1776067745.110429`
