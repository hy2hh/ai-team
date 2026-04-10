/**
 * Task Queue Manager
 * 복잡한 작업을 Task 단위로 분해 → SQLite 큐에 저장 → 독립 세션으로 순차 실행
 */
import { randomUUID } from 'crypto';
import { getDb } from './db.js';
import { createCard } from './kanban-sync.js';

// ─── 타입 정의 ────────────────────────────────────────

export interface QueueTask {
  agent: string;
  task: string;
  tier?: 'high' | 'standard' | 'fast';
  dependsOn?: number; // 선행 sequence index (0-based)
  priority?: number;  // 1(긴급) ~ 10(낮음), 기본값 5. 낮을수록 먼저 실행
}

export interface EnqueueResult {
  queueId: string;    // parent_queue_id
  taskCount: number;
  tasks: Array<{ id: string; sequence: number; agent: string; task: string }>;
}

export interface TaskQueueRow {
  id: string;
  parent_queue_id: string;
  sequence: number;
  depends_on: number | null;
  agent: string;
  task: string;
  context: string | null;
  tier: string;
  status: string;
  result: string | null;
  error: string | null;
  thread_ts: string;
  channel: string;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  retry_count: number;
  max_retries: number;
  kanban_card_id: number | null;
  checkpoint: string | null;
  priority: number;
}

export interface QueueStatusSummary {
  queueId: string;
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  skipped: number;
  tasks: Array<{
    sequence: number;
    agent: string;
    status: string;
    task: string;
  }>;
}

// ─── 상수 ─────────────────────────────────────────────

/** 동일 스레드에서 동시에 실행 가능한 큐 수 제한 */
const MAX_CONCURRENT_QUEUES_PER_THREAD = 1;

/** 결과 저장 최대 길이 (truncation) */
const MAX_RESULT_LENGTH = 5000;

// ─── 큐 등록 ──────────────────────────────────────────

/**
 * 복수 Task를 큐에 등록
 * @returns EnqueueResult (queueId, taskCount, tasks)
 */
export const enqueue = (
  tasks: QueueTask[],
  threadTs: string,
  channel: string,
): EnqueueResult => {
  if (tasks.length === 0) {
    throw new Error('enqueue: tasks 배열이 비어 있습니다');
  }

  const db = getDb();
  const queueId = randomUUID();
  const now = Date.now();

  const insertStmt = db.prepare(`
    INSERT INTO task_queue (
      id, parent_queue_id, sequence, depends_on, agent, task, tier,
      status, thread_ts, channel, created_at, retry_count, max_retries, priority
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, 0, 1, ?)
  `);

  const result: EnqueueResult = {
    queueId,
    taskCount: tasks.length,
    tasks: [],
  };

  db.transaction(() => {
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const taskId = randomUUID();
      insertStmt.run(
        taskId,
        queueId,
        i, // sequence (0-based)
        t.dependsOn ?? null,
        t.agent,
        t.task,
        t.tier ?? 'standard',
        threadTs,
        channel,
        now,
        Math.min(10, Math.max(1, t.priority ?? 5)), // priority 1~10 범위 강제
      );
      result.tasks.push({
        id: taskId,
        sequence: i,
        agent: t.agent,
        task: t.task,
      });
    }
  })();

  console.log(`[queue] 등록: ${queueId} (${tasks.length}개 태스크)`);
  return result;
};

// ─── 다음 실행 가능한 태스크 조회 ─────────────────────

/**
 * 실행 가능한 다음 태스크 반환
 * - status = 'queued'
 * - depends_on IS NULL OR 해당 sequence의 task가 completed
 * - 동일 스레드에서 이미 running 상태인 큐가 있으면 null 반환
 */
export const getNextTask = (): TaskQueueRow | null => {
  const tasks = getNextTasks(1);
  return tasks.length > 0 ? tasks[0] : null;
};

/**
 * 실행 가능한 독립 태스크 목록 반환 (최대 maxCount개)
 *
 * Claude Code의 partitionToolCalls 패턴 적용:
 * - 서로 다른 스레드의 태스크는 독립 → 병렬 실행 가능
 * - 같은 큐에서 depends_on이 없는 태스크는 독립 → 병렬 실행 가능
 * - 같은 스레드에서 이미 실행 중이면 제외
 *
 * @param maxCount - 최대 반환 수 (기본 3)
 * @returns 실행 가능한 태스크 배열
 */
export const getNextTasks = (maxCount = 3): TaskQueueRow[] => {
  const db = getDb();

  // 현재 running 상태인 큐가 있는 스레드 목록 (동시 실행 제한)
  const runningThreads = db
    .prepare(`SELECT DISTINCT thread_ts FROM task_queue WHERE status = 'running'`)
    .all() as Array<{ thread_ts: string }>;
  const runningThreadSet = new Set(runningThreads.map((r) => r.thread_ts));

  // queued 상태 중 priority 높은(숫자 낮은) 것 → 오래된 것 순으로 조회
  const candidates = db
    .prepare(`
      SELECT * FROM task_queue
      WHERE status = 'queued'
      ORDER BY priority ASC, created_at ASC, sequence ASC
      LIMIT 20
    `)
    .all() as TaskQueueRow[];

  const result: TaskQueueRow[] = [];
  // 이번 배치에서 선택한 스레드 추적 (같은 스레드 중복 방지)
  const selectedThreads = new Set<string>();

  for (const task of candidates) {
    if (result.length >= maxCount) {
      break;
    }

    // 동일 스레드에서 이미 실행 중이거나 이번 배치에서 선택됨 → 스킵
    if (runningThreadSet.has(task.thread_ts) || selectedThreads.has(task.thread_ts)) {
      continue;
    }

    // 의존성 체크
    if (task.depends_on !== null) {
      const dependency = db
        .prepare(`
          SELECT status FROM task_queue
          WHERE parent_queue_id = ? AND sequence = ?
        `)
        .get(task.parent_queue_id, task.depends_on) as { status: string } | undefined;

      if (!dependency || dependency.status !== 'completed') {
        continue;
      }
    }

    result.push(task);
    selectedThreads.add(task.thread_ts);
  }

  return result;
};

// ─── 상태 업데이트 ────────────────────────────────────

export const markRunning = (id: string): void => {
  const db = getDb();
  db.prepare(`
    UPDATE task_queue
    SET status = 'running', started_at = ?
    WHERE id = ?
  `).run(Date.now(), id);
  console.log(`[queue] running: ${id}`);
};

export const markCompleted = (id: string, result: string): void => {
  const db = getDb();
  const truncatedResult = result.slice(0, MAX_RESULT_LENGTH);
  db.prepare(`
    UPDATE task_queue
    SET status = 'completed', result = ?, completed_at = ?
    WHERE id = ?
  `).run(truncatedResult, Date.now(), id);
  console.log(`[queue] completed: ${id}`);
};

export const markFailed = (id: string, error: string): void => {
  const db = getDb();
  db.prepare(`
    UPDATE task_queue
    SET status = 'failed', error = ?, completed_at = ?
    WHERE id = ?
  `).run(error.slice(0, 1000), Date.now(), id);
  console.log(`[queue] failed: ${id} — ${error.slice(0, 100)}`);
};

/**
 * error_max_turns 발생 시 재시도를 위해 queued 상태로 복원
 * retry_count < max_retries 조건을 확인해야 함 (호출 전 체크)
 */
export const requeueForRetry = (
  id: string,
  checkpoint?: string,
): void => {
  const db = getDb();
  db.prepare(`
    UPDATE task_queue
    SET status = 'queued', retry_count = retry_count + 1,
        started_at = NULL, error = NULL, checkpoint = ?
    WHERE id = ?
  `).run(checkpoint ?? null, id);
  console.log(
    `[queue] requeued for retry: ${id}${checkpoint ? ' (with checkpoint)' : ''}`,
  );
};

export const markSkipped = (id: string, reason: string): void => {
  const db = getDb();
  db.prepare(`
    UPDATE task_queue
    SET status = 'skipped', error = ?, completed_at = ?
    WHERE id = ?
  `).run(reason.slice(0, 500), Date.now(), id);
  console.log(`[queue] skipped: ${id}`);
};
// ─── 칸반 카드 ID 관리 ────────────────────────────────

/**
 * 태스크에 칸반 카드 ID 저장
 */
export const setKanbanCardId = (taskId: string, cardId: number): void => {
  const db = getDb();
  db.prepare('UPDATE task_queue SET kanban_card_id = ? WHERE id = ?').run(cardId, taskId);
};

/**
 * 태스크의 칸반 카드 ID 조회
 */
export const getKanbanCardId = (taskId: string): number | null => {
  const db = getDb();
  const row = db
    .prepare('SELECT kanban_card_id FROM task_queue WHERE id = ?')
    .get(taskId) as { kanban_card_id: number | null } | undefined;
  return row?.kanban_card_id ?? null;
};

/**
 * queue에서 활성(queued/running) 태스크의 칸반 카드 ID 목록 조회
 * cleanup 시 활성 카드를 보호하기 위해 사용
 */
export const getActiveKanbanCardIds = (): number[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT kanban_card_id FROM task_queue
       WHERE status IN ('queued', 'running') AND kanban_card_id IS NOT NULL`,
    )
    .all() as Array<{ kanban_card_id: number }>;
  return rows.map((r) => r.kanban_card_id);
};

/**
 * PM 플랜 기반으로 enqueue된 태스크들을 칸반 Backlog에 카드로 생성
 * - PM이 해석한 task 설명을 제목으로 사용 (원문 텍스트 아님)
 */
export const createBacklogCards = async (result: EnqueueResult): Promise<void> => {
  for (const task of result.tasks) {
    const title = task.task.slice(0, 200);
    const cardId = await createCard(title, task.agent, `큐 태스크 [${task.sequence + 1}/${result.taskCount}]`);
    if (cardId !== null) {
      setKanbanCardId(task.id, cardId);
    }
  }
};

// ─── 의존 태스크 스킵 처리 ─────────────────────────────

/**
 * 실패한 태스크에 의존하는 후속 태스크들을 skipped 처리
 */
export const skipDependentTasks = (parentQueueId: string, failedSequence: number): number => {
  const db = getDb();

  // 직접 의존 + 간접 의존(의존 체인) 모두 처리
  // 단순 구현: 실패한 sequence보다 큰 sequence 중 depends_on이 있는 것만 skipped
  const toSkip = db
    .prepare(`
      SELECT id, sequence FROM task_queue
      WHERE parent_queue_id = ?
        AND status = 'queued'
        AND depends_on IS NOT NULL
        AND sequence > ?
    `)
    .all(parentQueueId, failedSequence) as Array<{ id: string; sequence: number }>;

  for (const row of toSkip) {
    markSkipped(row.id, `의존 태스크 (sequence ${failedSequence}) 실패로 스킵됨`);
  }

  return toSkip.length;
};

// ─── 큐 취소 (⛔ 리액션) ──────────────────────────────

/**
 * 특정 스레드의 모든 queued 상태 태스크를 skipped 처리
 * @returns 취소된 태스크 수와 해당 칸반 카드 ID 목록
 */
export const cancelQueueByThread = (threadTs: string): { count: number; kanbanCardIds: number[] } => {
  const db = getDb();

  // 취소 대상의 칸반 카드 ID 먼저 조회
  const cards = db
    .prepare(`
      SELECT kanban_card_id FROM task_queue
      WHERE thread_ts = ? AND status IN ('queued', 'running') AND kanban_card_id IS NOT NULL
    `)
    .all(threadTs) as Array<{ kanban_card_id: number }>;

  const result = db
    .prepare(`
      UPDATE task_queue
      SET status = 'skipped', error = '사용자 취소 (⛔)', completed_at = ?
      WHERE thread_ts = ? AND status IN ('queued', 'running')
    `)
    .run(Date.now(), threadTs);
  console.log(`[queue] 취소: thread ${threadTs} (${result.changes}개 태스크)`);
  return {
    count: result.changes,
    kanbanCardIds: cards.map((c) => c.kanban_card_id),
  };
};

/**
 * 특정 스레드에서 현재 running 상태인 태스크 ID 목록 반환
 *
 * ⛔ 이모지로 전체 중단 시 각 task.id로 cancelAgent()를 호출해야
 * 큐 태스크 에이전트(activeAgents key = task.id)가 실제로 중단됨
 */
export const getRunningTaskIdsByThread = (threadTs: string): string[] => {
  const db = getDb();
  const rows = db
    .prepare(`SELECT id FROM task_queue WHERE thread_ts = ? AND status = 'running'`)
    .all(threadTs) as Array<{ id: string }>;
  return rows.map((r) => r.id);
};

/**
 * 특정 큐 ID의 모든 queued 상태 태스크를 skipped 처리
 */
export const cancelQueue = (parentQueueId: string): number => {
  const db = getDb();
  const result = db
    .prepare(`
      UPDATE task_queue
      SET status = 'skipped', error = '사용자 취소 (⛔)', completed_at = ?
      WHERE parent_queue_id = ? AND status = 'queued'
    `)
    .run(Date.now(), parentQueueId);
  console.log(`[queue] 취소: queue ${parentQueueId} (${result.changes}개 태스크)`);
  return result.changes;
};

// ─── 이전 태스크 결과 조회 ─────────────────────────────

/**
 * 의존하는 이전 태스크의 결과 반환
 */
export const getPreviousTaskResult = (
  parentQueueId: string,
  dependsOn: number | null,
): string | null => {
  if (dependsOn === null) return null;

  const db = getDb();
  const row = db
    .prepare(`
      SELECT result FROM task_queue
      WHERE parent_queue_id = ? AND sequence = ?
    `)
    .get(parentQueueId, dependsOn) as { result: string | null } | undefined;

  return row?.result ?? null;
};

// ─── 큐 상태 조회 ─────────────────────────────────────

/**
 * 특정 스레드의 최신 큐 상태 반환
 */
export const getQueueStatus = (threadTs: string): QueueStatusSummary | null => {
  const db = getDb();

  // 해당 스레드의 가장 최근 큐
  const latestQueue = db
    .prepare(`
      SELECT parent_queue_id FROM task_queue
      WHERE thread_ts = ?
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(threadTs) as { parent_queue_id: string } | undefined;

  if (!latestQueue) return null;

  const queueId = latestQueue.parent_queue_id;

  const tasks = db
    .prepare(`
      SELECT sequence, agent, status, task FROM task_queue
      WHERE parent_queue_id = ?
      ORDER BY sequence ASC
    `)
    .all(queueId) as Array<{
      sequence: number;
      agent: string;
      status: string;
      task: string;
    }>;

  const summary: QueueStatusSummary = {
    queueId,
    total: tasks.length,
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    tasks,
  };

  for (const t of tasks) {
    if (t.status === 'queued') summary.queued++;
    else if (t.status === 'running') summary.running++;
    else if (t.status === 'completed') summary.completed++;
    else if (t.status === 'failed') summary.failed++;
    else if (t.status === 'skipped') summary.skipped++;
  }

  return summary;
};

// ─── 오펀 태스크 복구 ─────────────────────────────────

/**
 * Bridge 재시작 시 running 상태로 남은 태스크를 queued로 복구
 * (retry_count 증가, max_retries 초과 시 failed)
 */
export const recoverOrphanTasks = (): number => {
  const db = getDb();

  // running 상태 중 10분 이상 경과한 것 = orphan
  const orphanThreshold = Date.now() - 10 * 60 * 1000;

  const orphans = db
    .prepare(`
      SELECT id, retry_count, max_retries FROM task_queue
      WHERE status = 'running' AND started_at < ?
    `)
    .all(orphanThreshold) as Array<{
      id: string;
      retry_count: number;
      max_retries: number;
    }>;

  let recovered = 0;
  for (const orphan of orphans) {
    if (orphan.retry_count >= orphan.max_retries) {
      // 재시도 한도 초과 → failed
      markFailed(orphan.id, 'max_retries 초과 (orphan 복구 실패)');
    } else {
      // 재시도 가능 → queued로 복구
      db.prepare(`
        UPDATE task_queue
        SET status = 'queued', retry_count = retry_count + 1, started_at = NULL
        WHERE id = ?
      `).run(orphan.id);
      recovered++;
      console.log(`[queue] 복구: ${orphan.id} (retry ${orphan.retry_count + 1})`);
    }
  }

  return recovered;
};

// ─── 통계 조회 ────────────────────────────────────────

export interface QueueStats {
  totalQueued: number;
  totalRunning: number;
  totalCompletedToday: number;
  totalFailedToday: number;
}

export const getQueueStats = (): QueueStats => {
  const db = getDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const queued = db
    .prepare(`SELECT COUNT(*) as c FROM task_queue WHERE status = 'queued'`)
    .get() as { c: number };

  const running = db
    .prepare(`SELECT COUNT(*) as c FROM task_queue WHERE status = 'running'`)
    .get() as { c: number };

  const completedToday = db
    .prepare(`
      SELECT COUNT(*) as c FROM task_queue
      WHERE status = 'completed' AND completed_at >= ?
    `)
    .get(todayStart.getTime()) as { c: number };

  const failedToday = db
    .prepare(`
      SELECT COUNT(*) as c FROM task_queue
      WHERE status = 'failed' AND completed_at >= ?
    `)
    .get(todayStart.getTime()) as { c: number };

  return {
    totalQueued: queued.c,
    totalRunning: running.c,
    totalCompletedToday: completedToday.c,
    totalFailedToday: failedToday.c,
  };
};
