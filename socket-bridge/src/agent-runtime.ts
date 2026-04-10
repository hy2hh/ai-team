import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { getDb } from './db.js';
import {
  query,
  createSdkMcpServer,
  tool,
} from '@anthropic-ai/claude-agent-sdk';
import { postPermissionRequest } from './permission-request.js';
import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { App } from '@slack/bolt';
import type { AgentSession, SlackEvent } from './types.js';
import {
  registerAutoProceed,
  type AutoProceedRequest,
} from './auto-proceed.js';
import { classifyRisk } from './risk-matrix.js';
import { rateLimited } from './rate-limiter.js';
import { runMeeting, type MeetingType } from './meeting.js';
import { enqueue, createBacklogCards, type QueueTask, type EnqueueResult } from './queue-manager.js';
import { postQueueStarted } from './queue-processor.js';
import { buildMessageBlocks } from './slack-table.js';
import {
  generateControlId,
  updateStatusMessage,
  storeRunContext,
  deleteRunContext,
} from './agent-control-buttons.js';
import { createCard, moveToInProgress, updateCard, cleanSlackText } from './kanban-sync.js';
import {
  emitAgentStarted,
  emitAgentCompleted,
  emitAgentFailed,
} from './hook-events.js';
import { getClaudeSdkQueryAuthOptions } from './anthropic-auth.js';

const PROJECT_DIR = join(import.meta.dirname, '..', '..');

// ─── 태스크 라이프사이클 이벤트 로거 ──────────────────────
// task_dispatched / task_completed / task_failed / task_escalated 이벤트를
// .memory/logs/task-events.jsonl 에 append-only 기록 (디버깅 + 관측성)

const TASK_EVENTS_LOG_DIR = join(PROJECT_DIR, '.memory', 'logs');
const TASK_EVENTS_LOG_PATH = join(TASK_EVENTS_LOG_DIR, 'task-events.jsonl');
// 로테이션 기준: 5MB 초과 시 .1 → .2 → .3 순환, 최대 3개 백업 유지
const TASK_EVENTS_MAX_BYTES = 5 * 1024 * 1024;
const TASK_EVENTS_MAX_BACKUPS = 3;

// ─── 에이전트별 성공/실패 통계 ──────────────────────────
// SQLite agent_stats 테이블에 에이전트별 total/failures 기록
// 라우팅 가중치 조정 및 운영 관측성에 활용

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
 * 에이전트 성공/실패 통계를 SQLite에 기록 (UPSERT)
 * task_completed → success=true, task_failed → success=false
 */
const recordAgentStat = (agent: string, success: boolean): void => {
  try {
    const db = getDb();
    const now = new Date().toISOString();

    if (success) {
      db.prepare(`
        INSERT INTO agent_stats (agent, total, failures, last_failure, last_updated)
        VALUES (?, 1, 0, NULL, ?)
        ON CONFLICT(agent) DO UPDATE SET
          total        = total + 1,
          last_updated = excluded.last_updated
      `).run(agent, now);
    } else {
      db.prepare(`
        INSERT INTO agent_stats (agent, total, failures, last_failure, last_updated)
        VALUES (?, 1, 1, ?, ?)
        ON CONFLICT(agent) DO UPDATE SET
          total        = total + 1,
          failures     = failures + 1,
          last_failure = excluded.last_failure,
          last_updated = excluded.last_updated
      `).run(agent, now, now);
    }
  } catch {
    // 통계 기록 실패는 에이전트 동작에 영향 없도록 무시
  }
};

/**
 * 에이전트 통계를 SQLite에서 읽어 AgentStats 형태로 반환
 */
export const getAgentStats = (): AgentStats => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM agent_stats').all() as Array<{
      agent: string;
      total: number;
      failures: number;
      last_failure: string | null;
      last_updated: string;
    }>;

    const stats: AgentStats = {};
    for (const row of rows) {
      stats[row.agent] = {
        total: row.total,
        failures: row.failures,
        lastUpdated: row.last_updated,
        ...(row.last_failure !== null && { lastFailure: row.last_failure }),
      };
    }
    return stats;
  } catch {
    return {};
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
 * task-events.jsonl 로테이션
 * 현재 파일이 TASK_EVENTS_MAX_BYTES 초과 시 .1/.2/.3 순환 백업 후 새 파일 시작
 */
const rotateLogs = (): void => {
  if (!existsSync(TASK_EVENTS_LOG_PATH)) return;
  const size = statSync(TASK_EVENTS_LOG_PATH).size;
  if (size < TASK_EVENTS_MAX_BYTES) return;

  // 오래된 백업부터 제거: .3 삭제 후 .2→.3, .1→.2, 현재→.1
  for (let i = TASK_EVENTS_MAX_BACKUPS; i >= 1; i--) {
    const older = `${TASK_EVENTS_LOG_PATH}.${i}`;
    const newer = i === 1 ? TASK_EVENTS_LOG_PATH : `${TASK_EVENTS_LOG_PATH}.${i - 1}`;
    if (existsSync(newer)) {
      renameSync(newer, older);
    }
  }
};

/**
 * 태스크 이벤트를 JSONL 로그 파일에 기록
 * 5MB 초과 시 자동 로테이션 (최대 3개 백업 유지)
 */
const logTaskEvent = (data: TaskEvent): void => {
  try {
    if (!existsSync(TASK_EVENTS_LOG_DIR)) {
      mkdirSync(TASK_EVENTS_LOG_DIR, { recursive: true });
    }
    rotateLogs();
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

// SESSION_TTL_MS: config.ts에서 import (환경변수 BRIDGE_SESSION_TTL_MS로 조정 가능)
import { SESSION_TTL_MS, MODEL_HIGH, MODEL_STANDARD, MODEL_FAST, MAX_TURNS } from './config.js';

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
// THREAD_SESSIONS_MAX: config.ts에서 import
import { THREAD_SESSIONS_MAX } from './config.js';

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
  /** 에이전트 시작 시각 (stale 엔트리 정리용) */
  startedAt: number;
}

/** 현재 실행 중인 에이전트 (원본 메시지 ts → 엔트리) */
const activeAgents = new Map<string, ActiveAgentEntry>();

/**
 * 라우팅/디바운스 중 취소 요청된 메시지 ts 집합
 * handleMessage 시작 시 체크하여 즉시 중단
 */
const pendingCancellations = new Set<string>();

// ─── Lisa 리서치 모드 선택 대기 ────────────────────────────
// key: threadTs, value: resolve 함수 (선택된 모드 + 버튼 메시지 ts를 전달)
export interface ResearchModeResult {
  mode: 'academic' | 'practical';
  /** 버튼이 포함된 기존 메시지 ts (인플레이스 업데이트용) */
  messageTs: string;
  channel: string;
}

const pendingResearchMode = new Map<
  string,
  (result: ResearchModeResult | null) => void
>();

/** 버튼 클릭 시 호출 — 대기 중인 Promise를 resolve */
export const resolveResearchMode = (
  threadTs: string,
  mode: 'academic' | 'practical',
  messageTs: string,
  channel: string,
): boolean => {
  const resolve = pendingResearchMode.get(threadTs);
  if (resolve) {
    resolve({ mode, messageTs, channel });
    pendingResearchMode.delete(threadTs);
    return true;
  }
  return false;
};

/** 취소 버튼 클릭 시 호출 — 대기 중인 Promise를 null로 resolve */
export const cancelResearchMode = (threadTs: string): boolean => {
  const resolve = pendingResearchMode.get(threadTs);
  if (resolve) {
    resolve(null);
    pendingResearchMode.delete(threadTs);
    return true;
  }
  return false;
};

/** 리서치 요청인지 판별 (depth 미지정 시 모드 선택 필요) */
const isResearchRequest = (event: SlackEvent): boolean => {
  const text = event.text.toLowerCase();
  // depth가 이미 명시된 경우 건너뜀
  if (text.includes('depth=academic') || text.includes('depth=practical')) {
    return false;
  }
  // 리서치 관련 키워드 포함 여부
  const researchKeywords = ['리서치', '조사', '분석', '시장', '트렌드', 'research', 'analyze', 'survey'];
  return researchKeywords.some((kw) => text.includes(kw));
};

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

// ─── 메모리 관리: 주기적 정리 함수 ──────────────────────

/** stale 에이전트 강제 중단 (기본 60분) */
const ACTIVE_AGENT_MAX_AGE_MS = Number(
  process.env.BRIDGE_AGENT_STALE_MS ?? 60 * 60 * 1000,
);

export const cleanupStaleAgents = (): number => {
  const now = Date.now();
  let cleaned = 0;
  for (const [ts, entry] of activeAgents) {
    if (now - entry.startedAt > ACTIVE_AGENT_MAX_AGE_MS) {
      console.warn(
        `[cleanup] stale agent aborted: ${entry.agentName} (${ts}, age=${Math.round((now - entry.startedAt) / 60000)}min)`,
      );
      entry.controller.abort();
      activeAgents.delete(ts);
      cleaned++;
    }
  }
  return cleaned;
};

/** 모든 활성 에이전트 즉시 중단 (shutdown용) */
export const cancelAllAgents = (): void => {
  for (const [, entry] of activeAgents) {
    entry.controller.abort();
  }
  activeAgents.clear();
};

/** shutdown 알림용: 현재 실행 중인 에이전트 정보 스냅샷 반환 */
export const getActiveAgentsSnapshot = (): Array<{
  eventTs: string;
  agentName: string;
  channel: string;
  slackApp: App;
}> =>
  Array.from(activeAgents.entries()).map(([eventTs, entry]) => ({
    eventTs,
    agentName: entry.agentName,
    channel: entry.channel,
    slackApp: entry.slackApp,
  }));

/** 만료된 세션 엔트리 정리 (런타임 주기적 실행) */
export const cleanupExpiredSessions = (): number => {
  const now = Date.now();
  let cleaned = 0;
  for (const agent of Object.keys(sessionStore)) {
    for (const key of Object.keys(sessionStore[agent])) {
      if (now - sessionStore[agent][key].updatedAt > SESSION_TTL_MS) {
        delete sessionStore[agent][key];
        cleaned++;
      }
    }
    if (Object.keys(sessionStore[agent]).length === 0) {
      delete sessionStore[agent];
    }
  }
  if (cleaned > 0) {
    saveSessionStore();
    console.log(`[session] periodic cleanup: ${cleaned} expired entries removed`);
  }
  return cleaned;
};

/**
 * 공통 맥락 규칙 prefix 생성 — 페르소나보다 앞에 삽입하여 우선순위 확보
 * 강한 페르소나가 맥락 해석 규칙을 압도하는 것을 방지
 * @returns 맥락 규칙 prefix 문자열
 */
const buildContextRulesPrefix = (agentName: string): string => {
  const agentIdList = Array.from(agentBotUserIds.entries())
    .map(([name, id]) => `  - ${name}: <@${id}>`)
    .join('\n');

  return [
    '# 최우선 규칙 (페르소나보다 상위)',
    '',
    '## 답변 태도 (핵심 원칙)',
    '- 모든 답변은 객관적이고 솔직하게 하세요. 불확실하거나 모르는 내용은 추측하지 말고 사용자에게 직접 질문하여 파악한 후 답변하세요.',
    '- 당신의 답변이 사용자의 의사결정에 직접 영향을 미칩니다. 부모가 아이를 대하듯 책임감 있게 처리하세요.',
    '- 오늘날 구현 비용은 제로입니다. 업계 best practice 기준으로 답변하세요. 예산·구현 난이도를 이유로 차선책을 먼저 제안하지 마세요.',
    '',
    '## 맥락 해석',
    '- 스레드 주제가 제공되면, 새 메시지를 반드시 해당 주제의 맥락 안에서 해석하세요.',
    '- 당신의 전문 분석은 스레드 주제가 당신의 전문 영역일 때만 적용하세요.',
    '- 주제와 무관한 전문 분석을 강제로 끼워넣지 마세요.',
    '',
    '## 응답 규칙',
    '- 반드시 한국어로 응답하세요.',
    '- Slack mrkdwn만 사용: *굵게* _기울임_ ~취소선~ `코드` ```코드블록``` • 목록',
    '- 절대 금지: **bold**, ## 헤더, [링크](url)',
    '- 구조화된 정보는 bullet list 또는 마크다운 테이블(`| 헤더 | 헤더 |\\n| --- | --- |\\n| 값 | 값 |`)로 표현',
    '- 마크다운 테이블은 bridge가 자동으로 Slack Block Kit Table Block으로 변환해 실제 표로 렌더링합니다',
    '- 테이블 제약: 메시지당 1개, 최대 100행 × 20열',
    '- Slack 포스팅 도구를 직접 호출하지 마세요. 응답을 텍스트로 출력하면 bridge가 자동으로 포스팅합니다.',
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
    '## 분석 보고 정확성 (수치/비교 주장 시 필수)',
    '- 수치 주장(N개, N회, N건 등)에는 반드시 `파일명:라인번호`를 인용하세요. 예: "인덱스 6개 (db.ts:52-68)"',
    '- 조건 분기가 있는 코드를 분석할 때는 최소/최대 실행 경로를 모두 명시하세요. 예: "쿼리 최소 3개(wip_limit=null) ~ 최대 5개"',
    '- 최적화나 개선을 제안할 때는 원본 코드와 제안 코드의 차이점을 명시하세요. 특히 조건절(WHERE, AND, OR)의 변경은 반드시 강조하세요.',
    '- 비교 목적으로 다른 엔드포인트/함수를 언급할 때도 동일한 정확성 기준을 적용하세요. 본문이 아닌 부수적 언급도 검증 대상입니다.',
    '',
    '## 자율 실행 (AGI 행동 원칙)',
    '- 작업을 받으면 즉시 실행하세요. "시작할까요?", "진행할까요?", "어떻게 할까요?" 질문 금지.',
    '- 계획을 세웠으면 바로 구현하세요. 승인을 기다리지 마세요.',
    '- 작업 완료 후 "다음 뭐하지?" 대기 금지. 반드시 다음 단계를 추천하세요.',
    '- 판단이 필요하면 스스로 판단하고 실행하세요. 확신이 없는 경우에만 에스컬레이션.',
    '',
    '## ⚠️ 실행 컨텍스트: SDK Headless 모드 (파일 권한 오해 금지)',
    '현재 실행 환경: Claude Agent SDK (headless) — permissionMode: bypassPermissions',
    '- Write/Edit 도구는 즉시 실행됩니다. 터미널 팝업, 사용자 승인 팝업은 존재하지 않습니다.',
    '- "Claude Code 파일 쓰기 권한이 필요합니다", "터미널에서 팝업을 승인해 주세요" 등의 메시지는 *허위 보고*입니다. 절대 출력하지 마세요.',
    '- 파일 수정이 필요하면: Write/Edit 도구를 즉시 호출 → 실패 시 실제 에러 메시지만 보고.',
    '- `.claude/agents/shared/`, `.memory/`, 프로젝트 코드 파일 모두 수정 가능합니다.',
    '',
    '## 에이전트 간 위임',
    '- 다른 에이전트에게 작업을 맡기려면 반드시 `mcp__delegation__delegate` 도구를 사용하세요.',
    '- delegate 도구에 에이전트 이름(pm/designer/frontend/backend/researcher/secops/qa)과 이유를 전달하면 bridge가 해당 에이전트를 실행합니다.',
    '- 지금 즉시 실행해야 할 에이전트만 delegate하세요. 향후 계획은 delegate하지 마세요.',
    '- 순차 실행이 필요하면 먼저 할 에이전트만 delegate하세요. 나중 에이전트는 리뷰 시 delegate합니다.',
    '- 텍스트에서 에이전트를 언급할 때는 이름(Krusty, Bart 등)만 사용하세요. <@USER_ID> 멘션은 위임 트리거가 아닙니다.',
    '- 에이전트 목록 (이름 → 역할):',
    '  - Marge(PM): 기획/로드맵/스프린트',
    '  - Krusty(Designer): UI/UX 디자인',
    '  - Bart(Frontend): React/TS 구현',
    '  - Homer(Backend): API/DB/인프라',
    '  - Lisa(Researcher): 시장조사/경쟁사 분석',
    '  - Wiggum(SecOps): 보안 리뷰',
    '  - Chalmers(QA): 품질 검증',
    '- Slack ID 매핑:',
    agentIdList,
    '- 자신이 직접 처리할 수 있는 작업은 위임하지 마세요.',
    '',
    // Researcher 보고서 품질 강제 규칙
    ...(agentName === 'researcher'
      ? [
          '',
          '### 리서치 보고서 필수 규칙 (예외 없음)',
          '모든 리서치 응답에 아래 3가지를 반드시 적용하라. 사용자가 명시하지 않아도 자동 적용.',
          '',
          '1. *검증 마커*: 모든 수치·통계 옆에 인라인으로 ✅ / ⚠️ (사유) / ❓ (사유) 표기. ⚠️·❓에는 반드시 괄호 안에 구체적 사유를 명시. 예: ⚠️ (WebSearch 기반, 원문 미접속), ❓ (공개 데이터 없음). 하단 일괄 경고로 대체 금지.',
          '2. *출처 구분*: WebFetch로 원문 접속한 수치는 ✅, WebSearch 스니펫만으로 확인한 수치는 ⚠️ (WebSearch 기반, 원문 미접속) 명시.',
          '3. *면책 문구*: 보고서 상단과 하단 모두에 "이 보고서의 수치는 YYYY-MM-DD 기준입니다. 현재와 다를 수 있습니다." 포함.',
        ]
      : []),
    '',
    '---',
    '',
  ].join('\n');
};

// ─── 공유 메모리 로더 ──────────────────────────────────
// 에이전트 실행 시 .memory/ 파일을 코드가 직접 읽어 프롬프트에 주입
// LLM에게 "읽어라" 지시하는 대신, 구조적으로 동일한 사실 기반 보장


/** 공유 메모리 캐시 엔트리 */
interface SharedMemoryCacheEntry {
  content: string;
  loadedAt: number;
}

/** 공유 메모리 캐시 (모든 에이전트에 동일 → 1회 로드 후 재사용) */
let sharedMemoryCache: SharedMemoryCacheEntry | null = null;

/** 공유 메모리 캐시 TTL (5분) */
const SHARED_MEMORY_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * 프로젝트 공유 메모리 로드 — 모든 에이전트 user turn에 주입
 *
 * 로드 대상:
 * - facts/project-context.md : 전역 프로젝트 상태
 * - facts/services.md        : 서비스 포트/엔드포인트 정보
 * - facts/team-profile.md    : 팀 구성 및 역할
 * - decisions/_index.md      : 결정사항 인덱스 (전문은 에이전트가 Read로 조회)
 *
 * decisions/ 개별 파일은 로드하지 않음 — _index.md를 보고 필요한 파일만 Read할 것.
 * 5분 TTL 캐시로 반복 로드 방지.
 *
 * @returns 공유 메모리 문자열
 */
const loadSharedMemory = (): string => {
  const now = Date.now();
  if (
    sharedMemoryCache &&
    now - sharedMemoryCache.loadedAt < SHARED_MEMORY_CACHE_TTL_MS
  ) {
    return sharedMemoryCache.content;
  }

  const parts: string[] = ['# 프로젝트 공유 메모리', ''];

  /** 파일을 읽어 섹션으로 추가 — 실패 시 조용히 건너뜀 */
  const addSection = (heading: string, relativePath: string): void => {
    const fullPath = join(PROJECT_DIR, relativePath);
    if (!existsSync(fullPath)) { return; }
    try {
      const content = readFileSync(fullPath, 'utf-8');
      parts.push(`## ${heading}`, '', content, '');
    } catch {
      // 읽기 실패 시 건너뜀
    }
  };

  // 1. 전역 프로젝트 상태
  addSection('프로젝트 상태', '.memory/facts/project-context.md');

  // 2. 서비스 포트/엔드포인트
  addSection('서비스 정보', '.memory/facts/services.md');

  // 3. 팀 구성
  addSection('팀 프로필', '.memory/facts/team-profile.md');

  // 4. 결정사항 인덱스 — 전문 로드 금지, 인덱스만 주입
  // 에이전트는 roles/topic 컬럼을 보고 관련 파일만 Read로 직접 조회할 것
  addSection('결정사항 인덱스 (전문은 .memory/decisions/{파일명} Read로 조회)', '.memory/decisions/_index.md');

  const result = parts.join('\n');
  sharedMemoryCache = { content: result, loadedAt: Date.now() };
  return result;
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

/**
 * user turn 앞에 주입할 메모리 prefix 조립
 *
 * system prompt는 정적(캐시 가능)으로 유지하고,
 * 동적 메모리(공유 + 개인)는 user turn 직전에 배치 — recency 효과 극대화.
 *
 * @param agentName - 에이전트 이름
 * @returns sharedMemory + agentMemory 조합 문자열
 */
export const buildUserMemoryPrefix = (agentName: string): string => {
  const shared = loadSharedMemory();
  const agent = loadAgentMemory(agentName);
  console.log(
    `[memory] ${agentName}: shared=${shared.length}c agent=${agent.length}c`,
  );
  return [shared, agent].join('\n');
};

/** 에이전트 persona 파일 경로 매핑 */
const AGENT_PERSONA_FILES: Record<string, string> = {
  pm: '.claude/agents/pm.md',
  designer: '.claude/agents/designer.md',
  frontend: '.claude/agents/frontend.md',
  backend: '.claude/agents/backend.md',
  researcher: '.claude/agents/researcher.md',
  secops: '.claude/agents/secops.md',
  qa: '.claude/agents/chalmers.md',
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
  'Skill',
  ...SLACK_TOOLS,
  ...ATLASSIAN_READ_TOOLS,
  ...ATLASSIAN_COMMON_WRITE_TOOLS,
  ...CONTEXT7_TOOLS,
  'Agent',
];

/** 대화형 메시지용 경량 도구 (도구 불필요한 간단 응답) */
const CONVERSATIONAL_TOOLS = [
  'Read',
  'Skill',
  ...SLACK_TOOLS,
];

/**
 * 라우팅 방식에 따른 도구 필터링
 *
 * conversational/broadcast 라우팅은 간단한 응답이므로 경량 도구만 제공.
 * 나머지는 에이전트 전체 도구 세트 사용.
 *
 * @param fullTools - 에이전트 전체 도구 목록
 * @param routingMethod - 라우팅 방식
 * @returns 필터링된 도구 목록
 */
const filterToolsByRouting = (
  fullTools: string[],
  routingMethod: string,
): string[] => {
  // :parallel 접미사 제거 후 base method로 판단
  const baseMethod = routingMethod.replace(':parallel', '');
  // 간단한 응답만 필요한 라우팅: 경량 도구 세트
  if (baseMethod === 'conversational' || baseMethod === 'broadcast') {
    return CONVERSATIONAL_TOOLS;
  }
  return fullTools;
};

/**
 * 읽기 전용 요청 감지
 * "검토만 하세요", "확인만 해주세요", "수정 작업은 진행하지 말고" 등의 패턴을 감지
 */
const isReadonlyRequest = (text: string): boolean => {
  return /검토만\s*(해주세요|하세요|진행해?주세요?|부탁)|확인만\s*(해주세요|하세요)|읽기만\s*(해주세요|하세요)|분석만\s*(해주세요|하세요)|수정\s*(작업은|은)\s*(하지\s*말고|진행하지\s*말고|제외)|수정\s*(없이|하지\s*말고|금지)/.test(
    text,
  );
};

/** readonly 모드에서 제거할 쓰기 도구 목록 */
const WRITE_ONLY_TOOL_PATTERNS = new Set([
  'Write',
  'Edit',
  'NotebookEdit',
  'Bash(git:*)',
  'Bash(npm:*)',
  'Bash(pnpm:*)',
  'Bash(npx:*)',
  'Bash(node:*)',
  'Bash(rm:*.json)',
  'Bash(mkdir:*)',
  // High fix #1: echo/cat 쉘 리다이렉션(>, >>)으로 파일 쓰기 우회 차단
  'Bash(echo:*)',
  'Bash(cat:*)',
  // High fix #2: gh CLI로 GitHub 쓰기(pr create, issue create, pr merge 등) 우회 차단
  'Bash(gh:*)',
]);

/**
 * readonly 모드용 도구 필터링 — 쓰기 도구 제거
 * Write, Edit, 쓰기 Bash 명령, Atlassian 쓰기 도구를 모두 제거
 */
const filterReadonlyTools = (tools: string[]): string[] => {
  const atlassianWriteTools = new Set([
    ...ATLASSIAN_COMMON_WRITE_TOOLS,
    ...ATLASSIAN_PM_WRITE_TOOLS,
    ...CONFLUENCE_COMMENT_TOOLS,
  ]);
  return tools.filter(
    (t) => !WRITE_ONLY_TOOL_PATTERNS.has(t) && !atlassianWriteTools.has(t),
  );
};

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
        // Agent 도구 제외: 서브에이전트는 allowedTools 필터 우회로 Slack 쓰기 가능 → 중복 메시지 발생
        ...BASE_TOOLS.filter((t) => t !== 'Agent'),
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

    // PM 전용: 순차 계획 강제 지시 주입
    const pmPlanningEnforcement =
      agentName === 'pm'
        ? [
            '',
            '## ⛔ 계획 수립 순차 강제 (HARD GATE)',
            '계획/설계/개선/구현 요청을 받으면 반드시 다음 순서를 따르세요:',
            '1. **첫 응답**: 맥락 탐색(코드/스펙 확인) + 관련 에이전트 소집(@mention으로 의견 요청)',
            '2. **에이전트 입력 수신 후**: 관점 종합 + 접근 방식 2~3개 제안 + sid 승인 요청',
            '3. **sid 승인 후**: 구현 계획서 작성 + 담당 에이전트 위임',
            '',
            '**절대 금지**: 첫 응답에서 전체 계획(Phase 1~5 등)을 한 번에 작성하는 것.',
            '에이전트 의견 없이 혼자 세운 계획은 전문가 관점이 빠진 단독 판단입니다.',
            '',
          ].join('\n')
        : '';

    console.log(`[persona] ${agentName}: persona=${persona.length}c`);

    const kanbanInstruction = [
      '',
      '## 칸반 카드 관리 (필수 — 최우선)',
      '**모든 작업에서 가장 먼저 `create_kanban_card`를 호출하세요.** 분석, 조사, 회의 소집, 코드 작성, 리뷰 등 어떤 작업이든 예외 없이 호출합니다.',
      '- **title**: 사용자가 요청한 작업의 핵심 내용을 사용자 관점에서 요약. 에이전트 내부 프로세스(라우팅, 전달, 위임)가 아니라 실제 수행될 작업을 적을 것.',
      '  - 좋은 예: "socket-bridge 코드 디버깅", "Slack 라우팅 키워드 테이블 리팩토링"',
      '  - 나쁜 예: "Homer에게 디버깅 요청 전달", "사용자 요청 수신 및 라우팅"',
      '- **description**: 구체적 실행 내용이나 작업 범위. 정보가 부족하면 비워두기',
      '- **예외 없음**: "안녕"도, "1+1=?"도, 단답형 답변도 모두 카드를 먼저 생성합니다.',
      '',
    ].join('\n');

    // 구조: 행동 규칙(최상위) → 에이전트 정체성(persona) → 에이전트별 주입
    // 메모리(sharedMemory, agentMemory)는 system에서 제거 — user turn 직전에 주입 (recency 효과)
    return [
      buildContextRulesPrefix(agentName),
      persona,
      pmPlanningEnforcement,
      kanbanInstruction,
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
  // :parallel 접미사 분리 — 병렬 실행 감지용 (base method는 도구 필터링·지시 조회에 사용)
  const isParallel = routingMethod.endsWith(':parallel');
  const baseMethod = isParallel ? routingMethod.replace(':parallel', '') : routingMethod;

  const parts = [
    `[Slack 메시지 수신 — #${event.channel_name}]`,
    `발신자: <@${event.user}>`,
    `라우팅: ${baseMethod}${isParallel ? ' (병렬)' : ''}`,
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
  const instruction = instructions[baseMethod];
  if (instruction) {
    parts.push(`지시: ${instruction}`);
  }
  // 병렬 실행 시 스코프 제한 — 자기 영역만 답변하도록 강제
  if (isParallel) {
    parts.push(
      '⚠️ 병렬 실행 중: 다른 에이전트도 동시에 이 메시지를 처리하고 있습니다. 반드시 당신의 전문 영역에 대해서만 답변하세요. 다른 파트의 분석을 대신하지 마세요 — 해당 에이전트가 별도로 답변합니다.',
    );
  }
  // 언어/포맷 규칙은 시스템 프롬프트(buildContextRulesPrefix)에 정의 — 중복 주입 불필요
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
 * 에이전트 세션을 가져오거나 새로 생성.
 * persona 파일이 변경된 경우 시스템 프롬프트를 재로드한다.
 * @param agentName - 에이전트 이름
 * @returns 에이전트 세션
 */
const getOrCreateSession = (agentName: string): AgentSession => {
  const existing = sessions.get(agentName);

  // persona 파일 수정 시각 확인
  const relativePath = AGENT_PERSONA_FILES[agentName];
  let personaFileMtimeMs = 0;
  if (relativePath) {
    try {
      personaFileMtimeMs = statSync(join(PROJECT_DIR, relativePath)).mtimeMs;
    } catch {
      // 파일 없으면 무시
    }
  }

  if (existing) {
    // 파일이 세션 생성 이후 수정된 경우 시스템 프롬프트 재로드
    if (personaFileMtimeMs > existing.personaLoadedAt) {
      console.log(
        `[runtime] persona 파일 변경 감지 — 시스템 프롬프트 재로드: ${agentName}`,
      );
      existing.systemPrompt = loadPersona(agentName);
      existing.personaLoadedAt = Date.now();
    }
    return existing;
  }

  const session: AgentSession = {
    agentName,
    systemPrompt: loadPersona(agentName),
    personaLoadedAt: Date.now(),
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
/** 순차 위임 step */
export interface DelegationStep {
  agents: string[];
  task: string;
  /** 이 step에서 사용할 모델 tier ('high'=Opus, 'standard'=Sonnet, 'fast'=Haiku). 기본값: 'standard' */
  tier?: 'high' | 'standard' | 'fast';
  /** PM이 생성한 Backlog 칸반 카드 ID (에이전트별) */
  kanbanCardIds?: Record<string, number>;
}

/** 병렬 위임 대상 */
export interface DelegationTarget {
  agent: string;
  /** 이 에이전트 실행 시 사용할 모델 tier. 기본값: 'standard' */
  tier?: 'high' | 'standard' | 'fast';
  /** PM이 생성한 Backlog 칸반 카드 ID */
  kanbanCardId?: number;
}

/** handleMessage 반환 타입 */
export interface HandleMessageResult {
  text: string;
  postedTs?: string;
  /** "작업중" 상태 메시지의 ts — 호출자가 결과를 직접 업데이트할 때 사용 */
  statusMessageTs?: string;
  /** PM delegate 도구로 지정된 위임 대상 에이전트 목록 (병렬) */
  delegationTargets: DelegationTarget[];
  /** PM delegate_sequential 도구로 지정된 순차 위임 단계 */
  delegationSteps?: DelegationStep[];
  /** 에이전트가 escalate_to_pm 도구를 호출한 경우 이유 (PM 재라우팅 트리거) */
  escalationReason?: string;
  /** 에이전트가 create_kanban_card 도구로 생성한 칸반 카드 ID */
  kanbanCardId?: number;
  /** 사용자 ⛔ 리액션 또는 stale 타임아웃으로 중단된 경우 true */
  aborted?: boolean;
  /** error_max_turns 발생 시 덮어쓰기 전 마지막 assistant 텍스트 */
  partialResult?: string;
  /** error_max_turns로 종료된 경우 true */
  isMaxTurns?: boolean;
}

export const handleMessage = async (
  agentName: string,
  event: SlackEvent,
  routingMethod: string,
  slackApp: App,
  skipReaction = false,
  skipPosting = false,
  modelTier: 'high' | 'standard' | 'fast' = 'standard',
  existingKanbanCardId?: number | null,
  _stepInfo?: { current: number; total: number },
): Promise<HandleMessageResult> => {
  // ─── Lisa 리서치 모드 선택 가로채기 ─────────────────────
  // 사람이 보낸 리서치 요청이면 A/B 버튼을 먼저 보내고 선택 대기
  // delegation(에이전트 간 위임)인 경우 버튼 없이 B(practical) 자동 선택
  /** 선택된 모드 결과 (버튼 메시지 ts 포함) — 인플레이스 업데이트에 활용 */
  let researchModeContext: ResearchModeResult | undefined;
  if (agentName === 'researcher' && isResearchRequest(event) && routingMethod === 'delegation') {
    console.log(`[research-mode] delegation 모드: depth=practical 자동 선택`);
    event.text = `${event.text}\n\ndepth=practical`;
  } else if (agentName === 'researcher' && isResearchRequest(event)) {
    const threadTs = event.thread_ts ?? event.ts;
    console.log(`[research-mode] 리서치 모드 선택 대기: ${threadTs}`);

    // 버튼 클릭 핸들러 등록을 postMessage보다 먼저 수행
    // (Slack이 HTTP 응답 전에 클라이언트에 버튼을 전달할 수 있으므로
    //  postMessage await 이후에 등록하면 클릭 → resolve 미등록 → ⚠️ 경고 발생)
    const selectedModePromise = new Promise<ResearchModeResult | null>(
      (resolve) => {
        pendingResearchMode.set(threadTs, resolve);
      },
    );

    // A/B 버튼 메시지 전송
    await rateLimited(() =>
      slackApp.client.chat.postMessage({
        channel: event.channel,
        thread_ts: threadTs,
        text: '리서치 모드를 선택해주세요: (A) 리서치 보고서 / (B) 실행 플레이북',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: [
                '*📊 리서치 결과를 어떤 용도로 쓰실 예정인가요?*',
                '',
                '*`(A)` 리서치 보고서* — 발표, 의사결정, 투자자 자료 등 수치 신뢰도가 중요한 경우',
                '→ 모든 수치를 원문 출처로 직접 확인합니다. 시간이 더 걸릴 수 있어요.',
                '',
                '*`(B)` 실행 플레이북* — 기획 아이디에이션, 트렌드 파악, 내부 참고용 등',
                '→ ROI 사례·업계 추정치도 포함해서 폭넓게 조사합니다. 미검증 수치는 별도 표기해요.',
              ].join('\n'),
            },
          },
          {
            type: 'actions',
            block_id: `research_mode_${threadTs}`,
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '📄 (A) 리서치 보고서',
                  emoji: true,
                },
                style: 'primary',
                action_id: 'research_mode_academic',
                value: threadTs,
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '📋 (B) 실행 플레이북',
                  emoji: true,
                },
                action_id: 'research_mode_practical',
                value: threadTs,
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '취소',
                  emoji: true,
                },
                style: 'danger',
                action_id: 'research_mode_cancel',
                value: threadTs,
              },
            ],
          },
        ],
      }),
    );

    // 사용자 선택 대기 (최대 5분 타임아웃)
    const selectedResult = await Promise.race([
      selectedModePromise,
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 5 * 60 * 1000);
      }),
    ]);

    // 타임아웃 시 정리
    pendingResearchMode.delete(threadTs);

    if (!selectedResult) {
      console.log(`[research-mode] 타임아웃: ${threadTs}`);
      await rateLimited(() =>
        slackApp.client.chat.postMessage({
          channel: event.channel,
          thread_ts: threadTs,
          text: '⏰ 리서치 모드 선택 시간이 초과되었습니다. 다시 요청해주세요.',
        }),
      );
      return { text: '', delegationTargets: [] };
    }

    // 선택된 모드를 원래 메시지에 주입 + 인플레이스 업데이트 컨텍스트 저장
    console.log(`[research-mode] ${selectedResult.mode} 선택됨: ${threadTs}`);
    event.text = `${event.text}\n\ndepth=${selectedResult.mode}`;
    researchModeContext = selectedResult;
  }
  // ─── 가로채기 끝 ────────────────────────────────────────

  const session = getOrCreateSession(agentName);
  // 메모리는 user turn 직전에 배치 — system prompt는 정적 유지(캐시 가능), recency 효과 극대화
  const memoryPrefix = buildUserMemoryPrefix(agentName);
  const prompt = [memoryPrefix, formatSlackEventAsPrompt(event, routingMethod)].join('\n\n');

  console.log(
    `[runtime] ${agentName} 처리 시작 (${routingMethod}): "${event.text.slice(0, 50)}..."`,
  );

  // 리액션 관리 여부: 사람/에이전트 메시지 모두 리액션으로 처리 상태 표시
  const canReact = !skipReaction;

  // 🔍 단계에서 이미 취소된 메시지인지 확인
  if (pendingCancellations.has(event.ts)) {
    pendingCancellations.delete(event.ts);
    console.log(
      `[control] ⛔ ${agentName} 사전 취소로 실행 건너뜀: ${event.ts}`,
    );
    // ⛔ 리액션 추가 (취소됨 표시) — 에이전트 메시지에만
    if (canReact) {
      try {
        await slackApp.client.reactions.add({
          channel: event.channel,
          timestamp: event.ts,
          name: 'black_square_for_stop',
        });
      } catch (err) {
        console.error(`[reaction] ⛔ 취소 리액션 추가 실패:`, err);
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
  emitAgentStarted(agentName, event.channel, event.ts);

  // 중단 제어용 AbortController 등록
  const abortController = new AbortController();
  activeAgents.set(event.ts, {
    controller: abortController,
    agentName,
    channel: event.channel,
    slackApp,
    startedAt: Date.now(),
  });

  // ⚒️ 리액션으로 처리 중 표시 — 마지막 메시지(🧠)만 ⚒️로 전환
  // earlier 메시지(👀)는 건드리지 않음
  if (canReact) {
    const timestamps = event.batchTs ?? [event.ts];
    for (const ts of timestamps) {
      // earlier 메시지는 👀 유지, 마지막 메시지만 처리
      if (ts !== event.ts) continue;
      try {
        // 🧠 brain 제거 후 ⚒️ 추가 (마지막 메시지만)
        await slackApp.client.reactions.remove({
          channel: event.channel,
          timestamp: ts,
          name: 'brain',
        });
      } catch {
        // brain 리액션이 없을 수도 있음 — 무시
      }
      try {
        await slackApp.client.reactions.add({
          channel: event.channel,
          timestamp: ts,
          name: 'writing_hand',
        });
        console.log(`[reaction] ⚒️ 처리 중 추가: ${ts}`);
      } catch (err) {
        console.error(`[reaction] ⚒️ 추가 실패:`, err);
      }
    }
  }

  // 🎛️ 컨트롤 버튼 메시지 게시 (취소/재실행) — 비활성화: 이모지 리액션 방식으로 대체
  // Lisa 리서치 모드: 선택 버튼 메시지를 새 메시지 없이 인플레이스 업데이트
  // skipPosting=true (cross-verify 등 내부 실행): 텍스트 상태 메시지 생략 — 이모지 리액션으로만 완료 표시
  const controlId = generateControlId();
  const threadTs = event.thread_ts ?? event.ts;
  let statusMessageTs: string | undefined;
  if (researchModeContext) {
    // 선택 버튼 메시지를 단순 텍스트로 업데이트 (컨트롤 버튼 없음)
    const modeLabel =
      researchModeContext.mode === 'academic'
        ? '📄 (A) 리서치 보고서'
        : '📋 (B) 실행 플레이북';
    try {
      await rateLimited(() =>
        slackApp.client.chat.update({
          channel: researchModeContext.channel,
          ts: researchModeContext.messageTs,
          text: `✅ ${modeLabel} 모드가 선택되었습니다.`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `✅ ${modeLabel} 모드가 선택되었습니다.`,
              },
            },
          ],
        }),
      );
    } catch (err) {
      console.error('[research-mode] 선택 메시지 업데이트 실패:', err);
    }
    // 선택 버튼 메시지 ts를 statusMessageTs로 설정 → 완료 시 인플레이스 업데이트 (새 메시지 방지)
    statusMessageTs = researchModeContext.messageTs;
  }
  // else if (!skipPosting) {
  //   // skipPosting=true(cross-verify 등)는 텍스트 상태 메시지 불필요 — 이모지 리액션으로만 처리
  //   statusMessageTs = await postRunningMessage(
  //     slackApp,
  //     event.channel,
  //     threadTs,
  //     agentName,
  //     controlId,
  //     stepInfo,
  //   );
  // }
  if (statusMessageTs) {
    storeRunContext({
      controlId,
      agentName,
      originalText: event.text,
      channel: event.channel,
      threadTs,
      statusMessageTs,
      eventTs: event.ts,
      slackApp,
      routingMethod,
      modelTier,
      createdAt: Date.now(),
    });
  }

  try {
    // 에이전트별 Slack bot token 조회
    const botToken =
      process.env[
        `SLACK_BOT_TOKEN_${agentName.toUpperCase()}`
      ] ?? '';

    let resultText = '';
    let lastMeaningfulText = '';
    let partialResultText = '';
    let hitMaxTurns = false;
    let usedModel = '';
    let costUsd = 0;
    let sdkFailed = false;
    const toolUses: Array<{ name: string }> = [];

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
    const delegationQueue: DelegationTarget[] = [];
    /** 순차 위임 단계 (delegate_sequential 사용 시) */
    const sequentialSteps: DelegationStep[] = [];
    // 비PM 에이전트: escalate_to_pm 도구로 PM 재라우팅 신호 수집
    let escalationReason: string | undefined;

    const baseMcpServers = getMcpServersForAgent(
      agentName,
      botToken,
    );
    const fullTools = getToolsForAgent(agentName);
    let baseTools = filterToolsByRouting(fullTools, routingMethod);

    // readonly 요청 감지: "검토만 하세요", "확인만 해주세요", "수정 작업은 진행하지 말고" 등
    const readonlyMode = isReadonlyRequest(event.text ?? '');
    if (readonlyMode) {
      baseTools = filterReadonlyTools(baseTools);
      console.log(
        `[readonly] ${agentName}: write 도구 비활성화 (readonly 모드 감지)`,
      );
    }

    // PM hub-review 모드: Edit 도구 제거 — 리뷰 단계에서 PM이 다른 에이전트 산출물을 직접 수정하는 것을 방지
    // QA FAIL 시 PM이 코드/디자인 파일을 직접 수정하는 대신 반드시 원작업자에게 재위임하도록 강제
    if (agentName === 'pm' && routingMethod === 'hub-review') {
      baseTools = baseTools.filter((t) => t !== 'Edit');
      console.log('[pm] hub-review 모드: Edit 도구 비활성화 (파일 수정은 원작업자에게 재위임)');
    }

    if (agentName === 'pm') {
      const delegationServer = createSdkMcpServer({
        name: 'delegation',
        tools: [
          tool(
            'delegate',
            '다른 에이전트에게 작업을 즉시 위임합니다. 독립적인 작업은 한 번에 여러 에이전트를 지정하세요. 순서가 반드시 필요한 경우만 delegate_sequential을 사용하세요.',
            {
              agents: z.array(z.string()),
              reason: z.string(),
              tier: z.enum(['high', 'standard', 'fast']).optional().describe('모델 tier. high=Opus(설계/분석), standard=Sonnet(구현), fast=Haiku(단순 조회). 기본값: standard'),
            },
            async ({ agents, reason, tier }) => {
              const valid = agents.filter((a: string) =>
                ['pm', 'designer', 'frontend', 'backend', 'researcher', 'secops', 'qa'].includes(a),
              );

              // 2+ 구현 에이전트 위임 시 스펙 파일 + 에러 케이스 AC 검증
              const implAgents = valid.filter((a) =>
                ['designer', 'frontend', 'backend'].includes(a),
              );
              if (implAgents.length >= 2) {
                const specsDir = join(PROJECT_DIR, 'docs', 'specs');
                const specFiles = existsSync(specsDir)
                  ? readdirSync(specsDir).filter((f) => f.endsWith('.md') && f !== 'README.md')
                  : [];
                if (specFiles.length === 0) {
                  console.warn(`[enforcement] delegate 차단: 2+ 구현 에이전트(${implAgents.join(', ')}) 위임에 스펙 파일 없음`);
                  return {
                    content: [{
                      type: 'text' as const,
                      text: `⛔ 위임 차단: 구현 에이전트 ${implAgents.length}명(${implAgents.join(', ')}) 위임에는 docs/specs/에 Feature Spec 파일이 필요합니다. 먼저 스펙을 작성하세요. 템플릿: .claude/context/pm/templates/feature-spec.md`,
                    }],
                  };
                }
                // 최신 스펙 파일에 에러 케이스 AC가 있는지 검증
                const latestSpec = specFiles.sort().pop()!;
                const specContent = readFileSync(join(specsDir, latestSpec), 'utf-8');
                if (!specContent.includes('에러 케이스') || !specContent.includes('- [')) {
                  console.warn(`[enforcement] delegate 차단: 스펙 ${latestSpec}에 에러 케이스 AC 누락`);
                  return {
                    content: [{
                      type: 'text' as const,
                      text: `⛔ 위임 차단: 스펙 파일 ${latestSpec}에 에러 케이스 AC가 없거나 비어 있습니다. "에러 케이스" 섹션에 구체적인 Given/When/Then을 작성하세요.`,
                    }],
                  };
                }
              }

              const tierLabel = tier ? ` (tier=${tier})` : '';
              console.log(
                `[delegation] PM delegate 호출: [${valid.join(', ')}]${tierLabel} — ${reason}`,
              );

              // 위임 대상별 Backlog 카드 생성 + 카드 ID를 target에 저장
              const targets: DelegationTarget[] = [];
              for (const agent of valid) {
                const cardId = await createCard(reason.slice(0, 200), agent).catch(() => null);
                targets.push({ agent, tier, kanbanCardId: cardId ?? undefined });
              }
              delegationQueue.push(...targets);

              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `위임 예약됨: [${valid.join(', ')}]${tierLabel} — ${reason}`,
                  },
                ],
              };
            },
          ),
          tool(
            'delegate_sequential',
            '순서가 중요한 작업을 순차적으로 위임합니다. 예: 디자이너가 색상 팔레트를 먼저 정의하고, 그 결과를 받아 프론트엔드가 구현해야 할 때 사용합니다. 각 step은 이전 step 완료 후 실행되며, 이전 결과가 자동으로 전달됩니다. 독립적인 작업은 delegate를 사용하세요.',
            {
              steps: z.array(z.object({
                agents: z.array(z.string()).describe('이 step에서 실행할 에이전트'),
                task: z.string().describe('이 step에서 수행할 작업 설명'),
                tier: z.enum(['high', 'standard', 'fast']).optional().describe('이 step에서 사용할 모델 tier. high=Opus(설계/분석), standard=Sonnet(구현), fast=Haiku(단순 조회). 기본값: standard'),
              })).describe('순차 실행할 step 배열 (앞에서부터 순서대로 실행)'),
              reason: z.string().describe('순차 실행이 필요한 이유'),
            },
            async ({ steps, reason: _reason }) => {
              const validSteps: DelegationStep[] = steps.map((step: { agents: string[]; task: string; tier?: 'high' | 'standard' | 'fast' }) => ({
                agents: step.agents.filter((a: string) =>
                  ['pm', 'designer', 'frontend', 'backend', 'researcher', 'secops', 'qa'].includes(a),
                ),
                task: step.task,
                tier: step.tier,
              })).filter((step) => step.agents.length > 0);

              // 전체 step에서 구현 에이전트 2+ 참여 시 스펙 파일 검증
              const allImplAgents = new Set(
                validSteps.flatMap((s: { agents: string[] }) =>
                  s.agents.filter((a: string) => ['designer', 'frontend', 'backend'].includes(a)),
                ),
              );
              if (allImplAgents.size >= 2) {
                const specsDir = join(PROJECT_DIR, 'docs', 'specs');
                const specFiles = existsSync(specsDir)
                  ? readdirSync(specsDir).filter((f) => f.endsWith('.md') && f !== 'README.md')
                  : [];
                if (specFiles.length === 0) {
                  console.warn(`[enforcement] delegate_sequential 차단: 구현 에이전트 ${[...allImplAgents].join(', ')} 참여에 스펙 파일 없음`);
                  return {
                    content: [{
                      type: 'text' as const,
                      text: `⛔ 순차 위임 차단: 구현 에이전트 ${allImplAgents.size}명(${[...allImplAgents].join(', ')}) 참여에는 docs/specs/에 Feature Spec 파일이 필요합니다. 먼저 스펙을 작성하세요. 템플릿: .claude/context/pm/templates/feature-spec.md`,
                    }],
                  };
                }
                const latestSpec = specFiles.sort().pop()!;
                const specContent = readFileSync(join(specsDir, latestSpec), 'utf-8');
                if (!specContent.includes('에러 케이스') || !specContent.includes('- [')) {
                  console.warn(`[enforcement] delegate_sequential 차단: 스펙 ${latestSpec}에 에러 케이스 AC 누락`);
                  return {
                    content: [{
                      type: 'text' as const,
                      text: `⛔ 순차 위임 차단: 스펙 파일 ${latestSpec}에 에러 케이스 AC가 없거나 비어 있습니다. "에러 케이스" 섹션에 구체적인 Given/When/Then을 작성하세요.`,
                    }],
                  };
                }
              }

              sequentialSteps.push(...validSteps);
              const summary = validSteps
                .map((s: { agents: string[]; task: string }, i: number) => `  ${i + 1}. [${s.agents.join(', ')}] ${s.task}`)
                .join('\n');
              console.log(
                `[delegation] PM delegate_sequential 호출 (${validSteps.length} steps):\n${summary}`,
              );

              // 각 step의 에이전트별 Backlog 카드 생성 + 카드 ID를 step에 저장
              for (const step of validSteps) {
                const cardIds: Record<string, number> = {};
                for (const agent of step.agents) {
                  const cardId = await createCard(step.task.slice(0, 200), agent).catch(() => null);
                  if (cardId !== null) {
                    cardIds[agent] = cardId;
                  }
                }
                step.kanbanCardIds = cardIds;
              }

              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `순차 위임 예약됨 (${validSteps.length} steps):\n${summary}`,
                  },
                ],
              };
            },
          ),
          tool(
            'enqueue_tasks',
            '복잡한 작업을 Task 단위로 분해하여 큐에 등록합니다. 각 Task는 독립 에이전트 세션에서 순차 실행되어 max_turns 초과 문제를 방지합니다. 3개 이상의 분석/조사 작업, 31턴 초과 위험이 있는 복잡한 작업에 사용하세요. 단순 단일 태스크는 delegate를 사용하세요.',
            {
              tasks: z.array(z.object({
                agent: z.string().describe('태스크를 실행할 에이전트 (pm/designer/frontend/backend/researcher/secops/qa)'),
                task: z.string().describe('태스크 설명 (구체적일수록 좋음)'),
                tier: z.enum(['high', 'standard', 'fast']).optional().describe('모델 tier. high=Opus(설계/분석), standard=Sonnet(구현), fast=Haiku(단순 조회). 기본값: standard'),
                dependsOn: z.number().optional().describe('선행 태스크의 인덱스 (0-based). 해당 태스크 완료 후 실행됨'),
                priority: z.number().min(1).max(10).optional().describe('실행 우선순위. 1=긴급(가장 먼저 실행) ~ 10=낮음. 기본값: 5'),
              })).describe('순차 실행할 태스크 배열'),
              reason: z.string().describe('큐 등록 이유'),
            },
            async ({ tasks, reason }) => {
              const validAgents = ['pm', 'designer', 'frontend', 'backend', 'researcher', 'secops', 'qa'];
              const validTasks: QueueTask[] = tasks
                .filter((t: { agent: string }) => validAgents.includes(t.agent))
                .map((t: { agent: string; task: string; tier?: 'high' | 'standard' | 'fast'; dependsOn?: number; priority?: number }) => ({
                  agent: t.agent,
                  task: t.task,
                  tier: t.tier,
                  dependsOn: t.dependsOn,
                  priority: t.priority,
                }));

              if (validTasks.length === 0) {
                return {
                  content: [{
                    type: 'text' as const,
                    text: '⛔ 유효한 태스크가 없습니다. agent는 pm/designer/frontend/backend/researcher/secops/qa 중 하나여야 합니다.',
                  }],
                };
              }

              try {
                // 큐에 등록
                const result: EnqueueResult = enqueue(
                  validTasks,
                  event.thread_ts ?? event.ts,
                  event.channel,
                );

                // 칸반 Backlog에 카드 생성 (PM 플랜 기반 제목)
                createBacklogCards(result).catch((err) =>
                  console.warn('[kanban-sync] Backlog 카드 생성 실패:', err),
                );

                // Slack에 큐 시작 알림
                await postQueueStarted(
                  slackApp,
                  event.channel,
                  event.thread_ts ?? event.ts,
                  result.tasks,
                );

                console.log(
                  `[delegation] PM enqueue_tasks: ${result.taskCount}개 태스크 등록 — ${reason}`,
                );

                const taskList = result.tasks
                  .map((t) => `  ${t.sequence + 1}. [${t.agent}] ${t.task.slice(0, 50)}...`)
                  .join('\n');

                return {
                  content: [{
                    type: 'text' as const,
                    text: `큐 등록 완료 (${result.taskCount}개 태스크):\n${taskList}\n\n각 태스크는 독립 세션에서 순차 실행됩니다. 진행 상황은 스레드에서 확인하세요.`,
                  }],
                };
              } catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                console.error('[delegation] enqueue_tasks 실패:', err);
                return {
                  content: [{
                    type: 'text' as const,
                    text: `⛔ 큐 등록 실패: ${errorMsg}`,
                  }],
                };
              }
            },
          ),
          tool(
            'run_qa',
            'QA Agent(Chalmers)를 실행하여 Feature Spec의 AC를 E2E 검증합니다. Cross-Verification PASS 후 수동 실행 또는 특정 스펙 재검증 시 사용하세요.',
            {
              specPath: z.string().describe('검증할 스펙 파일 경로 (예: docs/specs/2026-03-30_feature-name.md)'),
              reason: z.string().optional().describe('실행 이유 (선택)'),
            },
            async ({ specPath, reason }: { specPath: string; reason?: string }) => {
              // hub-review 모드에서는 QA 트리거 차단 — 에이전트 작업이 완전히 완료된 후에만 허용
              if (routingMethod === 'hub-review') {
                console.warn('[run_qa] hub-review 모드에서 호출 차단 — 에이전트 작업 완료 후 호출하세요');
                return {
                  content: [{
                    type: 'text' as const,
                    text: '⛔ hub-review 중에는 run_qa를 호출할 수 없습니다. 모든 에이전트 작업이 완료된 후 재호출하세요.',
                  }],
                };
              }
              console.log(`[run_qa] QA 실행 요청: specPath=${specPath}${reason ? `, reason=${reason}` : ''}`);
              try {
                // dynamic import로 circular dependency 방지 (qa-loop → agent-runtime 순환 참조)
                const { runDirectQA } = await import('./qa-loop.js');
                // 백그라운드 실행 (PM 응답 블로킹 없이)
                runDirectQA(specPath, event, slackApp).catch((err: unknown) => {
                  console.error('[run_qa] QA 실행 실패:', err);
                });
                return {
                  content: [{
                    type: 'text' as const,
                    text: `✅ QA 실행 예약됨: \`${specPath}\`${reason ? ` — ${reason}` : ''}`,
                  }],
                };
              } catch (err) {
                console.error('[run_qa] 도구 오류:', err);
                return {
                  content: [{
                    type: 'text' as const,
                    text: `❌ QA 실행 실패: ${err instanceof Error ? err.message : String(err)}`,
                  }],
                };
              }
            },
          ),
          tool(
            'recommend_next_phase',
            '다음 작업 단계를 추천합니다. bridge가 리스크를 분류하여 자동 진행 또는 sid 승인 대기를 결정합니다. 작업 완료 리뷰 후 다음 단계가 명확할 때 호출하세요.',
            {
              agents: z.array(z.string()).describe('다음 단계에 참여할 에이전트 목록'),
              reason: z.string().describe('추천 이유'),
              actionSummary: z.string().describe('다음 단계에서 수행할 작업 요약'),
              riskLevel: z.string().optional().describe('리스크 레벨 (LOW/MEDIUM/HIGH). 생략 시 자동 분류'),
              dodPendingItems: z.array(z.string()).optional().describe('완료 조건 미충족 항목 목록 (예: ["런타임 테스트", "빌드 확인"]). 1개라도 있으면 자동 진행이 차단됩니다. 모든 완료 조건 충족 후 재호출하세요.'),
              hasCodeChanges: z.boolean().optional().describe('코드/설정 파일 변경 여부. true이면 QA(Chalmers)가 다음 단계 첫 번째로 자동 삽입됩니다.'),
            },
            async ({ agents, reason, actionSummary, riskLevel, dodPendingItems, hasCodeChanges }) => {
              // hub-review 모드에서는 recommend_next_phase 차단 — 에이전트가 아직 작업 중일 수 있음
              if (routingMethod === 'hub-review') {
                console.warn('[delegation] recommend_next_phase hub-review 모드 차단 — 허브 루프 완료 후에만 호출 가능');
                return {
                  content: [{
                    type: 'text' as const,
                    text: '⛔ hub-review 중에는 recommend_next_phase를 호출할 수 없습니다. 모든 에이전트 작업이 완료되어 허브 루프가 종료된 후 재호출하세요.',
                  }],
                };
              }
              // 방안 A: 완료 조건 게이트 — 미충족 항목이 있으면 자동 진행 차단
              if (dodPendingItems && dodPendingItems.length > 0) {
                const itemList = dodPendingItems.map((i) => `• ${i}`).join('\n');
                await slackApp.client.chat.postMessage({
                  channel: event.channel,
                  thread_ts: event.ts,
                  text: [
                    '🚫 *작업 완료 조건 미충족 — 자동 진행 차단됨*',
                    '',
                    '*미완료 항목:*',
                    itemList,
                    '',
                    '아래 항목을 모두 완료한 뒤 다음 단계로 진행하세요.',
                  ].join('\n'),
                });
                console.log(
                  `[delegation] PM recommend_next_phase 차단 — 완료 조건 미충족: [${dodPendingItems.join(', ')}]`,
                );
                return {
                  content: [{
                    type: 'text' as const,
                    text: `⛔ 완료 조건 미충족으로 자동 진행 차단됨. 미충족 항목: ${dodPendingItems.join(', ')}`,
                  }],
                };
              }

              const VALID_AGENTS = ['designer', 'frontend', 'backend', 'researcher', 'secops', 'pm', 'qa'];
              let valid = agents.filter((a: string) => VALID_AGENTS.includes(a));

              // 방안 B: 코드 변경 시 QA 자동 선행 삽입
              if (hasCodeChanges && !valid.includes('qa')) {
                valid = ['qa', ...valid];
                console.log(
                  `[delegation] PM recommend_next_phase: hasCodeChanges=true → qa 자동 삽입 [${valid.join(', ')}]`,
                );
              }

              const risk = classifyRisk(
                `${reason} ${actionSummary}`,
                riskLevel,
              );
              // 방안 D: dodPendingItems를 registerAutoProceed에 전달 (MEDIUM 내부 게이트용)
              const approvalId = await registerAutoProceed(
                {
                  messageTs: event.ts,
                  channel: event.channel,
                  agents: valid,
                  reason,
                  actionSummary,
                  riskLevel: risk.level,
                  dodPendingItems: dodPendingItems ?? [],
                } as AutoProceedRequest,
                slackApp,
              );
              console.log(
                `[delegation] PM recommend_next_phase: #${approvalId} ${risk.level} [${valid.join(', ')}] — ${reason}`,
              );
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `다음 단계 등록됨: #${approvalId} [${risk.level}] ${valid.join(', ')} — ${reason} (${risk.reason})`,
                  },
                ],
              };
            },
          ),
          tool(
            'convene_meeting',
            '에이전트 회의를 소집합니다. 참여자들의 독립 의견을 병렬 수집한 뒤 종합하여 결정을 내립니다. 아키텍처 결정, 설계 리뷰, 기술 선택 등 다양한 관점이 필요한 주제에 사용하세요.',
            {
              type: z.enum(['architecture', 'planning', 'review', 'retrospective', 'ad-hoc']).describe('회의 유형'),
              topic: z.string().describe('회의 주제'),
              participants: z.array(z.string()).describe('참여 에이전트 목록'),
              context: z.string().optional().describe('회의 배경/맥락'),
            },
            async ({ type, topic, participants, context }) => {
              const valid = participants.filter((a: string) =>
                ['pm', 'designer', 'frontend', 'backend', 'researcher', 'secops', 'qa'].includes(a),
              );
              try {
                const { meetingId, decision } = await runMeeting(
                  type as MeetingType,
                  topic,
                  valid,
                  context,
                  event,
                  slackApp,
                );
                return {
                  content: [
                    {
                      type: 'text' as const,
                      text: `회의 #${meetingId} 완료. 결정:\n${decision.slice(0, 1000)}`,
                    },
                  ],
                };
              } catch (err) {
                return {
                  content: [
                    {
                      type: 'text' as const,
                      text: `회의 소집 실패: ${err instanceof Error ? err.message : String(err)}`,
                    },
                  ],
                };
              }
            },
          ),
        ],
      });
      baseMcpServers.delegation = delegationServer;
      baseTools.push(
        'mcp__delegation__delegate',
        'mcp__delegation__delegate_sequential',
        'mcp__delegation__run_qa',
        'mcp__delegation__recommend_next_phase',
        'mcp__delegation__convene_meeting',
      );
    } else {
      // 비PM 에이전트: 범위 초과 시 PM에게 에스컬레이션 신호 도구
      // 단, 'mention' 라우팅은 사용자가 에이전트를 명시적으로 선택한 것 → 에스컬레이션 차단
      const baseMethod = routingMethod.replace(':parallel', '');
      if (baseMethod === 'mention') {
        console.log(`[escalation] ${agentName}: mention 라우팅 → escalate_to_pm 비활성화`);
      } else {
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
      } // end if (baseMethod !== 'mention')
    }

    // 모든 에이전트: sid에게 Block Kit 버튼으로 권한 승인 요청
    const permissionServer = createSdkMcpServer({
      name: 'permission',
      tools: [
        tool(
          'request_permission',
          'sid에게 Slack Block Kit 버튼으로 권한 승인을 요청합니다. 반드시 다음 경우에만 호출하세요: (1) DB 마이그레이션 실행, (2) 프로덕션 배포, (3) 외부 API 과금 발생, (4) .claude/agents/shared/ 디렉토리 파일 수정. 일반 파일 생성/수정, 신규 에이전트 파일(.claude/agents/*.md) 작성, 코드 구현에는 호출하지 마세요. sid가 [✅ 승인] 또는 [❌ 거부]를 클릭할 때까지 대기합니다.',
          {
            reason: z.string().describe('권한이 필요한 이유 (맥락 설명)'),
            action: z.string().describe('수행하려는 구체적 작업 (예: collaboration-rules.md 수정)'),
          },
          async ({ reason, action }) => {
            const approved = await postPermissionRequest(
              slackApp,
              event.channel,
              event.thread_ts ?? event.ts,
              agentName,
              reason,
              action,
            );
            return {
              content: [
                {
                  type: 'text' as const,
                  text: approved
                    ? `승인됨: "${action}" 작업을 진행하세요.`
                    : `거부됨: "${action}" 작업을 중단하세요. sid가 요청을 거부했습니다.`,
                },
              ],
            };
          },
        ),
      ],
    });
    baseMcpServers.permission = permissionServer;
    baseTools.push('mcp__permission__request_permission');

    // 모든 에이전트: 칸반 카드 생성/업데이트 도구
    let kanbanCardId: number | undefined = existingKanbanCardId ?? undefined;
    const kanbanServer = createSdkMcpServer({
      name: 'kanban',
      tools: [
        tool(
          'create_kanban_card',
          '현재 작업의 칸반 카드를 생성합니다. 작업을 이해한 후 호출하세요. title은 실제 수행할 작업의 요약(예: "Slack 라우팅 키워드 테이블 리팩토링"), description은 구체적 실행 내용을 적습니다. 사용자의 원문 메시지를 그대로 넣지 마세요.',
          {
            title: z.string().max(200).describe('작업 제목 — 에이전트가 수행할 작업의 핵심 요약'),
            description: z.string().max(500).optional().describe('구체적 실행 내용 또는 작업 범위'),
            priority: z.enum(['low', 'medium', 'high']).optional().describe('우선순위. 기본값: medium'),
          },
          async ({ title, description, priority }) => {
            // 기존 Backlog 카드가 있으면 업데이트 + In Progress 이동만 수행
            if (kanbanCardId !== undefined) {
              await updateCard(kanbanCardId, { title, description }).catch(() => {});
              await moveToInProgress(kanbanCardId).catch(() => {});
              if (priority && priority !== 'medium') {
                await updateCard(kanbanCardId, { priority }).catch(() => {});
              }
              return { content: [{ type: 'text' as const, text: `칸반 카드 #${kanbanCardId} 업데이트 → In Progress 이동 완료. 작업을 진행하세요.` }] };
            }
            // 새 카드 생성 (직접 메시지 경로)
            const cardId = await createCard(
              title,
              agentName,
              description,
            );
            if (cardId === null) {
              return { content: [{ type: 'text' as const, text: '칸반 카드 생성 실패 (백엔드 응답 없음). 작업은 계속 진행하세요.' }] };
            }
            kanbanCardId = cardId;
            await moveToInProgress(cardId).catch(() => {});
            if (priority && priority !== 'medium') {
              await updateCard(cardId, { priority }).catch(() => {});
            }
            return { content: [{ type: 'text' as const, text: `칸반 카드 #${cardId} 생성 완료 (In Progress). 작업을 진행하세요.` }] };
          },
        ),
        tool(
          'update_kanban_card',
          '현재 작업의 칸반 카드를 업데이트합니다. 진행률 변경, 설명 보강 등에 사용합니다.',
          {
            progress: z.number().min(0).max(100).optional().describe('진행률 (0-100)'),
            description: z.string().max(500).optional().describe('업데이트할 설명'),
            title: z.string().max(200).optional().describe('업데이트할 제목'),
          },
          async ({ progress, description: desc, title }) => {
            if (kanbanCardId === undefined) {
              return { content: [{ type: 'text' as const, text: '칸반 카드가 아직 생성되지 않았습니다. 먼저 create_kanban_card를 호출하세요.' }] };
            }
            const fields: Record<string, unknown> = {};
            if (progress !== undefined) { fields.progress = progress; }
            if (desc !== undefined) { fields.description = desc; }
            if (title !== undefined) { fields.title = title; }
            if (Object.keys(fields).length === 0) {
              return { content: [{ type: 'text' as const, text: '업데이트할 필드가 없습니다.' }] };
            }
            await updateCard(kanbanCardId, fields as { title?: string; description?: string; progress?: number }).catch(() => {});
            return { content: [{ type: 'text' as const, text: `칸반 카드 #${kanbanCardId} 업데이트 완료.` }] };
          },
        ),
      ],
    });
    baseMcpServers.kanban = kanbanServer;
    baseTools.push('mcp__kanban__create_kanban_card', 'mcp__kanban__update_kanban_card');

    const selectedModel = modelTier === 'high'
      ? MODEL_HIGH
      : modelTier === 'fast'
        ? MODEL_FAST
        : MODEL_STANDARD;
    console.log(`[runtime] ${agentName} 모델 선택: ${selectedModel} (tier=${modelTier})`);

    const queryOptions: Parameters<typeof query>[0]['options'] = {
      ...getClaudeSdkQueryAuthOptions(agentName),
      cwd: PROJECT_DIR,
      systemPrompt: session.systemPrompt,
      model: selectedModel,
      allowedTools: baseTools,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: MAX_TURNS,
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
      // 도구 사용 기록 수집 (사실 주장 감사에 활용)
      if (message.type === 'assistant') {
        const assistantMsg = message as { type: 'assistant'; message: { content: Array<{ type: string; name?: string; text?: string }> } };
        for (const block of assistantMsg.message.content) {
          if (block.type === 'tool_use' && block.name) {
            toolUses.push({ name: block.name });
          }
          if (block.type === 'text' && block.text) {
            lastMeaningfulText = block.text;
          }
        }
      }

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
          // error_max_turns 등 비성공 결과 → Slack에 에러 메시지 전송
          sdkFailed = true;
          const isMaxTurns = resultMsg.subtype === 'error_max_turns';
          // 체크포인트: error_max_turns 시 partial result 보존
          if (isMaxTurns) {
            // SDK result에 부분 결과가 있으면 사용, 없으면 기존 resultText 사용
            partialResultText =
              ('result' in resultMsg && resultMsg.result)
                ? String(resultMsg.result)
                : resultText || lastMeaningfulText;
          }
          resultText = isMaxTurns
            ? `⚠️ 대화 한도를 초과하여 응답을 완료하지 못했습니다. 작업을 더 작은 단위로 나눠서 요청해주세요.`
            : `⚠️ 처리 중 오류가 발생했습니다 (${resultMsg.subtype}). 잠시 후 다시 시도해주세요.`;
          hitMaxTurns = isMaxTurns;
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[runtime] ${agentName} 완료 (${elapsed}s): ${resultText.slice(0, 100)}...`,
    );

    // 완료 리액션 전환
    // - 마지막 메시지(event.ts): ⚒️ → ✅/❌
    // - earlier 메시지(batchTs 중 event.ts 외): 👀 제거
    const doneReaction = sdkFailed ? 'x' : 'white_check_mark';
    if (canReact) {
      const timestamps = event.batchTs ?? [event.ts];
      for (const ts of timestamps) {
        if (ts !== event.ts) {
          // earlier 메시지: 👀 제거 (완료됐으므로)
          try {
            await slackApp.client.reactions.remove({
              channel: event.channel,
              timestamp: ts,
              name: 'eyes',
            });
          } catch {
            // eyes 리액션이 없을 수도 있음 — 무시
          }
        } else {
          // 마지막 메시지: ⚒️ → ✅/❌
          // remove와 add를 분리 — remove 실패해도 완료 리액션은 반드시 추가
          try {
            await slackApp.client.reactions.remove({
              channel: event.channel,
              timestamp: ts,
              name: 'writing_hand',
            });
          } catch {
            // ⚒️ 없을 수도 있음 — 무시
          }
          try {
            await slackApp.client.reactions.add({
              channel: event.channel,
              timestamp: ts,
              name: doneReaction,
            });
          } catch (err) {
            console.error(
              `[reaction] ${sdkFailed ? '❌' : '✅'} 완료 리액션 추가 실패:`,
              err,
            );
          }
        }
      }
    }
    activeAgents.delete(event.ts);

    // 응답 메타데이터 (소요 시간 + 모델) 추가
    const modelLabel = usedModel || 'unknown';
    const metaFooter = `\n\n_⏱ ${elapsed}s · ${modelLabel}_`;

    // ── "진행할까요?" 안티패턴 감지 ──────────────────────────
    // 프롬프트 규칙으로 금지해도 반복 위반 → 코드로 강제 차단
    const ASK_PERMISSION_PATTERNS = [
      /진행할까요\??/,
      /시작할까요\??/,
      /어떻게 할까요\??/,
      /해볼까요\??/,
      /괜찮을까요\??/,
      /승인.*기다리/,
      /확인.*부탁/,
      /의견.*주세요/,
      // "A할까요, 아니면 B할까요?" — 이진 선택 위임 패턴
      /할까요[,，]?\s*(아니면|or)\s*.{1,30}할까요/,
      // "먼저 X할까요?" / "X부터 할까요?" — 순서 결정 위임 패턴
      /먼저\s*.{1,20}할까요/,
      /부터\s*.{1,20}할까요/,
    ];
    if (resultText) {
      const matched = ASK_PERMISSION_PATTERNS.find((p) => p.test(resultText));
      if (matched) {
        console.warn(
          `[enforcement] ${agentName} "진행할까요?" 안티패턴 감지: ${matched}`,
        );
        resultText += '\n\n> ⚠️ _[bridge 자동 경고] 위 응답에 승인 요청 패턴이 감지되었습니다. 에이전트는 즉시 실행해야 합니다._';
      }
    }

    // ── 완료 보고 시 완료 조건 증거 누락 감지 ──────────────────────
    // 구현 에이전트(frontend/backend/designer)가 "완료" 선언 시 완료 조건 체크리스트 없으면 경고
    const IMPL_AGENTS = ['frontend', 'backend', 'designer'];
    const COMPLETION_PATTERNS = [/완료/, /Done/, /Fixed/, /구현.*완료/, /작업.*마무리/];
    const DOD_EVIDENCE_PATTERNS = [/완료 조건/, /에러 핸들링/, /하드코딩/, /런타임/, /빌드.*통과/, /lint.*통과/, /AC.*통과/, /체크/];
    if (
      resultText &&
      IMPL_AGENTS.includes(agentName) &&
      COMPLETION_PATTERNS.some((p) => p.test(resultText)) &&
      !DOD_EVIDENCE_PATTERNS.some((p) => p.test(resultText))
    ) {
      console.warn(
        `[enforcement] ${agentName} 완료 보고에 완료 조건 증거 누락`,
      );
      resultText += '\n\n> ⚠️ _[자동 경고] 완료 보고에 작업 완료 확인 항목이 없습니다. 빌드/런타임/에러 처리 확인 결과를 첨부하세요._';
    }

    // ── 사실 주장 패턴 감지 (도구 미사용 시 경고) ──────────────────────
    const FACTUAL_CLAIM_PATTERNS = [
      /\d+개\s*(항목|파일|TODO|미완료)/,
      /존재(합니다|하지 않습니다|함|없음)/,
      /확인(됩니다|됐습니다|했습니다)/,
      /(완료|미완료|처리|미처리)됩니다/,
      /하드코딩.*되어 있/,
    ];

    const usedSearchTools = toolUses.some((t) =>
      ['Read', 'Grep', 'Glob', 'Bash'].includes(t.name)
    );

    if (resultText && !usedSearchTools && FACTUAL_CLAIM_PATTERNS.some(p => p.test(resultText))) {
      console.warn(
        `[enforcement] ${agentName} 사실 주장에 도구 사용 기록 없음`,
      );
      resultText += '\n\n> ⚠️ _[bridge 자동 경고] 프로젝트 내부 사실을 주장했으나 Read/Grep/Glob/Bash 사용 기록이 없습니다. 코드/파일을 직접 확인 후 답변하세요._';
    }

    // ── 분석 보고 정확성 경고: 수치 주장에 소스 라인 인용 누락 감지 ──────
    const NUMERIC_CLAIM_PATTERNS = [
      /\d+\s*개\s*(쿼리|인덱스|엔드포인트|API|파일|테이블|컬럼|필드)/,
      /\d+\s*회\s*(실행|호출|조회)/,
      /\d+\s*건/,
      /최소\s*\d+\s*개/,
      /최대\s*\d+\s*개/,
    ];
    const LINE_REF_PATTERNS = [
      /\d+번?\s*줄/,
      /line\s*\d+/i,
      /:\d{1,4}[)~\-\s]/,
      /\(.*\d+[-~]\d+.*\)/,
    ];

    if (
      resultText &&
      usedSearchTools &&
      NUMERIC_CLAIM_PATTERNS.some((p) => p.test(resultText)) &&
      !LINE_REF_PATTERNS.some((p) => p.test(resultText))
    ) {
      console.warn(
        `[enforcement] ${agentName} 수치 주장에 소스 라인 인용 누락`,
      );
      resultText += '\n\n> ⚠️ _[bridge 자동 경고] 수치 주장(N개, N회 등)이 포함되어 있으나 소스 라인 번호 인용이 없습니다. 파일명:라인번호를 명시하세요._';
    }

    // bridge가 resultText를 Slack에 1회만 포스팅 (에이전트 직접 포스팅 제거)
    // statusMessageTs가 있으면 "작업중" 메시지를 결과로 업데이트, 없으면 새 메시지 포스팅
    // PM이 delegation을 포함한 경우: 메시지는 포스팅하되 status 업데이트는 hub 루프가 최종 처리
    const hasDelegation = delegationQueue.length > 0 || sequentialSteps.length > 0;
    let postedTs: string | undefined;
    if (resultText && !skipPosting) {
      const fullText = resultText + metaFooter;
      const messageBlocks = buildMessageBlocks(fullText);

      // 디버그: 테이블 블록 여부 로깅
      const hasTableBlock = messageBlocks?.some((b) => b.type === 'table');
      if (hasTableBlock) {
        console.log(
          `[runtime] ${agentName} 테이블 블록 포함 — blocks 전달`,
        );
      }

      if (statusMessageTs) {
        // 리서치 모드 선택 메시지가 있으면 hasDelegation 여부 무관하게 항상 인플레이스 업데이트
        // (delegation 중이라도 선택 버튼 메시지를 결과로 교체 — 중복 메시지 방지)
        await updateStatusMessage(
          slackApp,
          event.channel,
          statusMessageTs,
          'completed',
          agentName,
          {
            resultText: fullText,
            resultBlocks: messageBlocks
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? (messageBlocks as unknown as Array<Record<string, unknown>>)
              : undefined,
            threadTs: event.thread_ts ?? event.ts,
          },
        );
        postedTs = statusMessageTs;
        console.log(
          `[runtime] ${agentName} 상태 메시지 업데이트 완료 (결과 포함, hasDelegation=${hasDelegation})`,
        );
      } else {
        // statusMessageTs 없거나 delegation 중인 경우 새 메시지 포스팅
        // delegation 시 이 postedTs가 hub 루프의 currentPmTs(리액션 대상)로 사용됨
        try {
          const postResult =
            await rateLimited(() =>
              slackApp.client.chat.postMessage({
                channel: event.channel,
                text: fullText,
                thread_ts: event.thread_ts ?? event.ts,
                ...(messageBlocks ? { blocks: messageBlocks } : {}),
              }),
            );
          postedTs = postResult.ts;

          if ((postResult as { warning?: string }).warning) {
            console.warn(
              `[runtime] ${agentName} Slack API warning:`,
              (postResult as { warning?: string }).warning,
            );
          }

          console.log(
            `[runtime] ${agentName} Slack 포스팅 완료 (bridge)`,
          );
        } catch (postErr) {
          console.error(
            `[runtime] ${agentName} Slack 포스팅 실패:`,
            postErr,
          );
        }
      }
    } else if (!resultText) {
      console.warn(
        `[runtime] ${agentName} 빈 결과 — Slack 포스팅 건너뜀`,
      );
    }

    // resultText가 없으면 bare "완료" 메시지는 노이즈 → 상태 메시지 삭제
    // skipPosting + resultText: 상태 메시지를 "완료"로 업데이트 (결과는 Slack에 노출 안 함)
    if (statusMessageTs && skipPosting && resultText) {
      await updateStatusMessage(
        slackApp,
        event.channel,
        statusMessageTs,
        'completed',
        agentName,
      );
      // 완료 시 runContext 유지 — 30분 TTL 내 이모지(🔄)로 재실행 가능
    } else if (statusMessageTs && !resultText) {
      // 빈 결과: bare "✅ 완료" 메시지는 노이즈 — 삭제
      try {
        await slackApp.client.chat.delete({
          channel: event.channel,
          ts: statusMessageTs,
        });
        console.log(
          `[runtime] ${agentName} 빈 결과 — 상태 메시지 삭제 (노이즈 방지)`,
        );
      } catch (delErr) {
        // 삭제 실패 시 fallback: "완료"로 업데이트
        console.warn(
          `[runtime] ${agentName} 상태 메시지 삭제 실패 — fallback 업데이트:`,
          delErr,
        );
        await updateStatusMessage(
          slackApp,
          event.channel,
          statusMessageTs,
          'completed',
          agentName,
        );
      }
    }

    if (skipPosting && resultText) {
      console.log(
        `[runtime] ${agentName} skipPosting=true — Slack 포스팅 억제`,
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
    // 완료된 컨텍스트는 즉시 DB에서 삭제 — bridge 재시작 시 "중단됨"으로 잘못 표시되는 것을 방지
    deleteRunContext(controlId);
    emitAgentCompleted(
      agentName,
      event.channel,
      event.ts,
      Date.now() - startTime,
    );

    // 칸반 카드 미생성 fallback — 에이전트가 create_kanban_card를 호출하지 않은 경우 자동 생성
    if (kanbanCardId === undefined) {
      const fallbackTitle = cleanSlackText(event.text).slice(0, 200);
      const fallbackCardId = await createCard(fallbackTitle, agentName).catch(() => null);
      if (fallbackCardId !== null) {
        kanbanCardId = fallbackCardId;
        await moveToInProgress(fallbackCardId).catch(() => {});
        console.log(`[kanban-sync] fallback 카드 생성: #${fallbackCardId} "${fallbackTitle.slice(0, 40)}"`);
      }
    }

    return {
      text: resultText,
      postedTs: postedTs ?? statusMessageTs,
      statusMessageTs: statusMessageTs ?? undefined,
      delegationTargets: [...delegationQueue],
      delegationSteps: sequentialSteps.length > 0 ? [...sequentialSteps] : undefined,
      escalationReason,
      kanbanCardId,
      ...(hitMaxTurns ? {
        partialResult: partialResultText || undefined,
        isMaxTurns: true,
      } : {}),
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
      emitAgentFailed(
        agentName,
        event.channel,
        event.ts,
        'aborted by user',
        Date.now() - startTime,
      );
      // ⚒️ → ⛔ 중단 리액션 — 에이전트 메시지에만
      if (canReact) {
        try {
          await slackApp.client.reactions.remove({
            channel: event.channel,
            timestamp: event.ts,
            name: 'writing_hand',
          });
          await slackApp.client.reactions.add({
            channel: event.channel,
            timestamp: event.ts,
            name: 'black_square_for_stop',
          });
        } catch (err) {
          console.error(`[reaction] ⛔ 중단 리액션 전환 실패:`, err);
        }
      }
      // 상태 메시지 → "취소됨" (버튼 제거)
      if (statusMessageTs) {
        await updateStatusMessage(
          slackApp,
          event.channel,
          statusMessageTs,
          'cancelled',
          agentName,
        );
      }
      return { text: '', delegationTargets: [], aborted: true };
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
    emitAgentFailed(
      agentName,
      event.channel,
      event.ts,
      err instanceof Error ? err.message : String(err),
      Date.now() - startTime,
    );

    // ⚒️ → ❌ 에러 리액션 전환 — 디바운스 배치 시 모든 원본 메시지
    // remove와 add를 분리 — remove 실패해도 ❌ add는 반드시 시도
    if (canReact) {
      const timestamps = event.batchTs ?? [event.ts];
      for (const ts of timestamps) {
        try {
          await slackApp.client.reactions.remove({
            channel: event.channel,
            timestamp: ts,
            name: 'writing_hand',
          });
        } catch {
          // ⚒️ 없을 수도 있음 — 무시
        }
        try {
          await slackApp.client.reactions.add({
            channel: event.channel,
            timestamp: ts,
            name: 'x',
          });
        } catch (err) {
          console.error(
            `[reaction] ❌ 에러 리액션 추가 실패:`,
            err,
          );
        }
      }
    }

    // 상태 메시지 → "오류" (버튼 제거)
    if (statusMessageTs) {
      await updateStatusMessage(
        slackApp,
        event.channel,
        statusMessageTs,
        'error',
        agentName,
      );
    }

    // 에러 시 Slack에 알림 (에러 분류 포함)
    const errMsg = err instanceof Error ? err.message : String(err);
    const isTimeout = errMsg.includes('timeout') || errMsg.includes('타임아웃');
    const isNetwork = errMsg.includes('ECONNRESET') || errMsg.includes('ETIMEDOUT') || errMsg.includes('fetch failed');
    const isMaxTurns = errMsg.includes('max_turns') || errMsg.includes('error_max_turns');
    const errorHint = isTimeout
      ? '(시간 초과 — 작업이 너무 복잡할 수 있습니다)'
      : isNetwork
        ? '(네트워크 오류 — 일시적 문제일 수 있습니다)'
        : isMaxTurns
          ? '(대화 한도 초과 — 작업을 더 작게 나눠주세요)'
          : '';
    try {
      await rateLimited(() =>
        slackApp.client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.thread_ts ?? event.ts,
          text: `[${agentName}] 처리 중 오류가 발생했습니다. ${errorHint}\n잠시 후 다시 시도해주세요.`,
        }),
      );
    } catch (postErr) {
      console.error('[runtime] 오류 알림 포스팅 실패:', postErr);
    }

    return { text: '', delegationTargets: [] };
  } finally {
    activeAgents.delete(event.ts);
  }
};
