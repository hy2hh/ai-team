/**
 * 환경 변수에서 설정값을 읽고 기본값을 제공하는 중앙 설정 모듈.
 * 하드코딩된 매직 넘버를 환경별로 조정 가능하게 합니다.
 */

const envInt = (key: string, fallback: number): number => {
  const val = process.env[key];
  if (val === undefined) {
    return fallback;
  }
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
};

/** 디바운스 대기 시간 (ms) */
export const DEBOUNCE_DELAY = envInt('BRIDGE_DEBOUNCE_DELAY', 3000);

/** 에이전트 실행 타임아웃 (ms, 기본 1시간) */
export const AGENT_TIMEOUT_MS = envInt('BRIDGE_AGENT_TIMEOUT_MS', 60 * 60 * 1000);

/** 세션 TTL (ms, 기본 30일) */
export const SESSION_TTL_MS = envInt('BRIDGE_SESSION_TTL_MS', 30 * 24 * 60 * 60 * 1000);

/** 최대 위임 깊이 */
export const MAX_DELEGATION_DEPTH = envInt('BRIDGE_MAX_DELEGATION_DEPTH', 3);

/** 동시 메시지 처리 수 */
export const MAX_CONCURRENT_HANDLERS = envInt('BRIDGE_MAX_CONCURRENT_HANDLERS', 3);

/** Slack API 레이트 리밋 (req/min) */
export const SLACK_RATE_LIMIT = envInt('BRIDGE_SLACK_RATE_LIMIT', 50);

/** 스레드 세션 최대 수 (에이전트당) */
export const THREAD_SESSIONS_MAX = envInt('BRIDGE_THREAD_SESSIONS_MAX', 50);

// ─────────────────────────────────────────────
// 3-tier 모델 라우팅
// ─────────────────────────────────────────────

const envStr = (key: string, fallback: string): string =>
  process.env[key] ?? fallback;

/** HIGH tier: 회의, 계획, 복잡한 추론 (Opus) */
export const MODEL_HIGH = envStr('BRIDGE_MODEL_HIGH', 'claude-opus-4-5');

/** STANDARD tier: 일반 에이전트 실행 (Sonnet, 기본값) */
export const MODEL_STANDARD = envStr('BRIDGE_MODEL_STANDARD', 'claude-sonnet-4-6');

/** FAST tier: 분류, 요약, 경량 작업 (Haiku) */
export const MODEL_FAST = envStr('BRIDGE_MODEL_FAST', 'claude-haiku-4-5-20251001');

// ─────────────────────────────────────────────
// 팀 Ralph Loop 설정
// ─────────────────────────────────────────────

/** Cross-verify/QA FAIL 시 최대 재작업 루프 횟수 */
export const MAX_RALPH_LOOP_ITERATIONS = envInt('BRIDGE_MAX_RALPH_LOOP_ITERATIONS', 3);

/** Ralph Loop 활성화 여부 */
export const RALPH_LOOP_ENABLED = process.env.BRIDGE_RALPH_LOOP_ENABLED !== '0';
