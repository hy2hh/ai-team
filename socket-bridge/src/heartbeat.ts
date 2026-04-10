import { getDb } from './db.js';

/** 하트비트 만료 임계값 (10분) */
const HEARTBEAT_STALE_MS = 10 * 60 * 1000;

interface HeartbeatData {
  role: string;
  last_seen: string;
  status: 'active' | 'idle';
  current_task?: string;
  pid: number;
  agent_version?: string;
}

interface HeartbeatRow {
  role: string;
  last_seen: number;
  status: 'active' | 'idle';
  current_task: string | null;
  pid: number;
  agent_version: string | null;
}

/**
 * 에이전트 하트비트 기록
 * @param role - 에이전트 역할 (e.g., 'bridge', 'pm', 'backend')
 * @param status - 현재 상태
 * @param currentTask - 현재 처리 중인 태스크 (선택)
 * @param agentVersion - 에이전트 버전 (선택, 예: '1.2.3')
 */
export const writeHeartbeat = (
  role: string,
  status: 'active' | 'idle',
  currentTask?: string,
  agentVersion?: string,
): void => {
  const db = getDb();
  const now = Date.now();

  try {
    db.prepare(`
      INSERT INTO heartbeats (role, last_seen, status, current_task, pid, agent_version)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(role) DO UPDATE SET
        last_seen     = excluded.last_seen,
        status        = excluded.status,
        current_task  = excluded.current_task,
        pid           = excluded.pid,
        agent_version = excluded.agent_version
    `).run(role, now, status, currentTask ?? null, process.pid, agentVersion ?? null);
  } catch (err) {
    console.error(`[heartbeat] 쓰기 실패: ${role}`, err);
  }
};

/**
 * 오래된 하트비트 정리 (10분 이상 미갱신)
 * @returns 삭제된 행 수
 */
export const cleanupStaleHeartbeats = (): number => {
  const db = getDb();
  const cutoff = Date.now() - HEARTBEAT_STALE_MS;

  const result = db.prepare(`
    DELETE FROM heartbeats WHERE last_seen < ?
  `).run(cutoff);

  if (result.changes > 0) {
    console.log(`[heartbeat] ${result.changes}개 만료 하트비트 삭제 완료`);
  }

  return result.changes;
};

/**
 * 활성 에이전트 목록 반환 (하트비트 10분 이내)
 * @returns 활성 에이전트 하트비트 데이터 배열
 */
export const getActiveAgents = (): HeartbeatData[] => {
  const db = getDb();
  const cutoff = Date.now() - HEARTBEAT_STALE_MS;

  try {
    const rows = db.prepare(`
      SELECT * FROM heartbeats WHERE last_seen >= ?
    `).all(cutoff) as HeartbeatRow[];

    return rows.map((row) => ({
      role: row.role,
      last_seen: new Date(row.last_seen).toISOString(),
      status: row.status,
      pid: row.pid,
      ...(row.current_task !== null && { current_task: row.current_task }),
      ...(row.agent_version !== null && { agent_version: row.agent_version }),
    }));
  } catch (err) {
    console.error('[heartbeat] 활성 에이전트 조회 실패:', err);
    return [];
  }
};
