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
 */

import type { App } from '@slack/bolt';
import crypto from 'node:crypto';

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

/** 실행 컨텍스트 저장소: controlId → AgentRunContext */
const runContexts = new Map<string, AgentRunContext>();

/** 자동 정리 타임아웃: 30분 */
const CONTEXT_TTL_MS = 30 * 60 * 1000;

export const generateControlId = (): string =>
  `ctrl_${crypto.randomUUID().replace(/-/g, '')}`;

export const storeRunContext = (ctx: AgentRunContext): void => {
  runContexts.set(ctx.controlId, ctx);
  setTimeout(() => runContexts.delete(ctx.controlId), CONTEXT_TTL_MS);
};

export const getRunContext = (
  controlId: string,
): AgentRunContext | undefined => runContexts.get(controlId);

export const deleteRunContext = (controlId: string): void => {
  runContexts.delete(controlId);
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

/** Block Kit actions 블록: [🛑 취소] [🔄 재실행] */
export const buildControlActions = (controlId: string) => ({
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
): Promise<string | undefined> => {
  try {
    const result = await slackApp.client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: `🏃 ${agentName} 작업 중...`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🏃 *${agentName}* 작업 중...`,
          },
        },
        buildControlActions(controlId),
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
 */
export const updateStatusMessage = async (
  slackApp: App,
  channel: string,
  messageTs: string,
  status: 'completed' | 'cancelled' | 'error' | 'rerunning',
  agentName: string,
): Promise<void> => {
  const statusText: Record<string, string> = {
    completed: `✅ *${agentName}* 완료`,
    cancelled: `🛑 *${agentName}* 취소됨`,
    error: `❌ *${agentName}* 오류 발생`,
    rerunning: `🔄 *${agentName}* 재실행 중...`,
  };
  try {
    await slackApp.client.chat.update({
      channel,
      ts: messageTs,
      text: statusText[status] ?? `${agentName} ${status}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: statusText[status] ?? `${agentName} ${status}`,
          },
        },
      ],
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
