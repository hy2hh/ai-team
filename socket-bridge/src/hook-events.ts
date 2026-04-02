/**
 * Hook Event System — 이벤트 기반 자동화 인프라
 *
 * Claude Code의 Hook 패턴을 참고하여 구현:
 * - 에이전트 라이프사이클 이벤트 발행/구독
 * - Matcher 기반 필터링 (에이전트, 채널, 타입)
 * - 동기/비동기 핸들러 지원
 * - 핸들러 실패는 이벤트 소스에 영향 없음 (fire-and-forget)
 */

// ─── Event Types ──────────────────────────────────────

/** 지원하는 이벤트 타입 */
export type HookEventType =
  | 'message.received'
  | 'message.routed'
  | 'agent.started'
  | 'agent.completed'
  | 'agent.failed'
  | 'agent.timeout'
  | 'claim.acquired'
  | 'claim.released'
  | 'claim.orphaned'
  | 'task.created'
  | 'task.completed'
  | 'task.failed'
  | 'handoff.created'
  | 'handoff.completed'
  | 'queue.enqueued'
  | 'queue.step.completed'
  | 'queue.completed'
  | 'circuit.opened'
  | 'circuit.closed'
  | 'bridge.started'
  | 'bridge.shutdown';

/** 이벤트 페이로드 기본 구조 */
export interface HookEventBase {
  /** 이벤트 타입 */
  type: HookEventType;
  /** 발생 시각 (ms) */
  timestamp: number;
  /** 이벤트 소스 (에이전트 이름, 'bridge', 'system' 등) */
  source: string;
}

/** 메시지 관련 이벤트 */
export interface MessageEvent extends HookEventBase {
  type: 'message.received' | 'message.routed';
  channel: string;
  messageTs: string;
  /** 라우팅 결과 (message.routed에만 존재) */
  agents?: string[];
  routingMethod?: string;
}

/** 에이전트 실행 이벤트 */
export interface AgentEvent extends HookEventBase {
  type:
    | 'agent.started'
    | 'agent.completed'
    | 'agent.failed'
    | 'agent.timeout';
  agent: string;
  channel: string;
  messageTs: string;
  /** 소요 시간 (ms, completed/failed/timeout에만) */
  elapsedMs?: number;
  /** 에러 메시지 (failed에만) */
  error?: string;
}

/** Claim 이벤트 */
export interface ClaimEvent extends HookEventBase {
  type: 'claim.acquired' | 'claim.released' | 'claim.orphaned';
  agent: string;
  messageTs: string;
  channel?: string;
}

/** 태스크 이벤트 */
export interface TaskEvent extends HookEventBase {
  type: 'task.created' | 'task.completed' | 'task.failed';
  taskId: string;
  agent: string;
  channel?: string;
  threadTs?: string;
}

/** 핸드오프 이벤트 */
export interface HandoffEvent extends HookEventBase {
  type: 'handoff.created' | 'handoff.completed';
  fromAgent: string;
  toAgent: string;
  channel?: string;
}

/** 큐 이벤트 */
export interface QueueEvent extends HookEventBase {
  type: 'queue.enqueued' | 'queue.step.completed' | 'queue.completed';
  queueId: string;
  channel: string;
  threadTs: string;
  /** 큐 내 태스크 수 */
  totalTasks?: number;
  /** 완료된 스텝 번호 */
  stepSequence?: number;
}

/** Circuit Breaker 이벤트 */
export interface CircuitEvent extends HookEventBase {
  type: 'circuit.opened' | 'circuit.closed';
  label: string;
  consecutiveFailures?: number;
}

/** 브리지 라이프사이클 이벤트 */
export interface BridgeEvent extends HookEventBase {
  type: 'bridge.started' | 'bridge.shutdown';
}

/** 모든 이벤트 타입 유니온 */
export type HookEvent =
  | MessageEvent
  | AgentEvent
  | ClaimEvent
  | TaskEvent
  | HandoffEvent
  | QueueEvent
  | CircuitEvent
  | BridgeEvent;

// ─── Matcher ──────────────────────────────────────────

/** 이벤트 필터 조건 */
export interface HookMatcher {
  /** 이벤트 타입 (배열이면 OR 조건) */
  type?: HookEventType | HookEventType[];
  /** 소스 에이전트 필터 */
  source?: string;
  /** 와일드카드 패턴 (e.g., 'agent.*', 'task.*') */
  pattern?: string;
}

/**
 * 이벤트가 matcher 조건에 부합하는지 확인
 *
 * @param event - 검사할 이벤트
 * @param matcher - 필터 조건
 * @returns 매칭 여부
 */
const matchesFilter = (
  event: HookEvent,
  matcher: HookMatcher,
): boolean => {
  // 타입 필터
  if (matcher.type) {
    const types = Array.isArray(matcher.type)
      ? matcher.type
      : [matcher.type];
    if (!types.includes(event.type)) {
      return false;
    }
  }

  // 소스 필터
  if (matcher.source && event.source !== matcher.source) {
    return false;
  }

  // 와일드카드 패턴 (e.g., 'agent.*' → agent.started, agent.completed 등)
  if (matcher.pattern) {
    const regex = new RegExp(
      `^${matcher.pattern.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`,
    );
    if (!regex.test(event.type)) {
      return false;
    }
  }

  return true;
};

// ─── Handler Registry ─────────────────────────────────

/** 핸들러 함수 타입 */
export type HookHandler = (event: HookEvent) => void | Promise<void>;

/** 등록된 핸들러 엔트리 */
interface HandlerEntry {
  /** 고유 ID */
  id: string;
  /** 핸들러 함수 */
  handler: HookHandler;
  /** 필터 조건 */
  matcher: HookMatcher;
  /** 1회 실행 후 자동 해제 */
  once: boolean;
}

/** 핸들러 레지스트리 */
const handlers: HandlerEntry[] = [];

/** 핸들러 ID 카운터 */
let handlerId = 0;

/**
 * 이벤트 핸들러 등록
 *
 * @param matcher - 필터 조건 (빈 객체면 모든 이벤트)
 * @param handler - 핸들러 함수
 * @param options - 추가 옵션
 * @returns unsubscribe 함수
 */
export const on = (
  matcher: HookMatcher,
  handler: HookHandler,
  options: { once?: boolean } = {},
): (() => void) => {
  const id = `hook_${++handlerId}`;
  const entry: HandlerEntry = {
    id,
    handler,
    matcher,
    once: options.once ?? false,
  };
  handlers.push(entry);

  // unsubscribe 함수 반환
  return () => {
    const idx = handlers.findIndex((h) => h.id === id);
    if (idx !== -1) {
      handlers.splice(idx, 1);
    }
  };
};

/**
 * 1회 실행 이벤트 핸들러 등록
 *
 * @param matcher - 필터 조건
 * @param handler - 핸들러 함수
 * @returns unsubscribe 함수
 */
export const once = (
  matcher: HookMatcher,
  handler: HookHandler,
): (() => void) => on(matcher, handler, { once: true });

// ─── Event Emission ───────────────────────────────────

/** 이벤트 발행 통계 */
const stats = {
  totalEmitted: 0,
  totalHandlerCalls: 0,
  totalHandlerErrors: 0,
};

/**
 * 이벤트 발행 (fire-and-forget)
 *
 * 등록된 모든 매칭 핸들러를 비동기로 실행.
 * 핸들러 에러는 console.error로 출력하되 발행 흐름에 영향 없음.
 *
 * @param event - 발행할 이벤트
 */
export const emit = (event: HookEvent): void => {
  stats.totalEmitted++;

  // once 핸들러 정리를 위한 제거 대상 수집
  const toRemove: string[] = [];

  for (const entry of handlers) {
    if (!matchesFilter(event, entry.matcher)) {
      continue;
    }

    stats.totalHandlerCalls++;

    if (entry.once) {
      toRemove.push(entry.id);
    }

    // fire-and-forget: 핸들러 실패는 이벤트 소스에 영향 없음
    try {
      const result = entry.handler(event);
      if (result instanceof Promise) {
        result.catch((err) => {
          stats.totalHandlerErrors++;
          console.error(
            `[hook] handler error (${entry.id}, event=${event.type}):`,
            err,
          );
        });
      }
    } catch (err) {
      stats.totalHandlerErrors++;
      console.error(
        `[hook] handler sync error (${entry.id}, event=${event.type}):`,
        err,
      );
    }
  }

  // once 핸들러 제거
  if (toRemove.length > 0) {
    for (const id of toRemove) {
      const idx = handlers.findIndex((h) => h.id === id);
      if (idx !== -1) {
        handlers.splice(idx, 1);
      }
    }
  }
};

// ─── Helper Emitters ──────────────────────────────────

/**
 * 에이전트 시작 이벤트 발행
 */
export const emitAgentStarted = (
  agent: string,
  channel: string,
  messageTs: string,
): void => {
  emit({
    type: 'agent.started',
    timestamp: Date.now(),
    source: agent,
    agent,
    channel,
    messageTs,
  });
};

/**
 * 에이전트 완료 이벤트 발행
 */
export const emitAgentCompleted = (
  agent: string,
  channel: string,
  messageTs: string,
  elapsedMs: number,
): void => {
  emit({
    type: 'agent.completed',
    timestamp: Date.now(),
    source: agent,
    agent,
    channel,
    messageTs,
    elapsedMs,
  });
};

/**
 * 에이전트 실패 이벤트 발행
 */
export const emitAgentFailed = (
  agent: string,
  channel: string,
  messageTs: string,
  error: string,
  elapsedMs?: number,
): void => {
  emit({
    type: 'agent.failed',
    timestamp: Date.now(),
    source: agent,
    agent,
    channel,
    messageTs,
    error,
    elapsedMs,
  });
};

/**
 * 메시지 라우팅 완료 이벤트 발행
 */
export const emitMessageRouted = (
  channel: string,
  messageTs: string,
  agents: string[],
  routingMethod: string,
): void => {
  emit({
    type: 'message.routed',
    timestamp: Date.now(),
    source: 'bridge',
    channel,
    messageTs,
    agents,
    routingMethod,
  });
};

/**
 * Circuit Breaker 상태 변경 이벤트 발행
 */
export const emitCircuitStateChange = (
  label: string,
  opened: boolean,
  consecutiveFailures?: number,
): void => {
  emit({
    type: opened ? 'circuit.opened' : 'circuit.closed',
    timestamp: Date.now(),
    source: 'system',
    label,
    consecutiveFailures,
  });
};

// ─── Monitoring ───────────────────────────────────────

/**
 * 현재 등록된 핸들러 수
 */
export const getHandlerCount = (): number => handlers.length;

/**
 * 이벤트 통계 조회
 */
export const getStats = (): Readonly<typeof stats> => ({
  ...stats,
});

/**
 * 모든 핸들러 제거 (테스트용)
 */
export const clearAllHandlers = (): void => {
  handlers.length = 0;
};
