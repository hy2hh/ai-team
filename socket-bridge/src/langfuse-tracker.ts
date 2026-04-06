/**
 * Langfuse Tracker — ai-team 에이전트 행동 관측
 *
 * hook-events.ts 이벤트를 구독하여 Langfuse로 트레이스/스팬을 전송합니다.
 * LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY가 없으면 자동으로 no-op 처리됩니다.
 */
import { Langfuse, type LangfuseSpanClient, type LangfuseTraceClient } from 'langfuse';
import {
  on,
  type AgentEvent,
  type MessageEvent,
  type CircuitEvent,
} from './hook-events.js';

// ─── 초기화 ───────────────────────────────────────────

let langfuse: Langfuse | null = null;

/** Langfuse 인스턴스 초기화 (환경변수 없으면 no-op) */
const initClient = (): Langfuse | null => {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;

  if (!publicKey || !secretKey) {
    return null;
  }

  return new Langfuse({
    publicKey,
    secretKey,
    baseUrl: process.env.LANGFUSE_HOST ?? 'https://cloud.langfuse.com',
    // 브릿지 종료 시 flush — 자동 배치 전송
    flushAt: 20,
    flushInterval: 10_000,
  });
};

// ─── 인-플라이트 상태 ─────────────────────────────────

/** 메시지 단위 트레이스 (messageTs → trace) */
const activeTraces = new Map<string, LangfuseTraceClient>();

/** 에이전트 단위 스팬 (agent:channel:messageTs → span) */
const activeSpans = new Map<string, LangfuseSpanClient>();

/** 트레이스 ID 생성 */
const traceId = (channel: string, messageTs: string): string =>
  `${channel}_${messageTs.replace('.', '_')}`;

/** 스팬 키 생성 */
const spanKey = (agent: string, channel: string, messageTs: string): string =>
  `${agent}:${channel}:${messageTs}`;

// ─── 이벤트 핸들러 ────────────────────────────────────

/** message.routed → 트레이스 시작 + 라우팅 스팬 기록 */
const handleMessageRouted = (event: MessageEvent): void => {
  if (!langfuse) { return; }

  const id = traceId(event.channel, event.messageTs);

  const trace = langfuse.trace({
    id,
    name: 'message-processing',
    tags: ['ai-team', event.routingMethod ?? 'unknown'],
    metadata: {
      channel: event.channel,
      messageTs: event.messageTs,
      agents: event.agents ?? [],
      routingMethod: event.routingMethod ?? 'unknown',
    },
  });

  activeTraces.set(event.messageTs, trace);

  // 라우팅 자체를 단일 스팬으로 기록
  trace.span({
    name: 'routing',
    input: { messageTs: event.messageTs },
    output: { agents: event.agents ?? [], method: event.routingMethod ?? 'unknown' },
    startTime: new Date(event.timestamp),
    endTime: new Date(event.timestamp),
    metadata: { routingMethod: event.routingMethod ?? 'unknown' },
  });
};

/** agent.started → 에이전트 스팬 시작 */
const handleAgentStarted = (event: AgentEvent): void => {
  if (!langfuse) { return; }

  const key = spanKey(event.agent, event.channel, event.messageTs);
  const startTime = new Date(event.timestamp);

  // 트레이스가 없으면 on-demand 생성 (@mention 직접 실행 케이스)
  let trace = activeTraces.get(event.messageTs);
  if (!trace) {
    const id = traceId(event.channel, event.messageTs);
    trace = langfuse.trace({
      id,
      name: 'message-processing',
      tags: ['ai-team', 'direct-mention'],
      metadata: {
        channel: event.channel,
        messageTs: event.messageTs,
      },
    });
    activeTraces.set(event.messageTs, trace);
  }

  const span = trace.span({
    name: `agent:${event.agent}`,
    input: { agent: event.agent, channel: event.channel },
    startTime,
    metadata: { agent: event.agent },
  });

  activeSpans.set(key, span);
};

/** agent.completed → 스팬 성공 종료 */
const handleAgentCompleted = (event: AgentEvent): void => {
  if (!langfuse) { return; }

  const key = spanKey(event.agent, event.channel, event.messageTs);
  const span = activeSpans.get(key);

  if (span) {
    span.end({
      output: { elapsedMs: event.elapsedMs },
      level: 'DEFAULT',
    });
    activeSpans.delete(key);
  }

  // 해당 트레이스에 더 이상 in-flight 스팬이 없으면 트레이스 제거
  pruneTrace(event.messageTs, event.channel);
};

/** agent.failed → 스팬 실패 종료 */
const handleAgentFailed = (event: AgentEvent): void => {
  if (!langfuse) { return; }

  const key = spanKey(event.agent, event.channel, event.messageTs);
  const span = activeSpans.get(key);

  if (span) {
    span.end({
      output: { error: event.error, elapsedMs: event.elapsedMs },
      level: 'ERROR',
    });
    activeSpans.delete(key);
  }

  pruneTrace(event.messageTs, event.channel);
};

/** circuit.opened/closed → 트레이스 외부 이벤트로 기록 */
const handleCircuitEvent = (event: CircuitEvent): void => {
  if (!langfuse) { return; }

  // circuit 이벤트는 독립 트레이스로 기록
  const trace = langfuse.trace({
    name: 'circuit-breaker',
    tags: ['ai-team', 'circuit', event.type],
    metadata: {
      label: event.label,
      state: event.type === 'circuit.opened' ? 'opened' : 'closed',
      consecutiveFailures: event.consecutiveFailures ?? 0,
    },
  });

  trace.event({
    name: event.type,
    input: { label: event.label },
    output: { consecutiveFailures: event.consecutiveFailures ?? 0 },
    startTime: new Date(event.timestamp),
    level: event.type === 'circuit.opened' ? 'WARNING' : 'DEFAULT',
  });
};

/** 해당 messageTs의 in-flight 스팬이 없으면 트레이스 캐시에서 제거 */
const pruneTrace = (messageTs: string, channel: string): void => {
  const hasActiveSpan = [...activeSpans.keys()].some((k) =>
    k.endsWith(`:${channel}:${messageTs}`),
  );
  if (!hasActiveSpan) {
    activeTraces.delete(messageTs);
  }
};

// ─── 공개 API ─────────────────────────────────────────

/**
 * Langfuse 트래커 초기화 — index.ts 시작 시 1회 호출
 *
 * 환경변수 없으면 아무 동작 안 함. 설정 시 hook-events 자동 구독.
 */
export const initLangfuseTracker = (): void => {
  langfuse = initClient();

  if (!langfuse) {
    console.log('[langfuse] 환경변수 없음 — 트래킹 비활성화');
    return;
  }

  // hook-events 구독
  on({ type: 'message.routed' }, (e) =>
    handleMessageRouted(e as MessageEvent),
  );
  on({ type: 'agent.started' }, (e) =>
    handleAgentStarted(e as AgentEvent),
  );
  on({ type: 'agent.completed' }, (e) =>
    handleAgentCompleted(e as AgentEvent),
  );
  on({ type: 'agent.failed' }, (e) =>
    handleAgentFailed(e as AgentEvent),
  );
  on({ pattern: 'circuit.*' }, (e) =>
    handleCircuitEvent(e as CircuitEvent),
  );

  console.log(
    `[langfuse] 트래킹 활성화 — host: ${process.env.LANGFUSE_HOST ?? 'cloud.langfuse.com'}`,
  );
};

/**
 * 프로세스 종료 전 미전송 이벤트를 flush
 * bridge shutdown hook에서 호출
 */
export const flushLangfuse = async (): Promise<void> => {
  if (langfuse) {
    await langfuse.flushAsync();
  }
};
