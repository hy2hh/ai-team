/**
 * Auto-Proceed Module
 *
 * Ralph Loop 검증을 통과한 작업에 대해
 * 리스크 등급별 veto window를 적용하여 자동 진행한다.
 *
 * LOW: 2분 후 자동 진행 (Slack 알림)
 * MEDIUM: 5분 후 자동 진행 (Slack 알림 + sid DM)
 * HIGH: sid 승인 필수 (무기한 대기)
 */

import type { App } from '@slack/bolt';
import { getDb } from './db.js';
import type { RiskLevel } from './risk-matrix.js';
import { getVetoWindow } from './risk-matrix.js';

/** Auto-Proceed 요청 */
export interface AutoProceedRequest {
  messageTs: string;
  channel: string;
  agents: string[];
  reason: string;
  actionSummary: string;
  riskLevel: RiskLevel;
  /** 방안 D: 완료 조건 미충족 항목 목록 — MEDIUM 리스크 시 자동 진행 차단용 */
  dodPendingItems?: string[];
}

/** 대기 중인 승인의 DB 행 타입 */
interface PendingApprovalRow {
  id: number;
  message_ts: string;
  channel: string;
  risk_level: string;
  reason: string;
  agents: string;
  action_summary: string;
  status: string;
  veto_expires: number | null;
  created_at: number;
  resolved_at: number | null;
}

/** 활성 타이머 (취소용) */
const activeTimers = new Map<number, ReturnType<typeof setTimeout>>();

/** 승인 완료 시 실행할 콜백 */
let onApprovedCallback: ((approvalId: number, agents: string[], reason: string, channel: string, messageTs: string) => void) | null = null;

/**
 * 승인 완료 콜백 등록 (index.ts에서 호출)
 * 승인되면 해당 에이전트들에게 작업을 디스패치한다
 */
export const onApproved = (
  cb: (approvalId: number, agents: string[], reason: string, channel: string, messageTs: string) => void,
): void => {
  onApprovedCallback = cb;
};

/**
 * Auto-Proceed 요청 등록
 * 리스크 등급에 따라 타이머를 시작하거나 무기한 대기
 */
export const registerAutoProceed = async (
  req: AutoProceedRequest,
  slackApp: App,
  sidUserId?: string,
): Promise<number> => {
  const db = getDb();
  const now = Date.now();
  const vetoWindowMs = getVetoWindow(req.riskLevel);
  const vetoExpires = vetoWindowMs === Infinity ? null : now + vetoWindowMs;

  const result = db.prepare(`
    INSERT INTO pending_approvals
      (message_ts, channel, risk_level, reason, agents, action_summary, status, veto_expires, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    req.messageTs,
    req.channel,
    req.riskLevel,
    req.reason,
    JSON.stringify(req.agents),
    req.actionSummary,
    vetoExpires,
    now,
  );

  const approvalId = Number(result.lastInsertRowid);
  const vetoMinutes = vetoWindowMs === Infinity ? '∞' : `${vetoWindowMs / 60000}분`;
  const agentList = req.agents.join(', ');

  // Slack 알림 포스팅
  if (req.riskLevel === 'HIGH') {
    await slackApp.client.chat.postMessage({
      channel: req.channel,
      thread_ts: req.messageTs,
      text: [
        `🔴 *[HIGH 리스크] sid 승인 필요 — 무기한 대기 중*`,
        `*다음 단계:* ${agentList}`,
        `*이유:* ${req.reason}`,
        `*요약:* ${req.actionSummary}`,
        '',
        `이 스레드에 *승인* 또는 *거부* 로 답장하세요.`,
        `(또는 ✅ / ❌ 리액션)`,
      ].join('\n'),
    });
  } else {
    const emoji = req.riskLevel === 'LOW' ? '🟢' : '🟡';
    await slackApp.client.chat.postMessage({
      channel: req.channel,
      thread_ts: req.messageTs,
      text: [
        `${emoji} *[${req.riskLevel}] ${vetoMinutes} 내 :x: 없으면 자동 진행*`,
        `*다음 단계:* ${agentList}`,
        `*이유:* ${req.reason}`,
        `*요약:* ${req.actionSummary}`,
      ].join('\n'),
    });

    // 방안 D: MEDIUM 리스크 + 완료 조건 미충족 → 자동 진행 차단
    if (req.riskLevel === 'MEDIUM' && req.dodPendingItems && req.dodPendingItems.length > 0) {
      const itemList = req.dodPendingItems.map((i) => `• ${i}`).join('\n');
      await slackApp.client.chat.postMessage({
        channel: req.channel,
        thread_ts: req.messageTs,
        text: [
          '🟡⛔ *[보통 위험 + 완료 조건 미충족] 자동 진행 차단됨*',
          '',
          '*미완료 항목:*',
          itemList,
          '',
          '보통 위험 작업은 완료 조건 충족 후에만 자동 진행됩니다. PM이 직접 판단하세요.',
        ].join('\n'),
      });
      // DB에는 기록하되 타이머는 시작하지 않음 (pending 상태 유지 → PM 수동 처리)
      console.log(
        `[auto-proceed] 방안D 차단: #${approvalId} MEDIUM 완료 조건 미충족 [${req.dodPendingItems.join(', ')}]`,
      );
      return approvalId;
    }

    // MEDIUM: sid에게 DM 알림
    if (req.riskLevel === 'MEDIUM' && sidUserId) {
      try {
        const dm = await slackApp.client.conversations.open({
          users: sidUserId,
        });
        if (dm.channel?.id) {
          await slackApp.client.chat.postMessage({
            channel: dm.channel.id,
            text: `🟡 [MEDIUM] 자동 진행 예정 (${vetoMinutes})\n*${agentList}:* ${req.reason}\n채널에서 :x: 로 취소 가능`,
          });
        }
      } catch {
        // DM 실패는 무시 — 채널 알림은 이미 전송됨
      }
    }

    // veto window 타이머 시작
    if (vetoExpires) {
      const timer = setTimeout(() => {
        resolveApproval(approvalId, 'auto_approved', slackApp).catch((err) => {
          console.error(`[auto-proceed] auto-resolve failed for #${approvalId}:`, err);
        });
      }, vetoWindowMs);
      activeTimers.set(approvalId, timer);
    }
  }

  console.log(
    `[auto-proceed] 등록: #${approvalId} ${req.riskLevel} [${agentList}] veto=${vetoMinutes}`,
  );

  return approvalId;
};

/**
 * 승인 해결 (자동/수동)
 */
const resolveApproval = async (
  approvalId: number,
  status: 'auto_approved' | 'manually_approved' | 'cancelled' | 'rejected',
  slackApp: App,
): Promise<void> => {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM pending_approvals WHERE id = ? AND status = ?',
  ).get(approvalId, 'pending') as PendingApprovalRow | undefined;

  if (!row) {
    return;
  }

  db.prepare(
    'UPDATE pending_approvals SET status = ?, resolved_at = ? WHERE id = ?',
  ).run(status, Date.now(), approvalId);

  // 타이머 정리
  const timer = activeTimers.get(approvalId);
  if (timer) {
    clearTimeout(timer);
    activeTimers.delete(approvalId);
  }

  const agents = JSON.parse(row.agents) as string[];
  const statusEmoji = (status === 'cancelled' || status === 'rejected') ? '⛔' : '✅';
  const statusText = status === 'cancelled'
    ? '취소됨'
    : status === 'rejected'
      ? '거부됨'
      : status === 'auto_approved'
        ? '자동 진행'
        : '수동 승인';

  // Slack 상태 업데이트
  try {
    await slackApp.client.chat.postMessage({
      channel: row.channel,
      thread_ts: row.message_ts,
      text: `${statusEmoji} *${statusText}:* ${agents.join(', ')}`,
    });
  } catch {
    // 포스팅 실패 무시
  }

  console.log(
    `[auto-proceed] ${statusText}: #${approvalId} [${agents.join(', ')}]`,
  );

  // 승인된 경우 콜백 실행 (rejected/cancelled는 실행 안 함)
  if (status !== 'cancelled' && status !== 'rejected' && onApprovedCallback) {
    onApprovedCallback(approvalId, agents, row.reason, row.channel, row.message_ts);
  }
};

/**
 * 채널/스레드의 pending 승인을 취소 (:x: 리액션)
 * @returns 취소된 승인 수
 */
export const cancelAutoProceed = async (
  channel: string,
  messageTs: string,
  slackApp: App,
): Promise<number> => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT id FROM pending_approvals WHERE channel = ? AND message_ts = ? AND status = ?',
  ).all(channel, messageTs, 'pending') as Array<{ id: number }>;

  let cancelled = 0;
  for (const row of rows) {
    await resolveApproval(row.id, 'cancelled', slackApp);
    cancelled++;
  }

  // 스레드 내 모든 pending도 취소
  if (cancelled === 0) {
    const threadRows = db.prepare(
      'SELECT id FROM pending_approvals WHERE channel = ? AND status = ?',
    ).all(channel, 'pending') as Array<{ id: number }>;

    for (const row of threadRows) {
      await resolveApproval(row.id, 'cancelled', slackApp);
      cancelled++;
    }
  }

  return cancelled;
};

/**
 * 채널의 pending 승인을 수동 승인 (:white_check_mark: 또는 텍스트)
 * @returns 승인된 승인 수
 */
export const manuallyApprove = async (
  channel: string,
  slackApp: App,
): Promise<number> => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT id FROM pending_approvals WHERE channel = ? AND status = ? ORDER BY created_at ASC',
  ).all(channel, 'pending') as Array<{ id: number }>;

  let approved = 0;
  for (const row of rows) {
    await resolveApproval(row.id, 'manually_approved', slackApp);
    approved++;
  }

  return approved;
};

/**
 * 채널의 pending 승인을 거부 ("거부", "reject" 등 텍스트)
 * @returns 거부된 승인 수
 */
export const manuallyReject = async (
  channel: string,
  slackApp: App,
): Promise<number> => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT id FROM pending_approvals WHERE channel = ? AND status = ? ORDER BY created_at ASC',
  ).all(channel, 'pending') as Array<{ id: number }>;

  let rejected = 0;
  for (const row of rows) {
    await resolveApproval(row.id, 'rejected', slackApp);
    rejected++;
  }

  return rejected;
};

/**
 * 특정 스레드의 pending 승인 존재 여부
 */
export const hasPendingApproval = (
  channel: string,
): boolean => {
  const db = getDb();
  const row = db.prepare(
    'SELECT 1 FROM pending_approvals WHERE channel = ? AND status = ? LIMIT 1',
  ).get(channel, 'pending');
  return !!row;
};

/**
 * 만료된 pending 승인 정리 (startup 시 호출)
 * bridge 재시작 중 veto_expires가 지난 항목을 자동 승인 처리
 */
export const cleanupExpiredApprovals = async (
  slackApp: App,
): Promise<void> => {
  const db = getDb();
  const now = Date.now();
  const rows = db.prepare(
    'SELECT id FROM pending_approvals WHERE status = ? AND veto_expires IS NOT NULL AND veto_expires < ?',
  ).all('pending', now) as Array<{ id: number }>;

  for (const row of rows) {
    await resolveApproval(row.id, 'auto_approved', slackApp);
  }

  if (rows.length > 0) {
    console.log(
      `[auto-proceed] startup 정리: ${rows.length}개 만료 승인 자동 처리`,
    );
  }
};

/** 모든 pending 타이머 취소 (shutdown용) */
export const cancelAllPendingTimers = (): void => {
  for (const [, timer] of activeTimers) {
    clearTimeout(timer);
  }
  activeTimers.clear();
};
