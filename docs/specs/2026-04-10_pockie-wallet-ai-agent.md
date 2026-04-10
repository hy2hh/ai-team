---
date: 2026-04-10
topic: product
roles: [backend, frontend, designer, secops]
summary: Pockie Wallet AI Agent Tier 1 Feature Spec — Homer/Bart/Krusty/Wiggum 담당 (approved)
status: accepted
---

# Feature Spec: Pockie Wallet AI Agent (Tier 1)

**상태**: approved
**작성자**: Marge  **날짜**: 2026-04-10
**담당 에이전트**: Homer(Backend), Bart(Frontend), Krusty(Designer), Wiggum(SecOps 리뷰)
**회의 결정**: `.memory/decisions/2026-04-10_meeting-15_pockie-wallet-AI-agent-기능-설계.md`
**레포**: `/Users/hangheejo/git/pockie-wallet-extension`

---

## 문제
pockie-wallet-extension(암호화폐 지갑 크롬 확장)에 AI 에이전트 기능이 전무한 상태. 경쟁사(Coinbase Agentic Wallets, Trust Wallet TWAK)는 이미 AI 기능을 출시했으며, 사용자 편의성과 보안을 동시에 강화하는 AI 기능이 시급히 필요.

## 설계 결정
| 결정 | 선택한 방안 | 대안 | 선택 이유 |
|------|------------|------|----------|
| UI 진입점 | 하단 커맨드 바 + BottomSheet | Home 탭에 AI 탭 추가 | 400×600px에서 잔고와 AI 동시 접근, 기존 BottomSheet 인프라 활용 |
| 구현 순서 | F1→F3→F2 | F1→F2→F3 | F1이 파이프라인 전체 구축, F3은 기존 컨트롤러 연결만 필요, F2가 가장 복잡 |
| LLM | Claude API (프록시 서버 경유) | OpenAI / 온디바이스 | function calling 품질 + 보안, API 키 Extension 번들 노출 방지 |
| 보안 모드 | Approval Mode Only (v1) | Agent Mode 포함 | LLM 비결정적 출력 + 프롬프트 인젝션 위험 → 자동 서명 금지 |
| 아키텍처 | AIController (BifrostController 서브) | 독립 모듈 | 기존 17개 컨트롤러 패턴 일관성 유지 |

## 인터페이스 계약 (Extension ↔ Proxy Server)

| 엔드포인트 | 메서드 | 요청 | 응답 | 에러 응답 |
|-----------|--------|------|------|----------|
| `/ai/parse-intent` | POST | `{ message: string, context: { chainId, balance, tokens } }` | `{ intent: 'transfer'|'swap'|'gas-check', params: {...}, confidence: number }` | `{ error: string, code: number }` |
| `/ai/simulate-tx` | POST | `{ txParams: TransactionParams, chainId: number }` | `{ riskScore: 0-100, riskLevel: 'low'|'medium'|'high', warnings: string[] }` | `{ error: string }` |
| `/ai/gas-recommend` | POST | `{ chainId: number }` | `{ currentGwei: number, recommendedGwei: number, estimatedWait: string, savingsUsd: number }` | `{ error: string }` |

## 구현 범위

### 포함
- [ ] Phase 0: AI 프록시 서버 (Claude API 래퍼)
- [ ] Phase 0: AIController + SecurityGuardController 스캐폴딩
- [ ] Phase 0: ExternalRequestController 승인 플로우 연결
- [ ] Phase 0: SpendingPolicy 지출 한도 (perTx/daily/whitelist)
- [ ] Phase 1-Design: 커맨드 바 + BottomSheet + 트랜잭션 요약 카드 디자인 (Krusty)
- [ ] Phase 1-FE: AI 채팅 UI, Jotai atom 설계, 컨트롤러 상태 동기화
- [ ] Phase 1-BE: AI Command Parser, intent→controller 라우팅
- [ ] Phase 2: 가스 최적화 — GasFeeController 확장 + 인라인 추천 UI
- [ ] Phase 3: 리스크 시뮬레이션 — tx simulation API + 리스크 스코어 UI
- [ ] 보안: 프롬프트 인젝션 4계층 방어 (L1~L4)
- [ ] 보안: AI 트랜잭션 구분 태깅 + 감사 로그

### 제외 (이번에 안 함)
- Agent Mode (자동 실행) — v2에서 검토
- DCA/자동 매매 (F5) — Service Worker 제약 검증 필요
- 포트폴리오 인사이트 (F4) — Tier 2
- 크로스체인 브릿지 어드바이저 (F7) — Tier 3
- 스마트 알림 (F8) — Tier 3
- 토큰 안전성 스코어링 (F6) — Tier 2

## 인수 조건 (Acceptance Criteria)

### Happy Path
- [ ] Given 사용자가 커맨드 바 탭 When "0.5 ETH를 vitalik.eth로 보내줘" 입력 Then AI가 트랜잭션 요약 카드를 BottomSheet에 표시 (수신처, 금액, 가스, 네트워크)
- [ ] Given 트랜잭션 요약 카드 표시 When "서명하기" 버튼 클릭 Then 기존 ExternalRequestController 승인 팝업 표시 → 서명 → 전송
- [ ] Given 트랜잭션 생성 시 When 가스 추천 활성화 Then 현재 가스비 vs 추천 가스비 인라인 비교 표시
- [ ] Given AI 명령 파싱 완료 When 리스크 시뮬레이션 활성화 Then 리스크 스코어 (0-100) + 3단계 컬러 경고 표시

### 에러 케이스 (필수)
- [ ] Given LLM 파싱 실패 When 의도 불명확 입력 Then "이해할 수 없습니다" 메시지 + 예시 명령 제안
- [ ] Given 프록시 서버 장애 When AI 명령 전송 Then "AI 서비스를 사용할 수 없습니다" 에러 + 수동 전송 유도
- [ ] Given 지출 한도 초과 When AI 트랜잭션 생성 Then "일일 한도를 초과했습니다" 경고 + 트랜잭션 차단
- [ ] Given 프롬프트 인젝션 탐지 When L1~L4 검증 실패 Then 트랜잭션 차단 + 경고 배너 표시
- [ ] Given AI 파싱 주소와 원문 불일치 When L4 의미론적 검증 Then 트랜잭션 차단 + "주소 불일치" 경고

### 엣지 케이스
- [ ] Given 잔고 부족 When AI가 전송 트랜잭션 생성 Then 잔고 부족 경고 + 트랜잭션 차단
- [ ] Given ENS/CNS 해석 실패 When 도메인 주소 입력 Then "주소를 찾을 수 없습니다" + 수동 주소 입력 유도
- [ ] Given 동시에 여러 AI 명령 When 빠른 연속 입력 Then 큐 방식으로 순차 처리, 이전 명령 완료 후 다음 처리

## 참조 파일 (pockie-wallet-extension)
- `src/scripts/bifrost-controller.ts` — 메인 오케스트레이터, 서브 컨트롤러 등록 패턴
- `src/scripts/controllers/external-request/index.ts` — 승인 플로우 (appendRequest→showUserConfirmation→resolveRequest)
- `src/scripts/controllers/external-request/request-schema.ts` — Zod 스키마 검증 패턴
- `src/scripts/controllers/gas-fee/` — 가스 추정 컨트롤러
- `src/scripts/controllers/swap/` — 스왑 오케스트레이션
- `src/component/atoms/BottomSheet.tsx` — react-spring-bottom-sheet + framer-motion
- `src/store/controller-state-atoms.ts` — Jotai atom 동기화 패턴
- `src/store/dispatcher.ts` — 백그라운드↔UI 상태 동기화
- `src/styles/theme.ts` — 브랜드 컬러 (#5f5be2), 시맨틱 컬러

## 성공 기준
- [ ] Happy Path AC 전체 통과
- [ ] 에러 케이스 AC 전체 통과
- [ ] Wiggum 보안 코드 리뷰 PASS
- [ ] Chalmers QA 검증 PASS
- [ ] 프롬프트 인젝션 테스트 (L1~L4) 전체 차단 확인

## 메모
- Lisa 리서치: `.memory/research/crypto-wallet-ai-agent-features.md`
- 경쟁사 현황: Coinbase(MPC+x402), TWAK(25+체인 DCA), MoonPay+Ledger(HW 서명)
- Service Worker 30초 idle timeout → LLM 스트리밍 응답 프록시 서버에서 처리
- 번들 사이즈 관리: AI 모듈은 동적 import로 코드 스플리팅 적용
