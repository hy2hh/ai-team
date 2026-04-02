/**
 * 지수 백오프 + Circuit Breaker 패턴
 *
 * Claude Code의 withRetry 패턴을 참고하여 구현.
 * - 지수 백오프 (500ms → 1s → 2s → ... → 32s) + ±25% jitter
 * - 에러 분류별 전략 (retryable / non-retryable / rate-limit)
 * - Circuit Breaker: 연속 실패 N회 시 fallback 또는 차단
 */
import { emitCircuitStateChange } from './hook-events.js';

/** 재시도 옵션 */
export interface RetryOptions {
  /** 최대 재시도 횟수 (기본 3) */
  maxRetries?: number;
  /** 기본 딜레이 (ms, 기본 500) */
  baseDelayMs?: number;
  /** 최대 딜레이 (ms, 기본 32000) */
  maxDelayMs?: number;
  /** 작업 라벨 (로그용) */
  label?: string;
  /** 재시도 가능 여부 판단 함수 */
  isRetryable?: (error: unknown) => boolean;
  /** 재시도 시 콜백 (로그, 메트릭 등) */
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

/** Circuit Breaker 상태 */
type CircuitState = 'closed' | 'open' | 'half-open';

/** Circuit Breaker 설정 */
export interface CircuitBreakerOptions {
  /** 연속 실패 임계값 (기본 5) */
  failureThreshold?: number;
  /** 차단 해제 대기 시간 (ms, 기본 60000) */
  resetTimeoutMs?: number;
  /** 라벨 (로그용) */
  label?: string;
}

/** Circuit Breaker 인스턴스 상태 */
interface CircuitBreakerState {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureAt: number;
  totalFailures: number;
  totalSuccesses: number;
}

/**
 * 지수 백오프 딜레이 계산 (±25% jitter 포함)
 *
 * @param attempt - 현재 시도 횟수 (1-based)
 * @param baseDelayMs - 기본 딜레이 (ms)
 * @param maxDelayMs - 최대 딜레이 (ms)
 * @returns 딜레이 (ms)
 */
export const getRetryDelay = (
  attempt: number,
  baseDelayMs = 500,
  maxDelayMs = 32_000,
): number => {
  const exponentialDelay = Math.min(
    baseDelayMs * Math.pow(2, attempt - 1),
    maxDelayMs,
  );
  const jitter = Math.random() * 0.5 - 0.25; // -25% ~ +25%
  return Math.round(exponentialDelay * (1 + jitter));
};

/**
 * 기본 재시도 가능 여부 판단
 *
 * - Network 에러 (ECONNRESET, ETIMEDOUT, EPIPE, fetch fail)
 * - HTTP 5xx 서버 에러
 * - HTTP 408 Timeout
 * - HTTP 429 Rate Limit
 * - HTTP 409 Conflict
 *
 * @param error - 발생한 에러
 * @returns 재시도 가능 여부
 */
export const defaultIsRetryable = (error: unknown): boolean => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // 네트워크 에러
    if (
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('epipe') ||
      msg.includes('fetch failed') ||
      msg.includes('socket hang up') ||
      msg.includes('network')
    ) {
      return true;
    }
  }

  // HTTP 상태 코드 기반 판단
  const status = extractHttpStatus(error);
  if (status !== null) {
    // 5xx: 서버 에러 → 재시도
    if (status >= 500) {
      return true;
    }
    // 408: 타임아웃 → 재시도
    if (status === 408) {
      return true;
    }
    // 429: Rate Limit → 재시도
    if (status === 429) {
      return true;
    }
    // 409: Conflict → 재시도
    if (status === 409) {
      return true;
    }
    // 401, 403: 인증/권한 → 재시도 불가
    if (status === 401 || status === 403) {
      return false;
    }
  }

  return false;
};

/**
 * 에러에서 HTTP 상태 코드 추출
 *
 * @param error - 에러 객체
 * @returns HTTP 상태 코드 또는 null
 */
const extractHttpStatus = (error: unknown): number | null => {
  if (error && typeof error === 'object') {
    const statusField = (error as Record<string, unknown>).status;
    if (typeof statusField === 'number') {
      return statusField;
    }
    const statusCode = (error as Record<string, unknown>).statusCode;
    if (typeof statusCode === 'number') {
      return statusCode;
    }
  }
  return null;
};

/**
 * 재시도 래퍼 — 지수 백오프 + jitter로 비동기 함수 재시도
 *
 * @param fn - 실행할 비동기 함수
 * @param options - 재시도 옵션
 * @returns fn의 반환값
 * @throws 모든 재시도 소진 시 마지막 에러
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> => {
  const {
    maxRetries = 3,
    baseDelayMs = 500,
    maxDelayMs = 32_000,
    label = 'operation',
    isRetryable = defaultIsRetryable,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 마지막 시도이거나 재시도 불가능한 에러
      if (attempt > maxRetries || !isRetryable(error)) {
        throw error;
      }

      const delayMs = getRetryDelay(attempt, baseDelayMs, maxDelayMs);

      if (onRetry) {
        onRetry(attempt, delayMs, error);
      } else {
        const errMsg =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `[retry] ${label} 실패 (${attempt}/${maxRetries}), ${delayMs}ms 후 재시도: ${errMsg}`,
        );
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
};

/**
 * Circuit Breaker 생성
 *
 * 연속 실패가 임계값을 초과하면 회로를 열어 즉시 에러 반환.
 * resetTimeoutMs 후 half-open 상태에서 1회 시도 허용.
 *
 * @param options - Circuit Breaker 설정
 * @returns wrap 함수 + 상태 조회 함수
 */
export const createCircuitBreaker = (
  options: CircuitBreakerOptions = {},
) => {
  const {
    failureThreshold = 5,
    resetTimeoutMs = 60_000,
    label = 'circuit',
  } = options;

  const state: CircuitBreakerState = {
    state: 'closed',
    consecutiveFailures: 0,
    lastFailureAt: 0,
    totalFailures: 0,
    totalSuccesses: 0,
  };

  /** 성공 기록 */
  const onSuccess = (): void => {
    state.consecutiveFailures = 0;
    state.totalSuccesses++;
    if (state.state !== 'closed') {
      console.log(`[${label}] circuit breaker: closed (복구 성공)`);
      state.state = 'closed';
      emitCircuitStateChange(label, false);
    }
  };

  /** 실패 기록 */
  const onFailure = (): void => {
    state.consecutiveFailures++;
    state.totalFailures++;
    state.lastFailureAt = Date.now();

    if (state.state === 'half-open') {
      // half-open 시험 실패 → 즉시 open 복귀
      state.state = 'open';
      console.warn(
        `[${label}] circuit breaker: OPEN (half-open 시험 실패)`,
      );
      emitCircuitStateChange(
        label,
        true,
        state.consecutiveFailures,
      );
    } else if (
      state.consecutiveFailures >= failureThreshold &&
      state.state === 'closed'
    ) {
      state.state = 'open';
      console.warn(
        `[${label}] circuit breaker: OPEN (연속 ${state.consecutiveFailures}회 실패)`,
      );
      emitCircuitStateChange(
        label,
        true,
        state.consecutiveFailures,
      );
    }
  };

  /**
   * Circuit Breaker로 함수 래핑
   *
   * @param fn - 보호할 비동기 함수
   * @returns fn의 반환값
   * @throws 회로 열림 시 CircuitOpenError
   */
  const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
    // 회로가 열려있는 경우
    if (state.state === 'open') {
      const elapsed = Date.now() - state.lastFailureAt;
      if (elapsed < resetTimeoutMs) {
        throw new CircuitOpenError(
          `[${label}] circuit breaker open — ${Math.round((resetTimeoutMs - elapsed) / 1000)}s 후 재시도`,
        );
      }
      // resetTimeout 경과 → half-open 전환
      state.state = 'half-open';
      console.log(
        `[${label}] circuit breaker: half-open (시험 요청 허용)`,
      );
    }

    try {
      const result = await fn();
      onSuccess();
      return result;
    } catch (error) {
      onFailure();
      throw error;
    }
  };

  /** 현재 상태 조회 (모니터링/디버깅용) */
  const getState = (): Readonly<CircuitBreakerState> => ({
    ...state,
  });

  /** 수동 리셋 (테스트/운영용) */
  const reset = (): void => {
    state.state = 'closed';
    state.consecutiveFailures = 0;
    console.log(`[${label}] circuit breaker: 수동 리셋`);
  };

  return { wrap, getState, reset };
};

/** Circuit Breaker 열림 에러 */
export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

/** Promise 기반 sleep */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
