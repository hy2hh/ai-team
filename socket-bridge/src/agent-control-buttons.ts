/**
 * Agent Control Buttons Module
 *
 * 에이전트 실행 중 Slack Block Kit 버튼으로 취소/재실행 제어.
 *
 * 흐름:
 * 1. handleMessage 시작 시 "작업 중" 상태 메시지 + [취소][재실행] 버튼 게시
 * 2. 취소 클릭 → cancelAgent() + 상태 메시지 업데이트
 * 3. 재실행 클릭 → Modal로 추가 요구사항 입력 → 취소 후 재시작
 * 4. 에이전트 완료/오류 시 → 상태 메시지에서 버튼 제거
 *
 * 영속화:
 * - runContexts는 인메모리 Map(캐시) + SQLite run_contexts 테이블 이중 저장
 * - 브리지 재시작 후 DB에서 복원 → 재실행/취소 버튼이 재시작 후에도 동작
 */

import type { App } from '@slack/bolt';
import crypto from 'node:crypto';
import { getDb } from './db.js';

/** 재실행에 필요한 원본 실행 컨텍스트 */
export interface AgentRunContext {
  controlId: string;
  agentName: string;
  /** 원본 이벤트 텍스트 (재실행 시 사용) */
  originalText: string;
  channel: string;
  threadTs: string;
  /** 상태 메시지 ts (버튼 포함 메시지) */
  statusMessageTs: string;
  /** 원본 event.ts (cancelAgent 호출용) */
  eventTs: string;
  slackApp: App;
  /** 라우팅 방법 (재실행 시 동일 방법 사용) */
  routingMethod: string;
  /** 모델 tier */
  modelTier: 'high' | 'standard' | 'fast';
  createdAt: number;
}

/** DB에서 읽은 직렬화된 컨텍스트 행 */
interface DbRunContextRow {
  control_id: string;
  agent_name: string;
  original_text: string;
  channel: string;
  thread_ts: string;
  status_message_ts: string;
  event_ts: string;
  routing_method: string;
  model_tier: string;
  created_at: number;
  expires_at: number;
}

/** 실행 컨텍스트 저장소: controlId → AgentRunContext (인메모리 캐시) */
const runContexts = new Map<string, AgentRunContext>();

/** 자동 정리 타임아웃: 30분 */
export const CONTEXT_TTL_MS = 30 * 60 * 1000;

export const generateControlId = (): string =>
  `ctrl_${crypto.randomUUID().replace(/-/g, '')}`;

// ─── SQLite 영속화 헬퍼 ───────────────────────────────────

/** DB에서 읽은 행을 AgentRunContext로 변환 (slackApp 주입) */
const hydrateContext = (
  row: DbRunContextRow,
  appResolver: (agentName: string) => App,
): AgentRunContext => ({
  controlId: row.control_id,
  agentName: row.agent_name,
  originalText: row.original_text,
  channel: row.channel,
  threadTs: row.thread_ts,
  statusMessageTs: row.status_message_ts,
  eventTs: row.event_ts,
  routingMethod: row.routing_method,
  modelTier: row.model_tier as AgentRunContext['modelTier'],
  createdAt: row.created_at,
  slackApp: appResolver(row.agent_name),
});

/** DB에 컨텍스트 저장 (slackApp 제외) */
const persistToDb = (ctx: AgentRunContext): void => {
  try {
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO run_contexts
          (control_id, agent_name, original_text, channel, thread_ts,
           status_message_ts, event_ts, routing_method, model_tier,
           created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        ctx.controlId,
        ctx.agentName,
        ctx.originalText,
        ctx.channel,
        ctx.threadTs,
        ctx.statusMessageTs,
        ctx.eventTs,
        ctx.routingMethod,
        ctx.modelTier,
        ctx.createdAt,
        ctx.createdAt + CONTEXT_TTL_MS,
      );
  } catch (err) {
    console.error('[control-buttons] DB 저장 실패:', err);
  }
};

/** DB에서 컨텍스트 삭제 */
const removeFromDb = (controlId: string): void => {
  try {
    getDb()
      .prepare('DELETE FROM run_contexts WHERE control_id = ?')
      .run(controlId);
  } catch (err) {
    console.error('[control-buttons] DB 삭제 실패:', err);
  }
};

// ─── 공개 API ────────────────────────────────────────────

export const storeRunContext = (ctx: AgentRunContext): void => {
  runContexts.set(ctx.controlId, ctx);
  persistToDb(ctx);
  setTimeout(() => {
    runContexts.delete(ctx.controlId);
    removeFromDb(ctx.controlId);
  }, CONTEXT_TTL_MS);
};

export const getRunContext = (
  controlId: string,
): AgentRunContext | undefined => runContexts.get(controlId);

export const deleteRunContext = (controlId: string): void => {
  runContexts.delete(controlId);
  removeFromDb(controlId);
};

/** 만료된 레코드 일괄 삭제 후 삭제 건수 반환 */
export const purgeExpiredRunContexts = (): number => {
  try {
    const result = getDb()
      .prepare('DELETE FROM run_contexts WHERE expires_at <= ?')
      .run(Date.now());
    return result.changes;
  } catch (err) {
    console.error('[control-buttons] 만료 정리 실패:', err);
    return 0;
  }
};

/**
 * 브리지 재시작 시 DB에서 유효한 컨텍스트를 인메모리 Map으로 복원.
 * slackApp은 appResolver를 통해 agentName → App 매핑으로 주입.
 * @returns 복원된 컨텍스트 수
 */
export const restoreRunContextsFromDb = (
  appResolver: (agentName: string) => App,
): number => {
  try {
    const now = Date.now();
    const rows = getDb()
      .prepare('SELECT * FROM run_contexts WHERE expires_at > ?')
      .all(now) as DbRunContextRow[];

    for (const row of rows) {
      try {
        const ctx = hydrateContext(row, appResolver);
        runContexts.set(ctx.controlId, ctx);
        // 남은 TTL로 인메모리 자동 정리 타이머 재등록
        const remainingTtl = row.expires_at - now;
        setTimeout(() => {
          runContexts.delete(ctx.controlId);
          removeFromDb(ctx.controlId);
        }, remainingTtl);
      } catch (err) {
        // 특정 컨텍스트 복원 실패 (agentName 매핑 없음 등) → 해당 행만 스킵
        console.warn(`[control-buttons] 컨텍스트 복원 스킵 (${row.control_id}):`, err);
      }
    }
    return rows.length;
  } catch (err) {
    console.error('[control-buttons] DB 복원 실패:', err);
    return 0;
  }
};

/** controlId로 상태 메시지 ts 조회 (완료/취소 시 업데이트용) */
export const findContextByEventTs = (
  eventTs: string,
): AgentRunContext | undefined => {
  for (const ctx of runContexts.values()) {
    if (ctx.eventTs === eventTs) {
      return ctx;
    }
  }
  return undefined;
};

/** 같은 threadTs에 속한 모든 실행 컨텍스트 조회 (전체 중단용) */
export const findContextsByThread = (
  threadTs: string,
): AgentRunContext[] => {
  const results: AgentRunContext[] = [];
  for (const ctx of runContexts.values()) {
    if (ctx.threadTs === threadTs) {
      results.push(ctx);
    }
  }
  return results;
};

/** Block Kit actions 블록: [🛑 취소] [🔄 재실행] ([⏹️ 전체 중단] — 다중 스텝일 때만) */
export const buildControlActions = (controlId: string, showCancelAll = true) => ({
  type: 'actions' as const,
  block_id: `agent_control_${controlId}`,
  elements: [
    {
      type: 'button' as const,
      text: { type: 'plain_text' as const, text: '🛑 취소', emoji: true },
      style: 'danger' as const,
      action_id: 'agent_cancel',
      value: controlId,
    },
    {
      type: 'button' as const,
      text: {
        type: 'plain_text' as const,
        text: '🔄 재실행',
        emoji: true,
      },
      action_id: 'agent_rerun',
      value: controlId,
    },
    ...(showCancelAll
      ? [
          {
            type: 'button' as const,
            text: {
              type: 'plain_text' as const,
              text: '⏹️ 전체 중단',
              emoji: true,
            },
            style: 'danger' as const,
            action_id: 'agent_cancel_all',
            value: controlId,
          },
        ]
      : []),
  ],
});

/**
 * "작업 중" 상태 메시지를 버튼과 함께 게시
 * @returns 게시된 메시지 ts (실패 시 undefined)
 */
export const postRunningMessage = async (
  slackApp: App,
  channel: string,
  threadTs: string,
  agentName: string,
  controlId: string,
  stepInfo?: { current: number; total: number },
): Promise<string | undefined> => {
  const resolved = stepInfo ?? { current: 1, total: 1 };
  const stepSuffix = ` (${resolved.current}/${resolved.total}단계)`;
  const showCancelAll = resolved.total > 1;
  try {
    const result = await slackApp.client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: `🏃 ${agentName} 작업 중...${stepSuffix}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🏃 *${agentName}* 작업 중...${stepSuffix}`,
          },
        },
        buildControlActions(controlId, showCancelAll),
      ],
    });
    return (result as { ts?: string }).ts;
  } catch (err) {
    console.error('[control-buttons] running 메시지 게시 실패:', err);
    return undefined;
  }
};

/**
 * 상태 메시지 업데이트 (버튼 제거 + 상태 텍스트 변경)
 *
 * resultText / resultBlocks 를 전달하면 상태 헤더 아래에 결과 내용을 포함하여 업데이트.
 * 별도 postMessage 없이 단일 메시지로 완료 상태 + 답변을 표현할 때 사용.
 */
export const updateStatusMessage = async (
  slackApp: App,
  channel: string,
  messageTs: string,
  status: 'completed' | 'cancelled' | 'error' | 'rerunning',
  agentName: string,
  options?: {
    resultText?: string;
    resultBlocks?: Array<Record<string, unknown>>;
  },
): Promise<void> => {
  const statusText: Record<string, string> = {
    completed: `✅ *${agentName}* 완료`,
    cancelled: `🛑 *${agentName}* 취소됨`,
    error: `❌ *${agentName}* 오류 발생`,
    rerunning: `🔄 *${agentName}* 재실행 중...`,
  };

  const headerText = statusText[status] ?? `${agentName} ${status}`;

  // 결과가 있으면 헤더 + 구분선 + 결과 블록으로 구성
  let blocks: Array<Record<string, unknown>>;
  let fullText: string;

  if (options?.resultText) {
    fullText = `${headerText}\n\n${options.resultText}`;
    blocks = [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: headerText },
      },
      { type: 'divider' },
      ...(options.resultBlocks ?? [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: options.resultText },
        },
      ]),
    ];
  } else {
    fullText = headerText;
    blocks = [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: headerText },
      },
    ];
  }

  try {
    await slackApp.client.chat.update({
      channel,
      ts: messageTs,
      text: fullText,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blocks: blocks as any,
    });
  } catch (err) {
    console.error('[control-buttons] 상태 업데이트 실패:', err);
  }
};

/** 재실행 Modal 정의 */
export const buildRerunModal = (controlId: string, agentName: string) => ({
  type: 'modal' as const,
  callback_id: 'agent_rerun_modal',
  private_metadata: controlId,
  title: {
    type: 'plain_text' as const,
    text: `${agentName} 재실행`,
  },
  submit: { type: 'plain_text' as const, text: '재실행' },
  close: { type: 'plain_text' as const, text: '취소' },
  blocks: [
    {
      type: 'input' as const,
      block_id: 'rerun_input_block',
      label: {
        type: 'plain_text' as const,
        text: '추가 요구사항',
      },
      element: {
        type: 'plain_text_input' as const,
        action_id: 'rerun_requirements',
        multiline: true,
        placeholder: {
          type: 'plain_text' as const,
          text: '변경할 내용이나 추가 지시사항을 입력하세요',
        },
      },
    },
  ],
});
