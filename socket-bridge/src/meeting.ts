/**
 * Agent Meeting Module
 *
 * 구조화된 에이전트 회의 프로토콜:
 * 1. 소집 (PM이 convene_meeting 호출)
 * 2. 독립 의견 수집 (병렬 — cross-contamination 방지)
 * 3. 종합 (PM이 충돌 식별)
 * 4. 토론 (충돌 시 대립 에이전트끼리 반론, 최대 2라운드)
 * 5. 투표 (agree/disagree/abstain → 다수결)
 * 6. 기록 (.memory/decisions/에 저장)
 */

import { existsSync, mkdirSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { App } from '@slack/bolt';
import { getDb } from './db.js';
import { handleMessage } from './agent-runtime.js';
import type { SlackEvent } from './types.js';

const PROJECT_DIR = join(import.meta.dirname, '..', '..');

/** 회의 유형 */
export type MeetingType =
  | 'architecture'
  | 'planning'
  | 'review'
  | 'retrospective'
  | 'ad-hoc';

/** 회의 상태 */
export type MeetingStatus =
  | 'convened'
  | 'opinions_collected'
  | 'debating'
  | 'voting'
  | 'decided'
  | 'cancelled';

/** 회의 의견 */
interface MeetingOpinion {
  agent: string;
  opinion: string;
  vote?: 'agree' | 'disagree' | 'abstain';
  round: number;
}

/** 회의 DB 행 */
interface MeetingRow {
  id: number;
  type: string;
  topic: string;
  status: string;
  initiator: string;
  participants: string;
  context: string | null;
  decision: string | null;
  created_at: number;
  resolved_at: number | null;
}

/**
 * 회의 소집
 * @returns 회의 ID
 */
export const conveneMeeting = (
  type: MeetingType,
  topic: string,
  participants: string[],
  initiator: string,
  context?: string,
): number => {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO meetings (type, topic, status, initiator, participants, context, created_at)
    VALUES (?, ?, 'convened', ?, ?, ?, ?)
  `).run(
    type,
    topic,
    initiator,
    JSON.stringify(participants),
    context ?? null,
    Date.now(),
  );

  const meetingId = Number(result.lastInsertRowid);
  console.log(
    `[meeting] #${meetingId} 소집: ${type} — "${topic}" 참여자: [${participants.join(', ')}]`,
  );
  return meetingId;
};

/**
 * 독립 의견 수집 (병렬 실행)
 * 각 참여자에게 동일한 주제를 전달하고 독립적으로 의견을 수집한다.
 */
export const collectOpinions = async (
  meetingId: number,
  event: SlackEvent,
  slackApp: App,
): Promise<MeetingOpinion[]> => {
  const db = getDb();
  const meeting = db.prepare(
    'SELECT * FROM meetings WHERE id = ?',
  ).get(meetingId) as MeetingRow | undefined;

  if (!meeting) {
    throw new Error(`회의 #${meetingId} 없음`);
  }

  const participants = JSON.parse(meeting.participants) as string[];
  const opinions: MeetingOpinion[] = [];

  // 병렬 의견 수집
  const opinionPromises = participants.map(async (agent) => {
    const opinionEvent: SlackEvent = {
      type: 'message',
      channel: event.channel,
      channel_name: event.channel_name,
      user: 'meeting',
      text: [
        `[회의 #${meetingId}] ${meeting.type} — "${meeting.topic}"`,
        '',
        meeting.context ? `*배경:* ${meeting.context}` : '',
        '',
        '당신의 전문 관점에서 이 주제에 대한 의견을 제시하세요.',
        '다른 에이전트의 의견은 아직 공유되지 않았습니다 (독립 의견 단계).',
        '',
        '응답 형식:',
        '1. 핵심 의견 (2-3문장)',
        '2. 근거 (구체적 사실/데이터 기반)',
        '3. 리스크/우려사항 (있다면)',
        '4. 추천 행동',
      ].join('\n'),
      ts: event.ts,
      thread_ts: event.thread_ts ?? event.ts,
      mentions: [],
      raw: {},
    };

    try {
      const response = await handleMessage(
        agent,
        opinionEvent,
        'delegation',
        slackApp,
        true,
        true,
      );

      const opinion: MeetingOpinion = {
        agent,
        opinion: response.text,
        round: 1,
      };

      // DB 기록
      db.prepare(`
        INSERT INTO meeting_opinions (meeting_id, agent, opinion, round, created_at)
        VALUES (?, ?, ?, 1, ?)
      `).run(meetingId, agent, response.text, Date.now());

      return opinion;
    } catch (err) {
      console.error(`[meeting] ${agent} 의견 수집 실패:`, err);
      return {
        agent,
        opinion: `의견 수집 실패: ${err instanceof Error ? err.message : String(err)}`,
        round: 1,
      };
    }
  });

  const results = await Promise.all(opinionPromises);
  opinions.push(...results);

  // 상태 업데이트
  db.prepare(
    'UPDATE meetings SET status = ? WHERE id = ?',
  ).run('opinions_collected', meetingId);

  console.log(
    `[meeting] #${meetingId} 의견 수집 완료: ${opinions.length}건`,
  );

  return opinions;
};

/**
 * PM이 의견을 종합하고 충돌을 식별한 후 결정을 내린다.
 * 만장일치이면 즉시 결정, 충돌이 있으면 PM이 최종 판단한다.
 */
export const synthesizeAndDecide = async (
  meetingId: number,
  opinions: MeetingOpinion[],
  event: SlackEvent,
  slackApp: App,
): Promise<string> => {
  const db = getDb();
  const meeting = db.prepare(
    'SELECT * FROM meetings WHERE id = ?',
  ).get(meetingId) as MeetingRow | undefined;

  if (!meeting) {
    throw new Error(`회의 #${meetingId} 없음`);
  }

  // PM에게 종합 요청
  const synthesisEvent: SlackEvent = {
    type: 'message',
    channel: event.channel,
    channel_name: event.channel_name,
    user: 'meeting',
    text: [
      `[회의 #${meetingId} 종합] "${meeting.topic}"`,
      '',
      '*참여자 의견:*',
      ...opinions.map(
        (o) => `*${o.agent}:* ${o.opinion.slice(0, 500)}`,
      ),
      '',
      '위 의견들을 종합하여:',
      '1. 합의된 부분을 정리하세요',
      '2. 충돌이 있다면 각 입장의 장단점을 분석하세요',
      '3. 최종 결정을 내리세요 (근거 포함)',
      '4. 다음 행동 항목을 정리하세요',
    ].join('\n'),
    ts: event.ts,
    thread_ts: event.thread_ts ?? event.ts,
    mentions: [],
    raw: {},
  };

  const response = await handleMessage(
    'pm',
    synthesisEvent,
    'delegation',
    slackApp,
    true,
    false,
  );

  const decision = response.text;

  // DB 업데이트
  db.prepare(
    'UPDATE meetings SET status = ?, decision = ?, resolved_at = ? WHERE id = ?',
  ).run('decided', decision, Date.now(), meetingId);

  // .memory/decisions/에 기록
  const decisionsDir = join(PROJECT_DIR, '.memory', 'decisions');
  if (!existsSync(decisionsDir)) {
    mkdirSync(decisionsDir, { recursive: true });
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const slug = meeting.topic
    .replace(/[^a-zA-Z0-9가-힣\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
  const decisionFile = join(
    decisionsDir,
    `${dateStr}_meeting-${meetingId}_${slug}.md`,
  );

  const decisionContent = [
    `# 회의 결정: ${meeting.topic}`,
    `> 회의 ID: ${meetingId}`,
    `> 유형: ${meeting.type}`,
    `> 일시: ${new Date().toISOString()}`,
    `> 참여자: ${(JSON.parse(meeting.participants) as string[]).join(', ')}`,
    '',
    '## 의견 요약',
    ...opinions.map(
      (o) => `### ${o.agent}\n${o.opinion.slice(0, 300)}`,
    ),
    '',
    '## 최종 결정',
    decision,
  ].join('\n');

  // 원자적 파일 쓰기 (write→rename)
  const tmpFile = decisionFile + '.tmp';
  writeFileSync(tmpFile, decisionContent, 'utf-8');
  renameSync(tmpFile, decisionFile);
  console.log(
    `[meeting] #${meetingId} 결정 기록: ${decisionFile}`,
  );

  return decision;
};

/**
 * 회의 전체 프로세스 실행 (소집 → 의견 → 종합 → 결정)
 */
export const runMeeting = async (
  type: MeetingType,
  topic: string,
  participants: string[],
  context: string | undefined,
  event: SlackEvent,
  slackApp: App,
): Promise<{ meetingId: number; decision: string }> => {
  // 1. 소집
  const meetingId = conveneMeeting(
    type,
    topic,
    participants,
    'pm',
    context,
  );

  // Slack 알림
  try {
    await slackApp.client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts ?? event.ts,
      text: [
        `📋 *[회의 #${meetingId}] ${topic}*`,
        `유형: ${type}`,
        `참여자: ${participants.join(', ')}`,
        '의견 수집 중...',
      ].join('\n'),
    });
  } catch {
    // 포스팅 실패 무시
  }

  // 2. 독립 의견 수집
  const opinions = await collectOpinions(
    meetingId,
    event,
    slackApp,
  );

  // 3. PM 종합 + 결정
  const decision = await synthesizeAndDecide(
    meetingId,
    opinions,
    event,
    slackApp,
  );

  return { meetingId, decision };
};
