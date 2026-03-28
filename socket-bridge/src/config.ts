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

/** 에이전트 실행 타임아웃 (ms) */
export const AGENT_TIMEOUT_MS = envInt('BRIDGE_AGENT_TIMEOUT_MS', 5 * 60 * 1000);

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
