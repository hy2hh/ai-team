/**
 * Permission Request Module
 *
 * 에이전트가 위험한 작업(파일 수정, DB 마이그레이션 등) 전에
 * sid에게 Slack Block Kit 버튼으로 승인을 요청한다.
 *
 * 흐름:
 * 1. 에이전트가 `request_permission` 도구 호출
 * 2. Slack에 [✅ 승인] [❌ 거부] 버튼이 포함된 메시지 전송
 * 3. sid가 버튼 클릭 → resolvePermissionRequest() 호출
 * 4. 도구가 "승인됨" 또는 "거부됨" 반환 → 에이전트 계속 진행 or 중단
 */

import type { App } from '@slack/bolt';

/** 대기 중인 권한 요청 */
interface PendingPermission {
  resolve: (approved: boolean) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  agentName: string;
  action: string;
}

/** 대기 중인 권한 요청 Map: permissionId → PendingPermission */
const pendingPermissions = new Map<string, PendingPermission>();

/** 권한 요청 자동 타임아웃: 10분 */
const PERMISSION_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Block Kit 권한 요청 메시지를 Slack에 전송하고 사용자 응답 대기
 *
 * @param slackApp - 메시지 전송에 사용할 Slack Bolt App (apps[0])
 * @param channel - 메시지를 전송할 채널 ID
 * @param threadTs - 스레드 timestamp (없으면 새 스레드)
 * @param agentName - 권한을 요청하는 에이전트 이름
 * @param reason - 권한이 필요한 이유
 * @param action - 수행하려는 구체적 작업 설명
 * @returns true=승인, false=거부 또는 타임아웃
 */
export const postPermissionRequest = async (
  slackApp: App,
  channel: string,
  threadTs: string,
  agentName: string,
  reason: string,
  action: string,
): Promise<boolean> => {
  const permissionId = `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await slackApp.client.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: `[권한 요청] ${agentName}: ${action}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🔐 권한 요청 — ${agentName}*\n\n*이유:* ${reason}\n*작업:* \`${action}\``,
        },
      },
      {
        type: 'actions',
        block_id: `permission_block_${permissionId}`,
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '✅ 승인', emoji: true },
            style: 'primary',
            action_id: 'permission_approve',
            value: permissionId,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '❌ 거부', emoji: true },
            style: 'danger',
            action_id: 'permission_deny',
            value: permissionId,
          },
        ],
      },
    ],
  });

  console.log(`[permission] 권한 요청 전송: ${permissionId} — ${agentName}: ${action}`);

  return new Promise<boolean>((resolve) => {
    const timeoutId = setTimeout(() => {
      pendingPermissions.delete(permissionId);
      console.log(`[permission] 타임아웃 (10분 초과): ${permissionId}`);
      resolve(false);
    }, PERMISSION_TIMEOUT_MS);

    pendingPermissions.set(permissionId, {
      resolve,
      timeoutId,
      agentName,
      action,
    });
  });
};

/**
 * 버튼 클릭 이벤트를 수신해 대기 중인 권한 요청을 해결한다
 *
 * @param permissionId - 버튼의 value 값 (perm_xxx)
 * @param approved - true=승인, false=거부
 * @returns 대기 중인 요청이 존재했으면 true
 */
export const resolvePermissionRequest = (
  permissionId: string,
  approved: boolean,
): boolean => {
  const pending = pendingPermissions.get(permissionId);
  if (!pending) {
    console.warn(`[permission] 알 수 없는 permissionId: ${permissionId}`);
    return false;
  }
  clearTimeout(pending.timeoutId);
  pendingPermissions.delete(permissionId);
  console.log(
    `[permission] ${approved ? '✅ 승인' : '❌ 거부'}: ${permissionId} — ${pending.agentName}: ${pending.action}`,
  );
  pending.resolve(approved);
  return true;
};
