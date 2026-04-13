# pockie-wallet-extension AI Agent — Phase 2 & 3 UI/UX 상세 설계

**작성자**: Krusty (Designer)  **날짜**: 2026-04-13
**대상**: Bart (Frontend) 핸드오프용 구현 스펙
**CSS 토큰 파일**: `src/styles/ai-design-tokens.ts` (기존 파일 확장)
**기존 Phase 1 참조**: `src/component/modules/AI/` 전체

---

## 설계 원칙

- *기존 pockie 색상 체계 유지* — `theme.colors.point (#5f5be2)`, `theme.colors.dark`, `theme.colors.light300` 등
- *Extension Scale 토큰 유지* — 400×600 뷰포트 제약, Phase 1에서 정의한 `AI_SIZING` 그대로 사용
- *한 화면 한 목적* — 시뮬레이션 결과는 notification window 인라인, 가스 최적화는 기존 GasFeeBottomSheet 내 삽입
- *모달 금지, 바텀시트 우선* — 경고도 인라인 또는 바텀시트
- *Spinner 금지* — Skeleton shimmer만 허용

---

## Phase 2 — F2 트랜잭션 리스크 시뮬레이션 UI

### 2-1. 전체 플로우

```
사용자 "확인" 클릭 (IntentPreviewCard)
    ↓
SimulationLoadingOverlay (Skeleton shimmer, notification window 내)
    ↓
eth_call 시뮬레이션 완료
    ↓
SimulationOverlay (notification window 인라인)
  ├── RiskScoreHeader (Safe/Caution/Danger 비주얼)
  ├── BalanceChangeCard (잔액 변화 미리보기)
  ├── AnomalyWarningList (이상 감지 경고 — 조건부)
  └── SimulationCTABar (서명/취소)
```

### 2-2. SimulationOverlay — notification window 인라인 오버레이

> 별도 팝업/모달 금지. notification window 콘텐츠 영역에 직접 렌더링.

| 속성 | 값 | 비고 |
|------|---|------|
| 위치 | notification window 콘텐츠 영역 전체 | `position: absolute; inset: 0` |
| 배경 | `#FFFFFF` | 기존 notification window 배경과 동일 |
| z-index | `AI_ZINDEX.simulationOverlay` (150) | 기존 토큰 사용 |
| 등장 모션 | `opacity: 0 → 1`, `y: 12 → 0` | `AI_MOTION.springCard` |
| 내부 패딩 | `16px` (Extension Scale cardPadding) | `AI_SIZING.cardPadding` |
| 스크롤 | `overflow-y: auto` | 경고 항목 많을 때 스크롤 |

### 2-3. RiskScoreHeader — 리스크 레벨 비주얼

상단 고정 영역. 리스크 레벨에 따라 *전체 배경색*이 바뀌는 헤더.

| 속성 | Safe | Caution | Danger |
|------|------|---------|--------|
| 배경 | `AI_RISK_COLORS.safe.background` (`#e8f5ee`) | `AI_RISK_COLORS.caution.background` (`#fff8e0`) | `AI_RISK_COLORS.danger.background` (`#ffebec`) |
| 아이콘 | `CheckCircle` (lucide) | `AlertTriangle` (lucide) | `ShieldAlert` (lucide) |
| 아이콘 색상 | `#2fac68` | `#FFB600` | `#ff474c` |
| 아이콘 크기 | `32px` | `32px` | `32px` |
| 레벨 텍스트 | "안전" | "주의 필요" | "위험 감지" |
| 텍스트 스타일 | `AI_TYPOGRAPHY.cardTitle` (16px/700) | 동일 | 동일 |
| 텍스트 색상 | `#2fac68` | `#cc9200` | `#ff474c` |
| 설명 텍스트 | "이 트랜잭션은 안전합니다" | "일부 주의사항이 있습니다" | "위험한 트랜잭션입니다" |
| 설명 스타일 | `AI_TYPOGRAPHY.caption` (12px/400) | 동일 | 동일 |
| 설명 색상 | `theme.colors.dark200` | 동일 | 동일 |
| 패딩 | `16px` | 동일 | 동일 |
| radius | `AI_SIZING.cardRadius` (16px) | 동일 | 동일 |
| 높이 | auto (콘텐츠 기반) | 동일 | 동일 |
| 아이콘 모션 | Safe: `scale(0 → 1)` spring | Caution: `rotate(-15 → 0)` spring | Danger: `shake` (x: [-4, 4, -4, 0]) 200ms |

**레이아웃**: 세로 중앙 정렬
```
┌─────────────────────────────────────┐
│  [아이콘 32px]                       │
│  안전                                │
│  이 트랜잭션은 안전합니다              │
└─────────────────────────────────────┘
```

### 2-4. BalanceChangeCard — 잔액 변화 미리보기

> 기존 `SimulationResultCard`의 `BalanceChangeList` 섹션을 독립 카드로 리팩토링.

| 속성 | 값 |
|------|---|
| 배경 | `theme.colors.white` |
| radius | `AI_SIZING.cardRadius` (16px) |
| 패딩 | `AI_SIZING.cardPadding` (16px) |
| border | `1px solid ${theme.colors.lightline}` (기존 패턴 유지) |
| 제목 | "잔액 변화 미리보기" |
| 제목 스타일 | `AI_TYPOGRAPHY.cardTitle` (16px/700), `theme.colors.dark` |
| 간격 (제목↔리스트) | `12px` |

**각 토큰 행 (BalanceChangeRow)**:

| 속성 | 값 |
|------|---|
| 배경 | `theme.colors.light300` (`#f2f0ff`) |
| radius | `AI_SIZING.inputRadius` (12px) |
| 패딩 | `8px 12px` |
| 행 간격 | `AI_SIZING.itemGap` (8px) |
| 토큰 이름 | `AI_TYPOGRAPHY.bodyEmphasis` (14px/600), `theme.colors.dark` |
| 변화량 (+/-) | `AI_TYPOGRAPHY.bodyEmphasis` (14px/600), 양수 `#2fac68` / 음수 `#ff474c` |
| 상세 (before → after) | `AI_TYPOGRAPHY.caption` (12px/400), `theme.colors.dark200` |
| 등장 모션 | staggered, `delay: index * 120ms`, `opacity: 0→1, x: -8→0` |
| 숫자 모션 | 카운트업 — `AI_MOTION.countUp` (800ms, ease-out-expo) |

**레이아웃**:
```
┌─────────────────────────────────────┐
│ 잔액 변화 미리보기                    │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ETH          -0.5 ETH          │ │
│ │              1.2 → 0.7 ETH     │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Gas          -0.003 ETH        │ │
│ │              1.2 → 1.197 ETH   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 2-5. AnomalyWarningList — 이상 감지 경고

> 비정상 approval, 스캠 주소, 과도한 가스, 블랙리스트 컨트랙트 등 감지 시 표시.
> 경고 없으면 이 섹션 자체를 렌더링하지 않음.

| 속성 | 값 |
|------|---|
| 컨테이너 간격 | 상단 `12px` (BalanceChangeCard와의 간격) |
| 제목 | "⚠ 주의사항" (경고 1개 이상일 때만 표시) |
| 제목 스타일 | `AI_TYPOGRAPHY.bodyEmphasis` (14px/600), `#cc9200` (caution) 또는 `#ff474c` (danger) |

**각 경고 아이템 (AnomalyWarningItem)**:

| 속성 | Caution 레벨 | Danger 레벨 |
|------|-------------|-------------|
| 배경 | `AI_RISK_COLORS.caution.background` (`#fff8e0`) | `AI_RISK_COLORS.danger.background` (`#ffebec`) |
| 좌측 아이콘 | `AlertTriangle` (lucide, 16px) | `ShieldAlert` (lucide, 16px) |
| 아이콘 색상 | `#FFB600` | `#ff474c` |
| 텍스트 | `AI_TYPOGRAPHY.caption` (12px/400) | 동일 |
| 텍스트 색상 | `#cc9200` | `#ff474c` |
| radius | `AI_SIZING.badgeRadius` (8px) | 동일 |
| 패딩 | `8px 12px` | 동일 |
| 아이템 간격 | `4px` | 동일 |
| 등장 모션 | `opacity: 0→1, y: 4→0`, stagger `80ms` | 동일 |

**경고 메시지 예시**:

| 유형 | 메시지 | 레벨 |
|------|--------|------|
| 블랙리스트 컨트랙트 | "이 컨트랙트는 블랙리스트에 등록되어 있습니다" | danger |
| 무제한 approval | "무제한 토큰 승인을 요청합니다. 필요한 만큼만 승인하세요" | danger |
| 스캠 주소 | "수신 주소가 알려진 스캠 주소입니다" | danger |
| 슬리피지 과다 | "슬리피지가 5%를 초과합니다. 손실이 발생할 수 있습니다" | caution |
| 높은 가스비 | "현재 가스비가 평균 대비 200% 이상 높습니다" | caution |
| 신규 컨트랙트 | "이 컨트랙트는 배포된 지 24시간 미만입니다" | caution |

### 2-6. SimulationCTABar — 서명/취소 버튼

> notification window 하단 고정. 기존 notification window의 버튼 영역 교체.

| 속성 | 값 |
|------|---|
| 위치 | 하단 고정 (`position: sticky; bottom: 0`) |
| 배경 | `#FFFFFF` + 상단 `1px solid ${theme.colors.lightline}` |
| 패딩 | `12px 16px` |
| 레이아웃 | `flex, gap: 8px` |

**취소 버튼**:

| 속성 | 값 |
|------|---|
| flex | `1` |
| 높이 | `AI_SIZING.ctaHeight` (48px) |
| 배경 | `theme.colors.light300` |
| 텍스트 | "거부", `AI_TYPOGRAPHY.bodyEmphasis` (14px/600), `theme.colors.dark` |
| radius | `AI_SIZING.buttonRadius` (12px) |
| Hover | `theme.colors.light200` |

**서명 버튼**:

| 속성 | Safe | Caution | Danger |
|------|------|---------|--------|
| flex | `1` | `1` | `1` |
| 높이 | `48px` | `48px` | `48px` |
| 배경 | `theme.colors.point` (#5f5be2) | `#FFB600` | `#ff474c` |
| 텍스트 | "서명" | "주의 후 서명" | "위험 감수 서명" |
| 텍스트 색상 | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |
| radius | `12px` | `12px` | `12px` |
| Hover | `opacity: 0.9` | `opacity: 0.9` | `opacity: 0.9` |
| Disabled | `opacity: 0.5, cursor: not-allowed` | 동일 | 동일 |
| Loading | Skeleton shimmer (버튼 전체) | 동일 | 동일 |

**Danger 레벨 추가 UX**:
- "위험 감수 서명" 버튼은 *1.5초 long-press* 필요 (실수 방지)
- Long-press 중 원형 프로그레스 표시 (버튼 내부)
- 프로그레스 색상: `#ff474c`, 두께 `2px`
- long-press 미완료 시 탭만으로 서명 불가

### 2-7. SimulationLoadingOverlay — 로딩 상태

> 시뮬레이션 진행 중 Skeleton shimmer 표시.

| 속성 | 값 |
|------|---|
| 위치 | SimulationOverlay와 동일 위치 |
| 구조 | RiskScoreHeader 영역 + BalanceChangeCard 영역 Skeleton |
| Skeleton 색상 | `AI_COLORS.shimmerFrom` → `shimmerVia` → `shimmerTo` |
| Skeleton 주기 | `AI_MOTION.shimmerDuration` (1800ms) |
| RiskScore Skeleton | `height: 80px`, 전체 너비, `radius: 16px` |
| BalanceRow Skeleton | `height: 48px` × 2개, `radius: 12px`, 간격 `8px` |
| CTA Skeleton | `height: 48px` × 2개 (flex row), `radius: 12px` |

### 2-8. 컴포넌트 상태 매트릭스

| 컴포넌트 | Default | Loading | Error | Empty |
|----------|---------|---------|-------|-------|
| SimulationOverlay | 시뮬레이션 결과 표시 | Skeleton shimmer | "시뮬레이션 실패. 수동으로 확인하세요" + 기존 TX 확인 UI 폴백 | N/A |
| RiskScoreHeader | 레벨별 비주얼 | Skeleton (80px) | 숨김 — Error 시 OverlayError로 대체 | N/A |
| BalanceChangeCard | 토큰별 잔액 변화 | Skeleton 행 2개 | "잔액 변화를 확인할 수 없습니다" | 변화 없을 시 "잔액 변화 없음" 텍스트 |
| AnomalyWarningList | 경고 목록 | N/A | N/A | 렌더링 안 함 |
| SimulationCTABar | 서명/취소 활성 | 서명 버튼 Skeleton | 서명 비활성 + "수동 확인" 링크 | N/A |

---

## Phase 3 — F3 스마트 가스 최적화 UI

### 3-1. 전체 플로우

```
트랜잭션 생성 시
    ↓
AI 가스 분석 (백그라운드)
    ↓
GasOptimizerWidget (기존 GasFeeBottomSheet 내 상단 삽입)
  ├── AI 추천 배지 + 프리셋 그리드 (Fast/Normal/Slow)
  ├── GasDetailPanel (EIP-1559 상세)
  ├── GasSavingsIndicator (절감 금액)
  └── GasTimingHint (최적 타이밍 추천)
    ↓
Command Bar 내 GasOptimizeBadge (활성화 상태 표시)
```

### 3-2. GasOptimizerWidget — 확장 설계

> 기존 `gas-optimizer-widget.tsx`를 확장. 프리셋 그리드는 이미 구현됨.
> 추가: GasDetailPanel + GasSavingsIndicator + GasTimingHint.

**기존 유지 항목** (변경 없음):
- `WidgetWrapper`: 배경 `AI_COLORS.aiBubbleBg` (#f2f0ff), radius 16px, 패딩 12px 16px
- `AIBadge`: `theme.colors.point` 배경, 흰색 텍스트, "⚡ AI 추천"
- `PresetGrid`: 3-column grid, `AI_SIZING.itemGap` (8px) 간격
- `PresetCard`: 프리셋 선택 카드 (border 기반 선택 표시)

### 3-3. GasDetailPanel — EIP-1559 상세 표시

> 프리셋 선택 후 상세 가스 파라미터 표시. 접기/펼치기 토글.

| 속성 | 값 |
|------|---|
| 위치 | PresetGrid 하단 |
| 토글 트리거 | "상세 보기 ▾" / "접기 ▴" 텍스트 버튼 |
| 토글 텍스트 | `AI_TYPOGRAPHY.caption` (12px/400), `theme.colors.point` (#5f5be2) |
| 확장 모션 | `height: 0 → auto`, `AI_MOTION.springFast` |
| 컨테이너 | 상단 margin `8px`, 배경 없음 (부모 WidgetWrapper 배경 사용) |

**상세 필드**:

| 필드 | 라벨 | 값 형식 | 스타일 |
|------|------|---------|--------|
| Max Fee | "Max Fee" | `{value} Gwei` | 라벨: caption/dark200, 값: bodyEmphasis/dark |
| Priority Fee | "Priority Fee" | `{value} Gwei` | 동일 |
| Gas Limit | "Gas Limit" | `{value}` | 동일 |
| 예상 비용 | "예상 비용" | `~${usd} USD` | 라벨: caption/dark200, 값: bodyEmphasis/point |

**레이아웃**: 2-column grid
```
┌─────────────────────────────────────┐
│ Max Fee          12.5 Gwei          │
│ Priority Fee     2.0 Gwei           │
│ Gas Limit        21,000             │
│ 예상 비용         ~$0.42 USD         │
└─────────────────────────────────────┘
```

| 속성 | 값 |
|------|---|
| 행 높이 | `32px` (min) |
| 행 패딩 | `4px 0` |
| 구분선 | `1px solid ${theme.colors.lightline}` (마지막 행 제외) |
| 라벨 | `AI_TYPOGRAPHY.caption` (12px/400), `theme.colors.dark200` |
| 값 | `AI_TYPOGRAPHY.body` (14px/400), `theme.colors.dark` |
| 예상 비용 값 | `AI_TYPOGRAPHY.bodyEmphasis` (14px/600), `theme.colors.point` |

### 3-4. GasSavingsIndicator — 절감 금액 표시

> 히스토리 기반 예상 절감액. AI 추천 프리셋 선택 시에만 표시.

| 속성 | 값 |
|------|---|
| 위치 | GasDetailPanel 하단 (또는 PresetGrid 하단, 상세 접혀있을 때) |
| 배경 | `AI_RISK_COLORS.safe.background` (`#e8f5ee`) |
| radius | `AI_SIZING.badgeRadius` (8px) |
| 패딩 | `8px 12px` |
| 아이콘 | `TrendingDown` (lucide, 16px), `#2fac68` |
| 텍스트 | "최근 7일 평균 대비 ~$0.15 절감 예상" |
| 텍스트 스타일 | `AI_TYPOGRAPHY.caption` (12px/400), `#2fac68` |
| 금액 강조 | `AI_TYPOGRAPHY.badge` (11px/600), `#2fac68` |
| 등장 모션 | `opacity: 0→1, y: 4→0`, `AI_MOTION.springCard` |
| 숫자 모션 | 절감 금액 카운트업 — `AI_MOTION.countUp` (800ms) |

**레이아웃**:
```
┌─────────────────────────────────────┐
│ ↘ 최근 7일 평균 대비 ~$0.15 절감 예상 │
└─────────────────────────────────────┘
```

### 3-5. GasTimingHint — 최적 타이밍 추천

> 가스 가격이 높을 때 대기 추천. 선택적 표시.

| 속성 | 값 |
|------|---|
| 조건 | 현재 가스비가 7일 평균 대비 150% 이상일 때만 표시 |
| 배경 | `AI_RISK_COLORS.caution.background` (`#fff8e0`) |
| radius | `AI_SIZING.badgeRadius` (8px) |
| 패딩 | `8px 12px` |
| 아이콘 | `Clock` (lucide, 16px), `#FFB600` |
| 텍스트 | "현재 가스비가 높습니다. ~15분 후 하락 예상" |
| 텍스트 스타일 | `AI_TYPOGRAPHY.caption` (12px/400), `#cc9200` |
| 등장 모션 | `opacity: 0→1`, `AI_MOTION.springCard` |

### 3-6. GasOptimizeBadge — Command Bar 통합

> Command Bar 우측에 가스 최적화 활성 상태를 표시하는 소형 배지.

| 속성 | 값 |
|------|---|
| 위치 | Command Bar 입력 필드 우측 (기존 `point` 아이콘 영역 좌측) |
| 크기 | `24px × 24px` |
| 배경 | `theme.colors.point` (#5f5be2), `border-radius: 50%` |
| 아이콘 | `Zap` (lucide, 14px), `#FFFFFF` |
| 조건 | 가스 최적화 추천이 있을 때만 표시 |
| 탭 동작 | 가스 최적화 바텀시트 직접 열기 |
| 등장 모션 | `scale: 0→1`, `AI_MOTION.springFast` |
| 접근성 | `aria-label="가스 최적화 활성"` |

### 3-7. 가스 프리셋 선택 인터랙션 상세

**프리셋 카드 상태**:

| 상태 | border | 배경 | 스케일 |
|------|--------|------|--------|
| Default | `2px solid ${theme.colors.lightline}` | `transparent` | `1` |
| Hover | `2px solid ${theme.colors.point}` | `transparent` | `1` |
| Selected (추천) | `2px solid ${theme.colors.point}` | `theme.colors.white` | `1` |
| Selected (비추천) | `2px solid ${theme.colors.point}` | `theme.colors.white` | `1` |
| Pressed | `2px solid ${theme.colors.point}` | `theme.colors.white` | `0.97` |
| Disabled | `2px solid ${theme.colors.lightline}` | `transparent` | `1`, `opacity: 0.5` |

**선택 전환 모션**: `AI_MOTION.springFast`, border-color + background 동시 전환

### 3-8. 컴포넌트 상태 매트릭스

| 컴포넌트 | Default | Loading | Error | Empty |
|----------|---------|---------|-------|-------|
| GasOptimizerWidget | 프리셋 그리드 + AI 배지 | Skeleton (3 카드 + 배지) | "가스 분석 실패" 텍스트, 프리셋 수동 선택 가능 | 추천 없을 때 위젯 숨김 |
| GasDetailPanel | EIP-1559 필드 4개 | Skeleton 행 4개 | "상세 정보를 불러올 수 없습니다" | N/A |
| GasSavingsIndicator | 절감 금액 표시 | N/A | 숨김 | 절감 없으면 숨김 |
| GasTimingHint | 타이밍 추천 텍스트 | N/A | 숨김 | 가스비 정상이면 숨김 |
| GasOptimizeBadge | 배지 표시 | N/A | 숨김 | 추천 없으면 숨김 |

---

## 추가 디자인 토큰 (ai-design-tokens.ts 확장)

### 새로 추가할 토큰

```typescript
// ─── Phase 2: Simulation Overlay ──────────────────────────────
export const AI_SIMULATION = {
  /** RiskScoreHeader 아이콘 크기 */
  riskIconSize: 32,
  /** Danger long-press 시간 (ms) */
  dangerLongPressDuration: 1500,
  /** Danger 프로그레스 두께 */
  dangerProgressStroke: 2,
  /** 경고 아이템 아이콘 크기 */
  warningIconSize: 16,
  /** CTA 바 상단 border */
  ctaBarBorderTop: '1px solid',
} as const;

// ─── Phase 3: Gas Detail ──────────────────────────────────────
export const AI_GAS_DETAIL = {
  /** 상세 패널 행 높이 */
  rowHeight: 32,
  /** 상세 패널 행 패딩 */
  rowPadding: '4px 0',
  /** 상세 토글 상단 마진 */
  toggleMarginTop: 8,
  /** GasOptimizeBadge 크기 */
  badgeSize: 24,
  /** GasOptimizeBadge 아이콘 크기 */
  badgeIconSize: 14,
  /** 절감 인디케이터 아이콘 크기 */
  savingsIconSize: 16,
  /** 타이밍 힌트 아이콘 크기 */
  timingIconSize: 16,
} as const;
```

### 기존 토큰 변경 없음

- `AI_SIZING` — 그대로 유지
- `AI_RISK_COLORS` — 그대로 유지
- `AI_COLORS` — 그대로 유지
- `AI_MOTION` — 그대로 유지
- `AI_TYPOGRAPHY` — 그대로 유지
- `AI_ZINDEX` — 그대로 유지
- `AI_BOTTOMSHEET` — 그대로 유지

---

## 접근성 체크리스트

- [x] 모든 인터랙티브 요소: `aria-label` 필수
- [x] RiskScoreHeader: `role="status"`, `aria-live="polite"`
- [x] AnomalyWarningList: `role="alert"` (danger), `role="status"` (caution)
- [x] 서명/취소 버튼: `aria-label="트랜잭션 서명"` / `"트랜잭션 거부"`
- [x] Danger long-press: `aria-label="1.5초 길게 눌러 위험 트랜잭션 서명"`
- [x] 가스 프리셋: `aria-pressed` (선택 상태)
- [x] GasDetailPanel 토글: `aria-expanded`
- [x] 색상 대비: 모든 텍스트/배경 4.5:1 이상 (검증 완료)
- [x] 터치 타겟: 모든 버튼 최소 44px (`AI_SIZING.minTouchTarget`)
- [x] `prefers-reduced-motion` 대응: 카운트업·stagger·shake 비활성화

---

## 파일 구조 (신규/수정)

```
src/component/modules/AI/
├── simulation-overlay.tsx          [신규] Phase 2 인라인 오버레이 컨테이너
├── risk-score-header.tsx           [신규] 리스크 레벨 비주얼 헤더
├── balance-change-card.tsx         [신규] 잔액 변화 미리보기 (기존 SimulationResultCard에서 분리)
├── anomaly-warning-list.tsx        [신규] 이상 감지 경고 목록
├── simulation-cta-bar.tsx          [신규] 서명/취소 CTA (리스크 레벨별 분기)
├── simulation-loading-overlay.tsx  [신규] 시뮬레이션 로딩 Skeleton
├── gas-detail-panel.tsx            [신규] EIP-1559 상세 표시 (접기/펼치기)
├── gas-savings-indicator.tsx       [신규] 절감 금액 표시
├── gas-timing-hint.tsx             [신규] 최적 타이밍 추천
├── gas-optimize-badge.tsx          [신규] Command Bar 내 가스 최적화 배지
├── simulation-result-card.tsx      [수정] BalanceChangeCard 분리 후 래퍼로 변경
├── gas-optimizer-widget.tsx        [수정] GasDetailPanel + SavingsIndicator + TimingHint 통합
├── command-bar.tsx                 [수정] GasOptimizeBadge 추가
├── risk-score-badge.tsx            — 변경 없음
├── intent-preview-card.tsx         — 변경 없음
├── ai-chat-bottom-sheet.tsx        — 변경 없음
├── ai-message-bubble.tsx           — 변경 없음
└── index.ts                        [수정] 신규 컴포넌트 export 추가

src/styles/
└── ai-design-tokens.ts             [수정] AI_SIMULATION, AI_GAS_DETAIL 토큰 추가

src/types/
└── ai.ts                           [수정] AnomalyWarning, GasDetail 타입 추가
```

---

## 타입 추가 (ai.ts)

```typescript
// ── Phase 2: Anomaly Warning ──
export interface AnomalyWarning {
  id: string;
  type: 'blacklist_contract' | 'unlimited_approval' | 'scam_address' | 'high_slippage' | 'high_gas' | 'new_contract';
  message: string;
  level: 'caution' | 'danger';
}

// ── Phase 3: Gas Detail ──
export interface GasDetail {
  maxFeePerGas: string;       // Gwei
  maxPriorityFeePerGas: string; // Gwei
  gasLimit: string;
  estimatedCostUSD: string;
}

export interface GasSavings {
  /** 7일 평균 대비 절감 금액 (USD) */
  amountUSD: string;
  /** 절감 퍼센트 */
  percentSaved: number;
}

export interface GasTimingRecommendation {
  /** 현재 가스비 vs 평균 비율 */
  currentToAverageRatio: number;
  /** 예상 하락 시간 (분) */
  estimatedDropMinutes: number;
  /** 추천 메시지 */
  message: string;
}
```

---

## 핸드오프 체크리스트 → Bart

- [x] CSS 토큰 파일 경로: `src/styles/ai-design-tokens.ts` (기존 확장)
- [x] 색상: 기존 `theme.colors` + `AI_RISK_COLORS` 그대로, 신규 색상 없음
- [x] 타이포: `AI_TYPOGRAPHY` 그대로, 신규 스케일 없음
- [x] Spacing: `AI_SIZING` 그대로, 신규 간격 없음
- [x] 컴포넌트 상태: Default / Loading / Error / Empty 전부 정의
- [x] 반응형: 400×600 고정 뷰포트 (Extension), 반응형 불필요
- [x] 접근성: aria-*, role, 대비 비율, 터치 타겟 전부 명시
- [x] 모션: Spring 파라미터, duration, easing 전부 명시 (기존 `AI_MOTION` 재사용)
- [x] 신규 파일 10개 + 수정 파일 5개 목록 명시
- [x] 타입 정의: `AnomalyWarning`, `GasDetail`, `GasSavings`, `GasTimingRecommendation`
