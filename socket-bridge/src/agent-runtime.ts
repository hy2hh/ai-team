import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import {
  query,
  createSdkMcpServer,
  tool,
} from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { App } from '@slack/bolt';
import type { AgentSession, SlackEvent } from './types.js';

const PROJECT_DIR = join(import.meta.dirname, '..', '..');

// ─── 태스크 라이프사이클 이벤트 로거 ──────────────────────
// task_dispatched / task_completed / task_failed / task_escalated 이벤트를
// .memory/logs/task-events.jsonl 에 append-only 기록 (디버깅 + 관측성)

const TASK_EVENTS_LOG_DIR = join(PROJECT_DIR, '.memory', 'logs');
const TASK_EVENTS_LOG_PATH = join(TASK_EVENTS_LOG_DIR, 'task-events.jsonl');

// ─── 에이전트별 성공/실패 통계 ──────────────────────────
// .memory/metrics/agent-stats.json 에 에이전트별 total/failures 기록
// 라우팅 가중치 조정 및 운영 관측성에 활용

const AGENT_STATS_DIR = join(PROJECT_DIR, '.memory', 'metrics');
const AGENT_STATS_PATH = join(AGENT_STATS_DIR, 'agent-stats.json');

interface AgentStatEntry {
  total: number;
  failures: number;
  lastFailure?: string;
  lastUpdated: string;
}

interface AgentStats {
  [agentName: string]: AgentStatEntry;
}

/**
 * 에이전트 성공/실패 통계를 파일에 기록
 * task_completed → success=true, task_failed → success=false
 */
const recordAgentStat = (agent: string, success: boolean): void => {
  try {
    if (!existsSync(AGENT_STATS_DIR)) {
      mkdirSync(AGENT_STATS_DIR, { recursive: true });
    }

    let stats: AgentStats = {};
    if (existsSync(AGENT_STATS_PATH)) {
      try {
        stats = JSON.parse(
          readFileSync(AGENT_STATS_PATH, 'utf-8'),
        ) as AgentStats;
      } catch {
        stats = {};
      }
    }

    if (!stats[agent]) {
      stats[agent] = {
        total: 0,
        failures: 0,
        lastUpdated: new Date().toISOString(),
      };
    }

    stats[agent].total += 1;
    if (!success) {
      stats[agent].failures += 1;
      stats[agent].lastFailure = new Date().toISOString();
    }
    stats[agent].lastUpdated = new Date().toISOString();

    writeFileSync(
      AGENT_STATS_PATH,
      JSON.stringify(stats, null, 2),
      'utf-8',
    );
  } catch {
    // 통계 기록 실패는 에이전트 동작에 영향 없도록 무시
  }
};

type TaskEventType =
  | 'task_dispatched'
  | 'task_completed'
  | 'task_failed'
  | 'task_aborted'
  | 'task_escalated';

interface TaskEvent {
  event: TaskEventType;
  agent: string;
  messageTs: string;
  channel: string;
  routingMethod: string;
  timestamp: string;
  elapsedMs?: number;
  error?: string;
  escalationReason?: string;
}

/**
 * 태스크 이벤트를 JSONL 로그 파일에 기록
 */
const logTaskEvent = (data: TaskEvent): void => {
  try {
    if (!existsSync(TASK_EVENTS_LOG_DIR)) {
      mkdirSync(TASK_EVENTS_LOG_DIR, { recursive: true });
    }
    appendFileSync(TASK_EVENTS_LOG_PATH, JSON.stringify(data) + '\n', 'utf-8');
  } catch {
    // 로그 실패는 에이전트 동작에 영향 없도록 무시
  }
};

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

      try {
        sessionStore = JSON.parse(data) as SessionStore;
      } catch (jsonErr) {
        // Corrupted JSON 파일 — 백업 후 초기화
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${SESSION_STORE_PATH}.backup.${timestamp}`;
        console.warn(
          `[session] Corrupted JSON 파일 감지. 백업: ${backupPath}`,
        );
        renameSync(SESSION_STORE_PATH, backupPath);
        sessionStore = {};
        console.warn('[session] 세션 저장소 초기화됨');
        return;
      }

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

// ─── 이모지 기반 에이전트 제어 ───────────────────────────────
// 지원 이모지:
//   ⛔ black_square_for_stop → 즉시 중단

interface ActiveAgentEntry {
  controller: AbortController;
  agentName: string;
  channel: string;
  slackApp: App;
}

/** 현재 실행 중인 에이전트 (원본 메시지 ts → 엔트리) */
const activeAgents = new Map<string, ActiveAgentEntry>();

/**
 * 라우팅/디바운스 중 취소 요청된 메시지 ts 집합
 * handleMessage 시작 시 체크하여 즉시 중단
 */
const pendingCancellations = new Set<string>();

/**
 * 에이전트 즉시 중단 (black_square_for_stop 리액션)
 * 실행 중이면 즉시 중단, 아직 실행 전(🔍 단계)이면 대기열에 등록
 * @returns 중단 성공 여부
 */
export const cancelAgent = (messageTs: string): boolean => {
  const entry = activeAgents.get(messageTs);
  if (entry) {
    console.log(
      `[control] ⛔ ${entry.agentName} 즉시 중단: ${messageTs}`,
    );
    entry.controller.abort();
    activeAgents.delete(messageTs);
    return true;
  }
  // 아직 activeAgents에 없음 (🔍 라우팅/디바운스 단계)
  // → 대기열에 등록하여 handleMessage 시작 시 즉시 중단
  pendingCancellations.add(messageTs);
  console.log(
    `[control] ⛔ 사전 취소 등록: ${messageTs} (라우팅 단계)`,
  );
  // 5분 후 자동 정리 (메모리 누수 방지)
  setTimeout(
    () => pendingCancellations.delete(messageTs),
    5 * 60 * 1000,
  );
  return true;
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
    '## 사실 기반 응답 (추론 금지)',
    '- 프로젝트 내부에 대한 주장(코드 구조, 기능 유무, 설정 상태 등)은 반드시 코드/파일을 직접 읽고 확인한 후 답변하세요.',
    '- "없다", "안 된다", "구현되지 않았다"는 주장은 Grep/Glob/Read로 검증한 증거가 필요합니다.',
    '- 추론, 추측, 가정 기반 답변 금지. 모르면 "확인이 필요합니다"라고 하세요.',
    '',
    '## 파일 수정 권한',
    '- Write/Edit 도구로 프로젝트 파일을 직접 수정할 수 있습니다.',
    '- `.claude/agents/shared/`, `.memory/`, 프로젝트 코드 파일 모두 수정 가능합니다.',
    '- 사용자에게 권한을 요청하지 말고 직접 수정하세요.',
    '',
    '## 에이전트 간 위임',
    '- 다른 에이전트에게 작업을 맡기려면 반드시 `mcp__delegation__delegate` 도구를 사용하세요.',
    '- delegate 도구에 에이전트 이름(pm/designer/frontend/backend/researcher/secops)과 이유를 전달하면 bridge가 해당 에이전트를 실행합니다.',
    '- 지금 즉시 실행해야 할 에이전트만 delegate하세요. 향후 계획은 delegate하지 마세요.',
    '- 순차 실행이 필요하면 먼저 할 에이전트만 delegate하세요. 나중 에이전트는 리뷰 시 delegate합니다.',
    '- 텍스트에서 에이전트를 언급할 때는 이름(Krusty, Bart 등)만 사용하세요. <@USER_ID> 멘션은 위임 트리거가 아닙니다.',
    '- 에이전트 목록:',
    agentIdList,
    '- 자신이 직접 처리할 수 있는 작업은 위임하지 마세요.',
    '',
    '---',
    '',
  ].join('\n');
};

// ─── 공유 메모리 로더 ──────────────────────────────────
// 에이전트 실행 시 .memory/ 파일을 코드가 직접 읽어 프롬프트에 주입
// LLM에게 "읽어라" 지시하는 대신, 구조적으로 동일한 사실 기반 보장

/** decisions/ 디렉토리에서 로드할 최대 파일 수 */
const MAX_DECISION_FILES = 5;

/**
 * 프로젝트 공유 메모리 로드 — 모든 에이전트에 동일하게 주입
 * @returns 공유 메모리 문자열 (project-context + 최근 decisions)
 */
const loadSharedMemory = (): string => {
  const parts: string[] = ['# 프로젝트 공유 메모리 (자동 주입)', ''];

  // 1. project-context.md
  const contextPath = join(
    PROJECT_DIR,
    '.memory',
    'facts',
    'project-context.md',
  );
  if (existsSync(contextPath)) {
    try {
      const content = readFileSync(contextPath, 'utf-8');
      parts.push('## 프로젝트 상태', '', content, '');
    } catch {
      // 읽기 실패 시 건너뜀
    }
  }

  // 2. decisions/ 최근 파일 (최대 5개, 파일명 역순 = 최신순)
  const decisionsDir = join(
    PROJECT_DIR,
    '.memory',
    'decisions',
  );
  if (existsSync(decisionsDir)) {
    try {
      const files = readdirSync(decisionsDir)
        .filter((f) => f.endsWith('.md'))
        .sort()
        .reverse()
        .slice(0, MAX_DECISION_FILES);

      if (files.length > 0) {
        parts.push('## 최근 결정사항', '');
        for (const file of files) {
          const filePath = join(decisionsDir, file);
          const content = readFileSync(
            filePath,
            'utf-8',
          );
          parts.push(`### ${file}`, '', content, '');
        }
      }
    } catch {
      // 읽기 실패 시 건너뜀
    }
  }

  return parts.join('\n');
};

/**
 * 에이전트별 개인 메모리 로드 — 자기 파트 작업 현황
 * @param agentName - 에이전트 이름
 * @returns 개인 메모리 문자열
 */
const loadAgentMemory = (agentName: string): string => {
  const parts: string[] = [
    '# 내 작업 현황 (자동 주입)',
    '',
  ];

  const taskPath = join(
    PROJECT_DIR,
    '.memory',
    'tasks',
    `active-${agentName}.md`,
  );
  if (existsSync(taskPath)) {
    try {
      const content = readFileSync(taskPath, 'utf-8');
      parts.push(content, '');
    } catch {
      // 읽기 실패 시 건너뜀
    }
  }

  return parts.join('\n');
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
    const sharedMemory = loadSharedMemory();
    const agentMemory = loadAgentMemory(agentName);
    console.log(
      `[memory] ${agentName}: shared=${sharedMemory.length}c agent=${agentMemory.length}c persona=${persona.length}c`,
    );
    return [
      buildContextRulesPrefix(),
      sharedMemory,
      agentMemory,
      persona,
    ].join('\n');
  } catch (err) {
    console.error(
      `[runtime] persona 파일 로드 실패: ${fullPath}`,
      err,
    );
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
      '당신이 멘션되었습니다. 응답 내용을 텍스트로 출력하세요. 다른 에이전트에게 실제로 작업을 위임할 때만 @멘션을 사용하세요. 단순 참고·추천·소개 시에는 @멘션 대신 이름(예: Wiggum)만 사용하세요.',
    keyword:
      '당신의 전문 영역 키워드가 감지되었습니다. 응답 내용을 텍스트로 출력하세요.',
    broadcast:
      '팀 전체 브로드캐스트 메시지입니다. 응답 내용을 텍스트로 출력하세요.',
    conversational:
      '일상 대화 메시지입니다. 자연스럽게 응답하세요.',
    llm: 'LLM 라우터가 당신을 선택했습니다. 응답 내용을 텍스트로 출력하세요.',
    delegation:
      '당신에게 작업이 위임되었습니다. 작업 결과만 출력하세요. 다른 에이전트를 @멘션하지 마세요 — 조율은 PM이 담당합니다.',
    'hub-review':
      '에이전트 실행 결과가 돌아왔습니다. 추가 작업이 필요한 에이전트만 @멘션하세요. 모든 작업이 완료됐다면 최종 요약만 출력하고 절대 @멘션하지 마세요. 에이전트를 사용자에게 추천·소개할 때도 @멘션 대신 이름만 사용하세요.',
    default:
      '기본 담당자로 할당되었습니다. 응답 내용을 텍스트로 출력하세요. 다른 에이전트에게 실제로 작업을 위임할 때만 @멘션을 사용하세요. 단순 참고·추천 시에는 이름만 사용하세요.',
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
/** Stdio MCP 서버 설정 (Slack, Atlassian, Context7) */
interface McpStdioConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/** MCP 서버 설정 — stdio 또는 인라인 SDK 서버 */
type McpServerConfig = McpStdioConfig | ReturnType<typeof createSdkMcpServer>;

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
/** handleMessage 반환 타입 */
export interface HandleMessageResult {
  text: string;
  postedTs?: string;
  /** PM delegate 도구로 지정된 위임 대상 에이전트 목록 */
  delegationTargets: string[];
  /** 에이전트가 escalate_to_pm 도구를 호출한 경우 이유 (PM 재라우팅 트리거) */
  escalationReason?: string;
}

export const handleMessage = async (
  agentName: string,
  event: SlackEvent,
  routingMethod: string,
  slackApp: App,
  skipReaction = false,
): Promise<HandleMessageResult> => {
  const session = getOrCreateSession(agentName);
  const prompt = formatSlackEventAsPrompt(event, routingMethod);

  console.log(
    `[runtime] ${agentName} 처리 시작 (${routingMethod}): "${event.text.slice(0, 50)}..."`,
  );

  // 🔍 단계에서 이미 취소된 메시지인지 확인
  if (pendingCancellations.has(event.ts)) {
    pendingCancellations.delete(event.ts);
    console.log(
      `[control] ⛔ ${agentName} 사전 취소로 실행 건너뜀: ${event.ts}`,
    );
    // ⛔ 리액션 추가 (취소됨 표시)
    if (!skipReaction) {
      try {
        await slackApp.client.reactions.add({
          channel: event.channel,
          timestamp: event.ts,
          name: 'black_square_for_stop',
        });
      } catch {
        // 리액션 실패는 무시
      }
    }
    return { text: '', delegationTargets: [] };
  }

  const startTime = Date.now();

  // 태스크 시작 이벤트 기록
  logTaskEvent({
    event: 'task_dispatched',
    agent: agentName,
    messageTs: event.ts,
    channel: event.channel,
    routingMethod,
    timestamp: new Date().toISOString(),
  });

  // 중단 제어용 AbortController 등록
  const abortController = new AbortController();
  activeAgents.set(event.ts, {
    controller: abortController,
    agentName,
    channel: event.channel,
    slackApp,
  });

  // 🧠 리액션으로 처리 중 표시
  if (!skipReaction) {
    try {
      await slackApp.client.reactions.add({
        channel: event.channel,
        timestamp: event.ts,
        name: 'brain',
      });
      console.log(`[reaction] 🧠 추가 완료: ${event.ts}`);
    } catch (err) {
      console.error(`[reaction] 🧠 추가 실패:`, err);
    }
  }

  try {
    // 에이전트별 Slack bot token 조회
    const botToken =
      process.env[
        `SLACK_BOT_TOKEN_${agentName.toUpperCase()}`
      ] ?? '';

    let resultText = '';
    let usedModel = '';
    let costUsd = 0;

    // 스레드 내 연속 대화 시 이전 세션 재사용 (히스토리 + 시스템 프롬프트 캐싱)
    // threadTopic이 있으면 bridge가 맥락을 프리프로세싱했으므로 새 세션 강제
    // (이전 세션의 잘못된 히스토리가 맥락 지시를 압도하는 것 방지)
    const threadKey = event.thread_ts ?? event.ts;
    // 인메모리 캐시 → 영구화 저장소 순서로 조회
    const existingSessionId = event.threadTopic
      ? undefined
      : session.threadSessions.get(threadKey) ??
        getPersistedSessionId(agentName, threadKey);

    // PM 전용: delegate 도구로 위임 의도를 수집하는 인라인 MCP 서버
    const delegationQueue: string[] = [];
    // 비PM 에이전트: escalate_to_pm 도구로 PM 재라우팅 신호 수집
    let escalationReason: string | undefined;

    const baseMcpServers = getMcpServersForAgent(
      agentName,
      botToken,
    );
    const baseTools = getToolsForAgent(agentName);

    if (agentName === 'pm') {
      const delegationServer = createSdkMcpServer({
        name: 'delegation',
        tools: [
          tool(
            'delegate',
            '다른 에이전트에게 작업을 즉시 위임합니다. 지금 바로 실행해야 할 에이전트만 지정하세요. 향후 계획은 이 도구를 호출하지 마세요.',
            { agents: z.array(z.string()), reason: z.string() },
            async ({ agents, reason }) => {
              const valid = agents.filter((a: string) =>
                ['designer', 'frontend', 'backend', 'researcher', 'secops'].includes(a),
              );
              delegationQueue.push(...valid);
              console.log(
                `[delegation] PM delegate 호출: [${valid.join(', ')}] — ${reason}`,
              );
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `위임 예약됨: [${valid.join(', ')}] — ${reason}`,
                  },
                ],
              };
            },
          ),
        ],
      });
      baseMcpServers.delegation = delegationServer;
      baseTools.push('mcp__delegation__delegate');
    } else {
      // 비PM 에이전트: 범위 초과 시 PM에게 에스컬레이션 신호 도구
      const escalationServer = createSdkMcpServer({
        name: 'escalation',
        tools: [
          tool(
            'escalate_to_pm',
            '현재 요청이 내 전문 범위를 초과하거나 PM의 조율이 필요한 경우 사용합니다. PM이 적절한 에이전트를 선택하여 재라우팅합니다.',
            { reason: z.string() },
            async ({ reason }) => {
              escalationReason = reason;
              console.log(
                `[escalation] ${agentName} escalate_to_pm 호출: ${reason}`,
              );
              logTaskEvent({
                event: 'task_escalated',
                agent: agentName,
                messageTs: event.ts,
                channel: event.channel,
                routingMethod,
                timestamp: new Date().toISOString(),
                escalationReason: reason,
              });
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `에스컬레이션 등록됨: ${reason}. PM이 재라우팅합니다.`,
                  },
                ],
              };
            },
          ),
        ],
      });
      baseMcpServers.escalation = escalationServer;
      baseTools.push('mcp__escalation__escalate_to_pm');
    }

    const queryOptions: Parameters<typeof query>[0]['options'] = {
      cwd: PROJECT_DIR,
      systemPrompt: session.systemPrompt,
      model: 'claude-sonnet-4-6',
      allowedTools: baseTools,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: 30,
      persistSession: true,
      mcpServers: baseMcpServers,
      abortController,
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
          // 모델 정보 캡처 (메타데이터 표시용)
          const models = Object.entries(resultMsg.modelUsage);
          if (models.length > 0) {
            usedModel = models[0][0];
          }
          costUsd = resultMsg.total_cost_usd;
          // 캐시 통계 로깅
          for (const [model, usage] of models) {
            const cacheRead = usage.cacheReadInputTokens;
            const cacheCreate = usage.cacheCreationInputTokens;
            const input = usage.inputTokens;
            const output = usage.outputTokens;
            console.log(
              `[cache] ${agentName} (${model}): input=${input} output=${output} cacheRead=${cacheRead} cacheCreate=${cacheCreate} cost=$${costUsd.toFixed(4)}`,
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

    // 🧠 → ✅ 완료 리액션 전환
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
    activeAgents.delete(event.ts);

    // 응답 메타데이터 (소요 시간 + 모델) 추가
    const modelLabel = usedModel || 'unknown';
    const metaFooter = `\n\n_⏱ ${elapsed}s · ${modelLabel}_`;

    // bridge가 resultText를 Slack에 1회만 포스팅 (에이전트 직접 포스팅 제거)
    let postedTs: string | undefined;
    if (resultText) {
      try {
        const postResult =
          await slackApp.client.chat.postMessage({
            channel: event.channel,
            text: resultText + metaFooter,
            thread_ts: event.thread_ts ?? event.ts,
          });
        postedTs = postResult.ts;
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

    // 태스크 완료 이벤트 기록
    logTaskEvent({
      event: 'task_completed',
      agent: agentName,
      messageTs: event.ts,
      channel: event.channel,
      routingMethod,
      timestamp: new Date().toISOString(),
      elapsedMs: Date.now() - startTime,
      escalationReason,
    });
    recordAgentStat(agentName, true);

    return {
      text: resultText,
      postedTs,
      delegationTargets: [...delegationQueue],
      escalationReason,
    };
  } catch (err) {
    // AbortError: 이모지로 의도적 중단
    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' ||
        err.message?.toLowerCase().includes('abort'));
    if (isAbort) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `[control] ${agentName} 중단됨 (${elapsed}s): ${event.ts}`,
      );
      logTaskEvent({
        event: 'task_aborted',
        agent: agentName,
        messageTs: event.ts,
        channel: event.channel,
        routingMethod,
        timestamp: new Date().toISOString(),
        elapsedMs: Date.now() - startTime,
      });
      // 🧠 → ⛔ 중단 리액션
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
            name: 'black_square_for_stop',
          });
        } catch {
          // 리액션 실패는 무시
        }
      }
      return { text: '', delegationTargets: [] };
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[runtime] ${agentName} 오류 (${elapsed}s):`, err);
    logTaskEvent({
      event: 'task_failed',
      agent: agentName,
      messageTs: event.ts,
      channel: event.channel,
      routingMethod,
      timestamp: new Date().toISOString(),
      elapsedMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    });
    recordAgentStat(agentName, false);

    // 🧠 → ❌ 에러 리액션 전환
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

    return { text: '', delegationTargets: [] };
  } finally {
    activeAgents.delete(event.ts);
  }
};
