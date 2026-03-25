import { readFileSync } from 'fs';
import { join } from 'path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
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

// ─── 에이전트별 도구 매핑 ─────────────────────────────

/** Slack MCP 도구 (모든 에이전트 공통) */
const SLACK_TOOLS = [
  'mcp__slack__slack_post_message',
  'mcp__slack__slack_reply_to_thread',
  'mcp__slack__slack_get_channel_history',
  'mcp__slack__slack_get_thread_replies',
  'mcp__slack__slack_get_user_profile',
  'mcp__slack__slack_get_users',
  'mcp__slack__slack_list_channels',
  // slack_add_reaction 제거 — 리액션은 bridge가 관리
];

/** Atlassian 읽기 도구 (모든 에이전트 공통) */
const ATLASSIAN_READ_TOOLS = [
  'mcp__atlassian__getJiraIssue',
  'mcp__atlassian__searchJiraIssuesUsingJql',
  'mcp__atlassian__getVisibleJiraProjects',
  'mcp__atlassian__getTransitionsForJiraIssue',
  'mcp__atlassian__getJiraIssueTypeMetaWithFields',
  'mcp__atlassian__getJiraProjectIssueTypesMetadata',
  'mcp__atlassian__getJiraIssueRemoteIssueLinks',
  'mcp__atlassian__getIssueLinkTypes',
  'mcp__atlassian__lookupJiraAccountId',
  'mcp__atlassian__getConfluencePage',
  'mcp__atlassian__getConfluenceSpaces',
  'mcp__atlassian__getPagesInConfluenceSpace',
  'mcp__atlassian__searchConfluenceUsingCql',
  'mcp__atlassian__getConfluencePageDescendants',
  'mcp__atlassian__getConfluencePageFooterComments',
  'mcp__atlassian__getConfluencePageInlineComments',
  'mcp__atlassian__getConfluenceCommentChildren',
  'mcp__atlassian__searchAtlassian',
  'mcp__atlassian__fetchAtlassian',
  'mcp__atlassian__getAccessibleAtlassianResources',
  'mcp__atlassian__atlassianUserInfo',
];

/** Atlassian 공통 쓰기 도구 (모든 에이전트 — 본인 티켓 관리) */
const ATLASSIAN_COMMON_WRITE_TOOLS = [
  'mcp__atlassian__transitionJiraIssue',
  'mcp__atlassian__addCommentToJiraIssue',
  'mcp__atlassian__addWorklogToJiraIssue',
  'mcp__atlassian__editJiraIssue',
];

/** Atlassian PM 전용 쓰기 도구 (이슈 생성, Confluence 페이지 관리) */
const ATLASSIAN_PM_WRITE_TOOLS = [
  'mcp__atlassian__createJiraIssue',
  'mcp__atlassian__createIssueLink',
  'mcp__atlassian__createConfluencePage',
  'mcp__atlassian__updateConfluencePage',
  'mcp__atlassian__createConfluenceFooterComment',
  'mcp__atlassian__createConfluenceInlineComment',
];

/** Confluence 인라인 코멘트 (리뷰 가능 직군) */
const CONFLUENCE_COMMENT_TOOLS = [
  'mcp__atlassian__createConfluenceInlineComment',
];

/** context7 도구 (모든 에이전트 공통) */
const CONTEXT7_TOOLS = [
  'mcp__context7__resolve-library-id',
  'mcp__context7__query-docs',
];

/** Bash 제한 도구 (파일 탐색용) */
const BASH_LIMITED_TOOLS = [
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
];

/** 모든 에이전트 공통 기반 도구 */
const BASE_TOOLS = [
  'Read',
  ...SLACK_TOOLS,
  ...ATLASSIAN_READ_TOOLS,
  ...ATLASSIAN_COMMON_WRITE_TOOLS,
  ...CONTEXT7_TOOLS,
  'Agent',
];

/**
 * 에이전트별 허용 도구 목록 반환
 * @param agentName - 에이전트 이름
 * @returns 허용 도구 문자열 배열
 */
const getToolsForAgent = (agentName: string): string[] => {
  switch (agentName) {
    case 'pm':
      return [
        ...BASE_TOOLS,
        'Write',
        'Edit',
        'WebSearch',
        'WebFetch',
        ...ATLASSIAN_PM_WRITE_TOOLS,
      ];
    case 'frontend':
      return [
        ...BASE_TOOLS,
        'Write',
        'Edit',
        'Glob',
        'Grep',
        ...BASH_LIMITED_TOOLS,
        'Bash(npm:*)',
        'Bash(pnpm:*)',
        'Bash(gh:*)',
        'Bash(git:*)',
        'Bash(node:*)',
        'Bash(npx:*)',
        'WebSearch',
        'WebFetch',
        ...CONFLUENCE_COMMENT_TOOLS,
      ];
    case 'backend':
      return [
        ...BASE_TOOLS,
        'Write',
        'Edit',
        'Glob',
        'Grep',
        ...BASH_LIMITED_TOOLS,
        'Bash(npm:*)',
        'Bash(pnpm:*)',
        'Bash(gh:*)',
        'Bash(git:*)',
        'Bash(node:*)',
        'Bash(npx:*)',
        'Bash(docker:*)',
        'WebSearch',
        'WebFetch',
        ...CONFLUENCE_COMMENT_TOOLS,
      ];
    case 'designer':
      return [
        ...BASE_TOOLS,
        'Write',
        'Edit',
        'WebSearch',
        'WebFetch',
        ...CONFLUENCE_COMMENT_TOOLS,
        'mcp__pencil__get_editor_state',
        'mcp__pencil__batch_get',
        'mcp__pencil__batch_design',
        'mcp__pencil__open_document',
        'mcp__pencil__snapshot_layout',
        'mcp__pencil__get_screenshot',
        'mcp__pencil__get_variables',
        'mcp__pencil__set_variables',
        'mcp__pencil__get_guidelines',
        'mcp__pencil__get_style_guide',
        'mcp__pencil__get_style_guide_tags',
        'mcp__pencil__find_empty_space_on_canvas',
        'mcp__pencil__search_all_unique_properties',
        'mcp__pencil__replace_all_matching_properties',
      ];
    case 'researcher':
      return [
        ...BASE_TOOLS,
        'Write',
        'Edit',
        'WebSearch',
        'WebFetch',
      ];
    case 'secops':
      return [
        ...BASE_TOOLS,
        'Write',
        'Edit',
        'Glob',
        'Grep',
        ...BASH_LIMITED_TOOLS,
        'Bash(npm:*)',
        'Bash(gh:*)',
        'Bash(git:*)',
        'Bash(npx:*)',
        'WebSearch',
        'WebFetch',
        ...CONFLUENCE_COMMENT_TOOLS,
      ];
    default:
      // triage 등 최소 권한
      return [
        ...BASE_TOOLS,
        'Write',
        'Edit',
        'Glob',
      ];
  }
};

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

  const instructions: Record<string, string> = {
    mention:
      '당신이 멘션되었습니다. 반드시 Slack MCP 도구로 응답하세요.',
    keyword:
      '당신의 전문 영역 키워드가 감지되었습니다. 반드시 Slack MCP 도구로 응답하세요.',
    broadcast:
      '팀 전체 브로드캐스트 메시지입니다. 반드시 Slack MCP 도구로 응답하세요.',
    llm: 'LLM 라우터가 당신을 선택했습니다. 반드시 Slack MCP 도구로 응답하세요.',
    default:
      '기본 담당자로 할당되었습니다. 반드시 Slack MCP 도구로 응답하세요.',
  };
  const instruction = instructions[routingMethod];
  if (instruction) {
    parts.push(`지시: ${instruction}`);
  }
  parts.push('언어: 반드시 한국어로 응답하세요.');
  parts.push(
    '포맷 규칙 (엄격 준수):',
    '- Slack mrkdwn만 사용: *굵게* _기울임_ ~취소선~ `코드` ```코드블록``` • 목록',
    '- 절대 금지: **bold**, ## 헤더, [링크](url), 테이블(| --- | 포함 모든 형태), 코드블록 안 테이블도 금지',
    '- 구조화된 정보는 bullet list로만 표현. 예: *항목명:* 설명',
    '- 중요: slack_post_message 또는 slack_reply_to_thread는 전체 응답에서 딱 1번만 호출. 긴 내용도 하나의 메시지로 합쳐서 보낼 것. 절대 여러 번 나눠 보내지 말 것.',
  );
  if (event.threadTopic) {
    parts.push(
      '',
      `[스레드 주제] ${event.threadTopic}`,
      '맥락 규칙: 위 스레드 주제에 맞게 응답하세요. 새 메시지를 단독으로 해석하지 말고, 반드시 스레드 주제의 맥락 안에서 이해하세요. 당신의 전문 분석은 주제가 해당 영역일 때만 적용하세요.',
    );
  } else {
    parts.push(
      '맥락 파악: 메시지의 맥락이 부족하거나 이전 대화 참조가 필요하면, 응답 전에 slack_get_channel_history로 채널 최근 대화를 확인하세요. 스레드 대화는 slack_get_thread_replies로 확인하세요.',
    );
  }

  if (event.thread_ts) {
    parts.push(`스레드: ${event.thread_ts}`);
  }

  parts.push('', '---', '', event.text);

  return parts.join('\n');
};

/** MCP 서버 설정 타입 */
interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/**
 * Slack MCP 서버 설정 생성
 * @param botToken - 에이전트별 Slack Bot Token
 * @returns MCP 서버 설정 객체
 */
const createSlackMcpConfig = (
  botToken: string,
): McpServerConfig => ({
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

/** Atlassian MCP 서버 설정 (mcp-remote 경유 SSE) */
const ATLASSIAN_MCP_CONFIG: McpServerConfig = {
  command: 'npx',
  args: [
    '-y',
    'mcp-remote',
    'https://mcp.atlassian.com/v1/sse',
  ],
  env: {},
};

/** context7 MCP 서버 설정 */
const CONTEXT7_MCP_CONFIG: McpServerConfig = {
  command: 'npx',
  args: ['-y', '@upstash/context7-mcp@latest'],
  env: {},
};

/**
 * 에이전트별 MCP 서버 설정 생성
 * @param agentName - 에이전트 이름
 * @param botToken - Slack Bot Token
 * @returns MCP 서버 설정 맵
 */
const getMcpServersForAgent = (
  agentName: string,
  botToken: string,
): Record<string, McpServerConfig> => {
  const servers: Record<string, McpServerConfig> = {
    slack: createSlackMcpConfig(botToken),
    atlassian: ATLASSIAN_MCP_CONFIG,
    context7: CONTEXT7_MCP_CONFIG,
  };

  if (agentName === 'designer') {
    // pencil MCP는 별도 설정 필요 시 여기에 추가
  }

  return servers;
};

/** 에이전트별 세션 캐시 */
const sessions = new Map<string, AgentSession>();

/**
 * 에이전트 세션을 가져오거나 새로 생성
 * @param agentName - 에이전트 이름
 * @returns 에이전트 세션
 */
const getOrCreateSession = (agentName: string): AgentSession => {
  const existing = sessions.get(agentName);
  if (existing) {
    return existing;
  }
  const session: AgentSession = {
    agentName,
    systemPrompt: loadPersona(agentName),
    threadSessions: new Map(),
  };
  sessions.set(agentName, session);
  console.log(`[runtime] 세션 생성: ${agentName}`);
  return session;
};

/**
 * Slack 이벤트를 Agent SDK로 처리하고 결과를 Slack에 포스팅
 * @param agentName - 대상 에이전트 이름
 * @param event - Slack 이벤트
 * @param routingMethod - 라우팅 방식
 * @param slackApp - Slack Bolt App (응답 포스팅용)
 * @param skipReaction - 리액션 관리 건너뛰기 (병렬 실행 시 첫 에이전트만 관리)
 */
export const handleMessage = async (
  agentName: string,
  event: SlackEvent,
  routingMethod: string,
  slackApp: App,
  skipReaction = false,
): Promise<void> => {
  const session = getOrCreateSession(agentName);
  const prompt = formatSlackEventAsPrompt(event, routingMethod);

  console.log(
    `[runtime] ${agentName} 처리 시작 (${routingMethod}): "${event.text.slice(0, 50)}..."`,
  );

  const startTime = Date.now();

  // ⏳ 리액션으로 처리 중 표시 (병렬 실행 시 첫 에이전트만 관리)
  if (!skipReaction) {
    try {
      await slackApp.client.reactions.add({
        channel: event.channel,
        timestamp: event.ts,
        name: 'brain',
      });
      console.log(`[reaction] 🧠 추가 완료: ${event.ts}`);
    } catch (err) {
      console.error(`[reaction] ⏳ 추가 실패:`, err);
    }
  }

  try {
    // 에이전트별 Slack bot token 조회
    const botToken =
      process.env[
        `SLACK_BOT_TOKEN_${agentName.toUpperCase()}`
      ] ?? '';

    let resultText = '';

    // 스레드 내 연속 대화 시 이전 세션 재사용 (히스토리 + 시스템 프롬프트 캐싱)
    const threadKey = event.thread_ts ?? event.ts;
    const existingSessionId = session.threadSessions.get(threadKey);

    const queryOptions: Parameters<typeof query>[0]['options'] = {
      cwd: PROJECT_DIR,
      systemPrompt: session.systemPrompt,
      model: 'claude-haiku-4-5-20251001',
      allowedTools: getToolsForAgent(agentName),
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: 30,
      persistSession: true,
      mcpServers: getMcpServersForAgent(
        agentName,
        botToken,
      ),
    };

    if (existingSessionId) {
      queryOptions.resume = existingSessionId;
      console.log(
        `[runtime] ${agentName} 세션 재사용: ${existingSessionId.slice(0, 8)}...`,
      );
    }

    for await (const message of query({ prompt, options: queryOptions })) {
      // ResultMessage (success/error 모두) → result 추출 + session_id 캡처
      if (message.type === 'result') {
        const resultMsg = message as SDKResultMessage;
        session.threadSessions.set(threadKey, resultMsg.session_id);
        if (resultMsg.subtype === 'success') {
          resultText = resultMsg.result;
          // 캐시 통계 로깅
          const models = Object.entries(resultMsg.modelUsage);
          for (const [model, usage] of models) {
            const cacheRead = usage.cacheReadInputTokens;
            const cacheCreate = usage.cacheCreationInputTokens;
            const input = usage.inputTokens;
            const output = usage.outputTokens;
            console.log(
              `[cache] ${agentName} (${model}): input=${input} output=${output} cacheRead=${cacheRead} cacheCreate=${cacheCreate} cost=$${resultMsg.total_cost_usd.toFixed(4)}`,
            );
          }
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[runtime] ${agentName} 완료 (${elapsed}s): ${resultText.slice(0, 100)}...`,
    );

    // ⏳ → ✅ 완료 리액션 전환 (리액션 담당 에이전트만)
    if (!skipReaction) {
      try {
        await slackApp.client.reactions.remove({
          channel: event.channel,
          timestamp: event.ts,
          name: 'brain',
        });
        await slackApp.client.reactions.add({
          channel: event.channel,
          timestamp: event.ts,
          name: 'white_check_mark',
        });
      } catch {
        // 리액션 실패는 무시
      }
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

    // ⏳ → ❌ 에러 리액션 전환 (리액션 담당 에이전트만)
    if (!skipReaction) {
      try {
        await slackApp.client.reactions.remove({
          channel: event.channel,
          timestamp: event.ts,
          name: 'brain',
        });
        await slackApp.client.reactions.add({
          channel: event.channel,
          timestamp: event.ts,
          name: 'x',
        });
      } catch {
        // 리액션 실패는 무시
      }
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
