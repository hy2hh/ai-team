/**
 * Risk-Based Delegation Matrix
 *
 * 에이전트 작업을 LOW/MEDIUM/HIGH 리스크로 분류하여
 * auto-proceed 정책을 결정한다.
 *
 * LOW: 자동 진행 (2분 veto window)
 * MEDIUM: 알림 + 자동 진행 (5분 veto window)
 * HIGH: sid 승인 필수 (무기한 대기)
 */

/** 리스크 등급 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/** 리스크 분류 결과 */
export interface RiskClassification {
  level: RiskLevel;
  reason: string;
  /** veto window (밀리초). HIGH는 Infinity */
  vetoWindowMs: number;
}

/** 리스크 등급별 veto window (밀리초) */
const VETO_WINDOWS: Record<RiskLevel, number> = {
  LOW: 2 * 60 * 1000,
  MEDIUM: 5 * 60 * 1000,
  HIGH: Infinity,
};

// ─── 키워드 기반 분류 규칙 ──────────────────────────────

/** HIGH 리스크 키워드 — sid 승인 필수 */
const HIGH_KEYWORDS = [
  // 의존성 변경
  'npm install',
  'pnpm add',
  'pnpm remove',
  'package.json',
  'dependencies',
  // 스키마/DB 변경
  'migration',
  'schema',
  'ALTER TABLE',
  'DROP TABLE',
  'CREATE TABLE',
  // 보안
  'security',
  'auth',
  'token',
  'secret',
  'credential',
  '.env',
  // 배포/인프라
  'deploy',
  'production',
  'release',
  'CI/CD',
  'pipeline',
  // 프로세스 변경
  'CLAUDE.md',
  'settings.json',
  'workflow',
];

/** MEDIUM 리스크 키워드 — 알림 + 자동 진행 */
const MEDIUM_KEYWORDS = [
  // 새 파일 생성
  'new file',
  'create file',
  '새 파일',
  '파일 생성',
  // 크로스 도메인
  'cross-domain',
  'handoff',
  '위임',
  'delegate',
  // 아키텍처
  'architecture',
  'refactor',
  '리팩토링',
  '아키텍처',
  // 다수 파일 변경
  'multiple files',
  '여러 파일',
];

/** LOW 리스크 키워드 — 자동 진행 */
const LOW_KEYWORDS = [
  // 분석/리뷰
  'review',
  'analyze',
  'analysis',
  '분석',
  '리뷰',
  '검토',
  // 문서화
  'document',
  'documentation',
  '문서',
  'README',
  // Phase 전환 (PM 추천)
  'next phase',
  'recommend',
  '다음 단계',
  '추천',
  // 조사/리서치
  'research',
  '조사',
  '리서치',
];

/**
 * 텍스트에서 키워드 매칭으로 리스크 등급 분류
 * HIGH → MEDIUM → LOW 순서로 검사 (가장 높은 리스크 우선)
 *
 * @param text - 분류 대상 텍스트 (작업 요약, PM 추천 등)
 * @returns 리스크 분류 결과 또는 null (키워드 매칭 실패)
 */
const classifyByKeywords = (
  text: string,
): RiskClassification | null => {
  const lower = text.toLowerCase();

  for (const keyword of HIGH_KEYWORDS) {
    if (lower.includes(keyword.toLowerCase())) {
      return {
        level: 'HIGH',
        reason: `키워드 매칭: "${keyword}"`,
        vetoWindowMs: VETO_WINDOWS.HIGH,
      };
    }
  }

  for (const keyword of MEDIUM_KEYWORDS) {
    if (lower.includes(keyword.toLowerCase())) {
      return {
        level: 'MEDIUM',
        reason: `키워드 매칭: "${keyword}"`,
        vetoWindowMs: VETO_WINDOWS.MEDIUM,
      };
    }
  }

  for (const keyword of LOW_KEYWORDS) {
    if (lower.includes(keyword.toLowerCase())) {
      return {
        level: 'LOW',
        reason: `키워드 매칭: "${keyword}"`,
        vetoWindowMs: VETO_WINDOWS.LOW,
      };
    }
  }

  return null;
};

/**
 * 에이전트가 명시적으로 지정한 리스크 레벨 파싱
 * recommend_next_phase 도구에서 riskLevel 필드로 전달
 *
 * @param explicitLevel - 에이전트가 지정한 리스크 레벨 문자열
 * @returns 리스크 분류 결과 또는 null
 */
const parseExplicitLevel = (
  explicitLevel?: string,
): RiskClassification | null => {
  if (!explicitLevel) {
    return null;
  }
  const upper = explicitLevel.toUpperCase() as RiskLevel;
  if (upper in VETO_WINDOWS) {
    return {
      level: upper,
      reason: `에이전트 명시 지정: ${upper}`,
      vetoWindowMs: VETO_WINDOWS[upper],
    };
  }
  return null;
};

/**
 * 작업 텍스트의 리스크 등급 분류 (메인 진입점)
 *
 * 분류 순서:
 * 1. 에이전트 명시 지정 (recommend_next_phase의 riskLevel)
 * 2. 키워드 기반 분류
 * 3. 기본값: MEDIUM (안전 쪽으로)
 *
 * @param text - 분류 대상 텍스트
 * @param explicitLevel - 에이전트가 명시 지정한 리스크 레벨
 * @returns 리스크 분류 결과
 */
export const classifyRisk = (
  text: string,
  explicitLevel?: string,
): RiskClassification => {
  // 1. 에이전트 명시 지정 우선
  const explicit = parseExplicitLevel(explicitLevel);
  if (explicit) {
    return explicit;
  }

  // 2. 키워드 기반
  const keywordResult = classifyByKeywords(text);
  if (keywordResult) {
    return keywordResult;
  }

  // 3. 기본값: MEDIUM (불확실하면 안전 쪽으로)
  return {
    level: 'MEDIUM',
    reason: '키워드 미매칭 — 기본값 MEDIUM',
    vetoWindowMs: VETO_WINDOWS.MEDIUM,
  };
};

/**
 * 리스크 등급별 veto window 반환 (밀리초)
 * @param level - 리스크 등급
 * @returns veto window (밀리초)
 */
export const getVetoWindow = (level: RiskLevel): number =>
  VETO_WINDOWS[level];
