// socket-bridge 진입점 — Slack 이벤트를 수신하여 에이전트에게 라우팅합니다
import { config } from 'dotenv';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { App } from '@slack/bolt';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';

// .env는 프로젝트 루트에 위치
config({ path: join(import.meta.dirname, '..', '..', '.env') });
import type { AgentConfig, SlackEvent } from './types.js';
import {
  registerBotUser,
  routeMessage,
  extractSpecPath,
} from './router.js';
import {
  handleMessage,
  registerAgentBotUserId,
  validatePersonaFiles,
  flushSessionStore,
  cancelAgent,
  cancelAllAgents,
  getActiveAgentsSnapshot,
  cleanupStaleAgents,
  cleanupExpiredSessions,
  resolveResearchMode,
  cancelResearchMode,
} from './agent-runtime.js';
import {
  getClaudeSdkQueryAuthOptions,
  validateAnthropicAuthOrExit,
} from './anthropic-auth.js';
import {
  tryClaim,
  updateClaim,
  cleanupExpiredClaims,
  cleanupOrphanClaims,
  recoverProcessingClaimsOnStartup,
  cancelAllProcessingClaims,
} from './claim-db.js';
import {
  writeHeartbeat,
  cleanupStaleHeartbeats,
} from './heartbeat.js';
import { runMaintenance, syncDecisionsFts } from './db.js';
import {
  cancelAutoProceed,
  manuallyApprove,
  manuallyReject,
  hasPendingApproval,
  cleanupExpiredApprovals,
  onApproved,
  cancelAllPendingTimers,
} from './auto-proceed.js';
import {
  shouldVerify,
  runCrossVerification,
  snapshotChangedFiles,
  diffSnapshots,
} from './cross-verify.js';
import { rateLimited } from './rate-limiter.js';
import {
  DEBOUNCE_DELAY,
  MAX_CONCURRENT_HANDLERS,
  AGENT_TIMEOUT_MS,
  MAX_DELEGATION_DEPTH,
  CONTEXT_COMPRESSION_ENABLED,
  CONTEXT_COMPRESSION_THRESHOLD_CHARS,
} from './config.js';
import {
  startQueueProcessor,
  stopQueueProcessor,
  agentDisplayName,
} from './queue-processor.js';
import { cancelQueueByThread, getRunningTaskIdsByThread } from './queue-manager.js';
import { moveToDone, moveToBlocked, updateCard } from './kanban-sync.js';
import { resolvePermissionRequest } from './permission-request.js';
import {
  getRunContext,
  deleteRunContext,
  updateStatusMessage,
  buildRerunModal,
  findContextsByThread,
  findContextByStatusMessageTs,
  restoreRunContextsFromDb,
  purgeExpiredRunContexts,
} from './agent-control-buttons.js';
import { buildMessageBlocks } from './slack-table.js';
import {
  initQaLoopTable,
  cleanupOldLoopStates,
  runRalphLoop,
  runDirectQA,
} from './qa-loop.js';
import { setApps as setMeetingApps } from './meeting.js';
import {
  startContextCleanupScheduler,
  formatCleanupReport,
} from './context-cleanup.js';
import {
  emit,
  emitMessageRouted,
  on,
  type HookEvent,
  type AgentEvent,
  type CircuitEvent,
} from './hook-events.js';
import {
  detectModelSelectRequest,
  extractModelTierFromText,
  postModelSelectMessage,
  resolveModelSelect,
  type ModelTier,
} from './model-select.js';
import { initLangfuseTracker, flushLangfuse } from './langfuse-tracker.js';

/** Slack 메시지 딥링크 생성 (channel + ts → 클릭 가능 링크) */
const slackMsgLink = (channel: string, ts: string): string => {
  const workspaceDomain =
    process.env.SLACK_WORKSPACE_DOMAIN ?? process.env.SLACK_TEAM_ID;
  if (!workspaceDomain) {
    return `\`${ts}\``;
  }
  const tsNoDot = ts.replace('.', '');
  const baseUrl = workspaceDomain.includes('.slack.com')
    ? `https://${workspaceDomain}`
    : `https://slack.com`;
  return `<${baseUrl}/archives/${channel}/p${tsNoDot}|원본 메시지>`;
};

// ─── 설정 ───────────────────────────────────────────────

const TEST_MODE = process.env.BRIDGE_TEST_MODE === '1';

/** Slack 첨부 이미지 임시 저장 디렉토리 */
const SLACK_FILES_TMP_DIR = '/tmp/slack-files';

/**
 * Slack url_private에서 이미지 파일 다운로드 후 임시 파일로 저장
 * @param urlPrivate - Slack url_private 경로
 * @param botToken - 다운로드 인증용 Slack Bot Token
 * @param filename - 저장 파일명
 * @returns 저장된 파일 경로 (실패 시 null)
 */
const downloadSlackImage = async (
  urlPrivate: string,
  botToken: string,
  filename: string,
): Promise<string | null> => {
  try {
    const resp = await fetch(urlPrivate, {
      headers: { Authorization: `Bearer ${botToken}` },
    });
    if (!resp.ok) {
      console.error(`[file] 이미지 다운로드 실패 (${resp.status}): ${urlPrivate}`);
      return null;
    }
    // content-type 검증 — Slack URL 만료 시 HTML 페이지가 반환되므로 이미지만 허용
    const contentType = resp.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      console.error(`[file] 이미지 다운로드 실패: 예상치 못한 content-type="${contentType}" (URL 만료 가능성)`);
      return null;
    }
    const buffer = await resp.arrayBuffer();
    await mkdir(SLACK_FILES_TMP_DIR, { recursive: true });
    const tmpPath = join(SLACK_FILES_TMP_DIR, filename);
    await writeFile(tmpPath, Buffer.from(buffer));
    console.log(`[file] 이미지 저장 완료: ${tmpPath}`);
    return tmpPath;
  } catch (err) {
    console.error(`[file] 이미지 다운로드 오류:`, err);
    return null;
  }
};

/** 환경변수 검증 함수 */
const validateEnvVars = (): void => {
  const agentNames = ['pm', 'designer', 'frontend', 'backend', 'researcher', 'secops', 'qa'];
  const missingTokens: string[] = [];

  for (const agent of agentNames) {
    const botTokenKey = `SLACK_BOT_TOKEN_${agent.toUpperCase()}`;
    const appTokenKey = `SLACK_APP_TOKEN_${agent.toUpperCase()}`;

    const botToken = process.env[botTokenKey];
    const appToken = process.env[appTokenKey];

    if (!botToken || botToken.trim() === '') {
      missingTokens.push(botTokenKey);
    }
    if (!appToken || appToken.trim() === '') {
      missingTokens.push(appTokenKey);
    }
  }

  if (missingTokens.length > 0) {
    console.error('[startup] CRITICAL: 필수 환경변수 누락');
    console.error(`[startup] 다음 토큰이 설정되지 않았거나 비어있습니다:`);
    missingTokens.forEach((token) => {
      console.error(`  - ${token}`);
    });
    console.error('[startup] .env 파일을 확인하고 모든 Slack 토큰을 설정해주세요.');
    process.exit(1);
  }
};

// 애플리케이션 시작 전 환경변수 검증
validateEnvVars();
validateAnthropicAuthOrExit();

const AGENTS: AgentConfig[] = [
  {
    name: 'pm',
    botToken: process.env.SLACK_BOT_TOKEN_PM!,
    appToken: process.env.SLACK_APP_TOKEN_PM!,
  },
  {
    name: 'designer',
    botToken: process.env.SLACK_BOT_TOKEN_DESIGNER!,
    appToken: process.env.SLACK_APP_TOKEN_DESIGNER!,
  },
  {
    name: 'frontend',
    botToken: process.env.SLACK_BOT_TOKEN_FRONTEND!,
    appToken: process.env.SLACK_APP_TOKEN_FRONTEND!,
  },
  {
    name: 'backend',
    botToken: process.env.SLACK_BOT_TOKEN_BACKEND!,
    appToken: process.env.SLACK_APP_TOKEN_BACKEND!,
  },
  {
    name: 'researcher',
    botToken: process.env.SLACK_BOT_TOKEN_RESEARCHER!,
    appToken: process.env.SLACK_APP_TOKEN_RESEARCHER!,
  },
  {
    name: 'secops',
    botToken: process.env.SLACK_BOT_TOKEN_SECOPS!,
    appToken: process.env.SLACK_APP_TOKEN_SECOPS!,
  },
  {
    name: 'qa',
    botToken: process.env.SLACK_BOT_TOKEN_QA!,
    appToken: process.env.SLACK_APP_TOKEN_QA!,
  },
];

// ─── Bot 자기 메시지 필터용 ──────────────────────────────

/** 우리 봇의 bot_id 집합 (런타임에 채워짐) */
const ownBotIds = new Set<string>();

/** botUserId → 에이전트 표시 이름 (히스토리 포맷용) */
const botUserIdToName = new Map<string, string>();

/** bot_id → 에이전트 표시 이름 (히스토리 포맷용) */
const botIdToName = new Map<string, string>();

/** bot_id → Bolt App 인스턴스 (자체 봇 메시지 chat.update용) */
const botIdToApp = new Map<string, App>();

/** botUserId → 에이전트 이름 (스레드 참여자 추적용) */
const botUserIdToAgentName = new Map<string, string>();

/** 에이전트 표시 이름 매핑 */
const AGENT_DISPLAY_NAMES: Record<string, string> = {
  pm: 'Marge',
  designer: 'Krusty',
  frontend: 'Bart',
  backend: 'Homer',
  researcher: 'Lisa',
  secops: 'Wiggum',
  qa: 'Chalmers',
};

/**
 * user ID 또는 bot_id로 발신자 표시 이름 반환
 * @param userId - Slack user ID
 * @param botId - Slack bot_id
 * @returns 표시 이름 (에이전트면 역할명, 아니면 user ID)
 */
const resolveSenderName = (
  userId?: string,
  botId?: string,
): string => {
  if (userId) {
    const agentName = botUserIdToName.get(userId);
    if (agentName) {
      return agentName;
    }
    return `<@${userId}>`;
  }
  if (botId) {
    const agentName = botIdToName.get(botId);
    if (agentName) {
      return agentName;
    }
    return `bot:${botId}`;
  }
  return 'unknown';
};

// ─── 채널 이름 캐시 (LRU — MAX 100개) ───────────────────

/** 채널 캐시 최대 크기 */
const CHANNEL_CACHE_MAX = 100;

const channelNameCache = new Map<string, string>();

/**
 * LRU 방식 채널 캐시 삽입 — 최대 크기 초과 시 가장 오래된 엔트리 제거
 * @param channelId - 채널 ID
 * @param name - 채널 이름
 */
const setChannelCache = (
  channelId: string,
  name: string,
): void => {
  // Map은 삽입 순서 보장 — delete 후 재삽입으로 LRU 위치 갱신
  if (channelNameCache.has(channelId)) {
    channelNameCache.delete(channelId);
  }
  channelNameCache.set(channelId, name);
  if (channelNameCache.size > CHANNEL_CACHE_MAX) {
    const oldest = channelNameCache.keys().next().value;
    if (oldest) {
      channelNameCache.delete(oldest);
    }
  }
};

/** 진행 중인 채널 이름 조회 (동시 요청 중복 방지) */
const pendingChannelLookups = new Map<string, Promise<string>>();

/** 첫 번째 유효한 Bolt App으로 채널 이름 조회 */
const getChannelName = async (
  apps: App[],
  channelId: string,
): Promise<string> => {
  const cached = channelNameCache.get(channelId);
  if (cached) {
    // LRU 순서 갱신: delete → re-insert
    channelNameCache.delete(channelId);
    channelNameCache.set(channelId, cached);
    return cached;
  }

  // 동일 채널에 대한 동시 조회 중복 방지
  const pending = pendingChannelLookups.get(channelId);
  if (pending) {
    return pending;
  }

  const lookup = (async () => {
    for (const app of apps) {
      try {
        const result = await app.client.conversations.info({
          channel: channelId,
        });
        const name =
          (result.channel as { name?: string })?.name ??
          channelId;
        setChannelCache(channelId, name);
        return name;
      } catch {
        continue;
      }
    }
    return channelId;
  })();

  pendingChannelLookups.set(channelId, lookup);
  try {
    return await lookup;
  } finally {
    pendingChannelLookups.delete(channelId);
  }
};

// ─── 스레드 주제 요약 ─────────────────────────────────────

/**
 * 스레드 히스토리를 Haiku로 1줄 요약 (Agent SDK 사용)
 * @param conversationHistory - 스레드 이전 대화 텍스트
 * @returns 주제 요약 (실패 시 빈 문자열)
 */
const summarizeThreadTopic = async (
  conversationHistory: string,
): Promise<string> => {
  try {
    let resultText = '';
    for await (const message of query({
      prompt: `다음 Slack 스레드의 최초 주제를 한 줄(20자 이내)로 요약하세요.
규칙:
- 스레드를 시작한 첫 메시지의 주제만 추출
- 이후 대화에서 빗나간 내용은 무시
- "~에 대한 논의" 형식으로 출력
- 주제만 출력하고 다른 설명은 하지 마세요

대화:
${conversationHistory}`,
      options: {
        ...getClaudeSdkQueryAuthOptions(),
        model: 'claude-haiku-4-5-20251001',
        maxTurns: 1,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
      },
    })) {
      if (message.type === 'result') {
        const result = message as SDKResultMessage;
        if (result.subtype === 'success') {
          resultText = result.result.trim();
        }
      }
    }
    console.log(
      `[topic] 스레드 주제 요약: "${resultText}"`,
    );
    return resultText;
  } catch (err) {
    console.error(
      '[topic] 스레드 주제 요약 실패:',
      err,
    );
    return '';
  }
};

// ─── LLM 컨텍스트 압축 (Phase 2) ─────────────────────────

/**
 * 긴 스레드 히스토리를 Haiku로 압축 (Agent SDK 사용).
 *
 * 압축 전략:
 *   - 주요 결정사항/답변 요약 보존
 *   - 최근 3개 메시지 원문 유지 (연속성 보장)
 *   - 압축 표시 헤더 추가 → 에이전트가 압축 여부 인지 가능
 *
 * @param conversationHistory - 압축할 스레드 히스토리 전문
 * @returns 압축된 히스토리 (실패 시 원본 반환)
 */
const compressConversationHistory = async (
  conversationHistory: string,
): Promise<string> => {
  try {
    // 최근 3개 메시지는 원문 유지 (연속성 보장)
    const lines = conversationHistory.split('\n').filter((l) => l.trim());
    const recentLines = lines.slice(-6); // 대화 1턴 ≈ 2줄 (발화자: 내용)
    const olderLines = lines.slice(0, -6);

    if (olderLines.length === 0) {
      // 압축할 구 히스토리가 없으면 그대로 반환
      return conversationHistory;
    }

    const olderHistory = olderLines.join('\n');
    let summaryText = '';

    for await (const message of query({
      prompt: `다음 Slack 스레드 이전 대화를 압축 요약하세요.

규칙:
- 주요 질문, 결정사항, 분석 결과를 bullet point로 요약
- 에이전트 이름(발화자)은 유지
- 반복되거나 부수적인 내용은 제거
- 500자 이내로 압축
- 요약문만 출력 (설명 없이)

대화:
${olderHistory}`,
      options: {
        ...getClaudeSdkQueryAuthOptions(),
        model: 'claude-haiku-4-5-20251001',
        maxTurns: 1,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
      },
    })) {
      if (message.type === 'result') {
        const result = message as SDKResultMessage;
        if (result.subtype === 'success') {
          summaryText = result.result.trim();
        }
      }
    }

    if (!summaryText) return conversationHistory;

    const compressed = [
      `[압축된 이전 대화 요약 — 원본 ${conversationHistory.length}자 → ${summaryText.length}자]`,
      summaryText,
      '',
      '[최근 대화]',
      recentLines.join('\n'),
    ].join('\n');

    console.log(
      `[compress] 히스토리 압축: ${conversationHistory.length}자 → ${compressed.length}자`,
    );
    return compressed;
  } catch (err) {
    console.error('[compress] 히스토리 압축 실패, 원본 사용:', err);
    return conversationHistory;
  }
};

// ─── 처리 중인 메시지 중복 방지 ─────────────────────────

/** 현재 처리 중인 메시지 ts 집합 */
const processingMessages = new Set<string>();

// ─── 메시지 디바운스 (연속 메시지 그룹핑) ────────────────

// DEBOUNCE_DELAY: config.ts에서 import (환경변수 BRIDGE_DEBOUNCE_DELAY로 조정 가능)

/** 디바운스 버퍼 항목 */
interface DebounceEntry {
  /** 누적된 메시지 (ts, text, user) */
  messages: Array<{
    ts: string;
    text: string;
    user: string;
  }>;
  /** 디바운스 타이머 */
  timer: ReturnType<typeof setTimeout>;
  /** 채널 ID */
  channel: string;
  /** 채널 이름 */
  channelName: string;
  /** 스레드 ts (스레드가 아니면 null) */
  threadTs: string | null;
  /** 원본 raw 이벤트 (마지막 메시지 기준) */
  raw: Record<string, unknown>;
  /** 엔트리 생성 시각 (TTL 정리용) */
  createdAt: number;
}

/**
 * 디바운스 키 생성 (스레드 기준, 사용자 무관)
 * @param channel - 채널 ID
 * @param threadTs - 스레드 ts
 * @param user - 발신자 ID (채널 메시지에서만 사용)
 * @returns 디바운스 키
 */
const getDebounceKey = (
  channel: string,
  threadTs: string | null,
  user: string,
): string => {
  if (threadTs) {
    // 스레드: 모든 사용자의 메시지를 하나로 그룹핑
    return `thread:${channel}:${threadTs}`;
  }
  // 채널 일반 메시지: 사용자별 그룹핑
  return `channel:${channel}:${user}`;
};

/** 디바운스 버퍼 (key → entry) */
const debounceBuffer = new Map<string, DebounceEntry>();

// ─── 에이전트 Slack App 조회 헬퍼 ───────────────────────

/** 에이전트 이름으로 Slack App 인스턴스 조회 */
const findAgentApp = (
  agentName: string,
  apps: App[],
): App => {
  const idx = AGENTS.findIndex(
    (a) => a.name === agentName,
  );
  return idx >= 0 ? apps[idx] : apps[0];
};

/** 유효한 에이전트 이름인지 확인 */
const isValidAgent = (name: string): boolean =>
  AGENTS.some((a) => a.name === name);

// ─── 리액션 유틸리티 ─────────────────────────────────────

/** 리액션 추가 (실패 로깅 후 무시, rate limited) */
const safeAddReaction = async (
  app: App,
  channel: string,
  ts: string,
  name: string,
): Promise<void> => {
  try {
    await rateLimited(() =>
      app.client.reactions.add({
        channel,
        timestamp: ts,
        name,
      }),
    );
  } catch (err) {
    // already_reacted는 정상 케이스 — 무시
    const errMsg = err instanceof Error ? err.message : String(err);
    if (!errMsg.includes('already_reacted')) {
      console.warn(`[reaction] add ${name} 실패 (ts=${ts}):`, errMsg);
    }
  }
};

/** 리액션 교체: from → to (실패 무시) */
const safeSwapReaction = async (
  app: App,
  channel: string,
  ts: string,
  from: string,
  to: string,
): Promise<void> => {
  try {
    await rateLimited(() =>
      app.client.reactions.remove({
        channel,
        timestamp: ts,
        name: from,
      }),
    );
  } catch {
    // 제거 실패 무시
  }
  await safeAddReaction(app, channel, ts, to);
};

// ─── 실행 모드별 핸들러 ─────────────────────────────────

/** PM Hub 최대 에이전트 실행 횟수 — 무한 루프 방지 */
// MAX_DELEGATION_DEPTH: config.ts에서 import

/** 에이전트별 최대 실행 시간 (5분) — fan-out 타임아웃 */
// AGENT_TIMEOUT_MS: config.ts에서 import

/**
 * 에이전트 실행에 타임아웃 적용
 * 타임아웃 시 cancelAgent()를 호출해 AbortController를 통해 내부 쿼리도 중단
 * @param promise - handleMessage Promise
 * @param agentName - 에이전트 이름 (로그용)
 * @param eventTs - 이벤트 ts (cancelAgent 호출용)
 */
const withAgentTimeout = <T>(
  promise: Promise<T>,
  agentName: string,
  eventTs: string,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      console.warn(
        `[timeout] ${agentName} 응답 시간 초과 (${AGENT_TIMEOUT_MS / 1000}s) — 강제 중단`,
      );
      cancelAgent(eventTs);
      reject(
        new Error(
          `[timeout] ${agentName} ${AGENT_TIMEOUT_MS / 1000}s 초과`,
        ),
      );
    }, AGENT_TIMEOUT_MS);
  });
  return Promise.race([promise, timeoutPromise]).finally(
    () => clearTimeout(timer),
  ) as Promise<T>;
};

// ─── 이벤트 빌더 ─────────────────────────────────────────

/** 위임받는 에이전트용 이벤트 생성 */
/** UTF-8 안전 문자열 자르기 (서로게이트 페어 보호) */

const DELEGATION_RESULT_LIMIT = Number(
  process.env.DELEGATION_RESULT_LIMIT ?? 3000,
);

const safeSlice = (str: string, maxLen: number): string => {
  if (str.length <= maxLen) {
    return str;
  }
  // 서로게이트 페어 중간에서 자르지 않도록 조정
  let end = maxLen;
  const code = str.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) {
    end -= 1;
  }
  return str.slice(0, end);
};

const buildDelegationEvent = (
  originalEvent: SlackEvent,
  accumulatedResults: Array<{
    agent: string;
    text: string;
  }>,
): SlackEvent => {
  const parts: string[] = [];

  if (accumulatedResults.length > 0) {
    parts.push('[이전 작업 결과]');
    for (const r of accumulatedResults) {
      parts.push(`— ${r.agent}: ${safeSlice(r.text, DELEGATION_RESULT_LIMIT)}`);
    }
    parts.push('');
  }

  parts.push('[원본 요청]', originalEvent.text);

  return { ...originalEvent, text: parts.join('\n') };
};

/** PM 리뷰용 이벤트 생성 */
const buildPmReviewEvent = (
  originalEvent: SlackEvent,
  accumulatedResults: Array<{
    agent: string;
    text: string;
  }>,
  executedAgents?: Set<string>,
): SlackEvent => {
  const parts = ['[에이전트 실행 결과 보고]'];

  for (const r of accumulatedResults) {
    parts.push(`— ${r.agent}: ${safeSlice(r.text, DELEGATION_RESULT_LIMIT)}`);
  }

  if (executedAgents && executedAgents.size > 0) {
    parts.push(
      '',
      `[이미 실행된 에이전트: ${Array.from(executedAgents).join(', ')}]`,
      '위 에이전트는 이미 실행 완료됨 — 동일 에이전트 재위임 금지',
    );
  }

  parts.push('', '[원본 요청]', originalEvent.text);

  return { ...originalEvent, text: parts.join('\n') };
};

// ─── 실행 핸들러 ─────────────────────────────────────────

/**
 * 단일 에이전트 실행 + PM Hub 위임 패턴
 *
 * PM 응답에 @mention이 포함되면 Hub 루프 진입:
 * PM → Agent(s) → PM 리뷰 → Agent(s) → PM 리뷰 → ... → 완료
 * 비PM 에이전트는 hub 미적용 (기존 동작 유지).
 * @param agentName - 에이전트 이름
 * @param event - Slack 이벤트
 * @param method - 라우팅 방식
 * @param app - Slack App 인스턴스
 * @param apps - 전체 Slack App 목록 (위임 시 필요)
 */
const executeSingle = async (
  agentName: string,
  event: SlackEvent,
  method: string,
  app: App,
  apps?: App[],
  modelTier: 'high' | 'standard' | 'fast' = 'standard',
): Promise<void> => {
  let result = await handleMessage(
    agentName,
    event,
    method,
    app,
    false,
    false,
    modelTier,
  );

  // max_turns 도달 시 → 체크포인트 기반 자동 재시도 (최대 3회)
  const MAX_MENTION_RETRIES = 3;
  let retryCount = 0;
  while (result.isMaxTurns && retryCount < MAX_MENTION_RETRIES) {
    retryCount++;
    console.log(
      `[mention-retry] ${agentName} max_turns 도달 — 세션 재개 재시도 ${retryCount}/${MAX_MENTION_RETRIES}`,
    );
    // 기존 세션을 재개(resume)하여 이전 컨텍스트 유지.
    // threadTopic을 제거해야 agent-runtime이 threadSessions에서 기존 세션 ID를 조회하고
    // resume 모드로 실행 — 새 세션 생성 시 에이전트가 이전 작업을 모르고 턴을 낭비하는 문제 방지.
    const retryEvent: SlackEvent = {
      ...event,
      user: 'mention-retry',
      threadTopic: undefined,
      text: `이전 작업을 이어서 완료하세요. (자동 재시도 ${retryCount}/${MAX_MENTION_RETRIES})`,
    };
    try {
      await rateLimited(() =>
        app.client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.thread_ts ?? event.ts,
          text: `🔄 *${agentName} 작업 재시도 중 [${retryCount}/${MAX_MENTION_RETRIES}]* — 대화 한도 초과, 체크포인트에서 이어서 계속합니다`,
        }),
      );
    } catch {
      // 알림 실패 무시
    }
    result = await handleMessage(
      agentName,
      retryEvent,
      'mention-retry',
      app,
      false,
      false,
      modelTier,
    );
  }

  // 에이전트가 create_kanban_card로 생성한 카드 → Done 이동 (max_turns 실패 시 Blocked로)
  if (result.kanbanCardId) {
    if (result.isMaxTurns) {
      moveToBlocked(result.kanbanCardId).catch((err) =>
        console.warn('[kanban-sync] executeSingle moveToBlocked 실패:', err),
      );
    } else {
      moveToDone(result.kanbanCardId).catch((err) =>
        console.warn('[kanban-sync] executeSingle moveToDone 실패:', err),
      );
    }
  }

  // 비PM 에이전트가 escalate_to_pm을 호출한 경우 → PM으로 재라우팅
  if (
    agentName !== 'pm' &&
    result.escalationReason &&
    apps
  ) {
    const pmApp = findAgentApp('pm', apps);
    const escalationText = [
      `[에스컬레이션 — ${agentName}에서 PM으로]`,
      `사유: ${result.escalationReason}`,
      '',
      result.text ? `${agentName} 부분 응답:\n${result.text}` : '',
      '',
      '[원본 요청]',
      event.text,
    ]
      .filter(Boolean)
      .join('\n');
    const escalationEvent: SlackEvent = {
      ...event,
      text: escalationText,
    };
    console.log(
      `[escalation] ${agentName} → PM 재라우팅: ${result.escalationReason}`,
    );
    await executeSingle('pm', escalationEvent, 'delegation', pmApp, apps);
    return;
  }

  // 비PM이거나 텍스트 없으면 hub 미적용
  if (
    agentName !== 'pm' ||
    !result.text ||
    !apps
  ) {
    return;
  }

  // PM delegate 도구로 지정된 위임 대상 사용 (텍스트 파싱 제거)
  let targets = result.delegationTargets.filter(
    (t) => t.agent !== 'pm' && isValidAgent(t.agent),
  );

  // 순차 위임 또는 병렬 위임이 없으면 종료
  const hasSequential = result.delegationSteps && result.delegationSteps.length > 0;
  if (targets.length === 0 && !hasSequential) {
    return;
  }

  // ─── 순차 위임 처리 (delegate_sequential) ──────────────
  // PM이 delegate_sequential을 사용하면 step별로 순차 실행
  if (result.delegationSteps && result.delegationSteps.length > 0) {
    console.log(
      `[hub] 순차 위임 시작: ${result.delegationSteps.length} steps`,
    );
    const pmApp = findAgentApp('pm', apps);
    // ⚒️ 사용자 원본 메시지에 처리 중 리액션 추가 (🧠 또는 ✅ 제거 후)
    try { await app.client.reactions.remove({ channel: event.channel, timestamp: event.ts, name: 'brain' }); } catch { /* 없으면 무시 */ }
    await safeSwapReaction(app, event.channel, event.ts, 'white_check_mark', 'writing_hand');
    console.log(`[reaction] ⚒️ 순차 위임 시작 → 사용자 메시지: ${event.ts}`);
    const seqResults: Array<{ agent: string; text: string; changedFiles: string[] }> = [];

    // PM 위임 발표 메시지 ts (리액션 대상)
    const seqPmTs = result.postedTs;

    for (let si = 0; si < result.delegationSteps.length; si++) {
      const step = result.delegationSteps[si];
      console.log(
        `[hub] 순차 위임: step ${si + 1}/${result.delegationSteps.length} [${step.agents.join(', ')}] — ${step.task}`,
      );

      // git diff 스냅샷 (step 전)
      const beforeSnapshot = snapshotChangedFiles();

      // ⚒️ 첫 번째 에이전트 앱으로 PM 위임 메시지에 작업 중 리액션 추가 (step 시작)
      const firstTargetApp = findAgentApp(step.agents[0], apps);
      if (seqPmTs) {
        await safeSwapReaction(firstTargetApp, event.channel, seqPmTs, 'white_check_mark', 'writing_hand');
        console.log(`[reaction] ⚒️ 순차 위임 step ${si + 1} 시작 → PM 메시지: ${seqPmTs}`);
      }

      // step 내 에이전트는 병렬 실행
      const stepResults = await Promise.allSettled(
        step.agents.map((target) => {
          const targetApp = findAgentApp(target, apps);
          // 이전 step 결과 + 현재 task를 포함한 이벤트
          const stepEvent: SlackEvent = {
            ...event,
            text: [
              `[순차 위임 step ${si + 1}] ${step.task}`,
              '',
              seqResults.length > 0
                ? `*이전 단계 결과:*\n${seqResults.map((r) => `[${r.agent}] ${r.text.slice(0, 1000)}`).join('\n\n')}`
                : '',
              '',
              '[원본 요청]',
              event.text,
            ].filter(Boolean).join('\n'),
          };
          // PM이 생성한 Backlog 카드 ID 전달
          const existingCardId = step.kanbanCardIds?.[target] ?? null;
          return handleMessage(
            target,
            stepEvent,
            'delegation',
            targetApp,
            true,
            false,
            step.tier ?? 'standard',
            existingCardId,
            { current: si + 1, total: result.delegationSteps!.length },
          );
        }),
      );

      // git diff 스냅샷 (step 후) — step 내 전체 변경 캡처
      const afterSnapshot = snapshotChangedFiles();
      const stepChangedFiles = diffSnapshots(beforeSnapshot, afterSnapshot);

      let stepHasFailure = false;
      for (let i = 0; i < step.agents.length; i++) {
        const r = stepResults[i];
        const isFailed = r.status === 'rejected';
        if (isFailed) {
          stepHasFailure = true;
        }
        seqResults.push({
          agent: step.agents[i],
          text: r.status === 'fulfilled'
            ? r.value.text
            : `[실패: ${(r as PromiseRejectedResult).reason}]`,
          changedFiles: stepChangedFiles,
        });

        // 에이전트가 create_kanban_card로 생성한 카드 → Done/Blocked 전환
        if (r.status === 'fulfilled' && r.value.kanbanCardId) {
          moveToDone(r.value.kanbanCardId).catch((err) =>
            console.warn('[kanban-sync] 순차 위임 moveToDone 실패:', err),
          );
        }
      }

      // ✅ 각 에이전트 완료 메시지에 체크 리액션 (step 완료 시)
      for (let i = 0; i < step.agents.length; i++) {
        const r = stepResults[i];
        if (r.status === 'fulfilled' && r.value.postedTs) {
          try {
            await pmApp.client.reactions.add({
              channel: event.channel,
              timestamp: r.value.postedTs,
              name: 'white_check_mark',
            });
            console.log(`[reaction] ✅ step ${si + 1} 에이전트 [${step.agents[i]}] 완료 메시지 리액션: ${r.value.postedTs}`);
          } catch {
            // 리액션 실패 무시 (이미 달린 경우 포함)
          }
        }
      }

      // ✅ PM 위임 메시지 ⚒️ → ✅ 교체 (step 완료, 실패 시 제외)
      if (seqPmTs && !stepHasFailure) {
        await safeSwapReaction(firstTargetApp, event.channel, seqPmTs, 'writing_hand', 'white_check_mark');
        console.log(`[reaction] ✅ 순차 위임 step ${si + 1} 완료 → PM 메시지: ${seqPmTs}`);
      }

      // step 실패 시 후속 step 중단 — 선행 step 실패한 상태로 후행 step 실행하면
      // 의존성 없는 결과물이 생성됨 (예: Designer 실패 → Frontend가 디자인 없이 구현)
      if (stepHasFailure) {
        const failedAgents = step.agents.filter(
          (_, i) => stepResults[i].status === 'rejected',
        );
        console.warn(
          `[hub] 순차 위임 중단: step ${si + 1} 실패 [${failedAgents.join(', ')}] — 후속 ${result.delegationSteps!.length - si - 1}개 step 스킵`,
        );
        try {
          await pmApp.client.chat.postMessage({
            channel: event.channel,
            thread_ts: event.thread_ts ?? event.ts,
            text: `❌ *Step ${si + 1} 실패* — [${failedAgents.join(', ')}]\n후속 step 중단됨. PM 리뷰로 전환합니다.`,
          });
        } catch {
          // 알림 실패 무시
        }
        break;
      }

      // 다음 step의 Backlog 카드에 이전 step 결과를 description으로 업데이트
      if (si < result.delegationSteps.length - 1) {
        const nextStep = result.delegationSteps[si + 1];
        const prevSummary = seqResults
          .filter((r) => step.agents.includes(r.agent))
          .map((r) => r.text.slice(0, 200))
          .join(' | ');
        if (nextStep.kanbanCardIds) {
          for (const [agent, cardId] of Object.entries(nextStep.kanbanCardIds)) {
            updateCard(cardId, { description: `이전 단계(${step.agents.join(', ')}) 결과: ${prevSummary}`.slice(0, 500) }).catch(() => {});
            console.log(`[kanban-sync] 다음 step 카드 #${cardId} (${agent}) description 업데이트`);
          }
        }
      }

    }

    // 전체 순차 위임 완료 → PM 리뷰
    const reviewEvent = buildPmReviewEvent(
      event,
      seqResults,
      new Set(seqResults.map((r) => r.agent)),
    );
    console.log('[hub] 순차 위임 전체 완료 → PM 리뷰');
    await handleMessage(
      'pm',
      reviewEvent,
      'hub-review',
      pmApp,
      true,
      false,
      'high',
    );

    // cross-verify (변경 파일 내용을 코드가 직접 읽어서 주입)
    // 동일 에이전트가 복수 step에 실행된 경우 마지막 결과만 검증 (중복 실행 방지)
    const lastSeqResultPerAgent = new Map<string, { agent: string; text: string; changedFiles: string[] }>();
    for (const agentResult of seqResults) {
      lastSeqResultPerAgent.set(agentResult.agent, agentResult);
    }
    const seqVerifyAgents = [...lastSeqResultPerAgent.values()].filter((r) => shouldVerify(r.agent) && r.changedFiles.length > 0);
    let seqAllPassed = seqVerifyAgents.length > 0;
    for (const agentResult of seqVerifyAgents) {
      console.log(`[cross-verify] ${agentResult.agent} 자동 검증 시작 (변경 파일: ${agentResult.changedFiles.length}개)`);
      try {
        const verifyResults = await runCrossVerification(agentResult.agent, agentResult.text, agentResult.changedFiles, event, pmApp);
        const hasFail = verifyResults.some((r) => r.result === 'FAIL');
        if (hasFail) {
          seqAllPassed = false;
          console.warn(`[cross-verify] ${agentResult.agent}: FAIL 감지 — Ralph Loop 시작`);
          const failedVerifier = verifyResults.find((r) => r.result === 'FAIL');
          const agentApp = findAgentApp(agentResult.agent, apps);
          try {
            const loopResult = await runRalphLoop(
              agentResult.agent,
              event.text,
              failedVerifier?.details ?? 'Cross-verify FAIL',
              event,
              agentApp,
              pmApp,
            );
            console.log(`[qa-loop] Ralph Loop 완료: ${agentResult.agent} → ${loopResult.finalResult} (${loopResult.iterations}회)`);
          } catch (loopErr) {
            console.error(`[qa-loop] Ralph Loop 실패: ${agentResult.agent}`, loopErr);
          }
        }
      } catch (err) {
        console.error(`[cross-verify] ${agentResult.agent} 검증 실패:`, err);
      }
    }
    // QA 자동 트리거: 모든 에이전트 검증 완료 후 1회만 실행 (중복 방지)
    if (seqAllPassed) {
      const specPath = extractSpecPath(event.text);
      if (specPath) {
        console.log(`[qa-loop] cross-verify 전체 PASS + specPath 감지 → QA 자동 실행: ${specPath}`);
        try {
          const qaApp = findAgentApp('qa', apps);
          await runDirectQA(specPath, event, qaApp);
        } catch (qaErr) {
          console.error('[qa-loop] QA 자동 실행 실패:', qaErr);
        }
      }
    }

    // PM이 순차 위임 전체 완료 후 리뷰했으므로 recommend_next_phase 재요청 불필요

    // ✅ 사용자 원본 메시지 완료 리액션 전환
    await safeSwapReaction(app, event.channel, event.ts, 'writing_hand', 'white_check_mark');
    console.log(`[reaction] ✅ 순차 위임 완료 → 사용자 메시지: ${event.ts}`);
    return;
  }

  // ─── PM Hub 루프 시작 (병렬 모드) ───────────────────
  console.log(
    `[hub] PM Hub 시작: targets=[${targets.map((t) => t.agent).join(', ')}]`,
  );

  const pmApp = findAgentApp('pm', apps);

  const accumulatedResults: Array<{
    agent: string;
    text: string;
    changedFiles: string[];
  }> = [];
  let agentExecutionCount = 0;
  // ⚒️ 사용자 원본 메시지에 처리 중 리액션 추가 (🧠 또는 ✅ 제거 후)
  try { await app.client.reactions.remove({ channel: event.channel, timestamp: event.ts, name: 'brain' }); } catch { /* 없으면 무시 */ }
  await safeSwapReaction(app, event.channel, event.ts, 'white_check_mark', 'writing_hand');
  console.log(`[reaction] ⚒️ 허브 루프 시작 → 사용자 메시지: ${event.ts}`);
  // 현재 라운드의 PM 메시지 (위임 에이전트가 리액션할 대상)
  let currentPmTs = result.postedTs;
  // 순환 핸드오프 감지: 전체 허브 루프에서 실행된 에이전트 추적
  const allExecutedAgents = new Set<string>();
  // 마지막 PM 리뷰 결과 (루프 자연 종료 시 Slack 포스팅용)
  let lastPmReview: { text: string; postedTs?: string } | null = null;

  while (
    targets.length > 0 &&
    agentExecutionCount < MAX_DELEGATION_DEPTH
  ) {
    // 순환 핸드오프 감지: 모든 타겟이 이미 실행된 경우 경고
    const repeatedAgents = targets.filter((t) => allExecutedAgents.has(t.agent));
    if (repeatedAgents.length > 0) {
      console.warn(
        `[hub] 순환 핸드오프 감지: [${repeatedAgents.map((t) => t.agent).join(', ')}] 이미 이번 허브 루프에서 실행됨 — PM이 재위임 요청`,
      );
    }
    // 모든 타겟이 재실행 요청이면 경고 후 종료 (순수 무한루프)
    if (repeatedAgents.length === targets.length) {
      console.warn(
        `[hub] 순환 루프 중단: 모든 타겟 [${targets.map((t) => t.agent).join(', ')}]이 이미 실행됨`,
      );
      break;
    }

    // (a) 위임 에이전트 실행
    if (targets.length === 1) {
      const targetObj = targets[0];
      const target = targetObj.agent;
      const targetApp = findAgentApp(target, apps);
      const delegationEvent = buildDelegationEvent(
        event,
        accumulatedResults,
      );

      // ⚒️ 위임받은 에이전트 앱으로 PM 메시지에 작업 중 리액션
      if (currentPmTs) {
        await safeAddReaction(
          targetApp,
          event.channel,
          currentPmTs,
          'writing_hand',
        );
        console.log(
          `[reaction] ⚒️ ${target} → PM 메시지: ${currentPmTs}`,
        );
      }

      const tierLabel = targetObj.tier ? ` (tier=${targetObj.tier})` : '';
      console.log(
        `[hub] 위임: ${target}${tierLabel} (${agentExecutionCount + 1}/${MAX_DELEGATION_DEPTH})`,
      );

      const beforeSingle = snapshotChangedFiles();

      const delegationResult = await withAgentTimeout(
        handleMessage(
          target,
          delegationEvent,
          'delegation',
          targetApp,
          true,
          false,
          targetObj.tier ?? 'standard',
          targetObj.kanbanCardId ?? null,
        ),
        target,
        event.ts,
      );

      const afterSingle = snapshotChangedFiles();
      const singleChangedFiles = diffSnapshots(beforeSingle, afterSingle);

      // 에이전트가 create_kanban_card로 생성한 카드 → Done 이동
      if (delegationResult.kanbanCardId) {
        moveToDone(delegationResult.kanbanCardId).catch((err) =>
          console.warn('[kanban-sync] 위임 moveToDone 실패:', err),
        );
      }

      // ✅ 위임받은 에이전트 앱으로 완료 전환
      if (currentPmTs) {
        await safeSwapReaction(
          targetApp,
          event.channel,
          currentPmTs,
          'writing_hand',
          'white_check_mark',
        );
        console.log(
          `[reaction] ✅ ${target} 완료: ${currentPmTs}`,
        );
      }

      accumulatedResults.push({
        agent: target,
        text: delegationResult.text || '[응답 없음]',
        changedFiles: singleChangedFiles,
      });
      agentExecutionCount += 1;
      allExecutedAgents.add(target);
    } else {
      // 복수 위임: 병렬 실행
      const remaining =
        MAX_DELEGATION_DEPTH - agentExecutionCount;
      const batch = targets.slice(0, remaining);

      const batchApps = batch.map((t) =>
        findAgentApp(t.agent, apps),
      );

      // ⚒️ 각 에이전트 앱으로 PM 메시지에 작업 중 리액션
      if (currentPmTs) {
        await Promise.all(
          batchApps.map((batchApp, i) => {
            console.log(
              `[reaction] ⚒️ ${batch[i].agent} → PM 메시지: ${currentPmTs}`,
            );
            return safeAddReaction(
              batchApp,
              event.channel,
              currentPmTs!,
              'writing_hand',
            );
          }),
        );
      }

      console.log(
        `[hub] 병렬 위임: [${batch.map((t) => t.agent).join(', ')}] (${agentExecutionCount + batch.length}/${MAX_DELEGATION_DEPTH})`,
      );

      const beforeBatch = snapshotChangedFiles();

      const parallelResults = await Promise.allSettled(
        batch.map((targetObj, i) => {
          const delegationEvent =
            buildDelegationEvent(
              event,
              accumulatedResults,
            );
          return handleMessage(
            targetObj.agent,
            delegationEvent,
            'delegation',
            batchApps[i],
            true,
            false,
            targetObj.tier ?? 'standard',
            targetObj.kanbanCardId ?? null,
          );
        }),
      );

      const afterBatch = snapshotChangedFiles();
      const batchChangedFiles = diffSnapshots(beforeBatch, afterBatch);

      for (let i = 0; i < batch.length; i++) {
        const r = parallelResults[i];
        accumulatedResults.push({
          agent: batch[i].agent,
          text:
            r.status === 'fulfilled'
              ? r.value.text
              : `[실패: ${(r as PromiseRejectedResult).reason}]`,
          changedFiles: batchChangedFiles,
        });

        // 에이전트가 create_kanban_card로 생성한 카드 → Done 이동
        if (r.status === 'fulfilled' && r.value.kanbanCardId) {
          moveToDone(r.value.kanbanCardId).catch((err) =>
            console.warn('[kanban-sync] 병렬 위임 moveToDone 실패:', err),
          );
        }

        // ✅ 각 에이전트 앱으로 완료 전환
        if (currentPmTs) {
          await safeSwapReaction(
            batchApps[i],
            event.channel,
            currentPmTs,
            'writing_hand',
            'white_check_mark',
          );
          console.log(
            `[reaction] ✅ ${batch[i].agent} 완료: ${currentPmTs}`,
          );
        }
      }
      agentExecutionCount += batch.length;
      // 순환 감지: 배치 실행된 에이전트 추가
      for (const t of batch) {
        allExecutedAgents.add(t.agent);
      }
    }

    // (b) depth 초과 시 종료
    if (agentExecutionCount >= MAX_DELEGATION_DEPTH) {
      console.log(
        `[hub] depth 한도 도달 (${agentExecutionCount}/${MAX_DELEGATION_DEPTH})`,
      );
      break;
    }

    // (c) PM에게 결과 전달 → 리뷰 (skipPosting=true: 중간 위임 메시지 Slack 노출 억제)
    const reviewEvent = buildPmReviewEvent(
      event,
      accumulatedResults,
      allExecutedAgents,
    );

    console.log('[hub] PM 리뷰 요청');

    const pmReview = await handleMessage(
      'pm',
      reviewEvent,
      'hub-review',
      pmApp,
      true,  // skipReaction
      true,  // skipPosting — 중간 허브 리뷰는 Slack에 노출 안 함
      'high',
    );

    // (d) PM 리뷰 응답에서 delegate 도구로 지정된 새 타겟
    targets = pmReview.delegationTargets.filter(
      (t) => t.agent !== 'pm' && isValidAgent(t.agent),
    );

    if (targets.length === 0) {
      // PM이 완료 판단 — "작업중" 메시지를 결과로 업데이트 (별도 postMessage 없음)
      // hub-review는 skipPosting=true이므로 statusMessageTs가 없음 → 원본 PM 상태 메시지(result.statusMessageTs)로 fallback
      if (pmReview.text) {
        try {
          const pmBlocks = buildMessageBlocks(pmReview.text);
          const finalStatusTs = pmReview.statusMessageTs ?? result.statusMessageTs;
          if (finalStatusTs) {
            // "작업중" 메시지를 PM 최종 답변으로 업데이트
            await updateStatusMessage(
              pmApp,
              event.channel,
              finalStatusTs,
              'completed',
              'Marge',
              {
                resultText: pmReview.text,
                resultBlocks: pmBlocks
                  ? (pmBlocks as unknown as Array<Record<string, unknown>>)
                  : undefined,
              },
            );
            lastPmReview = { text: pmReview.text, postedTs: finalStatusTs };
            console.log('[hub] PM 최종 답변을 "작업중" 메시지 업데이트로 반영');
          } else {
            // fallback: statusMessageTs 없으면 기존 방식으로 새 메시지 포스팅
            const postResult = await pmApp.client.chat.postMessage({
              channel: event.channel,
              text: pmReview.text,
              thread_ts: event.thread_ts ?? event.ts,
              ...(pmBlocks ? { blocks: pmBlocks } : {}),
            });
            lastPmReview = { text: pmReview.text, postedTs: postResult.ts as string | undefined };
            console.log('[hub] PM 최종 요약 포스팅 완료 (fallback)');
          }
        } catch (err) {
          console.error('[hub] PM 최종 요약 반영 실패:', err);
        }
      }
      console.log('[hub] PM이 완료 판단 — Hub 루프 종료');

      // ─── Cross-Verification 자동 실행 (변경 파일 내용 코드 주입) ──
      // 동일 에이전트가 복수 라운드에 실행된 경우 마지막 결과만 검증 (중복 실행 방지)
      const lastResultPerAgent = new Map<string, { agent: string; text: string; changedFiles: string[] }>();
      for (const agentResult of accumulatedResults) {
        lastResultPerAgent.set(agentResult.agent, agentResult);
      }
      const hubVerifyAgents = [...lastResultPerAgent.values()].filter((r) => shouldVerify(r.agent) && r.changedFiles.length > 0);
      let hubAllPassed = hubVerifyAgents.length > 0;
      for (const agentResult of hubVerifyAgents) {
        console.log(
          `[cross-verify] ${agentResult.agent} 자동 검증 시작 (변경 파일: ${agentResult.changedFiles.length}개)`,
        );
        try {
          const verifyResults = await runCrossVerification(
            agentResult.agent,
            agentResult.text,
            agentResult.changedFiles,
            event,
            pmApp,
          );
          const hasFail = verifyResults.some(
            (r) => r.result === 'FAIL',
          );
          if (hasFail) {
            hubAllPassed = false;
            console.warn(
              `[cross-verify] ${agentResult.agent}: FAIL 감지 — Ralph Loop 시작`,
            );
            const failedVerifier = verifyResults.find((r) => r.result === 'FAIL');
            const agentApp = findAgentApp(agentResult.agent, apps);
            try {
              const loopResult = await runRalphLoop(
                agentResult.agent,
                event.text,
                failedVerifier?.details ?? 'Cross-verify FAIL',
                event,
                agentApp,
                pmApp,
              );
              console.log(
                `[qa-loop] Ralph Loop 완료: ${agentResult.agent} → ${loopResult.finalResult} (${loopResult.iterations}회)`,
              );
            } catch (loopErr) {
              console.error(
                `[qa-loop] Ralph Loop 실패: ${agentResult.agent}`,
                loopErr,
              );
            }
          }
        } catch (err) {
          console.error(
            `[cross-verify] ${agentResult.agent} 검증 실패:`,
            err,
          );
        }
      }
      // QA 자동 트리거: 모든 에이전트 검증 완료 후 1회만 실행 (중복 방지)
      if (hubAllPassed) {
        const specPath = extractSpecPath(event.text);
        if (specPath) {
          console.log(`[qa-loop] cross-verify 전체 PASS + specPath 감지 → QA 자동 실행: ${specPath}`);
          try {
            const qaApp = findAgentApp('qa', apps);
            await runDirectQA(specPath, event, qaApp);
          } catch (qaErr) {
            console.error('[qa-loop] QA 자동 실행 실패:', qaErr);
          }
        }
      }

      // PM이 targets.length === 0으로 완료를 선언했으므로 recommend_next_phase 재요청 불필요
    } else {
      // 계속 위임 — PM 재위임 알림 메시지 게시 후 currentPmTs 갱신
      // QA 등 다음 에이전트가 이 메시지에 ✍️ 리액션을 달도록 함
      const targetNames = targets.map((t) => t.agent).join(', ');
      try {
        const announcementResult = await pmApp.client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.thread_ts ?? event.ts,
          text: `🔄 [${targetNames}] 재작업 요청`,
        });
        if (announcementResult.ts) {
          currentPmTs = announcementResult.ts as string;
          console.log(`[hub] PM 재위임 알림 게시 → currentPmTs 갱신: ${currentPmTs}`);
        }
      } catch (err) {
        console.warn('[hub] PM 재위임 알림 게시 실패 (무시):', err);
      }
      console.log(
        `[hub] PM 추가 위임: [${targetNames}]`,
      );
    }
  }

  // depth 한도 도달 시 PM 최종 요약 (루프 내 hub-review가 실행되지 않은 경우만)
  // lastPmReview가 없는 경우 = 루프가 depth break로 종료되어 PM 최종 리뷰 없음
  if (
    agentExecutionCount >= MAX_DELEGATION_DEPTH &&
    accumulatedResults.length > 0 &&
    !lastPmReview
  ) {
    const finalReviewEvent = buildPmReviewEvent(
      event,
      accumulatedResults,
      allExecutedAgents,
    );
    console.log(
      '[hub] PM 최종 요약 요청 (depth 한도 도달)',
    );
    await handleMessage(
      'pm',
      finalReviewEvent,
      'hub-review',
      pmApp,
      true,
      false,
      'high',
    );
  }

  // ✅ 사용자 원본 메시지 완료 리액션 전환
  await safeSwapReaction(app, event.channel, event.ts, 'writing_hand', 'white_check_mark');
  console.log(`[reaction] ✅ 허브 루프 완료 → 사용자 메시지: ${event.ts}`);
  // Hub 완료
  console.log('[hub] Hub 완료 — 모든 에이전트 리액션 처리됨');
};

/**
 * 병렬 에이전트 실행 — 각 에이전트가 스레드 reply로 응답
 * @param agentNames - 에이전트 이름 목록
 * @param event - Slack 이벤트
 * @param method - 라우팅 방식
 * @param apps - 전체 Slack App 목록
 */
/** 병렬 동시성 제한 — MCP 서버 과다 spawn 방지 (에이전트당 3개 MCP) */
const MAX_PARALLEL_AGENTS = 5;

const executeParallel = async (
  agentNames: string[],
  event: SlackEvent,
  method: string,
  apps: App[],
): Promise<void> => {
  // 병렬 실행 시 각 에이전트에게 스코프 제한을 알리기 위해 method에 표식 추가
  const parallelMethod = agentNames.length > 1 ? `${method}:parallel` : method;
  console.log(
    `[exec] 병렬 실행: [${agentNames.join(', ')}] (동시성 제한: ${MAX_PARALLEL_AGENTS})`,
  );

  // 동시성 제한: MAX_PARALLEL_AGENTS씩 배치 처리
  const allResults: Array<{
    name: string;
    result: PromiseSettledResult<{
      text: string;
      postedTs?: string;
    }>;
  }> = [];

  for (
    let i = 0;
    i < agentNames.length;
    i += MAX_PARALLEL_AGENTS
  ) {
    const batch = agentNames.slice(
      i,
      i + MAX_PARALLEL_AGENTS,
    );
    console.log(
      `[exec] 배치 ${Math.floor(i / MAX_PARALLEL_AGENTS) + 1}: [${batch.join(', ')}]`,
    );

    const batchResults = await Promise.allSettled(
      batch.map((name) => {
        const app = findAgentApp(name, apps);
        return withAgentTimeout(
          handleMessage(name, event, parallelMethod, app),
          name,
          event.ts,
        );
      }),
    );

    for (let j = 0; j < batch.length; j++) {
      allResults.push({
        name: batch[j],
        result: batchResults[j],
      });

      // 병렬 실행 완료 시 칸반 카드 → Done 이동
      const r = batchResults[j];
      if (r.status === 'fulfilled' && r.value.kanbanCardId) {
        moveToDone(r.value.kanbanCardId).catch((err) =>
          console.warn('[kanban-sync] 병렬 실행 moveToDone 실패:', err),
        );
      }
    }
  }

  const failed = allResults.filter(
    (r) => r.result.status === 'rejected',
  );

  // 실패한 에이전트 1회 재시도 (타임아웃은 재시도해도 같은 결과이므로 제외)
  const retryable = failed.filter((f) => {
    const reason = (f.result as PromiseRejectedResult).reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    return !msg.includes('[timeout]');
  });
  const timedOut = failed.filter((f) => !retryable.includes(f));

  if (timedOut.length > 0) {
    console.warn(
      `[exec] 타임아웃 에이전트 (재시도 제외): [${timedOut.map((f) => f.name).join(', ')}]`,
    );
  }

  if (retryable.length > 0) {
    const failedNames = retryable
      .map((f) => f.name)
      .join(', ');
    console.warn(
      `[exec] 병렬 실행 실패: [${failedNames}] — 1회 재시도`,
    );

    const retryResults = await Promise.allSettled(
      retryable.map((f) => {
        const app = findAgentApp(f.name, apps);
        // 재시도 시 리액션 관리 건너뛰기 (이미 첫 시도에서 처리됨)
        return withAgentTimeout(
          handleMessage(f.name, event, parallelMethod, app, true),
          f.name,
          event.ts,
        );
      }),
    );

    const stillFailed: string[] = [
      ...timedOut.map((f) => f.name), // 타임아웃은 재시도 없이 실패 확정
    ];
    for (let j = 0; j < retryable.length; j++) {
      if (retryResults[j].status === 'rejected') {
        stillFailed.push(retryable[j].name);
        console.error(
          `[exec]   ${retryable[j].name} 재시도 실패:`,
          (retryResults[j] as PromiseRejectedResult).reason,
        );
      } else {
        console.log(
          `[exec]   ${retryable[j].name} 재시도 성공`,
        );
      }
    }

    if (stillFailed.length > 0) {
      try {
        const threadTs = event.thread_ts ?? event.ts;
        await apps[0].client.chat.postMessage({
          channel: event.channel,
          thread_ts: threadTs,
          text: `⚠️ [${stillFailed.join(', ')}] 에이전트가 응답하지 못했습니다. (${agentNames.length - stillFailed.length}/${agentNames.length} 성공)`,
        });
      } catch {
        // 알림 실패는 무시
      }
    }

    console.log(
      `[exec] 병렬 실행 완료: ${agentNames.length - stillFailed.length}/${agentNames.length} 성공 (재시도 ${retryable.length - (stillFailed.length - timedOut.length)}건 복구, 타임아웃 ${timedOut.length}건)`,
    );
  } else if (timedOut.length > 0) {
    // 재시도 대상은 없지만 타임아웃 에이전트가 있는 경우
    try {
      const threadTs = event.thread_ts ?? event.ts;
      await apps[0].client.chat.postMessage({
        channel: event.channel,
        thread_ts: threadTs,
        text: `⚠️ [${timedOut.map((f) => f.name).join(', ')}] 에이전트가 시간 초과되었습니다. (${agentNames.length - timedOut.length}/${agentNames.length} 성공)`,
      });
    } catch {
      // 알림 실패 무시
    }
    console.log(
      `[exec] 병렬 실행 완료: ${agentNames.length - timedOut.length}/${agentNames.length} 성공 (타임아웃 ${timedOut.length}건)`,
    );
  } else {
    console.log(
      `[exec] 병렬 실행 완료: ${allResults.length}/${agentNames.length} 성공`,
    );
  }
};

// ─── 디바운스 플러시 ─────────────────────────────────────

/**
 * 디바운스 버퍼를 플러시하여 누적된 메시지를 하나로 묶어 처리
 * @param key - 디바운스 키
 * @param apps - Slack App 인스턴스 목록
 */

// ── 메시지 처리 동시성 제한 (P1-3) ──────────────────
// MAX_CONCURRENT_HANDLERS: config.ts에서 import
let activeHandlerCount = 0;
const handlerQueue: Array<() => void> = [];

const acquireHandlerSlot = (): Promise<void> => {
  if (activeHandlerCount < MAX_CONCURRENT_HANDLERS) {
    activeHandlerCount++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    handlerQueue.push(() => {
      activeHandlerCount++;
      resolve();
    });
  });
};

const releaseHandlerSlot = (): void => {
  activeHandlerCount--;
  const next = handlerQueue.shift();
  if (next) {
    next();
  }
};

const flushDebounceBuffer = async (
  key: string,
  apps: App[],
): Promise<void> => {
  const entry = debounceBuffer.get(key);
  if (!entry) {
    return;
  }
  debounceBuffer.delete(key);

  const { messages, channel, channelName, threadTs } =
    entry;

  // 디바운스된 새 메시지 텍스트 합치기
  const newMessagesText = messages
    .map((m) => `<@${m.user}>: ${m.text}`)
    .join('\n');
  // 라우팅용 텍스트: sender prefix 제외 (parseMentions 오인식 + 패턴 매칭 방해 방지)
  const rawTextsForRouting = messages
    .map((m) => m.text)
    .join('\n');
  const lastMessage = messages[messages.length - 1];
  const firstMessage = messages[0];

  // 이전 대화 히스토리 가져오기 (스레드 또는 채널)
  let conversationHistory = '';
  let historyMessages: Array<Record<string, unknown>> = [];
  try {

    if (threadTs) {
      // 스레드: conversations.replies
      const replies =
        await apps[0].client.conversations.replies({
          channel,
          ts: threadTs,
          limit: 30,
        });
      historyMessages = (
        (replies.messages ?? []) as Array<
          Record<string, unknown>
        >
      ).filter(
        (m) =>
          !messages.some(
            (dm) => dm.ts === (m.ts as string),
          ),
      );
    } else {
      // 채널: conversations.history
      const history =
        await apps[0].client.conversations.history({
          channel,
          limit: 15,
        });
      historyMessages = (
        (history.messages ?? []) as Array<
          Record<string, unknown>
        >
      )
        .filter(
          (m) =>
            !messages.some(
              (dm) => dm.ts === (m.ts as string),
            ),
        )
        .reverse(); // 시간순 정렬 (API는 최신순)
    }

    if (historyMessages.length > 0) {
      conversationHistory = historyMessages
        .map((m) => {
          const sender = resolveSenderName(
            m.user as string | undefined,
            m.bot_id as string | undefined,
          );
          return `${sender}: ${(m.text as string) ?? ''}`;
        })
        .join('\n');
    }
    console.log(
      `[debounce] ${threadTs ? '스레드' : '채널'} 히스토리: ${historyMessages.length}개 메시지 로드`,
    );
  } catch (err) {
    console.error(
      '[debounce] 히스토리 로드 실패:',
      err,
    );
  }

  // 스레드 참여 에이전트 추출 (히스토리에서 봇 메시지 기준)
  const threadParticipantAgents = new Set<string>();
  if (threadTs) {
    for (const m of historyMessages) {
      const userId = m.user as string | undefined;
      if (userId) {
        const agentName = botUserIdToAgentName.get(userId);
        if (agentName) {
          threadParticipantAgents.add(agentName);
        }
      }
    }
    if (threadParticipantAgents.size > 0) {
      console.log(
        `[thread] 참여 에이전트: [${Array.from(threadParticipantAgents).join(', ')}]`,
      );
    }
  }

  // 스레드 언급 에이전트 추출 (메시지 텍스트의 <@USER_ID> 기준)
  // 브로드캐스트 억제 시 "참여자" 대신 "명시적으로 언급된" 에이전트로 제한
  const threadMentionedAgents = new Set<string>();
  if (threadTs) {
    const mentionPattern = /<@([A-Z0-9]+)>/g;
    for (const m of historyMessages) {
      const text = (m.text as string) ?? '';
      let match: RegExpExecArray | null;
      mentionPattern.lastIndex = 0;
      while ((match = mentionPattern.exec(text)) !== null) {
        const userId = match[1];
        const agentName = botUserIdToAgentName.get(userId);
        if (agentName) {
          threadMentionedAgents.add(agentName);
        }
      }
    }
    if (threadMentionedAgents.size > 0) {
      console.log(
        `[thread] 언급 에이전트: [${Array.from(threadMentionedAgents).join(', ')}]`,
      );
    }
  }

  // LLM 컨텍스트 압축 (Phase 2): 임계값 초과 시 Haiku로 압축
  if (
    conversationHistory &&
    CONTEXT_COMPRESSION_ENABLED &&
    conversationHistory.length > CONTEXT_COMPRESSION_THRESHOLD_CHARS
  ) {
    console.log(
      `[compress] 히스토리 ${conversationHistory.length}자 > 임계값 ${CONTEXT_COMPRESSION_THRESHOLD_CHARS}자, 압축 시작`,
    );
    conversationHistory = await compressConversationHistory(conversationHistory);
  }

  // 스레드 주제 프리프로세싱 (스레드 + 히스토리 있을 때만)
  let threadTopic = '';
  if (threadTs && conversationHistory) {
    threadTopic =
      await summarizeThreadTopic(conversationHistory);
  }

  // 최종 텍스트: 히스토리 + 새 메시지
  const combinedText = conversationHistory
    ? `[이전 대화]\n${conversationHistory}\n\n[새 메시지]\n${newMessagesText}`
    : newMessagesText;

  console.log(
    `[debounce] 플러시: ${messages.length}개 메시지 → "${newMessagesText.slice(0, 50)}..."`,
  );

  const slackEvent: SlackEvent = {
    type: 'message',
    channel,
    channel_name: channelName,
    user: firstMessage.user,
    text: combinedText,
    ts: lastMessage.ts,
    thread_ts: threadTs,
    mentions: [],
    threadTopic,
    raw: entry.raw,
    batchTs:
      messages.length > 1
        ? messages.map((m) => m.ts)
        : undefined,
  };

  // 디바운스 병합 시 앞 메시지들에 리다이렉트 안내
  // 마지막 메시지 스레드에서 응답이 이루어지므로, 앞 메시지들은 무응답으로 보임
  if (messages.length > 1 && !threadTs) {
    const linkTs = lastMessage.ts.replace('.', '');
    const threadLink = `https://slack.com/archives/${channel}/p${linkTs}`;
    const redirectText = `:arrow_right: 이 메시지는 <${threadLink}|여기>에서 함께 처리 중입니다.`;
    for (const m of messages.slice(0, -1)) {
      apps[0].client.chat
        .postMessage({
          channel,
          thread_ts: m.ts,
          text: redirectText,
        })
        .catch((err: unknown) => {
          console.error(
            '[debounce] 리다이렉트 메시지 전송 실패:',
            err,
          );
        });
    }
  }

  // end-to-end 타이밍 시작
  const e2eStart = Date.now();

  // ─── Auto-Proceed 텍스트 승인/거부 체크 ──────────────────
  // pending approval이 있는 채널에서 승인/거부 텍스트가 오면 처리 후 라우팅 건너뜀
  const APPROVAL_TEXT_PATTERN =
    /^[\s]*(ㅇㅇ|ok|진행|ㄱ|고|approve|승인|넵|네)[\s!.]*$/i;
  const REJECTION_TEXT_PATTERN =
    /^[\s]*(거부|reject|취소|ㄴㄴ|노|no|반려|deny)[\s!.]*$/i;
  if (hasPendingApproval(slackEvent.channel)) {
    // 보안: SID_USER_ID만 텍스트로 승인/거부 가능
    const authorizedUserId = process.env.SID_USER_ID ?? 'U0AJ3T423RU';
    if (slackEvent.user !== authorizedUserId) {
      console.log(
        `[auto-proceed] 텍스트 승인/거부 무시: 권한 없는 사용자 ${slackEvent.user} (승인 권한: ${authorizedUserId})`,
      );
    } else if (APPROVAL_TEXT_PATTERN.test(newMessagesText)) {
      const count = await manuallyApprove(
        slackEvent.channel,
        apps[0],
      );
      if (count > 0) {
        console.log(
          `[auto-proceed] 텍스트 승인: "${newMessagesText.trim()}" → ${count}개 승인`,
        );
        return;
      }
    } else if (REJECTION_TEXT_PATTERN.test(newMessagesText)) {
      const count = await manuallyReject(
        slackEvent.channel,
        apps[0],
      );
      if (count > 0) {
        console.log(
          `[auto-proceed] 텍스트 거부: "${newMessagesText.trim()}" → ${count}개 거부`,
        );
        return;
      }
    }
  }

  // 라우팅 (raw 텍스트 기준 — sender prefix가 멘션/패턴 매칭을 오염하지 않도록)
  // 스레드 컨텍스트: 언급된 에이전트 우선, 없으면 참여 에이전트로 폴백
  const threadFilterAgents =
    threadMentionedAgents.size > 0
      ? threadMentionedAgents
      : threadParticipantAgents;
  let routing = await routeMessage(
    rawTextsForRouting,
    threadTs
      ? Array.from(threadFilterAgents)
      : undefined,
  );

  // 스레드 브로드캐스트 방지: mention 이 아닌 경우 언급된 에이전트로만 제한
  // (언급 없으면 참여자 기준 폴백)
  if (
    threadTs &&
    threadFilterAgents.size > 0 &&
    routing.method !== 'mention'
  ) {
    const filteredAgents = routing.agents.filter((a) =>
      threadFilterAgents.has(a.name),
    );
    if (filteredAgents.length > 0) {
      const filterLabel =
        threadMentionedAgents.size > 0 ? '언급' : '참여';
      console.log(
        `[route] 스레드 필터(${filterLabel}): [${routing.agents.map((a) => a.name).join(', ')}] → [${filteredAgents.map((a) => a.name).join(', ')}]`,
      );
      routing = {
        ...routing,
        agents: filteredAgents,
        execution: filteredAgents.length > 1 ? 'parallel' : 'single',
      };
    }
  }

  slackEvent.mentions =
    routing.method === 'mention'
      ? routing.agents.map((a) => a.name)
      : [];

  const agentNames = routing.agents
    .map((a) => a.name)
    .join(', ');
  console.log(
    `[route] "${combinedText.slice(0, 50)}..." → [${agentNames}] (${routing.execution}, ${routing.method})`,
  );
  emitMessageRouted(
    channel,
    slackEvent.ts,
    routing.agents.map((a) => a.name),
    routing.method,
  );

  // 👀 제거 (그룹 내 이전 메시지들 — 마지막 제외)
  // 🧠는 마지막 메시지에 남겨두고 hub에서 ⚒️ 전환 후 ✅로 마무리
  for (const m of messages.slice(0, -1)) {
    try {
      await apps[0].client.reactions.remove({
        channel,
        timestamp: m.ts,
        name: 'eyes',
      });
    } catch {
      // 리액션 제거 실패 무시
    }
  }

  // 모델 선택 감지 — 실행 전 사용자가 모델 변경 의도를 표현한 경우 처리
  // 1) 모델이 메시지에 명시된 경우 → 직접 사용 (Block Kit UI 생략)
  // 2) 모델이 명시되지 않은 경우(e.g. "모델 바꿔줘") → Block Kit UI 표시
  let selectedModelTier: ModelTier = 'standard';
  if (
    routing.execution === 'single' &&
    !routing.isQACommand &&
    detectModelSelectRequest(rawTextsForRouting)
  ) {
    const threadTs = slackEvent.thread_ts ?? slackEvent.ts;
    const explicitTier = extractModelTierFromText(rawTextsForRouting);
    if (explicitTier !== null) {
      // 모델이 명시됨 → 바로 적용
      selectedModelTier = explicitTier;
      const tierLabel =
        explicitTier === 'high' ? 'Opus' : explicitTier === 'fast' ? 'Haiku' : 'Sonnet';
      console.log(`[model-select] 명시된 모델 자동 적용: ${tierLabel} (tier=${explicitTier})`);
    } else {
      // 모델 미명시 → Block Kit UI 표시
      console.log(
        `[model-select] 모델 미명시 — Block Kit 전송: channel=${channel} thread=${threadTs}`,
      );
      const chosen = await postModelSelectMessage(
        apps[0],
        channel,
        threadTs,
      );
      if (chosen === null) {
        console.log(`[model-select] 취소 또는 타임아웃 — 기본 Sonnet 사용`);
      } else {
        selectedModelTier = chosen;
        const tierLabel =
          chosen === 'high' ? 'Opus' : chosen === 'fast' ? 'Haiku' : 'Sonnet';
        console.log(`[model-select] ${tierLabel} 선택됨`);
      }
    }
  }

  // 실행
  const executeTask = async () => {
    // 🧠 라우팅 완료 → 실행 시작 시 항상 제거 (non-PM/위임없음/병렬 등 모든 경로 커버)
    try { await apps[0].client.reactions.remove({ channel: slackEvent.channel, timestamp: slackEvent.ts, name: 'brain' }); } catch { /* 없으면 무시 */ }
    // QA 명령어 — specPath 없으면 사용법 안내
    if (routing.isQACommand && !routing.specPath) {
      await apps[0].client.chat.postMessage({
        channel: slackEvent.channel,
        thread_ts: slackEvent.thread_ts ?? slackEvent.ts,
        text: [
          '❌ *스펙 경로가 필요합니다*',
          '',
          '사용법: `QA 실행 docs/specs/{스펙파일}.md`',
          '예시: `QA 실행 docs/specs/2026-03-31_kanban-ux-improvement.md`',
        ].join('\n'),
      });
      console.log('[qa-loop] QA 명령어 — specPath 누락, 사용법 안내 전송');
      return;
    }

    // QA 직접 실행 명령어 분기 — 재작업 루프 없이 Chalmers QA 1회 직접 호출
    if (routing.isQACommand && routing.specPath) {
      const qaApp = findAgentApp('qa', apps);
      console.log(
        `[qa-loop] QA 직접 실행 명령어 감지: specPath=${routing.specPath}`,
      );
      const qaResult = await runDirectQA(
        routing.specPath,
        slackEvent,
        qaApp,
      );
      console.log(
        `[qa-loop] runDirectQA 완료: specPath=${routing.specPath} result=${qaResult.result}`,
      );
      return;
    }

    switch (routing.execution) {
      case 'parallel': {
        await executeParallel(
          routing.agents.map((a) => a.name),
          slackEvent,
          routing.method,
          apps,
        );
        break;
      }
      case 'single':
      default: {
        const primaryAgent = routing.agents[0];
        const agentApp = findAgentApp(
          primaryAgent.name,
          apps,
        );
        await executeSingle(
          primaryAgent.name,
          slackEvent,
          routing.method,
          agentApp,
          apps,
          selectedModelTier,
        );
        break;
      }
    }
  };

  acquireHandlerSlot().then(() => {
    executeTask()
      .then(() => {
        const e2eElapsed = (
          (Date.now() - e2eStart) /
          1000
        ).toFixed(1);
        console.log(
          `[perf] e2e complete: [${agentNames}] ${e2eElapsed}s (${routing.method})`,
        );
        for (const m of messages) {
          updateClaim(m.ts, 'completed');
        }
      })
      .catch((err) => {
        const e2eElapsed = (
          (Date.now() - e2eStart) /
          1000
        ).toFixed(1);
        console.error(
          `[perf] e2e failed: [${agentNames}] ${e2eElapsed}s`,
        );
        for (const m of messages) {
          updateClaim(m.ts, 'failed');
        }
        console.error(
          `[error] ${agentNames} 실행 실패:`,
          err,
        );
      })
      .finally(() => releaseHandlerSlot());
  });
};

// ─── 메인 ────────────────────────────────────────────────

const main = async () => {
  // 페르소나 파일 존재 검증
  validatePersonaFiles();

  // 주의: 환경변수 검증은 애플리케이션 시작 시 validateEnvVars()에서 수행됨

  // 6개 Bolt App 인스턴스 생성
  const apps: App[] = [];

  for (const agent of AGENTS) {
    const app = new App({
      token: agent.botToken,
      appToken: agent.appToken,
      socketMode: true,
    });

    // Bot User ID 조회 및 라우터에 등록
    try {
      const authResult = await app.client.auth.test();
      agent.botUserId = authResult.user_id as string;
      const botId = authResult.bot_id as string;
      registerBotUser(agent.botUserId, agent.name);
      registerAgentBotUserId(agent.name, agent.botUserId);
      ownBotIds.add(botId);
      botIdToApp.set(botId, app);
      const displayName =
        AGENT_DISPLAY_NAMES[agent.name] ?? agent.name;
      botUserIdToName.set(agent.botUserId, displayName);
      botIdToName.set(botId, displayName);
      botUserIdToAgentName.set(agent.botUserId, agent.name);
      console.log(
        `[init] ${agent.name}: botUserId=${agent.botUserId}, botId=${botId}`,
      );
    } catch (err) {
      console.error(
        `[error] ${agent.name} auth.test 실패:`,
        err,
      );
      process.exit(1);
    }

    // ─── Block Kit 권한 요청 버튼 핸들러 (모든 앱에 등록) ────────────
    // Slack은 메시지를 보낸 앱에만 interaction payload를 전달하므로,
    // 모든 에이전트 앱에서 버튼 클릭을 수신할 수 있어야 함
    app.action(
      'permission_approve',
      async ({ ack, body, action }) => {
        try {
          await ack();
          const clickerId = (body as { user?: { id?: string } }).user?.id ?? '';
          const authorizedUserId = process.env.SID_USER_ID ?? 'U0AJ3T423RU';
          if (clickerId !== authorizedUserId) {
            console.warn(`[permission] 미인가 사용자 승인 시도: ${clickerId}`);
            return;
          }
          const permissionId = (action as { value?: string }).value ?? '';
          const resolved = resolvePermissionRequest(permissionId, true);
          if (resolved) {
            const b = body as {
              message?: { ts?: string };
              channel?: { id?: string };
              container?: { message_ts?: string; channel_id?: string };
            };
            const channel = b.channel?.id ?? b.container?.channel_id ?? '';
            const ts = b.message?.ts ?? b.container?.message_ts ?? '';
            if (channel && ts) {
              await app.client.chat.update({
                channel,
                ts,
                text: '✅ 승인됨',
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: '✅ *승인됨* — 에이전트가 작업을 계속 진행합니다.',
                    },
                  },
                ],
              });
            }
          }
        } catch (err) {
          console.error('[permission] permission_approve 핸들러 오류:', err);
        }
      },
    );

    app.action(
      'permission_deny',
      async ({ ack, body, action }) => {
        try {
          await ack();
          const clickerId = (body as { user?: { id?: string } }).user?.id ?? '';
          const authorizedUserId = process.env.SID_USER_ID ?? 'U0AJ3T423RU';
          if (clickerId !== authorizedUserId) {
            console.warn(`[permission] 미인가 사용자 거부 시도: ${clickerId}`);
            return;
          }
          const permissionId = (action as { value?: string }).value ?? '';
          const resolved = resolvePermissionRequest(permissionId, false);
          if (resolved) {
            const b = body as {
              message?: { ts?: string };
              channel?: { id?: string };
              container?: { message_ts?: string; channel_id?: string };
            };
            const channel = b.channel?.id ?? b.container?.channel_id ?? '';
            const ts = b.message?.ts ?? b.container?.message_ts ?? '';
            if (channel && ts) {
              await app.client.chat.update({
                channel,
                ts,
                text: '❌ 거부됨',
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: '❌ *거부됨* — 에이전트가 작업을 중단합니다.',
                    },
                  },
                ],
              });
            }
          }
        } catch (err) {
          console.error('[permission] permission_deny 핸들러 오류:', err);
        }
      },
    );

    // ─── 모델 선택 버튼 핸들러 ─────────────────────────────────
    const MODEL_SELECT_ACTIONS: Array<{
      actionId: string;
      tier: ModelTier | null;
      label: string;
    }> = [
      { actionId: 'model_select_opus', tier: 'high', label: '🧠 Opus' },
      { actionId: 'model_select_sonnet', tier: 'standard', label: '⚡ Sonnet' },
      { actionId: 'model_select_haiku', tier: 'fast', label: '🚀 Haiku' },
      { actionId: 'model_select_cancel', tier: null, label: '취소' },
    ];

    for (const { actionId, tier, label } of MODEL_SELECT_ACTIONS) {
      app.action(
        actionId,
        async ({ ack, body, action }) => {
          try {
            await ack();

            // value = `${channel}:${threadTs}`
            const key = (action as { value?: string }).value ?? '';
            const b = body as {
              channel?: { id?: string };
              message?: { ts?: string };
              container?: {
                message_ts?: string;
                channel_id?: string;
              };
            };
            const msgChannel =
              b.channel?.id ?? b.container?.channel_id ?? '';
            const messageTs =
              b.message?.ts ?? b.container?.message_ts ?? '';

            const resolved = resolveModelSelect(key, tier);
            if (!resolved) {
              console.warn(
                `[model-select] 대기 중인 요청 없음: ${key}`,
              );
            }

            // 버튼 메시지를 선택 결과로 업데이트
            if (msgChannel && messageTs) {
              const resultText =
                tier === null
                  ? '✖ 취소됨 — 기본 Sonnet으로 실행합니다.'
                  : `✅ *${label}* 모델이 선택되었습니다.`;
              app.client.chat
                .update({
                  channel: msgChannel,
                  ts: messageTs,
                  text: resultText,
                  blocks: [
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: resultText,
                      },
                    },
                  ],
                })
                .catch((err: unknown) => {
                  console.error(
                    `[model-select] 메시지 업데이트 실패:`,
                    err,
                  );
                });
            }
          } catch (err) {
            console.error(
              `[model-select] ${actionId} 핸들러 오류:`,
              err,
            );
          }
        },
      );
    }

    // ─── Lisa 리서치 모드 선택 버튼 핸들러 ────────────────────
    for (const mode of ['academic', 'practical'] as const) {
      app.action(
        `research_mode_${mode}`,
        async ({ ack, body, action }) => {
          try {
            await ack();

            // 버튼 value에서 threadTs 직접 추출 (가장 신뢰도 높음)
            const threadTs =
              (action as { value?: string }).value ?? '';
            const b = body as {
              channel?: { id?: string };
              message?: { ts?: string };
              container?: {
                message_ts?: string;
                channel_id?: string;
              };
            };
            const channel =
              b.channel?.id ?? b.container?.channel_id ?? '';
            const messageTs =
              b.message?.ts ?? b.container?.message_ts ?? '';
            const label =
              mode === 'academic'
                ? '📄 (A) 리서치 보고서'
                : '📋 (B) 실행 플레이북';

            console.log(
              `[research-mode] 버튼 클릭: ${mode}, threadTs=${threadTs}`,
            );

            // resolve 실행 — messageTs/channel 포함하여 agent-runtime이 인플레이스 업데이트
            const resolved = resolveResearchMode(
              threadTs,
              mode,
              messageTs,
              channel,
            );
            if (!resolved) {
              console.warn(
                `[research-mode] 대기 중인 요청 없음: ${threadTs}`,
              );
            }
            // 버튼 메시지 업데이트는 agent-runtime의 updateToRunningMessage가 담당
            // (별도 chat.update 불필요 — 단일 메시지에서 작업 중 → 완료까지 처리)
          } catch (err) {
            console.error(
              `[research-mode] ${mode} 핸들러 오류:`,
              err,
            );
          }
        },
      );
    }

    // ─── Lisa 리서치 취소 버튼 핸들러 ────────────────────────────
    app.action(
      'research_mode_cancel',
      async ({ ack, body, action }) => {
        try {
          await ack();
          const threadTs = (action as { value?: string }).value ?? '';
          const b = body as {
            channel?: { id?: string };
            message?: { ts?: string };
            container?: { message_ts?: string; channel_id?: string };
          };
          const channel = b.channel?.id ?? b.container?.channel_id ?? '';
          const messageTs = b.message?.ts ?? b.container?.message_ts ?? '';

          await rateLimited(() =>
            app.client.chat.update({
              channel,
              ts: messageTs,
              text: '리서치가 취소되었습니다.',
              blocks: [
                {
                  type: 'section',
                  text: { type: 'mrkdwn', text: '리서치가 취소되었습니다.' },
                },
              ],
            }),
          );

          const resolved = cancelResearchMode(threadTs);
          if (!resolved) {
            console.warn(`[research-mode] 취소 대상 없음: ${threadTs}`);
          }
        } catch (err) {
          console.error('[research-mode] cancel 핸들러 오류:', err);
        }
      },
    );

    // ─── 에이전트 제어 버튼 핸들러 (취소/재실행) ────────────────
    app.action(
      'agent_cancel',
      async ({ ack, body, action }) => {
        try {
          await ack();
          const clickerId =
            (body as { user?: { id?: string } }).user?.id ?? '';
          const authorizedUserId =
            process.env.SID_USER_ID ?? 'U0AJ3T423RU';
          if (clickerId !== authorizedUserId) {
            console.warn(
              `[control] 미인가 사용자 취소 시도: ${clickerId}`,
            );
            return;
          }
          const controlId =
            (action as { value?: string }).value ?? '';
          const ctx = getRunContext(controlId);
          if (!ctx) {
            console.warn(
              `[control] 컨텍스트 없음 (만료/완료): ${controlId}`,
            );
            return;
          }
          // 에이전트 중단
          cancelAgent(ctx.eventTs);
          cancelQueueByThread(ctx.eventTs);
          // 상태 메시지 업데이트
          await updateStatusMessage(
            ctx.slackApp,
            ctx.channel,
            ctx.statusMessageTs,
            'cancelled',
            ctx.agentName,
          );
          deleteRunContext(controlId);
          console.log(
            `[control] 🛑 버튼 취소: ${ctx.agentName} (${ctx.eventTs})`,
          );
        } catch (err) {
          console.error('[control] agent_cancel 핸들러 오류:', err);
        }
      },
    );

    app.action(
      'agent_rerun',
      async ({ ack, body }) => {
        try {
          await ack();
          const clickerId =
            (body as { user?: { id?: string } }).user?.id ?? '';
          const authorizedUserId =
            process.env.SID_USER_ID ?? 'U0AJ3T423RU';
          if (clickerId !== authorizedUserId) {
            console.warn(
              `[control] 미인가 사용자 재실행 시도: ${clickerId}`,
            );
            return;
          }
          const action = (
            body as { actions?: Array<{ value?: string }> }
          ).actions?.[0];
          const controlId = action?.value ?? '';
          const ctx = getRunContext(controlId);
          if (!ctx) {
            console.warn(
              `[control] 컨텍스트 없음 (만료/완료): ${controlId}`,
            );
            return;
          }
          // Modal 열기
          const triggerId = (body as { trigger_id?: string })
            .trigger_id;
          if (!triggerId) {
            console.error('[control] trigger_id 없음');
            return;
          }
          await app.client.views.open({
            trigger_id: triggerId,
            view: buildRerunModal(
              controlId,
              ctx.agentName,
            ) as Parameters<
              typeof app.client.views.open
            >[0]['view'],
          });
        } catch (err) {
          console.error('[control] agent_rerun 핸들러 오류:', err);
        }
      },
    );

    app.action(
      'agent_cancel_all',
      async ({ ack, body, action }) => {
        try {
          await ack();
          const clickerId =
            (body as { user?: { id?: string } }).user?.id ?? '';
          const authorizedUserId =
            process.env.SID_USER_ID ?? 'U0AJ3T423RU';
          if (clickerId !== authorizedUserId) {
            console.warn(
              `[control] 미인가 사용자 전체 중단 시도: ${clickerId}`,
            );
            return;
          }
          const controlId =
            (action as { value?: string }).value ?? '';
          const ctx = getRunContext(controlId);
          if (!ctx) {
            console.warn(
              `[control] 컨텍스트 없음 (만료/완료): ${controlId}`,
            );
            return;
          }
          // 같은 스레드의 모든 에이전트 중단
          const threadContexts = findContextsByThread(
            ctx.threadTs,
          );
          let cancelledCount = 0;
          for (const tCtx of threadContexts) {
            cancelAgent(tCtx.eventTs);
            await updateStatusMessage(
              tCtx.slackApp,
              tCtx.channel,
              tCtx.statusMessageTs,
              'cancelled',
              tCtx.agentName,
            );
            deleteRunContext(tCtx.controlId);
            cancelledCount++;
          }
          // 큐 태스크 에이전트 중단 — 큐 태스크는 task.id로 activeAgents에 등록되므로
          // tCtx.eventTs로는 찾지 못함 → running task.id를 조회해 직접 중단
          const runningTaskIds = getRunningTaskIdsByThread(ctx.threadTs);
          for (const taskId of runningTaskIds) {
            cancelAgent(taskId);
          }
          // 큐 태스크 DB 상태도 취소 처리
          const queueResult = cancelQueueByThread(ctx.threadTs);
          cancelledCount += queueResult.count;
          console.log(
            `[control] ⏹️ 전체 중단: thread=${ctx.threadTs}, agents=${threadContexts.length}, queue=${queueResult.count} (running aborted=${runningTaskIds.length})`,
          );
        } catch (err) {
          console.error(
            '[control] agent_cancel_all 핸들러 오류:',
            err,
          );
        }
      },
    );

    app.view(
      'agent_rerun_modal',
      async ({ ack, view }) => {
        try {
          await ack();
          const controlId = view.private_metadata ?? '';
          const ctx = getRunContext(controlId);
          if (!ctx) {
            console.warn(
              `[control] 재실행 컨텍스트 없음: ${controlId}`,
            );
            return;
          }
          const additionalReqs =
            view.state?.values?.rerun_input_block?.rerun_requirements
              ?.value ?? '';

          // 현재 에이전트 중단
          cancelAgent(ctx.eventTs);
          cancelQueueByThread(ctx.eventTs);

          // 상태 메시지 → "재실행 중"
          await updateStatusMessage(
            ctx.slackApp,
            ctx.channel,
            ctx.statusMessageTs,
            'rerunning',
            ctx.agentName,
          );
          deleteRunContext(controlId);

          // 새 요구사항을 붙여서 재실행
          const newText = [
            ctx.originalText,
            '',
            '[재실행 — 추가 요구사항]',
            additionalReqs,
          ].join('\n');

          const rerunEvent: SlackEvent = {
            type: 'message',
            text: newText,
            user: process.env.SID_USER_ID ?? 'U0AJ3T423RU',
            channel: ctx.channel,
            channel_name: '',
            ts: `rerun_${Date.now()}`,
            thread_ts: ctx.threadTs,
            mentions: [],
            raw: {},
          };

          const agentApp = findAgentApp(
            ctx.agentName,
            apps,
          );
          console.log(
            `[control] 🔄 재실행: ${ctx.agentName} — "${additionalReqs.slice(0, 50)}..."`,
          );

          // 비동기 실행 (블로킹 방지)
          executeSingle(
            ctx.agentName,
            rerunEvent,
            'rerun',
            agentApp,
            apps,
          ).catch((err) =>
            console.error(
              `[control] 재실행 오류: ${ctx.agentName}`,
              err,
            ),
          );
        } catch (err) {
          console.error(
            '[control] agent_rerun_modal 핸들러 오류:',
            err,
          );
        }
      },
    );

    // 메시지 이벤트 핸들러 — 첫 번째 앱(PM)에서만 등록
    // 6개 앱이 모두 같은 메시지를 수신하므로 1개만 처리
    if (apps.length > 0) {
      apps.push(app);
      continue;
    }

    app.event('message', async ({ event }) => {
      let msgTs = '';
      try {
      const msg = event as unknown as Record<string, unknown>;

      // subtype 필터: message_changed, message_deleted 등 무시 (file_share는 허용)
      const subtype = msg.subtype as string | undefined;
      if (subtype && subtype !== 'file_share') {
        return;
      }

      const text = (msg.text as string) ?? '';
      const ts = (msg.ts as string) ?? '';
      msgTs = ts;

      // 첨부 파일 정보 추출 및 이미지 다운로드 (file_share 이벤트)
      // msg.file (singular) 도 처리 (Slack API에 따라 단수/복수 혼용)
      const rawFiles = (msg.files as Array<Record<string, unknown>> | undefined)
        ?? (msg.file ? [msg.file as Record<string, unknown>] : []);
      const pmBotToken = process.env.SLACK_BOT_TOKEN_PM ?? '';
      const imageFilePaths: string[] = [];

      for (const f of rawFiles) {
        let mimetype = (f.mimetype ?? f.filetype ?? '') as string;
        let urlPrivate = f.url_private as string | undefined;
        const fileId = (f.id as string | undefined) ?? '';

        // url_private 없으면 files.info API로 획득
        if (!urlPrivate && fileId) {
          try {
            const fileInfo = await apps[0].client.files.info({ file: fileId });
            const fullFile = fileInfo.file as Record<string, unknown> | undefined;
            urlPrivate = fullFile?.url_private as string | undefined;
            if (!mimetype && fullFile?.mimetype) {
              mimetype = fullFile.mimetype as string;
            }
            console.log(`[file] files.info 조회: ${fileId} url=${urlPrivate ? '획득' : '없음'} mimetype=${mimetype}`);
          } catch (err) {
            console.error(`[file] files.info 호출 실패 (${fileId}):`, err);
          }
        } else {
          console.log(`[file] 이벤트 페이로드 URL: ${fileId} url=${urlPrivate ? '있음' : '없음'} mimetype=${mimetype}`);
        }

        if (urlPrivate && mimetype.startsWith('image/')) {
          // 보안: path traversal 방지를 위한 ext sanitize
          const rawExt = mimetype.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
          const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '');
          const filename = `${ts}-${fileId}.${ext}`;
          const savedPath = await downloadSlackImage(urlPrivate, pmBotToken, filename);
          if (savedPath) {
            imageFilePaths.push(savedPath);
          }
        }
      }
      // 메시지 텍스트에서 Slack 파일 URL 파싱 (텍스트로 공유된 경우)
      // 패턴: <https://[workspace].slack.com/files/[user]/[fileId]/[name]>
      const slackFileUrlPattern = /https:\/\/[a-z0-9-]+\.slack\.com\/files\/[A-Z0-9]+\/([A-Z0-9]+)\/[^\s>)]+/gi;
      const urlMatches = [...text.matchAll(slackFileUrlPattern)];
      const urlFileIds = new Set(rawFiles.map((f) => f.id as string));

      for (const match of urlMatches) {
        const fileId = match[1];
        if (!fileId || urlFileIds.has(fileId)) continue; // 이미 처리된 파일 스킵

        try {
          const fileInfo = await apps[0].client.files.info({ file: fileId });
          const fullFile = fileInfo.file as Record<string, unknown> | undefined;
          if (!fullFile) continue;

          const urlPrivate = fullFile.url_private as string | undefined;
          const mimetype = (fullFile.mimetype ?? fullFile.filetype ?? '') as string;
          console.log(`[file] URL 텍스트 파싱: ${fileId} url=${urlPrivate ? '획득' : '없음'} mimetype=${mimetype}`);

          if (urlPrivate && mimetype.startsWith('image/')) {
            // 보안: path traversal 방지를 위한 ext sanitize
            const rawExt = mimetype.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
            const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '');
            const filename = `${ts}-${fileId}.${ext}`;
            const savedPath = await downloadSlackImage(urlPrivate, pmBotToken, filename);
            if (savedPath) {
              imageFilePaths.push(savedPath);
              rawFiles.push(fullFile); // fileContext 빌드에 포함
            }
          }
          urlFileIds.add(fileId);
        } catch (err) {
          console.error(`[file] URL 파싱 files.info 실패 (${fileId}):`, err);
        }
      }

      const files = rawFiles; // fileContext 빌드에 재사용

      const fileContext = files.length > 0
        ? '\n[첨부 파일: ' + files.map((f) => `${f.name ?? '파일'} (${f.mimetype ?? f.filetype ?? 'unknown'})`).join(', ') + ']'
          + (imageFilePaths.length > 0
            ? '\n[첨부 이미지 — Read 도구로 내용 확인 가능:\n' + imageFilePaths.join('\n') + ']'
            : '')
        : '';

      console.log(
        `[event] 수신: "${text.slice(0, 40)}..." ts=${ts} bot_id=${msg.bot_id ?? 'none'} thread_ts=${msg.thread_ts ?? 'none'}`,
      );

      // 우리 봇 메시지 무시 (테스트 모드에서는 통과)
      const msgBotId = msg.bot_id as string | undefined;
      if (!TEST_MODE && msgBotId && ownBotIds.has(msgBotId)) {
        // 테이블 문법이 있는 자체 봇 메시지 → chat.update로 Block Kit 변환
        const selfChannel = (msg.channel as string) ?? '';
        if (selfChannel && text && /^\|.+\|$/m.test(text)) {
          try {
            const tableBlocks = buildMessageBlocks(text);
            if (tableBlocks) {
              const botApp = botIdToApp.get(msgBotId);
              if (botApp) {
                await botApp.client.chat.update({
                  channel: selfChannel,
                  ts,
                  text,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  blocks: tableBlocks as any,
                });
                console.log(`[table] 자체 봇 메시지 테이블 변환 완료: ${ts}`);
              }
            }
          } catch (err) {
            const errCode = (err as { data?: { error?: string } }).data?.error;
            if (errCode === 'invalid_blocks') {
              console.warn(`[table] 자체 봇 invalid_blocks (uneven rows 등) — 테이블 변환 건너뜀: ${ts}`);
            } else {
              console.error(`[table] 자체 봇 chat.update 실패: ${ts}`, err);
            }
          }
        }
        console.log(`[filter] 자체 봇 메시지 무시: ${ts}`);
        return;
      }

      const channel = (msg.channel as string) ?? '';
      const user = (msg.user as string) ?? '';
      const threadTs =
        (msg.thread_ts as string) ?? null;

      // 허용 사용자 필터: ALLOWED_USER_IDS에 없는 사용자 메시지 무시
      const allowedUserIds = (process.env.ALLOWED_USER_IDS ?? 'U0AJ3T423RU')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (user && !allowedUserIds.includes(user)) {
        console.log(`[filter] 비허용 사용자 메시지 무시: user=${user} ts=${ts}`);
        return;
      }

      // x/X 시작 메시지 무시 (에이전트 실행 차단)
      if (/^[xX]\s/.test(text) || text === 'x' || text === 'X') {
        console.log(`[filter] x/X 접두사 메시지 무시: ${ts}`);
        return;
      }

      // 1차 필터: 인메모리 중복 방지 (빠른 체크)
      if (processingMessages.has(ts)) {
        console.log(`[filter] 중복 메시지 무시: ${ts}`);
        return;
      }
      processingMessages.add(ts);
      setTimeout(
        () => processingMessages.delete(ts),
        5 * 60 * 1000,
      );

      // 2차 필터: 파일 기반 claim lock (프로세스 재시작에도 안전)
      if (!tryClaim(ts, 'bridge', channel)) {
        console.log(
          `[claim] 이미 claim된 메시지: ${ts} — skip`,
        );
        return;
      }

      const channelName = await getChannelName(
        apps,
        channel,
      );
      const debounceKey = getDebounceKey(
        channel,
        threadTs,
        user,
      );

      const existing = debounceBuffer.get(debounceKey);

      if (existing) {
        // 기존 그룹의 이전 마지막 메시지: 🧠 → 👀 교체 (같이 처리될 메시지 표시)
        const prevLast = existing.messages[existing.messages.length - 1];
        try {
          await apps[0].client.reactions.remove({
            channel,
            timestamp: prevLast.ts,
            name: 'brain',
          });
        } catch {
          // 제거 실패 무시
        }
        try {
          await apps[0].client.reactions.add({
            channel,
            timestamp: prevLast.ts,
            name: 'eyes',
          });
        } catch {
          // 추가 실패 무시
        }

        // 새 메시지(그룹의 새 마지막)에 🧠 추가
        try {
          await apps[0].client.reactions.add({
            channel,
            timestamp: ts,
            name: 'brain',
          });
        } catch {
          // 리액션 실패 무시
        }

        // 기존 타이머 리셋, 메시지 추가
        clearTimeout(existing.timer);
        existing.messages.push({ ts, text: text + fileContext, user });
        existing.raw = msg;
        console.log(
          `[debounce] 메시지 추가 (${existing.messages.length}개): "${text.slice(0, 30)}..."`,
        );

        existing.timer = setTimeout(
          () =>
            flushDebounceBuffer(debounceKey, apps),
          DEBOUNCE_DELAY,
        );
      } else {
        // 🧠 즉시 리액션 (새 그룹 첫 메시지, 라우팅 중 표시)
        try {
          await apps[0].client.reactions.add({
            channel,
            timestamp: ts,
            name: 'brain',
          });
        } catch {
          // 리액션 실패 무시
        }

        // 새 디바운스 엔트리 생성
        const entry: DebounceEntry = {
          messages: [{ ts, text: text + fileContext, user }],
          channel,
          channelName,
          threadTs,
          raw: msg,
          createdAt: Date.now(),
          timer: setTimeout(
            () =>
              flushDebounceBuffer(debounceKey, apps),
            DEBOUNCE_DELAY,
          ),
        };
        debounceBuffer.set(debounceKey, entry);
        console.log(
          `[debounce] 새 버퍼: "${text.slice(0, 30)}..." (${DEBOUNCE_DELAY}ms 대기)`,
        );
      }
      } catch (err) {
        console.error(`[error] message handler uncaught error (ts=${msgTs}):`, err);
        if (msgTs) {
          try {
            updateClaim(msgTs, 'failed');
          } catch {
            // claim 업데이트 실패는 무시
          }
        }
      }
    });

    // ─── 이모지 기반 에이전트 제어 ──────────────────
    // ⛔ black_square_for_stop → 에이전트 즉시 중단
    // ❌ x → auto-proceed 취소
    // ✅ white_check_mark → HIGH 리스크 수동 승인
    app.event(
      'reaction_added',
      async ({ event: reactionEvent }) => {
        try {
        const re = reactionEvent as unknown as {
          reaction: string;
          item: { ts: string; channel: string };
          user: string;
        };
        // 봇 자신의 리액션은 무시
        const userId = re.user;
        if (
          Array.from(botUserIdToName.keys()).includes(userId)
        ) {
          return;
        }

        // 보안: SID_USER_ID만 리액션으로 제어 가능 (black_square_for_stop, white_check_mark)
        const authorizedUserId = process.env.SID_USER_ID ?? 'U0AJ3T423RU';
        const isAuthorized = userId === authorizedUserId;

        switch (re.reaction) {
          case 'black_square_for_stop': {
            if (!isAuthorized) {
              console.log(
                `[control] ⛔ 에이전트 중단 무시: 권한 없는 사용자 ${userId} (승인 권한: ${authorizedUserId})`,
              );
              break;
            }
            // 🧠 리액션 제거 (라우팅 중이었다면)
            try {
              await apps[0].client.reactions.remove({
                channel: re.item.channel,
                timestamp: re.item.ts,
                name: 'brain',
              });
            } catch {
              // 이미 제거됨 무시
            }
            // reactions.get으로 실제 thread_ts 확보
            // 이모지를 단 메시지가 스레드 루트가 아닌 답글일 수 있으므로
            // re.item.ts만으로는 thread_ts 매칭이 안 될 수 있음
            let threadTs = re.item.ts;
            try {
              const reactionInfo = await apps[0].client.reactions.get({
                channel: re.item.channel,
                timestamp: re.item.ts,
              });
              const msg = reactionInfo.message as { thread_ts?: string } | undefined;
              if (msg?.thread_ts) {
                threadTs = msg.thread_ts;
              }
            } catch {
              // API 실패 시 re.item.ts로 폴백
            }

            // 직접 실행 중인 단일 에이전트 중단 (원본 메시지 ts 기준)
            const cancelled = cancelAgent(re.item.ts);
            if (cancelled) {
              console.log(
                `[control] ⛔ 사용자 리액션으로 에이전트 중단: ${re.item.ts}`,
              );
            }

            // 큐 태스크 에이전트 중단 — 큐 task.id로 activeAgents에 등록되므로
            // re.item.ts로는 찾지 못함 → DB에서 running task.id를 조회해 직접 중단
            const runningTaskIds = getRunningTaskIdsByThread(threadTs);
            for (const taskId of runningTaskIds) {
              cancelAgent(taskId);
              console.log(`[control] ⛔ 큐 태스크 에이전트 중단: ${taskId}`);
            }

            // 큐에 등록된 태스크 취소 (queued/running → skipped)
            const queueResult = cancelQueueByThread(threadTs);
            if (queueResult.count > 0) {
              console.log(
                `[control] ⛔ 큐 태스크 ${queueResult.count}개 취소: thread=${threadTs}`,
              );
              // 취소된 태스크의 칸반 카드 → Blocked 이동
              for (const cardId of queueResult.kanbanCardIds) {
                moveToBlocked(cardId).catch((err) =>
                  console.warn('[kanban-sync] 취소 카드 Blocked 이동 실패:', err),
                );
              }
            }
            break;
          }
          case 'x': {
            // auto-proceed 취소
            const count = await cancelAutoProceed(
              re.item.channel,
              re.item.ts,
              apps[0],
            );
            if (count > 0) {
              console.log(
                `[auto-proceed] ❌ 사용자 리액션으로 ${count}개 자동 진행 취소`,
              );
            }
            break;
          }
          case 'white_check_mark': {
            if (!isAuthorized) {
              console.log(
                `[auto-proceed] ✅ 수동 승인 무시: 권한 없는 사용자 ${userId} (승인 권한: ${authorizedUserId})`,
              );
              break;
            }
            // HIGH 리스크 수동 승인
            const count = await manuallyApprove(
              re.item.channel,
              apps[0],
            );
            if (count > 0) {
              console.log(
                `[auto-proceed] ✅ 사용자 리액션으로 ${count}개 수동 승인`,
              );
            }
            break;
          }
          case 'arrows_counterclockwise': {
            // 🔄 버튼이 사라진 완료/중단 상태에서 이모지로 재실행
            if (!isAuthorized) {
              console.log(
                `[control] 🔄 이모지 재실행 무시: 권한 없는 사용자 ${userId}`,
              );
              break;
            }
            const rerunCtx = findContextByStatusMessageTs(re.item.ts);
            if (!rerunCtx) {
              console.log(
                `[control] 🔄 이모지 재실행: 컨텍스트 없음 (ts: ${re.item.ts}) — TTL 만료 또는 미등록 메시지`,
              );
              break;
            }
            console.log(
              `[control] 🔄 이모지 재실행: ${rerunCtx.agentName} (${rerunCtx.eventTs})`,
            );
            // 상태 메시지 → "재실행 중"
            await updateStatusMessage(
              rerunCtx.slackApp,
              rerunCtx.channel,
              rerunCtx.statusMessageTs,
              'rerunning',
              rerunCtx.agentName,
            );
            deleteRunContext(rerunCtx.controlId);

            const rerunEvent: SlackEvent = {
              type: 'message',
              text: rerunCtx.originalText,
              user: process.env.SID_USER_ID ?? 'U0AJ3T423RU',
              channel: rerunCtx.channel,
              channel_name: '',
              ts: `rerun_${Date.now()}`,
              thread_ts: rerunCtx.threadTs,
              mentions: [],
              raw: {},
            };

            const agentAppForRerun = findAgentApp(rerunCtx.agentName, apps);
            executeSingle(
              rerunCtx.agentName,
              rerunEvent,
              'rerun',
              agentAppForRerun,
              apps,
            ).catch((err) =>
              console.error(
                `[control] 🔄 이모지 재실행 오류: ${rerunCtx.agentName}`,
                err,
              ),
            );
            break;
          }
          default:
            break;
        }
        } catch (err) {
          console.error('[error] reaction handler uncaught error:', err);
        }
      },
    );

    apps.push(app);
  }

  // 브리지 재시작 후 run_contexts 복원 (재실행/취소 버튼 영속성)
  const purgedCount = purgeExpiredRunContexts();
  if (purgedCount > 0) {
    console.log(`[init] 만료된 runContexts ${purgedCount}개 삭제`);
  }
  const restoredContexts = restoreRunContextsFromDb((agentName) =>
    findAgentApp(agentName, apps),
  );
  console.log(`[init] runContexts 복원: ${restoredContexts.length}개`);
  // 복원된 컨텍스트는 에이전트가 죽은 상태 → Slack 메시지를 "중단됨"으로 업데이트
  if (restoredContexts.length > 0) {
    void Promise.allSettled(
      restoredContexts.map((ctx) =>
        updateStatusMessage(ctx.slackApp, ctx.channel, ctx.statusMessageTs, 'interrupted', ctx.agentName)
          .catch((err) => console.warn(`[init] interrupted 업데이트 실패 (${ctx.agentName}):`, err)),
      ),
    ).then(() => console.log(`[init] ${restoredContexts.length}개 "중단됨" 메시지 업데이트 완료`));
  }

  // 앱 순차 시작 (연결 간 5초 딜레이로 Slack pong 타임아웃 방지)
  const CONNECTION_DELAY_MS = 5000;
  const CLIENT_PING_TIMEOUT_MS = 15000;
  console.log('[start] Socket Mode 연결 중...');
  for (let i = 0; i < apps.length; i++) {
    // Bolt가 clientPingTimeout을 노출하지 않으므로 내부 SocketModeClient에 직접 패치
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const receiver = (apps[i] as any).receiver;
    if (receiver?.client?.clientPingTimeoutMS != null) {
      receiver.client.clientPingTimeoutMS = CLIENT_PING_TIMEOUT_MS;
    }
    await apps[i].start();
    // 봇 온라인 상태(초록 불) 설정
    try {
      await apps[i].client.users.setPresence({
        presence: 'auto',
      });
    } catch {
      // setPresence 실패 무시 (앱 설정에서 수동 활성화 필요할 수 있음)
    }
    console.log(
      `[start] ${AGENTS[i].name} 연결 완료 (${i + 1}/${apps.length})`,
    );
    // 다음 연결 전 딜레이 (Slack WebSocket rate limit 방지)
    if (i < apps.length - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, CONNECTION_DELAY_MS),
      );
    }
  }
  console.log('[start] 전체 에이전트 Socket Mode 연결 완료');
  setMeetingApps(apps);
  console.log(
    '[start] Agent SDK 런타임 활성 — 병렬 실행 + mention 기반 에이전트 간 위임 지원',
  );
  emit({
    type: 'bridge.started',
    timestamp: Date.now(),
    source: 'bridge',
  });

  // ─── Hook Event 핸들러 등록 ─────────────────────────────
  // agent.failed 로깅: 에이전트 실패 시 상세 로그 (디버깅용)
  on({ pattern: 'agent.failed' }, (event: HookEvent) => {
    const e = event as AgentEvent;
    console.warn(
      `[hook] agent.failed: ${e.agent} (${e.elapsedMs ?? 0}ms) — ${e.error ?? 'unknown'}`,
    );
  });

  // circuit.opened 알림: circuit breaker 열림 시 Slack 알림
  on({ pattern: 'circuit.*' }, async (event: HookEvent) => {
    const e = event as CircuitEvent;
    if (e.type === 'circuit.opened') {
      try {
        await apps[0].client.chat.postMessage({
          channel: process.env.SLACK_CHANNEL_ID ?? '',
          text: `🔴 *Circuit Breaker OPEN* — \`${e.label}\` (연속 ${e.consecutiveFailures ?? 0}회 실패)\nAPI 호출이 ${60}초간 차단됩니다.`,
        });
      } catch {
        // 알림 실패 무시
      }
    }
  });

  // Auto-Proceed: 만료된 승인 정리 + 콜백 등록
  await cleanupExpiredApprovals(apps[0]);
  onApproved((_approvalId, agents, reason, channel, messageTs) => {
    // 승인된 에이전트들에게 작업 디스패치
    console.log(
      `[auto-proceed] 승인 콜백: [${agents.join(', ')}] — ${reason}`,
    );
    for (const agentName of agents) {
      const agentEvent: SlackEvent = {
        type: 'message',
        channel,
        channel_name: 'ai-team',
        user: 'auto-proceed',
        text: `[Auto-Proceed] ${reason}`,
        ts: messageTs,
        thread_ts: messageTs,
        mentions: [],
        raw: {},
      };
      handleMessage(
        agentName,
        agentEvent,
        'delegation',
        apps[0],
        true,
      ).catch((err) => {
        console.error(
          `[auto-proceed] ${agentName} 디스패치 실패:`,
          err,
        );
      });
    }
  });

  // 시작 시 만료된 claim 정리 + 1시간마다 주기적 정리
  cleanupExpiredClaims();
  const cleanupInterval = setInterval(
    cleanupExpiredClaims,
    60 * 60 * 1000,
  );

  // Langfuse 트래커 초기화 (환경변수 없으면 no-op)
  initLangfuseTracker();

  // Decisions FTS 인덱스 동기화 (에이전트 Read 비용 절감)
  syncDecisionsFts();

  // Ralph Loop 테이블 초기화 + 오래된 상태 정리
  initQaLoopTable();
  cleanupOldLoopStates();
  const qaLoopCleanupInterval = setInterval(
    cleanupOldLoopStates,
    24 * 60 * 60 * 1000, // 24시간마다
  );

  // 하트비트: 브리지 활성 상태 기록 + 만료 하트비트 정리
  writeHeartbeat('bridge', 'active');
  cleanupStaleHeartbeats();
  const heartbeatInterval = setInterval(
    () => writeHeartbeat('bridge', 'active'),
    5 * 60 * 1000,
  );

  // Task Queue Processor 시작 (5초 주기 폴링)
  startQueueProcessor(apps[0]);

  // ── 오펀 claim 처리 공통 함수 (재시작 복구 + 주기 감지 공유) ──
  // 자동 재라우팅 없음 — 미처리 작업 목록을 메시지로 공유하여 수동 처리 유도
  const processOrphanList = async (
    orphans: import('./claim-db.js').OrphanClaimInfo[],
    label: string,
  ) => {
    if (orphans.length === 0 || apps.length === 0) {
      return;
    }
    console.log(`[${label}] ${orphans.length}개 미처리 작업 감지 — 수동 처리 알림`);

    // ⚒️ 리액션 제거 — 고착 claim 원본 메시지에서 처리 중 이모지 정리
    await Promise.allSettled(
      orphans
        .filter((o) => o.channel)
        .map((orphan) =>
          apps[0].client.reactions.remove({
            channel: orphan.channel!,
            timestamp: orphan.messageTs,
            name: 'writing_hand',
          }).then(() => {
            console.log(`[${label}] ⚒️ 제거: ${orphan.messageTs}`);
          }).catch(() => {
            // 이미 제거됐거나 없는 경우 무시
          }),
        ),
    );

    const notifyChannel =
      orphans.find((o) => o.channel)?.channel ??
      (process.env.SLACK_NOTIFY_CHANNEL || '');

    if (!notifyChannel) {
      console.warn(`[${label}] 알림 채널 없음 — Slack 알림 생략`);
      return;
    }

    // chat.getPermalink으로 thread_ts 포함된 정확한 링크 획득
    const taskLines = await Promise.all(
      orphans.map(async (orphan, i) => {
        const ageMin = Math.round(orphan.ageMs / 60000);
        let msgLink: string;
        if (orphan.channel) {
          try {
            const result = await apps[0].client.chat.getPermalink({
              channel: orphan.channel,
              message_ts: orphan.messageTs,
            });
            msgLink = result.permalink
              ? `<${result.permalink}|원본 메시지>`
              : slackMsgLink(orphan.channel, orphan.messageTs);
          } catch {
            msgLink = slackMsgLink(orphan.channel, orphan.messageTs);
          }
        } else {
          msgLink = `\`${orphan.messageTs}\``;
        }
        return `${i + 1}. ${msgLink} — ${agentDisplayName(orphan.agent)} — ${ageMin}분 경과`;
      }),
    );

    const text = [
      `⚠️ *미처리 작업 ${orphans.length}건 감지*`,
      '',
      '수동 처리가 필요한 작업 목록:',
      ...taskLines,
      '',
      '각 링크를 클릭하여 해당 메시지를 재전송하거나 에이전트를 직접 호출하세요.',
    ].join('\n');

    try {
      await apps[0].client.chat.postMessage({
        channel: notifyChannel,
        text,
      });
    } catch (err) {
      console.error(`[${label}] Slack 알림 실패:`, err);
    }
  };

  // 재시작 시 미처리 claim 알림 — processing 상태 항목만 체크 (failed 재확인 제거)
  // recoverRecentFailedClaimsOnStartup 제거: 재시작 반복 시 같은 claim을 중복 알림하는 원인
  // 칸반 카드 정리는 kanban backend startup-cleanup에서 task_queue 동기화 기반으로 처리
  {
    const startupOrphans = recoverProcessingClaimsOnStartup();
    if (startupOrphans.length > 0) {
      console.log(`[startup-recovery] ${startupOrphans.length}개 미처리 태스크 감지 — 수동 처리 알림`);
      void processOrphanList(startupOrphans, 'startup-recovery');
    } else {
      console.log('[startup-recovery] 미처리 태스크 없음');
    }
  }

  // 오펀 claim 감지 — 5분마다 실행 + 재시작 시 startup-recovery에서도 실행
  const orphanCheckInterval = setInterval(async () => {
    const orphans = cleanupOrphanClaims();
    await processOrphanList(orphans, 'orphan-requeue');
  }, 5 * 60 * 1000);

  // DB 유지보수: 24시간마다 VACUUM + ANALYZE
  const maintenanceInterval = setInterval(
    runMaintenance,
    24 * 60 * 60 * 1000,
  );

  // 컨텍스트 정리 스케줄러: 매일 자정 실행
  const notifyChannel = process.env.SLACK_CHANNEL_AI_TEAM ?? process.env.SLACK_NOTIFY_CHANNEL;
  const stopContextCleanup = startContextCleanupScheduler(async (result) => {
    if (!notifyChannel || apps.length === 0) return;
    try {
      await apps[0].client.chat.postMessage({
        channel: notifyChannel,
        text: formatCleanupReport(result),
      });
    } catch (err) {
      console.error('[context-cleanup] Slack 알림 실패:', err);
    }
  });

  // ── 메모리 관리 인터벌 ──────────────────────────────
  // debounceBuffer stale 엔트리 정리 (5분 주기)
  const DEBOUNCE_MAX_AGE_MS = 5 * 60 * 1000;
  const debounceCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of debounceBuffer) {
      if (now - entry.createdAt > DEBOUNCE_MAX_AGE_MS) {
        clearTimeout(entry.timer);
        debounceBuffer.delete(key);
        console.warn(`[cleanup] stale debounce entry removed: ${key}`);
      }
    }
  }, 5 * 60 * 1000);

  // activeAgents stale 엔트리 정리 (5분 주기)
  const agentCleanupInterval = setInterval(
    cleanupStaleAgents,
    5 * 60 * 1000,
  );

  // sessionStore 만료 엔트리 정리 (1시간 주기)
  const sessionCleanupInterval = setInterval(
    cleanupExpiredSessions,
    60 * 60 * 1000,
  );

  // 종료 시그널 처리
  const shutdown = async () => {
    console.log('\n[shutdown] Socket Mode 연결 종료 중...');
    emit({
      type: 'bridge.shutdown',
      timestamp: Date.now(),
      source: 'bridge',
    });

    // 1. 모든 인터벌 정리
    clearInterval(cleanupInterval);
    clearInterval(orphanCheckInterval);
    clearInterval(heartbeatInterval);
    clearInterval(maintenanceInterval);
    clearInterval(debounceCleanupInterval);
    clearInterval(agentCleanupInterval);
    clearInterval(sessionCleanupInterval);
    stopContextCleanup();

    // 2. debounce 타이머 전체 정리
    for (const [key, entry] of debounceBuffer) {
      clearTimeout(entry.timer);
      debounceBuffer.delete(key);
    }
    console.log('[shutdown] debounce 타이머 정리 완료');

    // 3. 활성 에이전트 Slack 알림 후 중단
    const activeSnapshot = getActiveAgentsSnapshot();
    if (activeSnapshot.length > 0) {
      console.log(`[shutdown] 실행 중 에이전트 ${activeSnapshot.length}개 중단 알림 전송`);
      await Promise.allSettled(
        activeSnapshot.map(({ eventTs, agentName, channel, slackApp }) =>
          slackApp.client.chat.postMessage({
            channel,
            thread_ts: eventTs,
            text: `⚠️ Bridge 재시작으로 인해 *${agentName}* 작업이 중단되었습니다. 필요 시 재실행해 주세요.`,
          }).catch((err) => console.warn(`[shutdown] 알림 전송 실패: ${agentName}`, err)),
        ),
      );
    }
    cancelAllAgents();
    console.log('[shutdown] 활성 에이전트 중단 완료');

    // 4. pending approval 타이머 정리
    cancelAllPendingTimers();
    console.log('[shutdown] pending approval 타이머 정리 완료');

    // 5. processing claim 정리 (재시작 시 차단 방지)
    cancelAllProcessingClaims();

    // 6. 세션 저장소 flush
    flushSessionStore();
    await flushLangfuse();

    // 7. Socket Mode 연결 종료
    const results = await Promise.allSettled(apps.map((app) => app.stop()));
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const agentName = AGENTS[idx]?.name || `agent[${idx}]`;
        console.warn(`[shutdown] 에이전트 '${agentName}' 정지 실패:`, result.reason);
      }
    });
    console.log('[shutdown] 완료');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // 예상치 못한 에러 처리 — crash 방지 + cleanup 보장
  process.on('uncaughtException', (err) => {
    console.error('[fatal] uncaughtException:', err);
    shutdown().catch(() => process.exit(1));
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[fatal] unhandledRejection:', reason);
    // unhandledRejection은 crash하지 않지만 로그 기록 필수
  });
};

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
