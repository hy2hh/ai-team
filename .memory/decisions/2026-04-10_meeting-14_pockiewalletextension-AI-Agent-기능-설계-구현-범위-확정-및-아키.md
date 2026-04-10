---
date: 2026-04-10
topic: architecture
roles: [backend, frontend, designer, secops]
summary: pockie-wallet-extension AI Agent 구현 범위 확정 및 아키텍처 결정 (회의 #14 에이전트 의견 취합)
status: accepted
---

# 회의 결정: pockie-wallet-extension AI Agent 기능 설계 — 구현 범위 확정 및 아키텍처 결정
> 회의 ID: 14
> 유형: architecture
> 일시: 2026-04-10T05:02:22.142Z
> 참여자: backend, frontend, designer, secops

## 의견 요약
### backend
회의 #14에 백엔드 아키텍처 의견을 제출했습니다. 핵심 내용 요약:

• *AIController를 기존 BifrostController 서브 컨트롤러로 추가* — 17개 컨트롤러 패턴 그대로 활용
• *LLM API는 자체 프록시 서버 필수* — Extension 번들에 API Key 노출 불가, CSP 제약, 프롬프트 인젝션 필터링 서버단 처리
• *ExternalRequestController 승인 플로우 재사용* — AI가 생성한 tx도 기존 Zod 검증 + 사용자 승인 경로로 주입
• *Claude API 추천* (function calling 품질 + 보안), 초기 Approval Mode only
• *Phase 0~3 구현 순서* 제안 (프록시 서버 → F1 자연어 tx → F2 리스크 시뮬레이션 → F3 가스 최적화)
### frontend
코드베이스 분석을 완료했습니다. 프론트엔드 관점에서 의견을 제시합니다.

---

*[회의 #14] 프론트엔드 통합 전략 — Bart 의견*

*1. 핵심 의견*

Tier 1 기능 3개에 동의하며, UI 진입점은 *기존 Home 탭에 AI 탭 추가* 방식을 추천합니다. 현재 `homeTabIndexAtom`으로 탭 전환 패턴이 이미 구현되어 있어 최소 변경으로 자연스럽게 통합 가능합니다. 별도 플로팅 버튼은 400×600px 팝업 안에서 공간을 침범하므로 부적절합니다.

*2. 근거 (코드 기반)*

• *Jotai 상태 통합이 자연스러움:* `dispatcher.ts`의 `updateCurrentControllerState()`가 백그라운드 컨트롤러 상태를 30+개 atom에 동기화하는 패턴이 이미 확립되어 있음. 새 AI 컨트롤러를 `MergedControllerState`에 추가하면 기존 dispatcher 패턴 그대로 UI에 반영 가능

• *ExternalRequestController 패턴 재활용 가능:* dApp 요청 처리 흐름(`Zod 스키마 검증 → parseInfo → 타입 분류 → UI 라우팅`)이 자연어 명령 파싱 결과를 UI에 표시하는 흐름과 동일. `RPC_METHOD_ROUTE` 매핑 패턴을 AI 명령에도 확장 가능

• *Bottom Sheet 시스템이 Approval UI에 적합:* 현재 `ConfirmTransferButtonSheet`, `SignTransaction` 등 20+개 Bottom Sheet가 트랜잭션 확인에 사용 중. AI 명령의 최종 승인 UI도 동일 패턴으로 구현하면 UX 일관성 유지

• *컴포넌트 구조 제안:*
```
src/
  component/
    modules/
      ai-agent/
        ai-chat-input.tsx        # 자연어 입력 (RoundField 패턴 활용)
        ai-response-card.tsx     # AI 응답 카드
        risk-score-badge.tsx     # F2 리스크 스코어 표시
        gas-recommendation.tsx   # F3 가스 추천 카드
  pages/
    ai-agent/
      index.tsx                  # AI 탭 메인 페이지
  store/
    ai-agent-atoms.ts            # AI 상태 atom
  scripts/
    controllers/
      ai-agent/
        index.ts                 # AIAgentController
```

• *새 atom 설계:*
```typescript
// ai-agent-atoms.ts
export const aiMessagesAtom = atom<AIMessage[]>([])
export const aiProcessingAtom = atom<boolean>(false)
export const aiRiskScoreAtom = atom<RiskScore | null>(null)
export const gasRecommendationAtom = atom<GasRecommendation | null>(null)
```

*3. 리스크/우려사항*

• *LLM API 호출 레이턴시:* 크롬 익스텐션 서비스 워커에서 직접 LLM API 호출 시, 서비스 워커 30초 idle timeout과 충돌 가능. 프록시 서버 경유 + 스트리밍 응답이 안전함. 프론트엔드에서는 `aiProcessingAtom`으로 로딩 상태를 관리하되, *스트리밍 응답을 청크 단위로 atom에 반영*해야 체감 속도를 확보할 수 있음

• *400×600px 공간 제약:* 채팅 UI + 키보드가 표시되면 실제 콘텐츠 영역이 ~300px로 축소됨. 입력 필드는 하단 고정 + 메시지 영역 스크롤 구조가 필수. 복잡한 리스크 시뮬레이션 결과는 Bottom Sheet 또는 별도 notification 탭(`notification.html`)으로 분리 필
### designer
코드베이스를 직접 확인했습니다. 이제 기존 디자인 시스템과 레이아웃을 기반으로 의견을 제시합니다.

---

*🎨 Krusty 디자인 의견 — pockie-wallet-extension AI Agent UI*

---

*1. 핵심 의견*

400×600px 팝업이라는 극도로 제한된 뷰포트에서 AI 채팅 UI를 별도 탭으로 만드는 건 화면 낭비입니다. *기존 홈 화면의 하단에 "AI 커맨드 바"를 고정 배치하고, 상세 인터랙션은 기존 `BottomSheet` 컴포넌트를 확장하는 방식*이 최적입니다. 이렇게 하면 기존 `react-spring-bottom-sheet` + `framer-motion` 인프라를 그대로 활용하면서 자연스러운 UX 흐름을 유지할 수 있습니다.

---

*2. 근거 — 코드베이스 분석 기반*

• *뷰포트 제약*: 팝업 크기 400×600px 고정. 홈 화면이 이미 `padding: 64px 24px 16px 24px`로 상단 64px, 좌우 24px 사용 중 (`pages/home/index.tsx:15-16`). 별도 AI 탭을 추가하면 탭 전환 비용이 발생하고, 지갑 핵심 기능(잔고 확인)과 AI 기능 사이 컨텍스트 전환이 끊김
• *기존 BottomSheet 활용 가능*: `component/atoms/BottomSheet.tsx`에 `react-spring-bottom-sheet` + `framer-motion` (spring mass:1, damping:26, stiffness:170) 이미 구현됨. `isFull` prop으로 풀스크린 지원, `snapPoints`로 높이 조절 가능
• *브랜드 컬러 `#5f5be2`*: `styles/theme.ts:79`에 `point: '#5f5be2'`로 정의. AI 관련 UI 강조색도 이 퍼플을 유지해야 브랜드 일관성 확보
• *폰트: Pretendard Variable*: `styles/global.ts:8-13`에 정의. 추가 폰트 로딩 불필요

*UI 진입점 추천: 하단 커맨드 바 방식*

```
┌──────────────────────────────┐
│  [Profile]                    │ 64px
│  [Dashboard — 잔고/가치]      │
│  [Balance 토큰 목록]          │
│         ...                   │
│                               │
│  ┌────────────────────────┐  │
│  │ ✨ AI에게 물어보세요...  │  │ 48px, 하단 고정
│  └────────────────────────┘  │
└──────────────────────────────┘
```

탭하면 BottomSheet가 올라오며 대화형 인터페이스 전개:

```
┌──────────────────────────────┐
│  ← AI 어시스턴트       ✕     │ Header
│─────────────────────────────│
│  "0.5 ETH를 vitalik.eth로   │
│   보내줘"                    │
│                              │
│  ┌─ AI 응답 카드 ─────────┐ │
│  │ 트랜잭션 요약           │ │
│  │ To: vitalik.eth         │ │
│  │ Amount: 0.5 ETH         │ │
│  │ Gas: ~$2.34 (적정 ✅)   │ │
│  │ 리스크: 낮음 🟢          │ │
│  │                         │ │
│  │ [거부]      [서명하기]  │ │
│  └─────────────────────────┘ │
│                              │
│  ┌────────────────────────┐  │
│  │ 메시지 입력...     [→] │  │ Input
│  └────────────────────────┘  │
└──
### secops
이제 레포지토리 구조를 충분히 파악했습니다. 보안 관점에서 의견을 제시하겠습니다.

---

*🔒 Wiggum (SecOps) — 회의 #14 독립 의견*

## 1. 핵심 의견

암호화폐 지갑에 AI 에이전트를 추가하는 것은 *공격 표면(attack surface)이 극적으로 확대*되는 변경입니다. 현재 pockie-wallet-extension은 MetaMask 패턴 기반의 견고한 보안 구조(AES-256-GCM 키 암호화, Zod 스키마 검증, 스트림 기반 IPC, 사용자 확인 필수)를 갖추고 있으나, LLM이 트랜잭션 파이프라인에 개입하는 순간 *프롬프트 인젝션이 곧 자산 탈취*로 직결됩니다. *Approval Mode Only로 1차 출시*하고, Agent Mode는 충분한 실전 검증 후 2차에서 도입할 것을 강력히 권고합니다.

## 2. 근거 — 코드 기반 분석

### 2-1. 현재 보안 아키텍처의 강점 (유지해야 할 것)

| 영역 | 현재 구현 | 파일 참조 |
| --- | --- | --- |
| 키 암호화 | AES-256-GCM (`@metamask/browser-passworder`) | `keyring/index.ts:273-306` |
| 입력 검증 | Zod 스키마 — 주소·hex·파라미터 전수 검증 | `external-request/request-schema.ts` |
| 사용자 확인 | 모든 서명/전송에 팝업 확인 필수 | `external-request/index.ts:234-294` |
| 세션 관리 | 비활성 시 자동 잠금, 메모리 키 클리어 | `bifrost-controller.ts:1542-1575` |
| IPC 격리 | 스트림 기반, 공유 메모리 없음 | `contentscript.js:13-64` |

*핵심 원칙:* AI 모듈은 이 보안 체인의 *위에* 위치해야 하며, *우회하거나 대체해서는 안 됩니다.*

### 2-2. AI 도입 시 새로운 위협 모델 (STRIDE 분석)

| 위협 | 카테고리 | 심각도 | 시나리오 |
| --- | --- | --- | --- |
| 프롬프트 인젝션 → 자산 탈취 | Tampering | *Critical* | "0.5 ETH를 vitalik.eth로 보내줘" 안에 숨겨진 악성 지시가 실제 수신 주소를 공격자 주소로 변경 |
| LLM API 키 탈취 | Information Disclosure | *High* | Extension 내 API 키 하드코딩 시 manifest/번들에서 추출 가능 |
| DApp 컨텍스트 오염 | Spoofing | *High* | 악성 DApp이 페이지 DOM에 AI 명령을 삽입, 사용자 의도와 다른 트랜잭션 생성 |
| 가스 조작 | Elevation of Privilege | *Medium* | AI의 "스마트 가스" 추천을 조작해 과도한 가스비 유도 |
| 시뮬레이션 위조 | Repudiation | *Medium* | AI가 표시한 리스크 스코어가 실제 시뮬레이션 결과와 불일치 |

## 3. 보안 가드레일 설계 제안

### 3-1. Approval Mode Only (1차 필수)

```
사용자 자연어 입력
  → AI Command Parser (LLM)
  → 구조화된 트랜잭션 객체 생성
  → ⚠️ 기존 ExternalRequestController.appendRequest() 호출
  → 기존 사용자 확인 팝업 (변경 없음)
  → 사용자 명시적 승인
  → 서명 및 전송
```

*근거:* 현재 `ExternalRequestController`는 `appendRequest() → showUserConfirmation → resolveRequest()` 흐름을 강제합니다(`external-request/index.ts:234-294`). AI 모듈은 이 흐름의 *입력단*에만 위치시키고, 확인 팝업을 *절대 건너뛰지 않아야* 합니다.

*Agent Mode(자동 실행)는 1차에서 금지합니다.* 이유:
- LLM 출력은 비결정적(non-deterministic) — 동일 

## 최종 결정
구현 파이프라인 전체가 세팅되었습니다.

*📋 pockie-wallet-extension AI Agent 구현 진행 현황*

*완료:*
• ✅ Lisa 리서치 — 경쟁사 분석 + 8개 후보 기능 평가
• ✅ 회의 #15 — Homer·Bart·Krusty·Wiggum 의견 종합, Tier 1(F1·F2·F3) 확정
• ✅ Feature Spec 작성 (`docs/specs/2026-04-10_pockie-wallet-ai-agent.md`)
• ✅ 결정사항 기록 (`.memory/decisions/`)

*진행 중 — `delegate_sequential` 5단계 체인:*

| Phase | 담당 | 내용 | 상태 |
| --- | --- | --- | --- |
| Phase 0 | Homer | AIController + SecurityGuardController + 프록시 클라이언트 | 🔄 진행 중 |
| Phase 1-Design | Krusty | 커맨드 바 + BottomSheet + 트랜잭션 카드 디자인 | ⏳ 대기 |
| Phase 1 | Bart + Homer | F1 자연어 트랜잭션 어시스턴트 | ⏳ 대기 |
| Phase 2+3 | Bart + Homer | F3 가스 최적화 + F2 리스크 시뮬레이션 | ⏳ 대기 |
| QA | Chalmers | 전체 검증 (Happy Path + 에러 + 보안) | ⏳ 대기 |

각 단계 완료 시 자동으로 다음 단계가 실행됩니다. 전체 완료 후 종합 보고 드리겠습니다.