import {
  readFileSync,
  writeFileSync,
  existsSync,
} from 'fs';
import { join } from 'path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import type { App } from '@slack/bolt';
import type { AgentSession, SlackEvent } from './types.js';

const PROJECT_DIR = join(import.meta.dirname, '..', '..');

// ─── Thread Session 영구화 (JSON 파일) ───────────────────
// bridge 재시작 후에도 thread_ts → session_id 매핑 유지

const SESSION_STORE_PATH = join(
  import.meta.dirname,
  '..',
  'thread-sessions.json',
);

/** TTL: 30일 (밀리초) */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 영구화 저장소 타입 */
interface SessionStore {
  [agentName: string]: {
    [threadKey: string]: {
      sessionId: string;
      updatedAt: number;
    };
  };
}

/** 인메모리 캐시 (파일에서 로드) */
let sessionStore: SessionStore = {};

/** 파일에서 세션 저장소 로드 */
const loadSessionStore = (): void => {
  try {
    if (existsSync(SESSION_STORE_PATH)) {
      const data = readFileSync(
        SESSION_STORE_PATH,
        'utf-8',
      );
      sessionStore = JSON.parse(data) as SessionStore;

      // TTL 만료된 엔트리 정리
      const now = Date.now();
      let cleaned = 0;
      for (const agent of Object.keys(sessionStore)) {
        for (const key of Object.keys(
          sessionStore[agent],
        )) {
          if (
            now - sessionStore[agent][key].updatedAt >
            SESSION_TTL_MS
          ) {
            delete sessionStore[agent][key];
            cleaned++;
          }
        }
        if (
          Object.keys(sessionStore[agent]).length === 0
        ) {
          delete sessionStore[agent];
        }
      }

      const totalEntries = Object.values(sessionStore)
        .reduce(
          (sum, agent) => sum + Object.keys(agent).length,
          0,
        );
      console.log(
        `[session] 세션 저장소 로드: ${totalEntries}개 엔트리 (${cleaned}개 만료 정리)`,
      );
    }
  } catch (err) {
    console.error(
      '[session] 세션 저장소 로드 실패:',
      err,
    );
    sessionStore = {};
  }
};

/** 세션 저장소를 파일에 기록 (debounced) */
let saveTimer: ReturnType<typeof setTimeout> | null =
  null;

/** 세션 저장소를 파일에 즉시 기록 (내부용) */
const writeSessionStoreToDisk = (): void => {
  try {
    writeFileSync(
      SESSION_STORE_PATH,
      JSON.stringify(sessionStore, null, 2),
      'utf-8',
    );
  } catch (err) {
    console.error(
      '[session] 세션 저장소 저장 실패:',
      err,
    );
  }
};

const saveSessionStore = (): void => {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  // 1초 디바운스 — 연속 업데이트 시 파일 쓰기 최소화
  saveTimer = setTimeout(writeSessionStoreToDisk, 1000);
};

/**
 * 세션 저장소 즉시 flush (shutdown 시 호출)
 * debounce 타이머를 취소하고 즉시 파일에 기록
 */
export const flushSessionStore = (): void => {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  writeSessionStoreToDisk();
  console.log('[session] 세션 저장소 flush 완료');
};

/** 세션 ID 저장 (인메모리 + 파일) */
const persistSessionId = (
  agentName: string,
  threadKey: string,
  sessionId: string,
): void => {
  if (!sessionStore[agentName]) {
    sessionStore[agentName] = {};
  }
  sessionStore[agentName][threadKey] = {
    sessionId,
    updatedAt: Date.now(),
  };
  saveSessionStore();
};

/** 저장된 세션 ID 조회 */
const getPersistedSessionId = (
  agentName: string,
  threadKey: string,
): string | undefined =>
  sessionStore[agentName]?.[threadKey]?.sessionId;

// 시작 시 로드
loadSessionStore();

// 1시간마다 TTL 만료 엔트리 정리 (시작 시 1회만이 아닌 주기적 정리)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const agent of Object.keys(sessionStore)) {
    for (const key of Object.keys(sessionStore[agent])) {
      if (
        now - sessionStore[agent][key].updatedAt >
        SESSION_TTL_MS
      ) {
        delete sessionStore[agent][key];
        cleaned++;
      }
    }
    if (Object.keys(sessionStore[agent]).length === 0) {
      delete sessionStore[agent];
    }
  }
  if (cleaned > 0) {
    console.log(
      `[session] 주기적 TTL 정리: ${cleaned}개 만료 엔트리 제거`,
    );
    saveSessionStore();
  }
}, 60 * 60 * 1000);

/** threadSessions Map 최대 크기 (에이전트당) */
const THREAD_SESSIONS_MAX = 200;

/**
 * 에이전트 bot user ID 매핑 (런타임에 index.ts에서 등록)
 * 위임 시 @mention에 실제 Slack user ID를 사용하기 위함
 */
const agentBotUserIds = new Map<string, string>();

/** 에이전트 bot user ID 등록 (index.ts에서 호출) */
export const registerAgentBotUserId = (
  agentName: string,
  botUserId: string,
): void => {
  agentBotUserIds.set(agentName, botUserId);
};

/**
 * 공통 맥락 규칙 prefix 생성 — 페르소나보다 앞에 삽입하여 우선순위 확보
 * 강한 페르소나가 맥락 해석 규칙을 압도하는 것을 방지
 * @returns 맥락 규칙 prefix 문자열
 */
const buildContextRulesPrefix = (): string => {
  const agentIdList = Array.from(agentBotUserIds.entries())
    .map(([name, id]) => `  - ${name}: <@${id}>`)
    .join('\n');

  return [
    '# 최우선 규칙 (페르소나보다 상위)',
    '',
    '## 맥락 해석',
    '- 스레드 주제가 제공되면, 새 메시지를 반드시 해당 주제의 맥락 안에서 해석하세요.',
    '- 당신의 전문 분석은 스레드 주제가 당신의 전문 영역일 때만 적용하세요.',
    '- 주제와 무관한 전문 분석을 강제로 끼워넣지 마세요.',
    '',
    '## 응답 규칙',
    '- 반드시 한국어로 응답하세요.',
    '- Slack mrkdwn 형식만 사용하세요 (Markdown 금지).',
    '- Slack 포스팅 도구를 직접 호출하지 마세요. 응답 내용을 텍스트로 출력하면 bridge가 자동으로 Slack에 포스팅합니다.',
    '',
    '## 브로드캐스트 응답 규칙',
    '- 여러 에이전트에게 동시에 전달된 메시지인 경우, 반드시 자신의 전문 영역에 대해서만 답변하세요.',
    '- 다른 파트의 상황을 추측하거나 대신 보고하지 마세요.',
    '- 전체 요약이 필요하면 PM에게 위임하세요.',
    '',
    '## 에이전트 간 위임',
    '- 작업이 다른 에이전트의 전문 영역에 해당하거나, 사용자가 다른 에이전트에게 넘기라고 요청하면, 응답 마지막에 해당 에이전트를 @mention하세요.',
    '- 에이전트 목록:',
    agentIdList,
    '- 위임 예시: "기획안을 정리했습니다. <@DESIGNER_USER_ID> 이 기획을 바탕으로 UI 디자인을 진행해주세요."',
    '- @mention하면 bridge가 자동으로 해당 에이전트를 실행하고, 당신의 응답을 컨텍스트로 전달합니다.',
    '- 자신이 직접 처리할 수 있는 작업은 위임하지 마세요.',
    '',
    '---',
    '',
  ].join('\n');
};

/** 에이전트 persona 파일 경로 매핑 */
const AGENT_PERSONA_FILES: Record<string, string> = {
  pm: '.claude/agents/pm.md',
  designer: '.claude/agents/designer.md',
  frontend: '.claude/agents/frontend.md',
  backend: '.claude/agents/backend.md',
  researcher: '.claude/agents/researcher.md',
  secops: '.claude/agents/secops.md',
};

/**
 * 모든 에이전트 persona 파일 존재 여부 검증 (시작 시 호출)
 * 누락된 파일이 있으면 에러 로그 출력 후 프로세스 종료
 */
export const validatePersonaFiles = (): void => {
  const missing: string[] = [];
  for (const [name, relativePath] of Object.entries(
    AGENT_PERSONA_FILES,
  )) {
    const fullPath = join(PROJECT_DIR, relativePath);
    if (!existsSync(fullPath)) {
      missing.push(`${name}: ${fullPath}`);
    }
  }
  if (missing.length > 0) {
    console.error(
      `[error] 누락된 persona 파일:\n  ${missing.join('\n  ')}`,
    );
    process.exit(1);
  }
  console.log(
    `[init] persona 파일 검증 완료 (${Object.keys(AGENT_PERSONA_FILES).length}개)`,
  );
};

// ─── 에이전트별 도구 매핑 ─────────────────────────────

/** Slack MCP 읽기 도구 (모든 에이전트 공통) */
// 쓰기 도구(post_message, reply_to_thread) 제거 — bridge가 resultText를 받아 1회만 포스팅
// 에이전트가 직접 포스팅하면 중복 응답 발생 가능
const SLACK_TOOLS = [
  'mcp__slack__slack_get_user_profile',
  'mcp__slack__slack_get_users',
  'mcp__slack__slack_list_channels',
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
        'Glob',
        'Grep',
        ...BASH_LIMITED_TOOLS,
        'Bash(git:*)',
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
        'Glob',
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
        'Glob',
        'Grep',
        ...BASH_LIMITED_TOOLS,
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
    const persona = readFileSync(fullPath, 'utf-8');
    return buildContextRulesPrefix() + persona;
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
      '당신이 멘션되었습니다. 응답 내용을 텍스트로 출력하세요.',
    keyword:
      '당신의 전문 영역 키워드가 감지되었습니다. 응답 내용을 텍스트로 출력하세요.',
    broadcast:
      '팀 전체 브로드캐스트 메시지입니다. 응답 내용을 텍스트로 출력하세요.',
    conversational:
      '일상 대화 메시지입니다. 자연스럽게 응답하세요.',
    llm: 'LLM 라우터가 당신을 선택했습니다. 응답 내용을 텍스트로 출력하세요.',
    delegation:
      '다른 에이전트가 당신에게 작업을 위임했습니다. 이전 에이전트의 작업 결과를 참고하여 응답하세요.',
    default:
      '기본 담당자로 할당되었습니다. 응답 내용을 텍스트로 출력하세요.',
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
    '- 중요: Slack 포스팅 도구를 직접 호출하지 마세요. 응답을 텍스트로 출력하면 bridge가 자동으로 Slack에 포스팅합니다.',
  );
  if (event.threadTopic) {
    parts.push(
      '',
      `[스레드 주제] ${event.threadTopic}`,
      '맥락 규칙: 위 스레드 주제에 맞게 응답하세요. 새 메시지를 단독으로 해석하지 말고, 반드시 스레드 주제의 맥락 안에서 이해하세요. 당신의 전문 분석은 주제가 해당 영역일 때만 적용하세요.',
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

// ─── MCP 서버 바이너리 경로 (npx -y 오버헤드 제거) ─────
// 로컬 node_modules/.bin/ 직접 참조 → npm resolution 200-500ms 절감
const BRIDGE_DIR = join(import.meta.dirname, '..');
const MCP_BIN = join(BRIDGE_DIR, 'node_modules', '.bin');

/**
 * Slack MCP 서버 설정 생성
 * @param botToken - 에이전트별 Slack Bot Token
 * @returns MCP 서버 설정 객체
 */
const createSlackMcpConfig = (
  botToken: string,
): McpServerConfig => ({
  command: join(MCP_BIN, 'mcp-server-slack'),
  args: [],
  env: {
    SLACK_BOT_TOKEN: botToken,
    SLACK_TEAM_ID: process.env.SLACK_TEAM_ID ?? '',
  },
});

/** Atlassian MCP 서버 설정 (mcp-remote 경유 SSE) */
const ATLASSIAN_MCP_CONFIG: McpServerConfig = {
  command: join(MCP_BIN, 'mcp-remote'),
  args: ['https://mcp.atlassian.com/v1/sse'],
  env: {},
};

/** context7 MCP 서버 설정 */
const CONTEXT7_MCP_CONFIG: McpServerConfig = {
  command: join(MCP_BIN, 'context7-mcp'),
  args: [],
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
 * @returns 에이전트 응답 텍스트 (C+D 위임 체인에서 활용)
 */
export const handleMessage = async (
  agentName: string,
  event: SlackEvent,
  routingMethod: string,
  slackApp: App,
  skipReaction = false,
): Promise<string> => {
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
    // threadTopic이 있으면 bridge가 맥락을 프리프로세싱했으므로 새 세션 강제
    // (이전 세션의 잘못된 히스토리가 맥락 지시를 압도하는 것 방지)
    const threadKey = event.thread_ts ?? event.ts;
    // 인메모리 캐시 → 영구화 저장소 순서로 조회
    const existingSessionId = event.threadTopic
      ? undefined
      : session.threadSessions.get(threadKey) ??
        getPersistedSessionId(agentName, threadKey);

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
        // threadSessions LRU: 크기 초과 시 가장 오래된 엔트리 제거
        if (session.threadSessions.has(threadKey)) {
          session.threadSessions.delete(threadKey);
        }
        session.threadSessions.set(threadKey, resultMsg.session_id);
        if (session.threadSessions.size > THREAD_SESSIONS_MAX) {
          const oldest = session.threadSessions.keys().next().value;
          if (oldest) {
            session.threadSessions.delete(oldest);
          }
        }
        persistSessionId(agentName, threadKey, resultMsg.session_id);
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
        } else {
          const errorText =
            'error' in resultMsg
              ? String(resultMsg.error)
              : JSON.stringify(resultMsg).slice(0, 200);
          console.error(
            `[runtime] ${agentName} SDK 비성공 결과: subtype=${resultMsg.subtype} — ${errorText}`,
          );
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

    // bridge가 resultText를 Slack에 1회만 포스팅 (에이전트 직접 포스팅 제거)
    if (resultText) {
      try {
        const postParams: {
          channel: string;
          text: string;
          thread_ts?: string;
        } = {
          channel: event.channel,
          text: resultText,
        };
        if (event.thread_ts) {
          postParams.thread_ts = event.thread_ts;
        }
        await slackApp.client.chat.postMessage(postParams);
        console.log(
          `[runtime] ${agentName} Slack 포스팅 완료 (bridge)`,
        );
      } catch (postErr) {
        console.error(
          `[runtime] ${agentName} Slack 포스팅 실패:`,
          postErr,
        );
      }
    } else {
      console.warn(
        `[runtime] ${agentName} 빈 결과 — Slack 포스팅 건너뜀`,
      );
    }

    return resultText;
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

    return '';
  }
};
