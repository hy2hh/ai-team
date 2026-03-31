/**
 * Task Queue Processor
 * 폴링 루프로 큐에서 태스크를 꺼내 독립 에이전트 세션으로 실행
 */
import type { App } from '@slack/bolt';
import type { SlackEvent } from './types.js';
import {
  getNextTask,
  markRunning,
  markCompleted,
  markFailed,
  skipDependentTasks,
  getPreviousTaskResult,
  recoverOrphanTasks,
  requeueForRetry,
  type TaskQueueRow,
  type QueueStatusSummary,
} from './queue-manager.js';
import { handleMessage, type HandleMessageResult } from './agent-runtime.js';

// ─── 상수 ─────────────────────────────────────────────

/** 폴링 주기 (ms) */
const POLL_INTERVAL_MS = 5000;

/** 태스크 타임아웃 (ms) — 10분 */
const TASK_TIMEOUT_MS = 10 * 60 * 1000;

// ─── 상태 ─────────────────────────────────────────────

let pollingIntervalId: NodeJS.Timeout | null = null;
let slackAppRef: App | null = null;
let isProcessing = false;

// ─── Slack 알림 ───────────────────────────────────────

/**
 * 큐 시작 알림 (enqueue 직후)
 */
export const postQueueStarted = async (
  slackApp: App,
  channel: string,
  threadTs: string,
  tasks: Array<{ sequence: number; agent: string; task: string }>,
): Promise<void> => {
  const taskList = tasks
    .map((t) => `  • ${t.sequence + 1}번: ${agentDisplayName(t.agent)} — ${truncate(t.task, 100)}`)
    .join('\n');

  const message = `📋 *작업 예약* — ${tasks.length}개 작업을 순서대로 전달합니다\n${taskList}`;

  try {
    await slackApp.client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: message,
    });
  } catch (err) {
    console.error('[queue-processor] 큐 시작 알림 실패:', err);
  }
};

/**
 * 태스크 진행 상황 알림
 */
const postTaskProgress = async (
  slackApp: App,
  task: TaskQueueRow,
  status: 'running' | 'completed' | 'failed',
  result?: string,
  error?: string,
): Promise<void> => {
  let message: string;
  const taskNum = task.sequence + 1;
  const totalCount = await getQueueTotalCount(task.parent_queue_id);
  const displayName = agentDisplayName(task.agent);

  switch (status) {
    case 'running':
      message = `🔄 *작업 진행 중 [${taskNum}/${totalCount}]* — ${displayName}\n  • ${truncate(task.task, 100)}`;
      break;
    case 'completed': {
      const duration = task.started_at
        ? Math.round((Date.now() - task.started_at) / 1000)
        : 0;
      message = `✅ *작업 완료 [${taskNum}/${totalCount}]* — ${displayName} (${duration}초 소요)\n  • ${truncate(task.task, 100)}`;
      break;
    }
    case 'failed':
      message = `❌ *작업 실패 [${taskNum}/${totalCount}]* — ${displayName}\n  • ${truncate(task.task, 100)}\n  • 오류: ${truncate(error ?? '알 수 없음', 100)}`;
      break;
  }

  try {
    await slackApp.client.chat.postMessage({
      channel: task.channel,
      thread_ts: task.thread_ts,
      text: message,
    });
  } catch (err) {
    console.error('[queue-processor] 진행 알림 실패:', err);
  }
};

// ─── 폴링 루프 ────────────────────────────────────────

/**
 * 다음 태스크 처리
 */
const processNextTask = async (): Promise<void> => {
  if (isProcessing) {
    console.log('[queue-processor] 이미 처리 중, 스킵');
    return;
  }

  if (!slackAppRef) {
    console.error('[queue-processor] slackApp 참조 없음');
    return;
  }

  const task = getNextTask();
  if (!task) {
    return; // 처리할 태스크 없음
  }

  isProcessing = true;
  console.log(`[queue-processor] 태스크 시작: ${task.id} (${task.agent})`);

  try {
    // 상태 → running
    markRunning(task.id);
    task.started_at = Date.now(); // in-memory 스냅샷 동기화 (duration 계산 오류 방지)

    // Slack 진행 알림
    await postTaskProgress(slackAppRef, task, 'running');

    // 이전 태스크 결과 로드 (의존성 있는 경우)
    const prevResult = getPreviousTaskResult(task.parent_queue_id, task.depends_on);

    // 태스크 프롬프트 구성
    const taskPrompt = buildTaskPrompt(task, prevResult);

    // SlackEvent 구성 (handleMessage 호환)
    const pseudoEvent: SlackEvent = {
      type: 'queue_task',
      channel: task.channel,
      channel_name: 'queue',
      user: 'queue-processor',
      text: taskPrompt,
      ts: task.id, // 태스크 ID를 메시지 ts로 사용
      thread_ts: task.thread_ts,
      mentions: [],
      raw: {},
    };

    // 에이전트 실행 (독립 세션)
    const result = await Promise.race([
      handleMessage(
        task.agent,
        pseudoEvent,
        'queue-task',
        slackAppRef,
        true,  // skipReaction
        true,  // skipPosting (결과를 직접 게시)
        task.tier as 'high' | 'standard' | 'fast',
      ),
      timeout(TASK_TIMEOUT_MS),
    ]) as HandleMessageResult | 'TIMEOUT';

    if (result === 'TIMEOUT') {
      throw new Error(`태스크 타임아웃 (${TASK_TIMEOUT_MS / 1000}초)`);
    }

    // 완료 처리
    markCompleted(task.id, result.text);
    await postTaskProgress(slackAppRef, task, 'completed', result.text);

    // 에이전트 실제 응답을 스레드에 게시
    if (result.text) {
      try {
        await slackAppRef.client.chat.postMessage({
          channel: task.channel,
          thread_ts: task.thread_ts,
          text: result.text,
        });
      } catch (err) {
        console.error('[queue-processor] 에이전트 결과 게시 실패:', err);
      }
    }

    console.log(`[queue-processor] 태스크 완료: ${task.id}`);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[queue-processor] 태스크 실패: ${task.id}`, err);

    // error_max_turns 감지 시 재시도 (max_retries 내)
    const isMaxTurnsError = errorMsg.includes('error_max_turns') || errorMsg.includes('max_turns');
    if (isMaxTurnsError && task.retry_count < task.max_retries) {
      console.log(`[queue-processor] error_max_turns 재시도: ${task.id} (${task.retry_count + 1}/${task.max_retries})`);
      requeueForRetry(task.id);
      try {
        await slackAppRef.client.chat.postMessage({
          channel: task.channel,
          thread_ts: task.thread_ts,
          text: `🔄 *${agentDisplayName(task.agent)} 작업 재시도 중 [${task.retry_count + 1}/${task.max_retries}]* — 대화 한도 초과로 이어서 계속합니다`,
        });
      } catch {
        // 알림 실패 무시
      }
    } else {
      // 실패 처리
      markFailed(task.id, errorMsg);
      await postTaskProgress(slackAppRef, task, 'failed', undefined, errorMsg);

      // 의존하는 후속 태스크 스킵
      const skipped = skipDependentTasks(task.parent_queue_id, task.sequence);
      if (skipped > 0) {
        try {
          await slackAppRef.client.chat.postMessage({
            channel: task.channel,
            thread_ts: task.thread_ts,
            text: `:fast_forward: ${skipped}개 후속 태스크 스킵됨 (의존성 실패)`,
          });
        } catch {
          // 알림 실패 무시
        }
      }
    }
  } finally {
    isProcessing = false;
  }
};

// ─── 초기화 / 정리 ────────────────────────────────────

/**
 * 폴링 루프 시작
 */
export const startQueueProcessor = (slackApp: App): void => {
  if (pollingIntervalId) {
    console.log('[queue-processor] 이미 실행 중');
    return;
  }

  slackAppRef = slackApp;

  // 시작 시 orphan 태스크 복구
  const recovered = recoverOrphanTasks();
  if (recovered > 0) {
    console.log(`[queue-processor] orphan 태스크 ${recovered}개 복구`);
  }

  // 폴링 루프 시작
  pollingIntervalId = setInterval(processNextTask, POLL_INTERVAL_MS);
  console.log(`[queue-processor] 시작 (${POLL_INTERVAL_MS}ms 주기)`);

  // 즉시 한 번 실행
  processNextTask().catch(console.error);
};

/**
 * 폴링 루프 중지
 */
export const stopQueueProcessor = (): void => {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
    console.log('[queue-processor] 중지');
  }
};

// ─── 유틸리티 ─────────────────────────────────────────

/**
 * 태스크 프롬프트 구성
 */
const buildTaskPrompt = (task: TaskQueueRow, prevResult: string | null): string => {
  let prompt = `[큐 태스크 실행]\n\n*작업:* ${task.task}`;

  if (prevResult) {
    prompt += `\n\n*이전 태스크 결과:*\n${truncate(prevResult, 3000)}`;
  }

  if (task.context) {
    prompt += `\n\n*추가 컨텍스트:*\n${task.context}`;
  }

  prompt += '\n\n이 태스크는 큐 시스템에서 실행됩니다. 결과를 간결하게 보고하세요.';

  return prompt;
};

/**
 * 에이전트 표시 이름
 */
export const agentDisplayName = (agent: string): string => {
  const names: Record<string, string> = {
    pm: 'Marge (PM)',
    designer: 'Krusty (Designer)',
    frontend: 'Bart (Frontend)',
    backend: 'Homer (Backend)',
    researcher: 'Lisa (Researcher)',
    secops: 'Wiggum (SecOps)',
  };
  return names[agent] ?? agent;
};

/**
 * 문자열 자르기
 */
const truncate = (str: string, maxLen: number): string => {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
};

/**
 * 타임아웃 Promise
 */
const timeout = (ms: number): Promise<'TIMEOUT'> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve('TIMEOUT'), ms);
  });
};

/**
 * 큐 전체 태스크 수 조회
 */
const getQueueTotalCount = async (parentQueueId: string): Promise<number> => {
  // queue-manager에서 직접 import하면 순환 의존 위험 → 여기서 직접 조회
  const { getDb } = await import('./db.js');
  const db = getDb();
  const row = db
    .prepare('SELECT COUNT(*) as c FROM task_queue WHERE parent_queue_id = ?')
    .get(parentQueueId) as { c: number };
  return row.c;
};
