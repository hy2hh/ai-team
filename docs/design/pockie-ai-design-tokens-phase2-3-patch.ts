/**
 * AI Design Tokens — Phase 2 & 3 추가분
 *
 * 이 파일의 내용을 기존 src/styles/ai-design-tokens.ts 에 추가하세요.
 * 기존 토큰(AI_SIZING, AI_RISK_COLORS, AI_COLORS, AI_MOTION 등)은 변경 없음.
 *
 * @see docs/design/pockie-ai-agent-phase2-3-ui-spec.md — 상세 스펙
 */

// ─── Phase 2: Simulation Overlay 토큰 ─────────────────────────
export const AI_SIMULATION = {
  /** RiskScoreHeader 아이콘 크기 */
  riskIconSize: 32,
  /** Danger long-press 시간 (ms) — 실수 방지 */
  dangerLongPressDuration: 1500,
  /** Danger 프로그레스 원형 두께 (px) */
  dangerProgressStroke: 2,
  /** 경고 아이템 아이콘 크기 */
  warningIconSize: 16,
  /** CTA 바 패딩 */
  ctaBarPadding: '12px 16px',
  /** CTA 바 gap */
  ctaBarGap: 8,
  /** 경고 아이템 패딩 */
  warningItemPadding: '8px 12px',
  /** 경고 아이템 간격 */
  warningItemGap: 4,
  /** RiskScoreHeader 패딩 */
  riskHeaderPadding: 16,
  /** 오버레이 등장 y offset */
  overlayEntryY: 12,
} as const;

// ─── Phase 3: Gas Detail 토큰 ─────────────────────────────────
export const AI_GAS_DETAIL = {
  /** 상세 패널 행 최소 높이 */
  rowMinHeight: 32,
  /** 상세 패널 행 패딩 */
  rowPadding: '4px 0',
  /** 상세 토글 상단 마진 */
  toggleMarginTop: 8,
  /** GasOptimizeBadge 전체 크기 */
  badgeSize: 24,
  /** GasOptimizeBadge 내부 아이콘 크기 */
  badgeIconSize: 14,
  /** 절감 인디케이터 아이콘 크기 */
  savingsIconSize: 16,
  /** 절감 인디케이터 패딩 */
  savingsPadding: '8px 12px',
  /** 타이밍 힌트 아이콘 크기 */
  timingIconSize: 16,
  /** 타이밍 힌트 패딩 */
  timingPadding: '8px 12px',
  /** 가스비 높음 판정 임계값 (평균 대비 배율) */
  highGasThreshold: 1.5,
} as const;
