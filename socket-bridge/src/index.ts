import { config } from 'dotenv';
import { join } from 'path';
import { App } from '@slack/bolt';

// .env는 프로젝트 루트에 위치
config({ path: join(import.meta.dirname, '..', '..', '.env') });
import type { AgentConfig, SlackEvent } from './types.js';
import { registerBotUser, routeMessage } from './router.js';
import { handleMessage } from './agent-runtime.js';
import {
  createChain,
  markStepInProgress,
  completeStepAndEvaluateNext,
  failChain,
} from './chain-manager.js';
import {
  tryClaim,
  updateClaim,
  cleanupExpiredClaims,
} from './claim.js';

// ─── 설정 ───────────────────────────────────────────────

const TEST_MODE = process.env.BRIDGE_TEST_MODE === '1';

const AGENTS: AgentConfig[] = [
  {
    name: 'pm',
    botToken: process.env.SLACK_BOT_TOKEN_PM ?? '',
    appToken: process.env.SLACK_APP_TOKEN_PM ?? '',
  },
  {
    name: 'designer',
    botToken: process.env.SLACK_BOT_TOKEN_DESIGNER ?? '',
    appToken: process.env.SLACK_APP_TOKEN_DESIGNER ?? '',
  },
  {
    name: 'frontend',
    botToken: process.env.SLACK_BOT_TOKEN_FRONTEND ?? '',
    appToken: process.env.SLACK_APP_TOKEN_FRONTEND ?? '',
  },
  {
    name: 'backend',
    botToken: process.env.SLACK_BOT_TOKEN_BACKEND ?? '',
    appToken: process.env.SLACK_APP_TOKEN_BACKEND ?? '',
  },
  {
    name: 'researcher',
    botToken: process.env.SLACK_BOT_TOKEN_RESEARCHER ?? '',
    appToken: process.env.SLACK_APP_TOKEN_RESEARCHER ?? '',
  },
  {
    name: 'secops',
    botToken: process.env.SLACK_BOT_TOKEN_SECOPS ?? '',
    appToken: process.env.SLACK_APP_TOKEN_SECOPS ?? '',
  },
];

// ─── Bot 자기 메시지 필터용 ──────────────────────────────

/** 우리 봇의 bot_id 집합 (런타임에 채워짐) */
const ownBotIds = new Set<string>();

// ─── 채널 이름 캐시 ──────────────────────────────────────

const channelNameCache = new Map<string, string>();

/** 진행 중인 채널 이름 조회 (동시 요청 중복 방지) */
const pendingChannelLookups = new Map<string, Promise<string>>();

/** 첫 번째 유효한 Bolt App으로 채널 이름 조회 */
const getChannelName = async (
  apps: App[],
  channelId: string,
): Promise<string> => {
  const cached = channelNameCache.get(channelId);
  if (cached) {
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
        channelNameCache.set(channelId, name);
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

// ─── 처리 중인 메시지 중복 방지 ─────────────────────────

/** 현재 처리 중인 메시지 ts 집합 */
const processingMessages = new Set<string>();

// ─── 에이전트 Slack App 조회 헬퍼 ───────────────────────

/** 에이전트 이름으로 Slack App 인스턴스 조회 */
const findAgentApp = (
  agentName: string,
  apps: App[],
): App => {
  const idx = AGENTS.findIndex((a) => a.name === agentName);
  return idx >= 0 ? apps[idx] : apps[0];
};

// ─── 실행 모드별 핸들러 ─────────────────────────────────

/**
 * 단일 에이전트 실행
 * @param agentName - 에이전트 이름
 * @param event - Slack 이벤트
 * @param method - 라우팅 방식
 * @param app - Slack App 인스턴스
 */
const executeSingle = async (
  agentName: string,
  event: SlackEvent,
  method: string,
  app: App,
): Promise<void> => {
  await handleMessage(agentName, event, method, app);
};

/**
 * 병렬 에이전트 실행 — 각 에이전트가 스레드 reply로 응답
 * @param agentNames - 에이전트 이름 목록
 * @param event - Slack 이벤트
 * @param method - 라우팅 방식
 * @param apps - 전체 Slack App 목록
 */
const executeParallel = async (
  agentNames: string[],
  event: SlackEvent,
  method: string,
  apps: App[],
): Promise<void> => {
  console.log(
    `[exec] 병렬 실행: [${agentNames.join(', ')}]`,
  );

  const results = await Promise.allSettled(
    agentNames.map((name, i) => {
      const app = findAgentApp(name, apps);
      // 첫 번째 에이전트만 리액션 관리 (경합 방지)
      const skipReaction = i > 0;
      return handleMessage(
        name,
        event,
        method,
        app,
        skipReaction,
      );
    }),
  );

  const failed = results
    .map((r, i) => ({ result: r, name: agentNames[i] }))
    .filter((r) => r.result.status === 'rejected');

  if (failed.length > 0) {
    const failedNames = failed.map((f) => f.name).join(', ');
    console.error(
      `[exec] 병렬 실행 실패: [${failedNames}] (${failed.length}/${agentNames.length})`,
    );
    for (const f of failed) {
      const reason =
        f.result.status === 'rejected'
          ? f.result.reason
          : '';
      console.error(`[exec]   ${f.name}:`, reason);
    }
  }

  console.log(
    `[exec] 병렬 실행 완료: ${results.length - failed.length}/${agentNames.length} 성공`,
  );
};

/**
 * 순차 체인 실행 — 첫 단계 실행 후 완료 시 다음 단계 동적 결정
 * @param event - Slack 이벤트
 * @param routing - 라우팅 결과
 * @param apps - 전체 Slack App 목록
 */
const executeSequential = async (
  event: SlackEvent,
  routing: { agents: Array<{ name: string }>; method: string },
  apps: App[],
): Promise<void> => {
  const firstExecution: 'single' | 'parallel' =
    routing.agents.length > 1 ? 'parallel' : 'single';
  const chain = createChain(
    event,
    routing.agents.map((a) => ({
      name: a.name,
      role: '',
    })),
    firstExecution,
  );

  console.log(
    `[exec] 순차 체인 시작: ${chain.chainId}`,
  );

  // 첫 단계 실행
  markStepInProgress(chain.chainId);
  const firstAgentNames = routing.agents.map((a) => a.name);

  try {
    if (firstExecution === 'parallel') {
      await executeParallel(
        firstAgentNames,
        event,
        routing.method,
        apps,
      );
    } else {
      const app = findAgentApp(firstAgentNames[0], apps);
      await executeSingle(
        firstAgentNames[0],
        event,
        routing.method,
        app,
      );
    }

    // 다음 단계 평가 루프
    let nextStep = await completeStepAndEvaluateNext(
      chain.chainId,
      `${firstAgentNames.join(', ')} 작업 완료`,
    );

    while (nextStep) {
      markStepInProgress(chain.chainId);

      if (
        nextStep.execution === 'parallel' &&
        nextStep.agents.length > 1
      ) {
        await executeParallel(
          nextStep.agents,
          event,
          routing.method,
          apps,
        );
      } else {
        const app = findAgentApp(nextStep.agents[0], apps);
        await executeSingle(
          nextStep.agents[0],
          event,
          routing.method,
          app,
        );
      }

      nextStep = await completeStepAndEvaluateNext(
        chain.chainId,
        `${nextStep.agents.join(', ')} 작업 완료`,
      );
    }

    console.log(
      `[exec] 순차 체인 완료: ${chain.chainId}`,
    );
  } catch (err) {
    failChain(chain.chainId);
    throw err;
  }
};

// ─── 메인 ────────────────────────────────────────────────

const main = async () => {
  // 환경변수 검증
  const missingAgents = AGENTS.filter(
    (a) => !a.botToken || !a.appToken,
  );
  if (missingAgents.length > 0) {
    console.error(
      `[error] 누락된 토큰: ${missingAgents.map((a) => a.name).join(', ')}`,
    );
    console.error('[error] .env 파일을 확인하세요');
    process.exit(1);
  }

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
      ownBotIds.add(botId);
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

    // 메시지 이벤트 핸들러
    app.event('message', async ({ event }) => {
      const msg = event as unknown as Record<string, unknown>;

      // 우리 봇 메시지 무시 (테스트 모드에서는 통과)
      const msgBotId = msg.bot_id as string | undefined;
      if (!TEST_MODE && msgBotId && ownBotIds.has(msgBotId)) {
        return;
      }

      const text = (msg.text as string) ?? '';
      const channel = (msg.channel as string) ?? '';
      const user = (msg.user as string) ?? '';
      const ts = (msg.ts as string) ?? '';
      const threadTs =
        (msg.thread_ts as string) ?? null;

      // 1차 필터: 인메모리 중복 방지 (빠른 체크)
      if (processingMessages.has(ts)) {
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

      const channelName = await getChannelName(apps, channel);

      const slackEvent: SlackEvent = {
        type: 'message',
        channel,
        channel_name: channelName,
        user,
        text,
        ts,
        thread_ts: threadTs,
        mentions: [],
        raw: msg,
      };

      // 4단계 라우팅 (LLM 복합 태스크 감지 포함)
      const routing = await routeMessage(text);
      slackEvent.mentions =
        routing.method === 'mention'
          ? routing.agents.map((a) => a.name)
          : [];

      const agentNames = routing.agents
        .map((a) => a.name)
        .join(', ');
      console.log(
        `[route] "${text.slice(0, 50)}..." → [${agentNames}] (${routing.execution}, ${routing.method})`,
      );

      // 실행 모드별 분기 (비동기 — 블로킹하지 않음)
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
          case 'sequential': {
            await executeSequential(
              slackEvent,
              routing,
              apps,
            );
            break;
          }
          case 'single':
          default: {
            const primaryAgent = routing.agents[0];
            const app = findAgentApp(
              primaryAgent.name,
              apps,
            );
            await executeSingle(
              primaryAgent.name,
              slackEvent,
              routing.method,
              app,
            );
            break;
          }
        }
      };

      executeTask()
        .then(() => {
          updateClaim(ts, 'completed');
        })
        .catch((err) => {
          updateClaim(ts, 'failed');
          console.error(
            `[error] ${agentNames} 실행 실패:`,
            err,
          );
        });
    });

    apps.push(app);
  }

  // 앱 순차 시작 (동시 연결 시 Slack rate limit 408 방지)
  console.log('[start] Socket Mode 연결 중...');
  for (let i = 0; i < apps.length; i++) {
    await apps[i].start();
    console.log(
      `[start] ${AGENTS[i].name} 연결 완료 (${i + 1}/${apps.length})`,
    );
  }
  console.log('[start] 전체 에이전트 Socket Mode 연결 완료');
  console.log(
    '[start] Agent SDK 런타임 활성 — 복합 태스크 병렬/순차 실행 지원',
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
    await Promise.all(apps.map((app) => app.stop()));
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
