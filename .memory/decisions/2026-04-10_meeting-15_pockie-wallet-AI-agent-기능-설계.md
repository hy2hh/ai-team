---
date: 2026-04-10
topic: product
roles: [backend, frontend, designer, secops]
summary: pockie-wallet AI Agent Tier 1 기능 설계 — 자연어 tx·리스크 시뮬레이션·가스 최적화 (회의 #15)
status: accepted
---

# 회의 #15 — pockie-wallet-extension AI Agent 기능 설계

- **날짜**: 2026-04-10
- **참여자**: Homer(Backend), Bart(Frontend), Krusty(Designer), Wiggum(SecOps)
- **주제**: 암호화폐 지갑에 AI 에이전트 기능 추가 — 구현 범위 확정 및 아키텍처 결정

## 전원 합의

1. **구현 범위**: Tier 1 — F1(자연어 트랜잭션), F2(리스크 시뮬레이션), F3(가스 최적화)
2. **보안 모드**: Approval Mode Only (Agent Mode는 v1 제외)
3. **LLM 호출**: 프록시 서버 경유 필수 — Extension 번들 내 API 키 노출 금지
4. **아키텍처**: AIController를 BifrostController 서브 컨트롤러로 추가
5. **승인 플로우**: AI 생성 트랜잭션도 기존 ExternalRequestController 경로 사용
6. **LLM 출력 검증**: 기존 Zod 스키마(request-schema.ts)로 재검증

## PM 결정

### UI 진입점: 커맨드 바 + BottomSheet (Krusty안 채택)
- 400×600px 팝업에서 탭 전환은 잔고 정보를 숨김
- 커맨드 바는 AI 기능 발견성이 높음
- 기존 react-spring-bottom-sheet + framer-motion 인프라 활용
- snapPoints 2단계(반접힘/펼침)로 공간 효율 확보

### 구현 순서: F1→F3→F2 (Bart안 채택)
- F1이 전체 파이프라인(입력→파싱→컨트롤러→승인→실행) 구축
- F3은 GasFeeController 연결만 추가하면 완성
- F2(리스크 시뮬레이션)는 시뮬레이션 API + UI가 가장 복잡하므로 마지막

## 구현 Phase

### Phase 0 — 기반 (Homer)
- AI 프록시 서버 셋업 (Claude API)
- AIController + SecurityGuardController 스캐폴딩
- ExternalRequestController 승인 플로우 연결
- 지출 한도(perTx/daily/whitelist) 하드코딩

### Phase 1 — F1 자연어 트랜잭션 (Krusty→Bart+Homer)
- Krusty: 커맨드 바 + BottomSheet + 트랜잭션 요약 카드 디자인
- Bart: AI 채팅 UI, atom 설계, 컨트롤러 상태 동기화
- Homer: AI Command Parser, intent→controller 라우팅

### Phase 2 — F3 가스 최적화 (Bart+Homer)
- Homer: GasFeeController 확장, 히스토리컬 가스 데이터 분석
- Bart: 가스 추천 인라인 UI

### Phase 3 — F2 리스크 시뮬레이션 (Bart+Homer)
- Homer: tx simulation API 연동, 리스크 스코어링 엔진
- Bart: 리스크 스코어 바, 3단계 컬러 경고

### 보안 (전 Phase 관통 — Wiggum)
- 프롬프트 인젝션 4계층 방어 (L1~L4)
- AI 트랜잭션 구분 태깅 + 감사 로그
- SecurityGuardController 코드 리뷰

## 보안 가드레일 (Wiggum 제안 전체 채택)

### SpendingPolicy
- perTxLimit, dailyLimit, dailyTxCount, whitelistOnly, allowedMethods
- 한도 변경은 사용자 비밀번호 재입력 필수
- AI/사용자 트랜잭션 구분 태깅

### 프롬프트 인젝션 방어 (4계층)
- L1: 입력 정규화 (제어문자, 유니코드 트릭 제거)
- L2: 구조적 분리 (system/user prompt API-level 격리)
- L3: 출력 검증 (Zod 스키마 재검증)
- L4: 의미론적 검증 (파싱 결과 vs 원문 일치 확인)

## 기술 스택 결정
- LLM: Claude API (function calling 품질 + 보안)
- UI: 커맨드 바 + BottomSheet (react-spring-bottom-sheet)
- 상태: Jotai atom (aiMessagesAtom, aiProcessingAtom 등)
- 스타일: 브랜드 컬러 #5f5be2, Pretendard Variable
- 리스크 컬러: #2fac68(안전) / #FFB600(주의) / #ff474c(위험)
