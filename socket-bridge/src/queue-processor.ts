/**
 * Task Queue Processor
 * 폴링 루프로 큐에서 태스크를 꺼내 독립 에이전트 세션으로 실행
 */
import type { App } from '@slack/bolt';
import type { SlackEvent } from './types.js';
import {
  getNextTasks,
  markRunning,
  markCompleted,
  markFailed,
  skipDependentTasks,
  getPreviousTaskResult,
  recoverOrphanTasks,
  requeueForRetry,
  getKanbanCardId,
  type TaskQueueRow,
  type QueueStatusSummary,
} from './queue-manager.js';
import { moveToDone, moveToBlocked } from './kanban-sync.js';
import { handleMessage, type HandleMessageResult } from './agent-runtime.js';
import { emit } from './hook-events.js';
// buildMessageBlocks — handleMessage 내부에서 처리하므로 별도 import 불필요

// ─── 상수 ─────────────────────────────────────────────

/** 폴링 주기 (ms) */
const POLL_INTERVAL_MS = 5000;

/** 태스크 타임아웃 (ms) — 10분 */
const TASK_TIMEOUT_MS = 10 * 60 * 1000;

/** 재시도 backoff 대기 시간 (ms) — 30초 후 재시도 (브리지 안정화 대기) */
const RETRY_BACKOFF_MS = 30_000;

// ─── 상태 ─────────────────────────────────────────────

let pollingIntervalId: NodeJS.Timeout | null = null;
let slackAppRef: App | null = null;
// isProcessing 단일 플래그 → activeTaskCount + MAX_PARALLEL_TASKS로 대체

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

/** 현재 병렬 실행 중인 태스크 수 */
let activeTaskCount = 0;

/** 최대 병렬 태스크 수 */
const MAX_PARALLEL_TASKS = 3;

/**
 * 다음 태스크 배치 처리 — 독립 태스크는 병렬 실행
 *
 * Claude Code의 partitionToolCalls 패턴 적용:
 * 서로 다른 스레드의 태스크는 독립이므로 동시 실행 가능
 */
const processNextTask = async (): Promise<void> => {
  if (!slackAppRef) {
    console.error('[queue-processor] slackApp 참조 없음');
    return;
  }

  // 남은 슬롯만큼 태스크 가져오기
  const availableSlots = MAX_PARALLEL_TASKS - activeTaskCount;
  if (availableSlots <= 0) {
    return;
  }

  const tasks = getNextTasks(availableSlots);
  if (tasks.length === 0) {
    return;
  }

  if (tasks.length > 1) {
    console.log(
      `[queue-processor] 병렬 실행: ${tasks.map((t) => `${t.agent}(${t.id.slice(0, 8)})`).join(', ')}`,
    );
  }

  // 각 태스크를 독립적으로 실행 (병렬)
  for (const task of tasks) {
    activeTaskCount++;
    processSingleTask(task).finally(() => {
      activeTaskCount--;
    });
  }
};

/**
 * 단일 태스크 처리 (기존 processNextTask 로직)
 */
const processSingleTask = async (task: TaskQueueRow): Promise<void> => {
  const slackApp = slackAppRef!; // processNextTask에서 null 체크 완료
  console.log(`[queue-processor] 태스크 시작: ${task.id} (${task.agent})`);

  // Backlog 카드 ID 조회 (PM이 생성한 카드) — catch 블록에서도 접근 필요
  const kanbanCardId = getKanbanCardId(task.id);

  try {
    // 상태 → running
    markRunning(task.id);
    task.started_at = Date.now(); // in-memory 스냅샷 동기화 (duration 계산 오류 방지)

    // Slack 진행 알림
    await postTaskProgress(slackApp, task, 'running');

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
      ts: task.id,
      thread_ts: task.thread_ts,
      threadTopic: `queue-task:${task.id}`, // 태스크별 독립 세션 강제
      mentions: [],
      raw: {},
    };

    // 에이전트 실행 (독립 세션, 기존 Backlog 카드 ID 전달)
    const result = await Promise.race([
      handleMessage(
        task.agent,
        pseudoEvent,
        'queue-task',
        slackApp,
        true,  // skipReaction
        false, // skipPosting=false — "작업중" 메시지를 결과로 직접 업데이트
        task.tier as 'high' | 'standard' | 'fast',
        kanbanCardId,
      ),
      timeout(TASK_TIMEOUT_MS),
    ]) as HandleMessageResult | 'TIMEOUT';

    if (result === 'TIMEOUT') {
      throw new Error(`태스크 타임아웃 (${TASK_TIMEOUT_MS / 1000}초)`);
    }

    // error_max_turns 감지 → 체크포인트 저장 후 재시도
    if (result.isMaxTurns && task.retry_count < task.max_retries) {
      const checkpoint = result.partialResult
        ? truncate(result.partialResult, 3000)
        : undefined;
      console.log(
        `[queue-processor] max_turns 도달, 체크포인트 저장 후 재시도: ${task.id}`,
      );
      setTimeout(() => {
        requeueForRetry(task.id, checkpoint);
        console.log(`[queue-processor] 체크포인트 재큐잉 완료: ${task.id}`);
      }, RETRY_BACKOFF_MS);
      try {
        await slackApp.client.chat.postMessage({
          channel: task.channel,
          thread_ts: task.thread_ts,
          text: `🔄 *${agentDisplayName(task.agent)} 작업 재시도 대기 중 [${task.retry_count + 1}/${task.max_retries}]* — 대화 한도 초과, 체크포인트에서 이어서 계속합니다`,
        });
      } catch {
        // 알림 실패 무시
      }
      return;
    }

    // 완료 처리
    markCompleted(task.id, result.text);

    // 칸반 카드 이동 (fire-and-forget)
    const doneCardId = result.kanbanCardId ?? kanbanCardId;
    if (doneCardId !== null && doneCardId !== undefined) {
      if (result.isMaxTurns) {
        moveToBlocked(doneCardId).catch((err) =>
          console.warn('[kanban-sync] moveToBlocked 실패:', err),
        );
      } else {
        moveToDone(doneCardId).catch((err) =>
          console.warn('[kanban-sync] moveToDone 실패:', err),
        );
      }
    }

    // 결과는 handleMessage 내부에서 "작업중" 메시지를 업데이트하여 표시 (별도 postMessage 없음)
    console.log(`[queue-processor] 태스크 완료: ${task.id}`);
    emit({
      type: 'queue.step.completed',
      timestamp: Date.now(),
      source: task.agent,
      queueId: task.parent_queue_id ?? task.id,
      channel: task.channel,
      threadTs: task.thread_ts,
      stepSequence: task.sequence,
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[queue-processor] 태스크 실패: ${task.id}`, err);

    // 재시도 대상 에러: error_max_turns + 타임아웃 + 연결 오류 (브리지 불안정 포함)
    const isRetryableError =
      errorMsg.includes('error_max_turns') ||
      errorMsg.includes('max_turns') ||
      errorMsg.includes('타임아웃') ||
      errorMsg.includes('ECONNRESET') ||
      errorMsg.includes('ECONNREFUSED') ||
      errorMsg.includes('ETIMEDOUT') ||
      errorMsg.includes('socket hang up');

    if (isRetryableError && task.retry_count < task.max_retries) {
      console.log(
        `[queue-processor] 재시도 예약: ${task.id} (${task.retry_count + 1}/${task.max_retries}, ${RETRY_BACKOFF_MS / 1000}초 후) — 원인: ${errorMsg.slice(0, 80)}`,
      );
      // backoff: 즉시 재시도하지 않고 대기 후 재큐잉 (브리지 안정화 구간 회피)
      setTimeout(() => {
        requeueForRetry(task.id);
        console.log(`[queue-processor] backoff 완료, 재큐잉: ${task.id}`);
      }, RETRY_BACKOFF_MS);
      try {
        const isMaxTurns = errorMsg.includes('max_turns');
        const reason = isMaxTurns ? '대화 한도 초과로 이어서 계속합니다' : '일시적 오류 — 잠시 후 재시도합니다';
        await slackApp.client.chat.postMessage({
          channel: task.channel,
          thread_ts: task.thread_ts,
          text: `🔄 *${agentDisplayName(task.agent)} 작업 재시도 대기 중 [${task.retry_count + 1}/${task.max_retries}]* — ${reason}`,
        });
      } catch {
        // 알림 실패 무시
      }
    } else {
      // 실패 처리
      markFailed(task.id, errorMsg);

      // 칸반 Blocked 이동 (fire-and-forget)
      if (kanbanCardId !== null) {
        moveToBlocked(kanbanCardId).catch((blockedErr) =>
          console.warn('[kanban-sync] moveToBlocked 실패:', blockedErr),
        );
      }

      await postTaskProgress(slackApp, task, 'failed', undefined, errorMsg);

      // 의존하는 후속 태스크 스킵
      const skipped = skipDependentTasks(task.parent_queue_id, task.sequence);
      if (skipped > 0) {
        try {
          await slackApp.client.chat.postMessage({
            channel: task.channel,
            thread_ts: task.thread_ts,
            text: `:fast_forward: ${skipped}개 후속 태스크 스킵됨 (의존성 실패)`,
          });
        } catch {
          // 알림 실패 무시
        }
      }
    }
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
  // 재시도 + checkpoint 존재 → "이어서 작업" 패턴
  if (task.retry_count > 0 && task.checkpoint) {
    const parts = [
      `[큐 태스크 이어서 실행 — 재시도 #${task.retry_count}]`,
      '',
      `*원래 작업:* ${task.task}`,
      '',
      '*이전 진행 상태 (대화 한도 도달로 중단됨):*',
      truncate(task.checkpoint, 3000),
    ];
    if (task.context) {
      parts.push('', `*추가 컨텍스트:*\n${task.context}`);
    }
    parts.push(
      '',
      '*지시사항:*',
      '1. 위 이전 진행 상태를 기반으로 남은 작업을 이어서 완료하세요',
      '2. 이미 완료된 작업을 반복하지 마세요',
      '3. 결과를 간결하게 보고하세요',
    );
    return parts.join('\n');
  }

  // 기존 로직 (첫 실행 또는 checkpoint 없는 재시도)
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
    qa: 'Chalmers (QA)',
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
