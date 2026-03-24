import 'dotenv/config';
import { App } from '@slack/bolt';
import { writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { AgentConfig, SlackEvent } from './types.js';

// ─── 설정 ───────────────────────────────────────────────

const PROJECT_DIR = join(import.meta.dirname, '..', '..');
const EVENTS_DIR = join(PROJECT_DIR, '.events');
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10분마다 정리 실행
const EVENT_TTL_MS = 60 * 60 * 1000; // 1시간 후 파일 삭제
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

// ─── Bot User ID → Agent 이름 매핑 ──────────────────────

/** botUserId → agentName 역방향 매핑 (런타임에 채워짐) */
const botUserIdToAgent = new Map<string, string>();

/** 우리 봇의 bot_id 집합 (런타임에 채워짐, 자기 메시지 필터용) */
const ownBotIds = new Set<string>();

// ─── 채널 이름 캐시 ──────────────────────────────────────

const channelNameCache = new Map<string, string>();

// ─── 유틸리티 ────────────────────────────────────────────

/** 에이전트별 .events 디렉토리 초기화 */
const ensureEventDirs = () => {
  const dirs = [...AGENTS.map((a) => a.name), 'triage'];
  for (const dir of dirs) {
    mkdirSync(join(EVENTS_DIR, dir), { recursive: true });
  }
};

/** 이벤트를 JSON 파일로 기록 */
const writeEvent = (agentName: string, event: SlackEvent) => {
  const dir = join(EVENTS_DIR, agentName);
  const filename = `${event.ts.replace('.', '-')}.json`;
  const filepath = join(dir, filename);
  writeFileSync(filepath, JSON.stringify(event, null, 2), 'utf-8');
  console.log(`[event] → .events/${agentName}/${filename}`);
};

/** 메시지 텍스트에서 멘션된 에이전트 목록 추출 */
const parseMentions = (text: string): string[] => {
  const mentions: string[] = [];
  // <@U12345> 형태의 멘션을 찾아서 botUserId → agentName 변환
  const mentionPattern = /<@(U[A-Z0-9]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = mentionPattern.exec(text)) !== null) {
    const userId = match[1];
    const agentName = botUserIdToAgent.get(userId);
    if (agentName) {
      mentions.push(agentName);
    }
  }
  return mentions;
};

/** 1시간 지난 이벤트 파일 정리 */
const cleanupOldEvents = () => {
  const now = Date.now();
  const dirs = [...AGENTS.map((a) => a.name), 'triage'];

  for (const dir of dirs) {
    const dirPath = join(EVENTS_DIR, dir);
    try {
      const files = readdirSync(dirPath);
      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }
        const filepath = join(dirPath, file);
        const stat = statSync(filepath);
        if (now - stat.mtimeMs > EVENT_TTL_MS) {
          unlinkSync(filepath);
          console.log(`[cleanup] deleted .events/${dir}/${file}`);
        }
      }
    } catch {
      // 디렉토리가 없으면 무시
    }
  }
};

// ─── 채널 이름 조회 ──────────────────────────────────────

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

  ensureEventDirs();

  // 6개 Bolt App 인스턴스 생성
  const apps: App[] = [];

  for (const agent of AGENTS) {
    const app = new App({
      token: agent.botToken,
      appToken: agent.appToken,
      socketMode: true,
      // 각 앱의 이벤트는 공통 핸들러로 라우팅
    });

    // Bot User ID 조회 및 매핑 등록
    try {
      const authResult = await app.client.auth.test();
      agent.botUserId = authResult.user_id as string;
      const botId = authResult.bot_id as string;
      botUserIdToAgent.set(agent.botUserId, agent.name);
      ownBotIds.add(botId);
      console.log(
        `[init] ${agent.name}: botUserId=${agent.botUserId}, botId=${botId}`,
      );
    } catch (err) {
      console.error(`[error] ${agent.name} auth.test 실패:`, err);
      process.exit(1);
    }

    // message 이벤트는 첫 번째 앱(PM)에서만 처리 (중복 방지)
    // 모든 앱에서 message 이벤트 수신 (어떤 앱에 구독이 있는지 모르므로)
    // 중복 방지는 파일명(ts 기반)으로 자동 처리됨 (같은 파일 덮어쓰기)
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

      const mentions = parseMentions(text);
      const channelName = await getChannelName(apps, channel);

      const slackEvent: SlackEvent = {
        type: 'message',
        channel,
        channel_name: channelName,
        user,
        text,
        ts,
        thread_ts: threadTs,
        mentions,
        raw: msg,
      };

      if (mentions.length > 0) {
        // 멘션된 에이전트별 디렉토리에 기록
        for (const agentName of mentions) {
          writeEvent(agentName, slackEvent);
        }
      } else {
        // 멘션 없음 → triage로 라우팅
        writeEvent('triage', slackEvent);
      }
    });

    apps.push(app);
  }

  // 앱 순차 시작 (동시 연결 시 Slack rate limit 408 방지)
  console.log('[start] Socket Mode 연결 중...');
  for (let i = 0; i < apps.length; i++) {
    await apps[i].start();
    console.log(`[start] ${AGENTS[i].name} 연결 완료 (${i + 1}/${apps.length})`);
  }
  console.log('[start] 전체 에이전트 Socket Mode 연결 완료');
  console.log(`[start] 이벤트 디렉토리: ${EVENTS_DIR}`);

  // 주기적 정리 스케줄
  setInterval(cleanupOldEvents, CLEANUP_INTERVAL_MS);
  console.log(
    `[cleanup] ${EVENT_TTL_MS / 1000 / 60}분 이상 된 이벤트 자동 삭제 (${CLEANUP_INTERVAL_MS / 1000 / 60}분 간격)`,
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
