/**
 * Slack API 슬라이딩 윈도우 레이트 리미터
 * Slack Tier 2/3: ~20-50 req/min per method
 * 보수적 기본값: 50 req/min (전체 메서드 통합)
 */

/** 레이트 리미터 설정 */
interface RateLimiterOptions {
  /** 윈도우 당 최대 요청 수 */
  maxRequests: number;
  /** 윈도우 크기 (ms) */
  windowMs: number;
}

/** 요청 타임스탬프 기록 */
const requestTimestamps: number[] = [];

/** 대기 큐 */
const waitQueue: Array<() => void> = [];

/** 기본 설정: 50 req/min */
const config: RateLimiterOptions = {
  maxRequests: 50,
  windowMs: 60_000,
};

/** 윈도우 밖의 오래된 타임스탬프 제거 */
const pruneOld = (): void => {
  const cutoff = Date.now() - config.windowMs;
  while (requestTimestamps.length > 0 && requestTimestamps[0] < cutoff) {
    requestTimestamps.shift();
  }
};

/** 대기 큐에서 다음 요청 해제 */
const drainQueue = (): void => {
  pruneOld();
  while (waitQueue.length > 0 && requestTimestamps.length < config.maxRequests) {
    const next = waitQueue.shift();
    if (next) {
      requestTimestamps.push(Date.now());
      next();
    }
  }
};

/**
 * 레이트 리밋 슬롯 획득 (슬롯 없으면 대기)
 * Slack API 호출 전에 await 합니다.
 */
export const acquireSlot = (): Promise<void> => {
  pruneOld();
  if (requestTimestamps.length < config.maxRequests) {
    requestTimestamps.push(Date.now());
    return Promise.resolve();
  }

  // 슬롯 없음 → 대기 큐에 등록
  return new Promise<void>((resolve) => {
    waitQueue.push(resolve);
  });
};

// 주기적으로 큐 drain (대기 중인 요청 해제)
setInterval(drainQueue, 1000);

/**
 * 레이트 리밋 적용 래퍼
 * @param fn - Slack API 호출 함수
 * @returns fn의 반환값
 */
export const rateLimited = async <T>(fn: () => Promise<T>): Promise<T> => {
  await acquireSlot();
  return fn();
};
