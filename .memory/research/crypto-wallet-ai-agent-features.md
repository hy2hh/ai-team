---
last-updated: 2026-04-13
confidence: high
sources:
  - https://trustwallet.com/blog/announcements/your-ai-agent-can-now-run-your-crypto-strategy-introducing-dca-automation-and-limit-orders-in-trust-wallet-agent-kit
  - https://www.coinbase.com/developer-platform/discover/launches/agentic-wallets
  - https://store.dcentwallet.com/blogs/post/ai-agents-crypto-wallets-autonomous-future
  - https://www.solulab.com/agent-native-crypto-wallets
  - https://www.dawnwallet.xyz/ai
  - https://www.pymnts.com/cryptocurrency/2026/coinbase-debuts-crypto-wallet-infrastructure-for-ai-agents/
  - https://www.thestreet.com/crypto/newsroom/human-tech-wallet-infrastructure-for-ai-agents
  - https://crypto.com/us/research/rise-of-autonomous-wallet-feb-2026
  - https://alpinist.ee/laskumine/simulate-before-you-sign-how-transaction-simulation-rabby-wallet-and-walletconnect-keep-your-defi-moves-safer/
  - https://cryptoslate.com/crypto-wallets/rabby-wallet-review/
---

# 암호화폐 지갑 AI Agent 기능 리서치 (v2 — 재조사)

> ⚠️ 이 보고서의 수치는 2026-04-13 기준입니다. 현재와 다를 수 있습니다.

## 1. 시장 현황 업데이트

### 주요 플레이어 및 최신 동향

| 제품 | 출시 | 핵심 AI 기능 | UX 패턴 | 검증 |
|------|------|-------------|---------|------|
| Coinbase Agentic Wallets | 2026 초 | MPC 기반 자율거래, x402 프로토콜 (1.07억 tx 처리) | SDK/API 통합, gasless on Base | ✅ |
| Trust Wallet Agent Kit (TWAK) | 2026.03 | DCA 자동화, 지정가 주문, 25+ 체인, 2.2억 사용자 | Agent Mode / WalletConnect Mode 이중 구조 | ✅ |
| Dawn AI | 미출시 (대기자 모집중) | 자연어 tx, 온체인 쿼리, 프로토콜 상호작용 | "Simply talk to your wallet" — 채팅 인터페이스 | ⚠️ (랜딩페이지만 확인) |
| Rabby Wallet | 운영중 | 트랜잭션 시뮬레이션, 피싱 탐지, 자동 체인 전환 | Pre-sign 시뮬레이션 인라인 표시, 420만 사용자 | ✅ |
| Human.tech Agentic WaaP | 2026 WalletCon 발표 | Wallet as a Protocol, 암호학적 인간 감독 | 에이전트 자율 실행 + 사용자 경계 설정 | ⚠️ (WebSearch 기반) |

### 시장 규모
- AI 에이전트 시장: $7.84B(2025) → $52.62B(2030), CAGR 46.3% ⚠️ (WebSearch 기반, 원문 미접속)
- McKinsey 에이전트 매개 상거래 전망: 2030년 $3–5T ⚠️ (WebSearch 기반)
- 2026년까지 크립토 지갑 60%가 에이전틱 AI 도입 전망 ⚠️ (WebSearch 기반, 원문 미접속)

## 2. Pockie Wallet 현재 상태

### 기존 인프라 (코드 확인 기반)
- MV3 Chrome Extension, TypeScript 573개 파일
- React 18 + Jotai + styled-components + Framer Motion
- MetaMask 호환 provider (`window.ethereum` + `window.bitcoin`)
- 22개 controllers (keyring, transaction, gas-fee, swap, prices, nft, balance 등)
- Bifrost SDK 멀티체인 (ETH, BSC, Avalanche, Polygon, BTC)
- 400×600px 팝업 뷰포트
- Playwright E2E 테스트 인프라 구축 완료

### AI Agent 재활용 가능 구조
- `ExternalRequestController`: RPC 요청 라우팅 → AI 명령 파이프라인 확장 가능
- `swap/`: DEX 스왑 오케스트레이션 → AI 자동 스왑 연동
- `gas-fee/`: 가스 추정 → AI 가스 최적화
- `prices/`: 토큰 가격 추적 → AI 가격 분석
- `history/`: 트랜잭션 히스토리 → AI 패턴 분석
- `bifrost-controller.ts`: 중앙 오케스트레이터 → AIController 서브컨트롤러 추가 포인트

## 3. 경쟁사 분석 — 실용 기능 비교

### 자연어 트랜잭션 (F1)

| 경쟁사 | 구현 방식 | 지원 범위 | 차별점 |
|--------|----------|----------|--------|
| Dawn AI | 채팅 기반 ("swap 2 dai for usdc") | 전송, 스왑, 브릿지, 온체인 쿼리 | 프로토콜 가이드 역할 병행 |
| Crypto.com SDK | 자연어 → 블록체인 액션 변환 | 전송, 스테이킹, 스왑 | SDK 레벨 제공 |
| TOMI Wallet | 음성 제어 | 전송, 잔액 조회, 가격 확인 | 핸즈프리 UX |

*Pockie 적용 포인트*: 기존 `ExternalRequestController` 파이프라인에 AI intent parser 삽입. LLM function calling으로 structured output → 컨트롤러 호출.

### 트랜잭션 시뮬레이션 (F2)

| 경쟁사 | 구현 방식 | UX | 차별점 |
|--------|----------|-----|--------|
| Rabby | Pre-sign 시뮬레이션, 잔액 변화 미리 표시 | 서명 화면에 인라인 결과 | 악성 approval 자동 감지 |
| Tenderly | tx simulation API | 개발자 도구 수준 | 디버깅 중심 |
| TWAK | 토큰 리스크 스코어링 | 자율 실행 전 리스크 체크 | 에이전트 자동 판단 |

*Pockie 적용 포인트*: notification window (기존 tx 승인 플로우)에 시뮬레이션 결과 + AI 리스크 스코어 오버레이.

### 가스 최적화 (F3)

| 경쟁사 | 구현 방식 | 절감 효과 |
|--------|----------|----------|
| MetaMask + Wallet Guard | 실시간 가스 스캔 + AI 최적화 | 미공개 |
| Klever | AI 가스 최적화 + 이상 행동 플래깅 | 미공개 |
| Coinbase (Base) | Gasless 트랜잭션 | 100% (L2 한정) |

*Pockie 적용 포인트*: 기존 `gas-fee-controller` 확장. 히스토리컬 가스 데이터 분석 → 최적 타이밍 추천 + EIP-1559 maxFeePerGas 자동 튜닝.

### DCA/자동매매 (F5)

| 경쟁사 | 구현 방식 | 모드 |
|--------|----------|------|
| TWAK | DCA 스케줄 + 지정가 주문 | Agent Mode (자율) / WalletConnect (승인) |
| Coinbase | Earn skill 자동 실행 | Agentic Wallet 내 자율 |

*Pockie 적용 포인트*: Service Worker alarms API 활용 스케줄러. 단, MV3 SW 생명주기 제약(30초 idle 종료) → `chrome.alarms` + `chrome.storage` 상태 영속화 필요.

## 4. 추천 기능 (재정의 — practical depth)

### Tier 1: 핵심 (v1 스코프)

#### F1. 자연어 트랜잭션 어시스턴트
- *무엇*: "0.5 ETH를 vitalik.eth로 보내줘", "USDC를 ETH로 스왑" 등 자연어 처리
- *왜*: 모든 경쟁사가 최우선 구현. 가장 직관적인 차별화.
- *어떻게*:
  - LLM proxy server (API 키 extension 노출 금지)
  - Claude function calling → structured intent (action, token, amount, to, chain)
  - Zod schema 재검증 → 기존 컨트롤러 호출
  - 실패 시 자연어 에러 메시지 반환

#### F2. 트랜잭션 리스크 시뮬레이션
- *무엇*: 서명 전 잔액 변화 미리 보기 + AI 위험도 스코어 (safe/caution/danger)
- *왜*: Rabby의 킬러 피처. 420만 사용자 확보의 핵심 요인.
- *어떻게*:
  - `eth_call` 기반 로컬 시뮬레이션 또는 Tenderly API
  - 결과를 notification window에 시각화
  - AI 분석: 비정상 approval, 알려진 스캠 주소, 과도한 가스 감지

#### F3. 스마트 가스 최적화
- *무엇*: 최적 가스 타이밍 추천 + 자동 가스 프리셋 (빠름/보통/절약)
- *왜*: 구현 난이도 낮음, 기존 인프라 최대 활용, 사용자 체감 즉각적
- *어떻게*:
  - 기존 `gas-fee-controller` 확장
  - 과거 블록 가스 통계 분석 → 추천 타이밍 알림
  - EIP-1559 maxFeePerGas 자동 조정

### Tier 2: 고부가가치 (v1.1)

#### F4. AI 포트폴리오 인사이트
- 자산 분포 분석 + 리밸런싱 제안 + 수익률 추적
- prices/balance 컨트롤러 데이터 + LLM 요약

#### F5. DCA/자동 매매
- 정기 매수, 지정가 주문
- `chrome.alarms` 기반 스케줄러 + swap 컨트롤러

#### F6. 토큰 안전성 스코어링
- 신규 토큰/컨트랙트 안전 등급 자동 표시
- 온체인 분석 + known scam DB

### Tier 3: 차별화 (v2)

#### F7. 크로스체인 브릿지 어드바이저
- Bifrost SDK 활용 최적 경로 비교

#### F8. 스마트 알림
- 가격 변동, 가스 윈도우, 포트폴리오 이벤트 기반

## 5. UI/UX 설계 권장사항

### 400×600px 팝업 제약 대응

| 패턴 | 설명 | 근거 |
|------|------|------|
| *Bottom-fixed Command Bar* | Home 하단 고정 입력창 "무엇을 도와드릴까요?" | Krusty 이전 제안 채택. 탭 분리보다 접근성 우수 (1-tap) |
| *BottomSheet 확장* | 입력 시 sheet가 올라와 대화 + 결과 표시 | framer-motion `snapPoints` [0.3, 0.85]로 2단계 높이 |
| *시뮬레이션 인라인 오버레이* | 기존 notification window에 리스크 결과 겹침 표시 | Rabby 패턴. 별도 화면 이동 없이 승인 플로우 내 표시 |
| *리스크 색상 체계* | Safe=#2fac68 / Caution=#FFB600 / Danger=#ff474c | 브랜드 포인트 컬러 #5f5be2와 보색 관계 |
| *Approval Mode 기본값* | v1은 모든 AI tx에 사용자 승인 필수 | 보안 최우선. Agent Mode는 v2에서 점진 도입 |

### 주요 UX 플로우

```
[Home] → [Command Bar 탭] → [자연어 입력]
    → [BottomSheet 확장: AI 파싱 결과 표시]
    → [확인] → [Notification Window: 시뮬레이션 + 리스크]
    → [서명] → [결과 표시]
```

## 6. 보안 아키텍처

### 필수 가드레일 (경쟁사 공통 패턴)
- *LLM Proxy Server*: API 키 extension 노출 절대 금지 (Coinbase, TWAK 모두 서버 사이드)
- *Spending Policy*: perTxLimit, dailyLimit, dailyTxCount, whitelistOnly, allowedMethods
- *4-Layer Prompt Injection 방어*: 정규화 → 구조 분리 → 스키마 검증 → 의미 검증
- *Approval Mode Only (v1)*: AI가 제안 → 사용자 매 건 승인
- *감사 로그*: 모든 AI intent → 실행 결과 매핑 추적

### 기술 아키텍처

```
[Popup UI — Command Bar + BottomSheet]
    ↓ (자연어 입력)
[LLM Proxy Server] — Claude API function calling
    ↓ (structured intent JSON)
[AIController] — BifrostController 서브컨트롤러
    ├── SecurityGuardController (spending policy + prompt injection 방어)
    ├── Zod schema 재검증
    └── Intent Router
         ├── swap-controller
         ├── eth-tx-controller
         ├── gas-fee-controller
         ├── prices-controller
         └── balance-controller
    ↓
[Transaction Simulator] — eth_call / Tenderly
    ↓ (리스크 스코어)
[Notification Window — 시뮬레이션 결과 + 승인 UI]
    ↓ (사용자 서명)
[Blockchain Execution]
```

## 7. 구현 우선순위 (실용 로드맵)

### Phase 0 (인프라): LLM Proxy + AIController + SecurityGuard
### Phase 1 (F1): Command Bar UI + 자연어 트랜잭션
### Phase 2 (F3): 가스 최적화 (기존 컨트롤러 확장)
### Phase 3 (F2): 트랜잭션 시뮬레이션 + 리스크 UI
### Phase 4 (F4-F6): 포트폴리오/DCA/안전성 스코어링

> ⚠️ 이 보고서의 수치는 2026-04-13 기준입니다. 현재와 다를 수 있습니다.
