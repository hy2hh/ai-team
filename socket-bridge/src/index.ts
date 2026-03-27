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
} from './router.js';
import {
  handleMessage,
  registerAgentBotUserId,
  validatePersonaFiles,
  flushSessionStore,
  cancelAgent,
} from './agent-runtime.js';
import {
  tryClaim,
  updateClaim,
  cleanupExpiredClaims,
} from './claim.js';

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
  const agentNames = ['pm', 'designer', 'frontend', 'backend', 'researcher', 'secops'];
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
];

// ─── Bot 자기 메시지 필터용 ──────────────────────────────

/** 우리 봇의 bot_id 집합 (런타임에 채워짐) */
const ownBotIds = new Set<string>();

/** botUserId → 에이전트 표시 이름 (히스토리 포맷용) */
const botUserIdToName = new Map<string, string>();

/** bot_id → 에이전트 표시 이름 (히스토리 포맷용) */
const botIdToName = new Map<string, string>();

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

// ─── 처리 중인 메시지 중복 방지 ─────────────────────────

/** 현재 처리 중인 메시지 ts 집합 */
const processingMessages = new Set<string>();

// ─── 메시지 디바운스 (연속 메시지 그룹핑) ────────────────

/** 디바운스 대기 시간 (ms) */
const DEBOUNCE_DELAY = 3000;

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

/** 리액션 추가 (실패 무시) */
const safeAddReaction = async (
  app: App,
  channel: string,
  ts: string,
  name: string,
): Promise<void> => {
  try {
    await app.client.reactions.add({
      channel,
      timestamp: ts,
      name,
    });
  } catch {
    // 리액션 실패 무시
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
    await app.client.reactions.remove({
      channel,
      timestamp: ts,
      name: from,
    });
  } catch {
    // 제거 실패 무시
  }
  await safeAddReaction(app, channel, ts, to);
};

// ─── 실행 모드별 핸들러 ─────────────────────────────────

/** PM Hub 최대 에이전트 실행 횟수 — 무한 루프 방지 */
const MAX_DELEGATION_DEPTH = 3;

// ─── 이벤트 빌더 ─────────────────────────────────────────

/** 위임받는 에이전트용 이벤트 생성 */
/** UTF-8 안전 문자열 자르기 (서로게이트 페어 보호) */
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
      parts.push(`— ${r.agent}: ${safeSlice(r.text, 1500)}`);
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
): SlackEvent => {
  const parts = ['[에이전트 실행 결과 보고]'];

  for (const r of accumulatedResults) {
    parts.push(`— ${r.agent}: ${safeSlice(r.text, 1500)}`);
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
): Promise<void> => {
  const result = await handleMessage(
    agentName,
    event,
    method,
    app,
  );

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
    (name) => name !== 'pm' && isValidAgent(name),
  );

  if (targets.length === 0) {
    return;
  }

  // ─── PM Hub 루프 시작 ───────────────────────────────
  console.log(
    `[hub] PM Hub 시작: targets=[${targets.join(', ')}]`,
  );

  const pmApp = findAgentApp('pm', apps);

  const accumulatedResults: Array<{
    agent: string;
    text: string;
  }> = [];
  let agentExecutionCount = 0;
  // 현재 라운드의 PM 메시지 (위임 에이전트가 리액션할 대상)
  let currentPmTs = result.postedTs;

  while (
    targets.length > 0 &&
    agentExecutionCount < MAX_DELEGATION_DEPTH
  ) {
    // (a) 위임 에이전트 실행
    if (targets.length === 1) {
      const target = targets[0];
      const targetApp = findAgentApp(target, apps);
      const delegationEvent = buildDelegationEvent(
        event,
        accumulatedResults,
      );

      // 🧠 위임 에이전트가 PM 메시지에 리액션
      if (currentPmTs) {
        await safeAddReaction(
          targetApp,
          event.channel,
          currentPmTs,
          'brain',
        );
        console.log(
          `[reaction] 🧠 ${target} → PM 메시지: ${currentPmTs}`,
        );
      }

      console.log(
        `[hub] 위임: ${target} (${agentExecutionCount + 1}/${MAX_DELEGATION_DEPTH})`,
      );

      const delegationResult = await handleMessage(
        target,
        delegationEvent,
        'delegation',
        targetApp,
        true,
      );

      // ✅ 완료 전환
      if (currentPmTs) {
        await safeSwapReaction(
          targetApp,
          event.channel,
          currentPmTs,
          'brain',
          'white_check_mark',
        );
        console.log(
          `[reaction] ✅ ${target} 완료: ${currentPmTs}`,
        );
      }

      accumulatedResults.push({
        agent: target,
        text: delegationResult.text || '[응답 없음]',
      });
      agentExecutionCount += 1;
    } else {
      // 복수 위임: 병렬 실행
      const remaining =
        MAX_DELEGATION_DEPTH - agentExecutionCount;
      const batch = targets.slice(0, remaining);

      const batchApps = batch.map((target) =>
        findAgentApp(target, apps),
      );

      // 🧠 각 에이전트가 PM 메시지에 리액션
      if (currentPmTs) {
        await Promise.all(
          batchApps.map((batchApp, i) => {
            console.log(
              `[reaction] 🧠 ${batch[i]} → PM 메시지: ${currentPmTs}`,
            );
            return safeAddReaction(
              batchApp,
              event.channel,
              currentPmTs!,
              'brain',
            );
          }),
        );
      }

      console.log(
        `[hub] 병렬 위임: [${batch.join(', ')}] (${agentExecutionCount + batch.length}/${MAX_DELEGATION_DEPTH})`,
      );

      const parallelResults = await Promise.allSettled(
        batch.map((target, i) => {
          const delegationEvent =
            buildDelegationEvent(
              event,
              accumulatedResults,
            );
          return handleMessage(
            target,
            delegationEvent,
            'delegation',
            batchApps[i],
            true,
          );
        }),
      );

      for (let i = 0; i < batch.length; i++) {
        const r = parallelResults[i];
        accumulatedResults.push({
          agent: batch[i],
          text:
            r.status === 'fulfilled'
              ? r.value.text
              : `[실패: ${(r as PromiseRejectedResult).reason}]`,
        });
        // ✅ 각 에이전트 완료 전환
        if (currentPmTs) {
          await safeSwapReaction(
            batchApps[i],
            event.channel,
            currentPmTs,
            'brain',
            'white_check_mark',
          );
          console.log(
            `[reaction] ✅ ${batch[i]} 완료: ${currentPmTs}`,
          );
        }
      }
      agentExecutionCount += batch.length;
    }

    // (b) depth 초과 시 종료
    if (agentExecutionCount >= MAX_DELEGATION_DEPTH) {
      console.log(
        `[hub] depth 한도 도달 (${agentExecutionCount}/${MAX_DELEGATION_DEPTH})`,
      );
      break;
    }

    // (c) PM에게 결과 전달 → 리뷰
    const reviewEvent = buildPmReviewEvent(
      event,
      accumulatedResults,
    );

    console.log('[hub] PM 리뷰 요청');

    const pmReview = await handleMessage(
      'pm',
      reviewEvent,
      'hub-review',
      pmApp,
      true,
    );

    // (d) PM 리뷰 응답에서 delegate 도구로 지정된 새 타겟
    targets = pmReview.delegationTargets.filter(
      (name) => name !== 'pm' && isValidAgent(name),
    );

    if (targets.length === 0) {
      console.log('[hub] PM이 완료 판단 — Hub 루프 종료');
    } else {
      // 다음 라운드의 PM 메시지 업데이트 (에이전트들이 여기에 리액션)
      if (pmReview.postedTs) {
        currentPmTs = pmReview.postedTs;
      }
      console.log(
        `[hub] PM 추가 위임: [${targets.join(', ')}]`,
      );
    }
  }

  // depth 한도 도달 시 PM 최종 요약 (리뷰는 depth에 미포함)
  if (
    agentExecutionCount >= MAX_DELEGATION_DEPTH &&
    accumulatedResults.length > 0
  ) {
    const finalReviewEvent = buildPmReviewEvent(
      event,
      accumulatedResults,
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
    );
  }

  // Hub 완료 — 개별 에이전트가 이미 ✅ 전환했으므로 추가 작업 없음
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
const MAX_PARALLEL_AGENTS = 3;

const executeParallel = async (
  agentNames: string[],
  event: SlackEvent,
  method: string,
  apps: App[],
): Promise<void> => {
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
        return handleMessage(name, event, method, app);
      }),
    );

    for (let j = 0; j < batch.length; j++) {
      allResults.push({
        name: batch[j],
        result: batchResults[j],
      });
    }
  }

  const failed = allResults.filter(
    (r) => r.result.status === 'rejected',
  );

  // 실패한 에이전트 1회 재시도
  if (failed.length > 0) {
    const failedNames = failed
      .map((f) => f.name)
      .join(', ');
    console.warn(
      `[exec] 병렬 실행 실패: [${failedNames}] — 1회 재시도`,
    );

    const retryResults = await Promise.allSettled(
      failed.map((f) => {
        const app = findAgentApp(f.name, apps);
        // 재시도 시 리액션 관리 건너뛰기 (이미 첫 시도에서 처리됨)
        return handleMessage(
          f.name,
          event,
          method,
          app,
          true,
        );
      }),
    );

    const stillFailed: string[] = [];
    for (let j = 0; j < failed.length; j++) {
      if (retryResults[j].status === 'rejected') {
        stillFailed.push(failed[j].name);
        console.error(
          `[exec]   ${failed[j].name} 재시도 실패:`,
          (retryResults[j] as PromiseRejectedResult).reason,
        );
      } else {
        console.log(
          `[exec]   ${failed[j].name} 재시도 성공`,
        );
      }
    }

    if (stillFailed.length > 0) {
      // 재시도 후에도 실패한 에이전트 Slack 알림
      try {
        const threadTs = event.thread_ts ?? event.ts;
        await apps[0].client.chat.postMessage({
          channel: event.channel,
          thread_ts: threadTs,
          text: `⚠️ [${stillFailed.join(', ')}] 에이전트가 응답하지 못했습니다. (재시도 포함 ${agentNames.length - stillFailed.length}/${agentNames.length} 성공)`,
        });
      } catch {
        // 알림 실패는 무시
      }
    }

    console.log(
      `[exec] 병렬 실행 완료: ${agentNames.length - stillFailed.length}/${agentNames.length} 성공 (재시도 ${failed.length - stillFailed.length}건 복구)`,
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
  };

  // end-to-end 타이밍 시작
  const e2eStart = Date.now();

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

  // 🔍 → 라우팅 완료, 에이전트 실행 시작 (🔍 제거)
  try {
    await apps[0].client.reactions.remove({
      channel,
      timestamp: lastMessage.ts,
      name: 'mag',
    });
  } catch {
    // 리액션 제거 실패 무시
  }

  // 실행
  const executeTask = async () => {
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
        );
        break;
      }
    }
  };

  executeTask()
    .then(() => {
      const e2eElapsed = (
        (Date.now() - e2eStart) /
        1000
      ).toFixed(1);
      console.log(
        `[perf] e2e complete: [${agentNames}] ${e2eElapsed}s (${routing.method})`,
      );
      // 모든 메시지의 claim을 completed로
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

    // 메시지 이벤트 핸들러 — 첫 번째 앱(PM)에서만 등록
    // 6개 앱이 모두 같은 메시지를 수신하므로 1개만 처리
    if (apps.length > 0) {
      apps.push(app);
      continue;
    }

    app.event('message', async ({ event }) => {
      const msg = event as unknown as Record<string, unknown>;

      // subtype 필터: message_changed, message_deleted 등 무시 (file_share는 허용)
      const subtype = msg.subtype as string | undefined;
      if (subtype && subtype !== 'file_share') {
        return;
      }

      const text = (msg.text as string) ?? '';
      const ts = (msg.ts as string) ?? '';

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
          const ext = mimetype.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
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
            const ext = mimetype.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
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
        console.log(`[filter] 자체 봇 메시지 무시: ${ts}`);
        return;
      }

      const channel = (msg.channel as string) ?? '';
      const user = (msg.user as string) ?? '';
      const threadTs =
        (msg.thread_ts as string) ?? null;

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
      if (!tryClaim(ts, 'bridge')) {
        console.log(
          `[claim] 이미 claim된 메시지: ${ts} — skip`,
        );
        return;
      }

      // 🔍 즉시 리액션 (읽었다는 피드백)
      try {
        await apps[0].client.reactions.add({
          channel,
          timestamp: ts,
          name: 'mag',
        });
      } catch {
        // 리액션 실패 무시
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
        // 새 디바운스 엔트리 생성
        const entry: DebounceEntry = {
          messages: [{ ts, text: text + fileContext, user }],
          channel,
          channelName,
          threadTs,
          raw: msg,
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
    });

    // ─── 이모지 기반 에이전트 제어 (⛔ 중단) ──────────────────
    app.event(
      'reaction_added',
      async ({ event: reactionEvent }) => {
        const re = reactionEvent as unknown as {
          reaction: string;
          item: { ts: string; channel: string };
          user: string;
        };
        // black_square_for_stop 이모지만 처리
        if (re.reaction !== 'black_square_for_stop') {
          return;
        }
        // 봇 자신의 리액션은 무시
        const userId = re.user;
        if (
          Array.from(botUserIdToName.keys()).includes(userId)
        ) {
          return;
        }
        // 🔍 리액션 제거 (라우팅 중이었다면)
        try {
          await apps[0].client.reactions.remove({
            channel: re.item.channel,
            timestamp: re.item.ts,
            name: 'mag',
          });
        } catch {
          // 이미 제거됨 무시
        }
        const cancelled = cancelAgent(re.item.ts);
        if (cancelled) {
          console.log(
            `[control] ⛔ 사용자 리액션으로 에이전트 중단: ${re.item.ts}`,
          );
        }
      },
    );

    apps.push(app);
  }

  // 앱 순차 시작 (동시 연결 시 Slack rate limit 408 방지)
  console.log('[start] Socket Mode 연결 중...');
  for (let i = 0; i < apps.length; i++) {
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
  }
  console.log('[start] 전체 에이전트 Socket Mode 연결 완료');
  console.log(
    '[start] Agent SDK 런타임 활성 — 병렬 실행 + mention 기반 에이전트 간 위임 지원',
  );

  // 시작 시 만료된 claim 정리 + 1시간마다 주기적 정리
  cleanupExpiredClaims();
  const cleanupInterval = setInterval(
    cleanupExpiredClaims,
    60 * 60 * 1000,
  );

  // 종료 시그널 처리
  const shutdown = async () => {
    console.log('\n[shutdown] Socket Mode 연결 종료 중...');
    clearInterval(cleanupInterval);
    // 세션 저장소 즉시 flush (debounce 타이머 누락 방지)
    flushSessionStore();
    // Promise.allSettled()로 부분 실패 시에도 shutdown 계속 진행
    const results = await Promise.allSettled(apps.map((app) => app.stop()));
    // 개별 실패 로깅
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
};

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
