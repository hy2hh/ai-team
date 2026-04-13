# 회의 결정: pockie-wallet-extension AI Agent 기능 설계 — v1 구현 범위 확정 및 아키텍처 결정
> 회의 ID: 19
> 유형: architecture
> 일시: 2026-04-13T05:13:53.209Z
> 참여자: designer, frontend, backend, secops

## 의견 요약
### designer
## 1. 핵심 의견

v1 스코프 3개 기능에 *동의*합니다. 다만 400×600px 뷰포트는 일반 모바일(360×800+)보다 세로가 37% 짧아서, 토스 디자인 시스템의 spacing·컴포넌트 높이를 *Extension Scale*로 재조정해야 합니다. Command Bar + BottomSheet 구조는 토스 철학("한 화면, 한 목적")과 정확히 부합하며, 바텀시트 snap-point 패턴은 토스 앱의 핵심 인터랙션과 일치합니다.

---

## 2. 근거 — UI/UX 상세 설계

### 2-1. Extension Scale 토큰 조정 (400×600 제약)

일반 토스 토큰을 그대로 적용하면 CTA 54px + 하단 탭바 56px = 110px로 뷰포트의 18%를 차지합니다. Extension용 축소 토큰을 제안합니다:

| 토큰 | 기본 토스값 | Extension Scale | 근거 |
| --- | --- | --- | --- |
| CTA height | 54px
### frontend
## 🖥️ Bart 프론트엔드 의견 — pockie-wallet AI Agent v1

---

### 1. 핵심 의견

v1 스코프 3개 기능(F1 자연어 tx, F2 리스크 시뮬레이션, F3 가스 최적화)에 *전면 동의*합니다. 기존 코드베이스를 직접 확인한 결과, 22개 컨트롤러·26개 BottomSheet·Jotai 31개 atom 인프라가 이미 성숙해 있어 AI 기능 통합 비용이 낮습니다. 다만 *구현 순서를 Phase 0→1→3→2로 변경*할 것을 제안합니다 — F2(시뮬레이션)가 F3(가스 최적화)보다 UX 임팩트가 크고, notification window 기존 플로우에 자연스럽게 병합됩니다.

---

### 2. 아키텍처 의견

리서치 제안 아키텍처에 대체로 동의하되, 프론트엔드 관점에서 수정/보강 사항:

*동의:*
• `AIController`를 `BifrostController` 서브컨트롤러로 추가 — `bifrost-controller.ts`가 이미 중앙 
### backend
코드베이스를 직접 분석한 결과를 바탕으로 백엔드 아키텍처 의견을 제시합니다.

---

*1. 핵심 의견*

v1 스코프 3개 기능에 동의합니다. 다만 리서치 제안의 `AIController`를 BifrostController 서브컨트롤러로 넣는 구조는 *반대*합니다. AI 레이어는 기존 컨트롤러를 *호출하는 별도 계층*으로 분리해야 합니다. 이유: BifrostController가 이미 17개 컨트롤러를 관리하며 `AllControllerState` 타입이 17개 상태를 합성 중(`bifrost-controller.ts:98-118`)이고, 여기에 AI 상태까지 얹으면 복잡도가 과도합니다.

---

*2. 아키텍처 수정 제안*

```
[LLM Proxy Server]  ← 신규 독립 서비스 (Express/Hono)
    │
[Extension Background]
    ├── AIIntentBridge (신규) ← LLM proxy와 통신, intent 파싱
    │  
### secops
# 🔒 Wiggum SecOps 의견 — pockie-wallet-extension AI Agent v1

## 1. 핵심 의견

v1 스코프 3개 기능에 *동의*합니다. 특히 Approval Mode Only 정책과 LLM Proxy Server 분리는 보안 관점에서 올바른 출발점입니다. 다만 제안된 4-Layer Prompt Injection 방어와 SpendingPolicy만으로는 *암호화폐 지갑의 위협 수준에 비해 불충분*하며, Phase 0에서 보안 인프라를 더 강화해야 합니다. 특히 *자연어→트랜잭션 변환 경로*는 공격 표면이 넓어 단일 실패 지점(Single Point of Failure)이 되지 않도록 다층 검증이 필수입니다.

## 2. 근거 — STRIDE 위협 분석

### 2-1. v1 공격 표면 매핑

```
[사용자 입력] → [LLM Proxy] → [AIController] → [기존 Controller] → [블록체인 TX]
     ①        

## 최종 결정
*[회의 #19 종합] pockie-wallet AI Agent v1 — 결정 사항*

*1. 전원 합의 (변경 없음)*
• v1 스코프: F1(자연어 tx) + F2(리스크 시뮬레이션) + F3(가스 최적화) — 4인 전원 동의
• UI: Bottom-fixed Command Bar + BottomSheet 확장 — Krusty·Bart 합의, 기존 `globalBottomSheetAtom` 인프라 재활용
• 보안: LLM Proxy Server 분리 + Approval Mode Only (v1) — 4인 전원 동의
• Krusty의 Extension Scale 토큰 조정 (CTA 48px, Input 44px 등) — 400×600 제약 대응 필수

*2. 충돌 해소*

*충돌 A: AI 레이어 배치*
• 리서치 제안: `AIController`를 BifrostController 서브컨트롤러로 추가
• Homer 반대: BifrostController가 이미 17개 컨트롤러 관리 중, AI 상태까지 얹으면 과부하. `AIIntentBridge`를 별도 서비스 레이어로 분리 제안

→ *결정: Homer 안 채택.* 근거 — BifrostController의 `AllControllerState`가 17개 상태를 합성 중인 상태에서 AI 상태 추가는 복잡도 폭증. AIIntentBridge가 `getApi()`를 통해 기존 컨트롤러를 호출하는 구조가 침습도 최소화 + 테스트 격리에 유리.

*충돌 B: 구현 순서*
• 리서치: Phase 0→1(F1)→2(F3 가스)→3(F2 시뮬레이션)
• Bart: Phase 0→1(F1)→2(F2 시뮬레이션)→3(F3 가스) — F2가 UX 임팩트 더 크고 notification window에 자연스럽게 병합

→ *결정: Bart 안 채택.* 근거 — Rabby 420만 사용자의 킬러 피처가 시뮬레이션. 가스 최적화는 기존 컨트롤러 확장이라 후순위로 밀려도 리스크 낮음.

*충돌 C: 보안 강도*
• Wiggum: 4-Layer 방어 + SpendingPolicy만으로는 불충분. STRIDE 분석 결과 6개 공격 지점 존재, Phase 0에서 보안 인프라 강화 필요

→ *결정: Wiggum 안 수용.* Phase 0에 SecurityGuard + Zod 스키마 재검증 + Address Poisoning 방어 + 감사 로그 포함. 단, v1 범위를 넘는 항목(MPC, HSM 등)은 v2로 이관.

*3. 최종 아키텍처*
```
[Popup UI — Command Bar + BottomSheet]
    ↓
[LLM Proxy Server] (독립 서비스)
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

*4. 구현 순서*
• Phase 0: LLM Proxy + AIIntentBridge + SecurityGuard (Homer)
• Phase 1: Command Bar UI + BottomSheet + 자연어 tx 프론트 (Krusty 디자인 → Bart 구현)
• Phase 2: 트랜잭션 시뮬레이션 + 리스크 UI (Krusty 디자인 → Bart 구현)
• Phase 3: 가스 최적화 (기존 컨트롤러 확장, Bart)

이 결정대로 Feature Spec 작성 후 `delegate_sequential`로 구현 체인 시작하겠습니다.