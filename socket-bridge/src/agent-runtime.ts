import { readFileSync } from 'fs';
import { join } from 'path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { App } from '@slack/bolt';
import type { AgentSession, SlackEvent } from './types.js';

const PROJECT_DIR = join(import.meta.dirname, '..', '..');

/** 에이전트 persona 파일 경로 매핑 */
const AGENT_PERSONA_FILES: Record<string, string> = {
  pm: '.claude/agents/pm.md',
  designer: '.claude/agents/designer.md',
  frontend: '.claude/agents/frontend.md',
  backend: '.claude/agents/backend.md',
  researcher: '.claude/agents/researcher.md',
  secops: '.claude/agents/secops.md',
};

/** SDK에 허용할 도구 목록 */
const ALLOWED_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'Bash(ls:*)',
  'Bash(cat:*)',
  'Bash(rm:*.json)',
  'Bash(find:*)',
  'Bash(mkdir:*)',
  'Bash(date:*)',
  'Bash(echo:*)',
  'Bash(sleep:*)',
  'Bash(wc:*)',
  'Bash(head:*)',
  'Bash(tail:*)',
  'mcp__slack__slack_post_message',
  'mcp__slack__slack_reply_to_thread',
  'mcp__slack__slack_get_channel_history',
  'mcp__slack__slack_get_thread_replies',
  'mcp__slack__slack_get_user_profile',
  'mcp__slack__slack_get_users',
  'mcp__slack__slack_list_channels',
  'mcp__slack__slack_add_reaction',
  'Agent',
  'WebSearch',
  'WebFetch',
];

/**
 * 에이전트 persona 파일을 읽어서 시스템 프롬프트 반환
 * @param agentName - 에이전트 이름
 * @returns persona 파일 내용
 */
const loadPersona = (agentName: string): string => {
  const relativePath = AGENT_PERSONA_FILES[agentName];
  if (!relativePath) {
    console.error(`[runtime] 알 수 없는 에이전트: ${agentName}`);
    return '';
  }
  const fullPath = join(PROJECT_DIR, relativePath);
  try {
    return readFileSync(fullPath, 'utf-8');
  } catch (err) {
    console.error(`[runtime] persona 파일 로드 실패: ${fullPath}`, err);
    return '';
  }
};

/**
 * Slack 이벤트를 에이전트에게 전달할 프롬프트로 포맷팅
 * @param event - Slack 이벤트
 * @param routingMethod - 라우팅 방식
 * @returns 프롬프트 문자열
 */
const formatSlackEventAsPrompt = (
  event: SlackEvent,
  routingMethod: string,
): string => {
  const parts = [
    `[Slack 메시지 수신 — #${event.channel_name}]`,
    `발신자: <@${event.user}>`,
    `라우팅: ${routingMethod}`,
  ];

  if (event.thread_ts) {
    parts.push(`스레드: ${event.thread_ts}`);
  }

  parts.push('', '---', '', event.text);

  return parts.join('\n');
};

/**
 * Slack MCP 서버 설정 생성
 * @param botToken - 에이전트별 Slack Bot Token
 * @returns MCP 서버 설정 객체
 */
const createSlackMcpConfig = (botToken: string) => ({
  command: 'npx',
  args: [
    '-y',
    '@modelcontextprotocol/server-slack',
  ],
  env: {
    SLACK_BOT_TOKEN: botToken,
    SLACK_TEAM_ID: process.env.SLACK_TEAM_ID ?? '',
  },
});

/** 에이전트별 세션 캐시 */
const sessions = new Map<string, AgentSession>();

/**
 * 에이전트 세션을 가져오거나 새로 생성
 * @param agentName - 에이전트 이름
 * @returns 에이전트 세션
 */
const getOrCreateSession = (agentName: string): AgentSession => {
  let session = sessions.get(agentName);
  if (!session) {
    session = {
      agentName,
      systemPrompt: loadPersona(agentName),
    };
    sessions.set(agentName, session);
    console.log(`[runtime] 세션 생성: ${agentName}`);
  }
  return session;
};

/**
 * Slack 이벤트를 Agent SDK로 처리하고 결과를 Slack에 포스팅
 * @param agentName - 대상 에이전트 이름
 * @param event - Slack 이벤트
 * @param routingMethod - 라우팅 방식
 * @param slackApp - Slack Bolt App (응답 포스팅용)
 */
export const handleMessage = async (
  agentName: string,
  event: SlackEvent,
  routingMethod: string,
  slackApp: App,
): Promise<void> => {
  const session = getOrCreateSession(agentName);
  const prompt = formatSlackEventAsPrompt(event, routingMethod);

  console.log(
    `[runtime] ${agentName} 처리 시작 (${routingMethod}): "${event.text.slice(0, 50)}..."`,
  );

  const startTime = Date.now();

  // ⏳ 리액션으로 처리 중 표시
  try {
    await slackApp.client.reactions.add({
      channel: event.channel,
      timestamp: event.ts,
      name: 'hourglass_flowing_sand',
    });
    console.log(`[reaction] ⏳ 추가 완료: ${event.ts}`);
  } catch (err) {
    console.error(`[reaction] ⏳ 추가 실패:`, err);
  }

  try {
    // 에이전트별 Slack bot token 조회
    const botToken =
      process.env[
        `SLACK_BOT_TOKEN_${agentName.toUpperCase()}`
      ] ?? '';

    let resultText = '';

    for await (const message of query({
      prompt,
      options: {
        cwd: PROJECT_DIR,
        systemPrompt: session.systemPrompt,
        model: 'claude-haiku-4-5-20251001',
        allowedTools: ALLOWED_TOOLS,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        maxTurns: 30,
        mcpServers: {
          slack: createSlackMcpConfig(botToken),
        },
      },
    })) {
      // ResultMessage에서 최종 결과 추출
      if ('result' in message) {
        resultText = message.result;
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[runtime] ${agentName} 완료 (${elapsed}s): ${resultText.slice(0, 100)}...`,
    );

    // ⏳ → ✅ 완료 리액션 전환
    try {
      await slackApp.client.reactions.remove({
        channel: event.channel,
        timestamp: event.ts,
        name: 'hourglass_flowing_sand',
      });
      await slackApp.client.reactions.add({
        channel: event.channel,
        timestamp: event.ts,
        name: 'white_check_mark',
      });
    } catch {
      // 리액션 실패는 무시
    }

    // SDK가 Slack MCP를 통해 직접 포스팅하므로
    // 여기서 추가 포스팅은 필요 없음
    if (!resultText) {
      console.warn(
        `[runtime] ${agentName} 빈 결과 — 에이전트가 직접 Slack에 응답했을 수 있음`,
      );
    }
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[runtime] ${agentName} 오류 (${elapsed}s):`, err);

    // ⏳ → ❌ 에러 리액션 전환
    try {
      await slackApp.client.reactions.remove({
        channel: event.channel,
        timestamp: event.ts,
        name: 'hourglass_flowing_sand',
      });
      await slackApp.client.reactions.add({
        channel: event.channel,
        timestamp: event.ts,
        name: 'x',
      });
    } catch {
      // 리액션 실패는 무시
    }

    // 에러 시 Slack에 알림
    try {
      await slackApp.client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts ?? event.ts,
        text: `[${agentName}] 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.`,
      });
    } catch (postErr) {
      console.error('[runtime] 오류 알림 포스팅 실패:', postErr);
    }
  }
};
