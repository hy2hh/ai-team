import 'dotenv/config';
import { App } from '@slack/bolt';
import type { AgentConfig, SlackEvent } from './types.js';
import { registerBotUser, routeMessage } from './router.js';
import { handleMessage } from './agent-runtime.js';

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

// ─── Slack App → agentName 매핑 ─────────────────────────

/** Slack App 인스턴스를 에이전트 이름으로 조회 */
const appToAgent = new Map<App, AgentConfig>();

// ─── 채널 이름 캐시 ──────────────────────────────────────

const channelNameCache = new Map<string, string>();

/** 첫 번째 유효한 Bolt App으로 채널 이름 조회 */
const getChannelName = async (
  apps: App[],
  channelId: string,
): Promise<string> => {
  const cached = channelNameCache.get(channelId);
  if (cached) {
    return cached;
  }

  for (const app of apps) {
    try {
      const result = await app.client.conversations.info({
        channel: channelId,
      });
      const name = (result.channel as { name?: string })?.name ?? channelId;
      channelNameCache.set(channelId, name);
      return name;
    } catch {
      continue;
    }
  }

  return channelId;
};

// ─── 처리 중인 메시지 중복 방지 ─────────────────────────

/** 현재 처리 중인 메시지 ts 집합 */
const processingMessages = new Set<string>();

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
      console.error(`[error] ${agent.name} auth.test 실패:`, err);
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
      const threadTs = (msg.thread_ts as string) ?? null;

      // 중복 처리 방지 (같은 메시지가 여러 앱에서 수신될 수 있음)
      if (processingMessages.has(ts)) {
        return;
      }
      processingMessages.add(ts);
      // 5분 후 자동 삭제 (메모리 누수 방지)
      setTimeout(() => processingMessages.delete(ts), 5 * 60 * 1000);

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

      // 3단계 라우팅
      const routing = routeMessage(text);
      slackEvent.mentions = routing.method === 'mention'
        ? [routing.agentName]
        : [];

      console.log(
        `[route] "${text.slice(0, 50)}..." → ${routing.agentName} (${routing.method})`,
      );

      // 대상 에이전트의 Slack App 인스턴스 찾기
      const targetAgent = AGENTS.find(
        (a) => a.name === routing.agentName,
      );
      const targetApp = targetAgent
        ? apps[AGENTS.indexOf(targetAgent)]
        : apps[0]; // 폴백: PM의 앱

      // Agent SDK로 직접 처리 (비동기 — 블로킹하지 않음)
      handleMessage(
        routing.agentName,
        slackEvent,
        routing.method,
        targetApp,
      ).catch((err) => {
        console.error(
          `[error] ${routing.agentName} handleMessage 실패:`,
          err,
        );
      });
    });

    appToAgent.set(app, agent);
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
    '[start] Agent SDK 런타임 활성 — .events/ 파일 중간 단계 제거됨',
  );

  // 종료 시그널 처리
  const shutdown = async () => {
    console.log('\n[shutdown] Socket Mode 연결 종료 중...');
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
