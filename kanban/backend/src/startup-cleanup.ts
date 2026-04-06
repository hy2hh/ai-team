import Database from 'better-sqlite3';
import path from 'path';
import { getDb } from './db';

/** Done 카드 TTL (3일) */
const DONE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/** In Progress / Blocked 카드 stale 기준 (24시간) */
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** 컬럼 ID 상수 */
const COLUMN = {
  BACKLOG: 1,
  IN_PROGRESS: 2,
  REVIEW: 3,
  DONE: 4,
  BLOCKED: 5,
} as const;

/** memory.db 경로 (bridge와 공유하는 task_queue 소스) */
const MEMORY_DB_PATH =
  process.env.MEMORY_DB_PATH ||
  path.join(__dirname, '..', '..', '..', '.memory', 'memory.db');

interface TaskRow {
  kanban_card_id: number;
  status: string;
  completed_at: number | null;
}

interface CardRow {
  id: number;
  column_id: number;
  title: string;
  updated_at: string;
}

/**
 * task_queue에서 칸반 카드와 연결된 태스크 상태 조회
 */
const getTaskStates = (): Map<number, string> => {
  const map = new Map<number, string>();

  try {
    const memDb = new Database(MEMORY_DB_PATH, { readonly: true });
    const rows = memDb
      .prepare(
        'SELECT kanban_card_id, status FROM task_queue WHERE kanban_card_id IS NOT NULL',
      )
      .all() as TaskRow[];

    for (const row of rows) {
      const existing = map.get(row.kanban_card_id);
      // 같은 카드에 여러 태스크가 있으면 가장 활성 상태를 우선
      if (
        !existing ||
        prioritize(row.status) > prioritize(existing)
      ) {
        map.set(row.kanban_card_id, row.status);
      }
    }

    memDb.close();
  } catch (err) {
    console.warn(
      '[startup-cleanup] memory.db 읽기 실패 — task 동기화 건너뜀:',
      (err as Error).message,
    );
  }

  return map;
};

/** 태스크 상태 우선순위 (높을수록 활성) */
const prioritize = (status: string): number => {
  switch (status) {
    case 'running':
      return 3;
    case 'queued':
      return 2;
    case 'completed':
      return 1;
    case 'failed':
      return 0;
    default:
      return -1;
  }
};

/**
 * 서버 시작 시 보드 자동 정리 + task_queue 동기화
 *
 * 정책:
 * 1. In Progress / Review 카드 → task_queue 상태와 동기화
 *    - task 완료 → Done 이동
 *    - task 진행중/대기 → 유지
 *    - task 실패 or 매칭 없음 → Blocked 이동
 * 2. Blocked 카드 중 24시간 경과 → 삭제
 * 3. Backlog 카드 중 24시간 경과 → 삭제
 * 4. Done 카드 중 3일(72h) 경과 → 삭제
 */
export const startupCleanup = (): void => {
  const db = getDb();
  const taskStates = getTaskStates();

  const stats = { toDone: 0, toBlocked: 0, kept: 0, deleted: 0 };

  db.transaction(() => {
    // Step 1: In Progress / Review 카드 동기화
    const activeCards = db
      .prepare(
        `SELECT id, column_id, title, updated_at FROM cards WHERE column_id IN (${COLUMN.IN_PROGRESS}, ${COLUMN.REVIEW})`,
      )
      .all() as CardRow[];

    for (const card of activeCards) {
      const taskStatus = taskStates.get(card.id);

      if (taskStatus === 'completed') {
        // 태스크 완료 → Done 이동
        db.prepare(
          "UPDATE cards SET column_id = ?, progress = 100, updated_at = datetime('now') WHERE id = ?",
        ).run(COLUMN.DONE, card.id);
        stats.toDone++;
      } else if (taskStatus === 'running' || taskStatus === 'queued') {
        // 태스크 진행중 → 유지
        stats.kept++;
      } else {
        // 태스크 실패 / 매칭 없음 → stale 체크
        const updatedAt = new Date(card.updated_at).getTime();
        const age = Date.now() - updatedAt;

        if (age > STALE_THRESHOLD_MS) {
          // 24시간 이상 방치 → Blocked
          db.prepare(
            "UPDATE cards SET column_id = ?, updated_at = datetime('now') WHERE id = ?",
          ).run(COLUMN.BLOCKED, card.id);
          stats.toBlocked++;
        } else {
          // 최근 카드 → 유지 (아직 bridge가 처리할 수 있음)
          stats.kept++;
        }
      }
    }

    // Step 2: stale Blocked 카드 삭제 (24시간 경과)
    const staleCutoff = new Date(Date.now() - STALE_THRESHOLD_MS)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);

    const blockedDeleted = db
      .prepare(
        'DELETE FROM cards WHERE column_id = ? AND updated_at < ?',
      )
      .run(COLUMN.BLOCKED, staleCutoff);
    stats.deleted += blockedDeleted.changes;

    // Step 3: stale Backlog 카드 삭제 (24시간 경과)
    const backlogDeleted = db
      .prepare(
        'DELETE FROM cards WHERE column_id = ? AND updated_at < ?',
      )
      .run(COLUMN.BACKLOG, staleCutoff);
    stats.deleted += backlogDeleted.changes;

    // Step 4: Done 카드 TTL (3일)
    const doneCutoff = new Date(Date.now() - DONE_TTL_MS)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);
    const doneDeleted = db
      .prepare(
        'DELETE FROM cards WHERE column_id = ? AND updated_at < ?',
      )
      .run(COLUMN.DONE, doneCutoff);
    stats.deleted += doneDeleted.changes;
  })();

  console.log(
    `[startup-cleanup] Done이동=${stats.toDone} Blocked이동=${stats.toBlocked} 유지=${stats.kept} 삭제=${stats.deleted}`,
  );
};
