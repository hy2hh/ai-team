---
last-updated: 2026-04-10
confidence: high
sources:
  - https://trustwallet.com/blog/announcements/introducing-the-trust-wallet-agent-kit-twak-your-ai-agent-can-now-act-on-crypto
  - https://www.coinbase.com/developer-platform/discover/launches/agentic-wallets
  - https://store.dcentwallet.com/blogs/post/ai-agents-crypto-wallets-autonomous-future
  - https://blog.millionero.com/blog/ai-agents-in-crypto-how-autonomous-finance-is-becoming-real-in-2026/
  - https://www.kucoin.com/blog/what-is-an-ai-agent-in-crypto
  - https://www.coindesk.com/tech/2026/03/13/moonpay-introduces-ledger-secured-ai-crypto-agents-to-address-wallet-key-risks
  - https://www.pymnts.com/cryptocurrency/2026/coinbase-debuts-crypto-wallet-infrastructure-for-ai-agents/
---

# 암호화폐 지갑 AI Agent 기능 리서치

## 1. 시장 현황 (2026-04 기준)

### 주요 플레이어 및 동향
- **Coinbase Agentic Wallets** (2026.02): MPC 기반, x402 프로토콜, 자율 거래/수익/트레이딩
- **Trust Wallet Agent Kit (TWAK)** (2026.03): 25+ 체인 지원, DCA/지정가 주문/스왑, 2가지 운영 모드
- **MoonPay + Ledger** (2026.03): 하드웨어 지갑 서명으로 AI 에이전트 보안 강화
- **Armor Wallet**: NLP 기반 DeFi 상호작용, 멀티 에이전트 포트폴리오 전략
- **Crypto.com AI Agent SDK**: 자연어 → 블록체인 액션 변환

### 시장 규모
- AI 에이전트 시장: $7.84B(2025) → $52.62B(2030), CAGR 46.3%
- AI 토큰 시가총액: 월 30% 성장 (2026 초)
- 550+ AI 에이전트 프로젝트, 합산 시가총액 $4.3B+

## 2. Pockie Wallet 현재 상태

### 기존 인프라
- MV3 Chrome Extension, TypeScript 64K LOC
- MetaMask 기반 컨트롤러 패턴 (17개 코어 컨트롤러)
- ETH/BTC/Bifrost 멀티체인 지원
- MCP (Model Context Protocol) 서버 기초 작업 존재 (git history)
- Jotai + ComposableObservableStore 상태 관리
- Biholder/Bitcore/Pockie/Moralis API 통합

### 활용 가능한 기존 구조
- `ExternalRequestController`: RPC 요청 라우팅 → AI 명령 파이프라인 확장 가능
- `swap/`: DEX 스왑 오케스트레이션 → AI 자동 스왑 연동
- `gas-fee/`: 가스 추정 → AI 가스 최적화
- `prices/`: 토큰 가격 추적 → AI 가격 분석
- `history/`: 트랜잭션 히스토리 → AI 패턴 분석

## 3. 추천 AI Agent 기능 (우선순위순)

### Tier 1: 핵심 기능 (즉시 구현 가능)

#### F1. 자연어 트랜잭션 어시스턴트
- **설명**: "0.5 ETH를 vitalik.eth로 보내줘" 같은 자연어 명령 처리
- **구현**: LLM API + intent parser → 기존 컨트롤러 호출
- **참고 사례**: Crypto.com SDK, Armor Wallet NLP
- **복잡도**: Medium — 기존 컨트롤러 재사용 가능

#### F2. 트랜잭션 리스크 시뮬레이션
- **설명**: 서명 전 트랜잭션 시뮬레이션 + 위험도 스코어링
- **구현**: tx simulation API + 룰 엔진 + AI 위험 분석
- **참고 사례**: TWAK token risk scoring, Armor tx simulation
- **복잡도**: Medium — notification flow에 통합

#### F3. 스마트 가스 최적화
- **설명**: 최적 가스 타이밍 추천 + 자동 가스 조정
- **구현**: 기존 gas-fee 컨트롤러 확장 + historical gas data 분석
- **복잡도**: Low — 기존 인프라 활용도 높음

### Tier 2: 고부가가치 기능

#### F4. AI 포트폴리오 인사이트
- **설명**: 자산 분석, 리밸런싱 제안, 수익률 추적
- **구현**: prices/balance 컨트롤러 데이터 + LLM 분석
- **참고 사례**: SingularityDAO DynaSets, TWAK portfolio monitoring
- **복잡도**: Medium

#### F5. DCA/자동 매매 에이전트
- **설명**: 정기 매수(DCA), 지정가 주문, 가격 기반 자동 실행
- **구현**: Service Worker 기반 스케줄러 + swap 컨트롤러
- **참고 사례**: TWAK DCA automations, limit orders
- **복잡도**: High — Service Worker 제약 고려 필요

#### F6. 토큰 안전성 스코어링
- **설명**: 신규 토큰/컨트랙트 상호작용 시 안전 등급 표시
- **구현**: 온체인 데이터 분석 + known scam DB + AI 패턴 매칭
- **참고 사례**: TWAK token risk scoring
- **복잡도**: Medium

### Tier 3: 차별화 기능

#### F7. 크로스체인 브릿지 어드바이저
- **설명**: 최적 브릿지 경로/수수료 비교 + 자동 추천
- **구현**: Bifrost SDK 확장 + 멀티 브릿지 비교 엔진
- **복잡도**: High — Pockie 특화 차별점

#### F8. 스마트 알림 + 인사이트
- **설명**: 사용자 행동 패턴 기반 맞춤 알림 (큰 변동, 기회 포착)
- **구현**: 가격 모니터링 + 사용자 선호도 학습
- **복잡도**: Medium

## 4. 보안 고려사항

### 필수 가드레일
- **프로그래밍 가능한 지출 한도**: 일별/주별/트랜잭션별 상한
- **화이트리스트 정책**: 승인된 컨트랙트/자산/체인만 허용
- **감사 로그**: 모든 AI 결정 → 온체인 액션 연결 추적
- **긴급 정지**: 서킷 브레이커 + 일시정지 스위치
- **프롬프트 인젝션 방어**: 연구에 따르면 방어 없이 73.2% 공격 성공률

### 사용자 제어 모드 (TWAK 참고)
1. **Agent Mode**: AI가 자율적으로 실행 (사전 규칙 내)
2. **Approval Mode**: AI가 제안 → 사용자가 매 건 승인

## 5. 기술 아키텍처 제안

```
[Chrome Extension Popup UI]
    ↓ (자연어 입력)
[AI Command Parser] — LLM API (Claude/GPT)
    ↓ (structured intent)
[Agent Orchestrator] — 보안 가드레일 체크
    ↓
[Existing Controllers]
  ├── swap-controller (스왑 실행)
  ├── eth-tx-controller (전송)
  ├── gas-fee-controller (가스 최적화)
  ├── prices-controller (가격 분석)
  └── balance-controller (포트폴리오)
    ↓
[Transaction Simulator] — 리스크 스코어링
    ↓
[User Approval UI] — notification window
    ↓
[Blockchain Execution]
```

## 6. 구현 우선순위 로드맵

### Phase 1 (2주): 기반 구축
- AI Command Parser 모듈
- Agent Orchestrator + 보안 가드레일
- 자연어 → 기존 컨트롤러 연결

### Phase 2 (2주): 핵심 기능
- F1: 자연어 트랜잭션 어시스턴트
- F2: 트랜잭션 리스크 시뮬레이션
- F3: 스마트 가스 최적화

### Phase 3 (3주): 고급 기능
- F4: AI 포트폴리오 인사이트
- F5: DCA/자동 매매 에이전트
- F6: 토큰 안전성 스코어링

### Phase 4 (2주): 차별화
- F7: 크로스체인 브릿지 어드바이저
- F8: 스마트 알림 + 인사이트
