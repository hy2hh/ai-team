# Feature Spec: pockie-wallet AI Agent v1

**상태**: completed (Phase 0~3 전체 완료, QA ALL PASS)
**작성자**: Marge  **날짜**: 2026-04-13
**담당 에이전트**: Homer(Backend), Krusty(Designer), Bart(Frontend), Chalmers(QA)
**회의 근거**: 회의 #19 (`decisions/2026-04-13_meeting-19_...`)

---

## 문제
pockie-wallet-extension에 AI agent 기능이 없어 경쟁사(Coinbase, Trust Wallet, Rabby, Dawn) 대비 차별화 부재. 자연어 트랜잭션, 리스크 시뮬레이션, 가스 최적화 3개 핵심 기능을 v1으로 추가하여 사용자 경험을 혁신한다.

## 설계 결정
| 결정 | 선택한 방안 | 대안 | 선택 이유 |
|------|------------|------|----------|
| AI 레이어 배치 | AIIntentBridge 별도 서비스 레이어 | BifrostController 서브컨트롤러 | BifrostController가 이미 17개 컨트롤러 관리 중, AI 상태 추가 시 복잡도 폭증. getApi()로 기존 컨트롤러 호출하는 구조가 침습도 최소 |
| 구현 순서 | Phase 0→1(F1)→2(F2)→3(F3) | Phase 0→1→3→2 (리서치 제안) | Rabby 420만 사용자 킬러 피처가 시뮬레이션(F2). 가스 최적화(F3)는 기존 컨트롤러 확장이라 후순위 리스크 낮음 |
| LLM 통신 | LLM Proxy Server 독립 서비스 | Extension 직접 API 호출 | API 키 extension 노출 절대 금지 (보안 필수) |
| 보안 모드 | Approval Mode Only (v1) | Agent Mode (자율 실행) | 암호화폐 지갑 특성상 v1은 사용자 승인 필수. Agent Mode는 v2 |
| UI 패턴 | Bottom-fixed Command Bar + BottomSheet | 별도 탭 분리 | 400×600 제약 대응 + 1-tap 접근성 |

## 아키텍처
```
[Popup UI — Command Bar + BottomSheet]
    ↓
[LLM Proxy Server] (독립 서비스, Express/Hono)
    ↓
[AIIntentBridge] (서비스 레이어, 컨트롤러 아님)
    ├── Zod 스키마 재검증
    ├── SecurityGuard (spending policy + prompt injection + address validation)
    └── Intent Router → getApi() → 기존 컨트롤러들
    ↓
[Transaction Simulator] → notification window 인라인
    ↓
[사용자 승인] → [블록체인 실행]
```

## 구현 범위

### 포함 — Phase 0: 인프라 (Homer) ✅ 완료
- [x] LLM Proxy Server 셋업 (Express/Hono, Claude API function calling)
- [x] AIIntentBridge 서비스 레이어 구현 (getApi()로 기존 컨트롤러 호출)
- [x] SecurityGuard 구현 (SpendingPolicy, Prompt Injection 4-Layer 방어, Address Validation)
- [x] Zod 스키마 정의 (intent: action, token, amount, to, chain)
- [x] 감사 로그 (AI intent → 실행 결과 매핑)

### 포함 — Phase 1: F1 자연어 트랜잭션 (Krusty 디자인 → Bart 구현) ✅ 완료
- [x] Command Bar UI (Home 하단 고정, Extension Scale 토큰 적용)
- [x] BottomSheet 확장 대화형 (snapPoints [0.3, 0.85], globalBottomSheetAtom 재활용)
- [x] 자연어 입력 → LLM Proxy → structured intent → 컨트롤러 호출 플로우
- [x] AI 파싱 결과 표시 UI (토큰, 금액, 수신자, 체인 확인)
- [x] 에러 시 자연어 에러 메시지 반환

### 포함 — Phase 2: F2 트랜잭션 리스크 시뮬레이션 (Krusty 디자인 → Bart 구현) ✅ 완료
- [x] eth_call 기반 로컬 시뮬레이션
- [x] notification window 인라인 오버레이 (잔액 변화 미리보기)
- [x] AI 리스크 스코어 (Safe=#2fac68 / Caution=#FFB600 / Danger=#ff474c)
- [x] 비정상 approval, 스캠 주소, 과도한 가스 감지

### 포함 — Phase 3: F3 스마트 가스 최적화 (Bart) ✅ 완료
- [x] 기존 gas-fee-controller 확장
- [x] 과거 블록 가스 통계 분석 → 최적 타이밍 추천
- [x] EIP-1559 maxFeePerGas 자동 튜닝
- [x] 가스 프리셋 UI (빠름/보통/절약)

### 제외 (이번에 안 함)
- DCA/자동매매 (v1.1)
- AI 포트폴리오 인사이트 (v1.1)
- 토큰 안전성 스코어링 (v1.1)
- 크로스체인 브릿지 어드바이저 (v2)
- Agent Mode 자율 실행 (v2)
- MPC, HSM 보안 (v2)

## 인수 조건 (Acceptance Criteria)

### Happy Path
- [x] Given 사용자가 Command Bar에 "0.5 ETH를 0xabc...로 보내줘" 입력 When AI가 파싱 Then BottomSheet에 {action: send, token: ETH, amount: 0.5, to: 0xabc...} 확인 UI 표시
- [x] Given 사용자가 "확인" 클릭 When 트랜잭션 생성 Then notification window에 시뮬레이션 결과(잔액 변화) + 리스크 스코어 표시
- [x] Given 리스크 스코어 Safe When 사용자 서명 Then 트랜잭션 정상 실행 + 결과 표시
- [x] Given "USDC를 ETH로 스왑" 입력 When AI 파싱 Then swap 컨트롤러로 라우팅 + 스왑 확인 UI
- [x] Given 가스 최적화 활성화 When 트랜잭션 생성 Then 최적 가스 프리셋 자동 선택 + 타이밍 추천

### 에러 케이스 (필수)
- [x] Given 파싱 불가능한 입력 When AI 처리 실패 Then 자연어 에러 메시지 반환 ("이해하지 못했습니다. '0.5 ETH를 주소로 보내줘' 형식으로 입력해주세요")
- [x] Given LLM Proxy 서버 다운 When 사용자 입력 Then "AI 서비스에 연결할 수 없습니다" 에러 + 기존 수동 전송 UI로 폴백
- [x] Given SpendingPolicy 초과 (perTxLimit) When 트랜잭션 시도 Then "1회 한도 초과" 경고 + 트랜잭션 차단
- [x] Given 알려진 스캠 주소 When 시뮬레이션 Then Danger 리스크 스코어 + 강력 경고 UI
- [x] Given Prompt Injection 시도 When 입력 검증 Then 4-Layer 방어로 차단 + 감사 로그 기록

### 엣지 케이스
- [x] Given 잔액 부족 When 전송 시도 Then "잔액이 부족합니다. 현재 잔액: X ETH" 메시지
- [ ] Given ENS/도메인 주소 입력 When 주소 해석 Then 정상 resolve + 확인 UI에 resolved 주소 표시
- [x] Given 동시 다중 AI 요청 When 큐잉 Then 순차 처리 + "이전 요청 처리 중" 표시

## 참조 파일
- `bifrost-controller.ts` — 중앙 오케스트레이터, getApi() 패턴
- `ExternalRequestController` — RPC 요청 라우팅 패턴 참조
- `gas-fee/` — 기존 가스 추정 로직 (F3 확장 대상)
- `swap/` — DEX 스왑 오케스트레이션 (F1 스왑 연동)
- `globalBottomSheetAtom` — 기존 BottomSheet 인프라 (UI 재활용)

## 성공 기준
- [x] Happy Path AC 전체 통과
- [x] 에러 케이스 AC 전체 통과
- [x] Command Bar → 자연어 입력 → 시뮬레이션 → 승인 → 실행 전체 플로우 E2E 동작
- [x] LLM Proxy 서버 독립 실행 + extension 연동 정상
- [x] SecurityGuard가 SpendingPolicy 초과/스캠 주소/Prompt Injection 차단 확인
- [x] 400×600 뷰포트에서 UI 깨짐 없음

## 메모
- 이전 pockie-wallet AI agent 이력 무시, 처음부터 새로 개발 (sid 지시)
- Homer 안 채택: AIIntentBridge를 BifrostController 서브컨트롤러가 아닌 별도 서비스 레이어로 분리
- Bart 안 채택: F2(시뮬레이션)을 F3(가스)보다 먼저 구현
- Wiggum 안 수용: Phase 0에 보안 인프라 강화, v1 범위 초과 항목은 v2
