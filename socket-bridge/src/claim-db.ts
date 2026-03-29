import { getDb } from './db.js';

/** Claim 만료 시간 (24시간) */
const CLAIM_EXPIRY_MS = 24 * 60 * 60 * 1000;

/** 오펀 claim 임계값 (2시간 이상 processing 상태 유지 시 고착으로 판단) */
const ORPHAN_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/** 오펀 claim 최대 재큐잉 시도 횟수 */
export const MAX_REQUEUE_ATTEMPTS = 2;

/** 오펀 claim 정보 */
export interface OrphanClaimInfo {
  messageTs: string;
  agent: string;
  timestamp: string;
  channel?: string;
  ageMs: number;
  /** 현재 처리 시도 버전 (재큐잉 한도 판단용) */
  version: number;
}

type ClaimStatus = 'processing' | 'completed' | 'failed';

interface ClaimRow {
  message_ts: string;
  agent: string;
  status: ClaimStatus;
  version: number;
  channel: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * 메시지에 대한 claim 획득 시도
 * @param messageTs - Slack 메시지 타임스탬프
 * @param agentName - 처리할 에이전트 이름
 * @param channel - Slack 채널 ID (오펀 알림용, 선택)
 * @returns true면 claim 획득 성공, false면 이미 다른 에이전트가 처리 중
 */
export const tryClaim = (
  messageTs: string,
  agentName: string,
  channel?: string,
): boolean => {
  const db = getDb();
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO claims (message_ts, agent, status, version, channel, created_at, updated_at)
    VALUES (?, ?, 'processing', 1, ?, ?, ?)
  `);

  const result = stmt.run(messageTs, agentName, channel ?? null, now, now);
  return result.changes === 1;
};

/**
 * Claim 상태 업데이트
 * @param messageTs - Slack 메시지 타임스탬프
 * @param status - 새 상태
 */
export const updateClaim = (
  messageTs: string,
  status: ClaimStatus,
): void => {
  const db = getDb();
  const now = Date.now();

  db.prepare(`
    UPDATE claims SET status = ?, updated_at = ? WHERE message_ts = ?
  `).run(status, now, messageTs);
};

/**
 * 만료된 claim 정리 (completed/failed + 24시간 경과)
 * created_at 기준은 의도적: completed/failed 상태는 더 이상 updated_at이 갱신되지 않으므로
 * "생성 후 24시간 경과" 기준이 올바름. orphan 감지(cleanupOrphanClaims)만 updated_at 사용.
 * @returns 삭제된 행 수
 */
export const cleanupExpiredClaims = (): number => {
  const db = getDb();
  const cutoff = Date.now() - CLAIM_EXPIRY_MS;

  const result = db.prepare(`
    DELETE FROM claims
    WHERE status != 'processing'
      AND created_at < ?  -- 완료/실패 후 생성 시점 기준 TTL (updated_at 아님)
  `).run(cutoff);

  if (result.changes > 0) {
    console.log(`[claim] ${result.changes}개 만료 claim 정리 완료`);
  }

  return result.changes;
};

/**
 * 오펀 claim 감지 및 복구
 * processing 상태가 ORPHAN_THRESHOLD_MS(2h) 이상 지속된 claim을 failed로 전환
 * @returns 발견된 오펀 claim 목록 (Slack 알림용)
 */
export const cleanupOrphanClaims = (): OrphanClaimInfo[] => {
  const db = getDb();
  const now = Date.now();
  const cutoff = now - ORPHAN_THRESHOLD_MS;

  const rows = db.prepare(`
    SELECT * FROM claims
    WHERE status = 'processing'
      AND updated_at < ?
  `).all(cutoff) as ClaimRow[];

  if (rows.length === 0) {
    return [];
  }

  // 배치 UPDATE (O(1) vs 기존 O(n) 개별 UPDATE)
  db.prepare(`
    UPDATE claims SET status = 'failed', updated_at = ?
    WHERE status = 'processing' AND updated_at < ?
  `).run(now, cutoff);

  const orphans: OrphanClaimInfo[] = rows.map((row) => {
    const ageMs = now - row.updated_at;
    console.warn(
      `[claim] 오펀 감지 → failed: ${row.message_ts} (agent=${row.agent}, age=${Math.round(ageMs / 60000)}min)`,
    );
    return {
      messageTs: row.message_ts,
      agent: row.agent,
      timestamp: new Date(row.created_at).toISOString(),
      channel: row.channel ?? undefined,
      ageMs,
      version: row.version,
    };
  });

  console.warn(`[claim] ${orphans.length}개 오펀 claim 복구 완료`);

  return orphans;
};

/**
 * 브리지 재시작 복구용: 처리 중이던 모든 claim을 failed로 전환하고 반환
 * age 제한 없음 — 브리지 재시작 자체가 모든 processing claim 중단을 의미함
 * @returns 발견된 processing claim 목록 (재라우팅용)
 */
export const recoverProcessingClaimsOnStartup = (): OrphanClaimInfo[] => {
  const db = getDb();
  const now = Date.now();

  const rows = db.prepare(`
    SELECT * FROM claims
    WHERE status = 'processing'
  `).all() as ClaimRow[];

  if (rows.length === 0) {
    return [];
  }

  // 일괄 업데이트
  db.prepare(`
    UPDATE claims SET status = 'failed', updated_at = ?
    WHERE status = 'processing'
  `).run(now);

  const orphans: OrphanClaimInfo[] = rows.map((row) => {
    const ageMs = now - row.updated_at;
    console.warn(
      `[claim] 재시작 복구 → failed: ${row.message_ts} (agent=${row.agent}, age=${Math.round(ageMs / 60000)}min)`,
    );
    return {
      messageTs: row.message_ts,
      agent: row.agent,
      timestamp: new Date(row.created_at).toISOString(),
      channel: row.channel ?? undefined,
      ageMs,
      version: row.version,
    };
  });

  console.log(`[claim] 재시작 복구: ${orphans.length}개 processing claim 발견`);
  return orphans;
};

/**
 * 오펀 claim을 재큐잉용으로 초기화
 * 현재 버전이 MAX_REQUEUE_ATTEMPTS 미만인 경우에만 재큐잉 허용.
 *
 * @param messageTs - 재큐잉할 메시지 ts
 * @param channel - 알림 채널 ID (기존 레코드에서 가져오는 것으로 폴백)
 * @returns 새 버전 번호, 한도 초과 또는 오류 시 null
 */
export const requeueClaim = (
  messageTs: string,
  channel?: string,
): number | null => {
  const db = getDb();
  const now = Date.now();

  const row = db.prepare(`
    SELECT * FROM claims WHERE message_ts = ?
  `).get(messageTs) as ClaimRow | undefined;

  if (!row) {
    return null;
  }

  if (row.version >= MAX_REQUEUE_ATTEMPTS) {
    console.warn(
      `[claim] 재큐잉 한도 초과: ${messageTs} (v${row.version}/${MAX_REQUEUE_ATTEMPTS})`,
    );
    return null;
  }

  const newVersion = row.version + 1;
  const channelToUse = channel ?? row.channel ?? undefined;

  try {
    db.prepare(`
      UPDATE claims
      SET status = 'processing', version = ?, channel = ?, created_at = ?, updated_at = ?
      WHERE message_ts = ?
    `).run(newVersion, channelToUse ?? null, now, now, messageTs);

    console.log(
      `[claim] 재큐잉 완료: ${messageTs} v${row.version} → v${newVersion}`,
    );
    return newVersion;
  } catch (err) {
    console.error(`[claim] 재큐잉 실패: ${messageTs}`, err);
    return null;
  }
};
