/**
 * Kanban Sync Module
 * bridge 태스크 상태 전이 시 칸반 REST API를 fire-and-forget으로 호출
 */
import { randomUUID } from 'crypto';
import { withRetry } from './retry.js';

const BASE_URL = process.env.KANBAN_API_URL || 'http://localhost:3001';

/** bridge 세션 고유 ID — 재시작마다 새로 생성 */
export const SESSION_ID = randomUUID();

/** 칸반 API용 경량 재시도 옵션 (localhost → 짧은 backoff) */
const KANBAN_RETRY = {
  maxRetries: 2,
  baseDelayMs: 200,
  maxDelayMs: 1_000,
  label: 'kanban-api',
} as const;

/** 컬럼 ID 매핑 */
const COLUMN = {
  BACKLOG: 1,
  IN_PROGRESS: 2,
  DONE: 4,
  BLOCKED: 5,
} as const;

/** 에이전트 role → 칸반 담당자 이름 매핑 */
const AGENT_DISPLAY_NAME: Record<string, string> = {
  pm: 'Marge',
  designer: 'Krusty',
  frontend: 'Bart',
  backend: 'Homer',
  researcher: 'Lisa',
  secops: 'Wiggum',
  qa: 'Chalmers',
};

/** <@USER_ID>: 프리픽스 및 에이전트명: 프리픽스 제거 */
const stripLinePrefix = (line: string): string =>
  line
    .replace(/^<@[A-Z0-9]+>:\s*/i, '')
    .replace(/^(Marge|Homer|Bart|Lisa|Krusty|Wiggum|Chalmers|sid):\s*/i, '')
    .trim();

/** Slack 마크업 제거 (멘션, URL, 이모지, 볼드) */
const stripSlackMarkup = (text: string): string =>
  text
    .replace(/<@[A-Z0-9]+>/gi, '')
    .replace(/<(https?:\/\/[^|>]+)\|?[^>]*>/g, '')
    .replace(/:[a-z_]+:/g, '')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

/** 의미 없는 Slack 시스템 텍스트 */
const MEANINGLESS = new Set([
  '[새 메시지]', '새 메시지', '(제목 없음)', '[new message]',
]);

/**
 * Slack 원본 텍스트에서 실제 사용자 요청만 추출
 * - [이전 대화] 컨텍스트 블록 제거 (내부 `<@USER>:` 프리픽스 정리 포함)
 * - <@USER_ID> 멘션, URL, 이모지, 볼드 마크업 제거
 * - [순차 위임 step N] 프리픽스 보존 (태스크 식별용)
 */
export const cleanSlackText = (raw: string): string => {
  let text = raw;

  // [이전 대화] 블록 처리: 마지막 실제 요청 추출
  const contextIdx = text.lastIndexOf('[이전 대화]');
  if (contextIdx !== -1) {
    // [이전 대화] 앞에 독립 텍스트가 있으면 그것이 실제 요청일 수 있음
    const beforeContext = text.slice(0, contextIdx).trim();

    // [이전 대화] 이후 줄에서 의미 있는 내용 역순 탐색
    const afterContext = text.slice(contextIdx);
    const lines = afterContext.split('\n').map((l) => l.trim()).filter(Boolean);

    const lastMeaningful = lines
      .reverse()
      .find((l) => {
        const stripped = stripLinePrefix(l);
        const cleaned = stripSlackMarkup(stripped);
        return (
          cleaned.length > 0 &&
          !cleaned.startsWith('[이전 대화]') &&
          !cleaned.startsWith('[원본 요청]') &&
          !MEANINGLESS.has(cleaned)
        );
      });

    if (lastMeaningful) {
      text = stripLinePrefix(lastMeaningful);
    } else if (beforeContext) {
      text = beforeContext;
    }
  }

  text = stripSlackMarkup(text);

  if (!text || MEANINGLESS.has(text)) {
    return '(제목 없음)';
  }

  return text;
};

/**
 * Backlog 컬럼에 카드 생성
 * @returns 생성된 카드 ID (실패 시 null)
 */
export const createCard = async (
  title: string,
  agent: string,
  description?: string,
): Promise<number | null> => {
  try {
    const assignee = AGENT_DISPLAY_NAME[agent] ?? agent;
    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          column_id: COLUMN.BACKLOG,
          title: title.slice(0, 400),
          description: description?.slice(0, 500) ?? '',
          assignee,
          priority: 'medium',
          progress: 0,
          session_id: SESSION_ID,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`${res.status} ${body.slice(0, 200)}`);
      }
      return res.json();
    }, KANBAN_RETRY);
    console.log(`[kanban-sync] 카드 생성: #${data.id} "${title.slice(0, 40)}"`);
    return data.id as number;
  } catch (err) {
    console.warn('[kanban-sync] createCard 오류:', err);
    return null;
  }
};

/**
 * 카드 필드 부분 업데이트 (title, description, progress 등)
 */
export const updateCard = async (
  cardId: number,
  fields: { title?: string; description?: string; progress?: number; priority?: string },
): Promise<void> => {
  try {
    const res = await fetch(`${BASE_URL}/cards/${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[kanban-sync] updateCard 실패: card=${cardId} ${res.status} ${body.slice(0, 200)}`);
      return;
    }
    console.log(`[kanban-sync] 카드 업데이트: #${cardId} ${JSON.stringify(fields).slice(0, 80)}`);
  } catch (err) {
    console.warn('[kanban-sync] updateCard 오류:', err);
  }
};

/**
 * 카드를 In Progress 컬럼으로 이동
 */
export const moveToInProgress = async (cardId: number): Promise<void> => {
  try {
    await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/cards/${cardId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: COLUMN.IN_PROGRESS }),
      });
      if (!res.ok) {
        throw new Error(`${res.status}`);
      }
    }, KANBAN_RETRY);
    console.log(`[kanban-sync] In Progress 이동: card #${cardId}`);
  } catch (err) {
    console.warn('[kanban-sync] moveToInProgress 오류:', err);
  }
};

/**
 * 카드를 Done 컬럼으로 이동 + progress=100
 */
export const moveToDone = async (cardId: number): Promise<void> => {
  try {
    await withRetry(async () => {
      const moveRes = await fetch(`${BASE_URL}/cards/${cardId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: COLUMN.DONE }),
      });
      if (!moveRes.ok) {
        throw new Error(`move ${moveRes.status}`);
      }
      // progress=100 업데이트 (별도 PATCH)
      const updateRes = await fetch(`${BASE_URL}/cards/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: 100 }),
      });
      if (!updateRes.ok) {
        console.warn(`[kanban-sync] moveToDone progress 업데이트 실패: card=${cardId} ${updateRes.status}`);
      }
    }, KANBAN_RETRY);
    console.log(`[kanban-sync] Done 이동: card #${cardId}`);
  } catch (err) {
    console.warn('[kanban-sync] moveToDone 오류:', err);
  }
};

/**
 * 카드를 Blocked 컬럼으로 이동
 */
export const moveToBlocked = async (cardId: number): Promise<void> => {
  try {
    await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/cards/${cardId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: COLUMN.BLOCKED }),
      });
      if (!res.ok) {
        throw new Error(`${res.status}`);
      }
    }, KANBAN_RETRY);
    console.log(`[kanban-sync] Blocked 이동: card #${cardId}`);
  } catch (err) {
    console.warn('[kanban-sync] moveToBlocked 오류:', err);
  }
};

/**
 * Bridge 시작 시 전체 보드 정리
 * 1. In Progress 카드 → Blocked 이동
 * 2. Backlog/Review/Blocked 카드 bulk 삭제 (queue 활성 카드 제외)
 * 3. Done 카드 중 3일(72h) 이상 된 것 삭제
 */
export const cleanupOrphanCards = async (): Promise<number> => {
  // 동적 import로 순환 의존성 방지
  const { getActiveKanbanCardIds } = await import(
    './queue-manager.js'
  );

  try {
    const res = await fetch(`${BASE_URL}/boards/1`);
    if (!res.ok) {
      console.warn(
        '[kanban-sync] cleanupOrphanCards: 보드 조회 실패',
      );
      return 0;
    }
    const board = (await res.json()) as {
      columns: Array<{
        id: number;
        cards: Array<{ id: number; title: string }>;
      }>;
    };

    // Step 1: In Progress 카드 → Blocked 이동
    const inProgressCol = board.columns.find(
      (c) => c.id === COLUMN.IN_PROGRESS,
    );
    let moved = 0;
    if (inProgressCol) {
      for (const card of inProgressCol.cards) {
        await moveToBlocked(card.id);
        moved++;
      }
    }
    if (moved > 0) {
      console.log(
        `[kanban-sync] 고아 카드 ${moved}개 → Blocked 이동`,
      );
    }

    // Step 2: queue 활성 카드 ID 조회 (보호 대상)
    const activeCardIds = getActiveKanbanCardIds();

    // Step 3: Backlog/Review/Blocked bulk 삭제
    const bulkRes = await fetch(`${BASE_URL}/cards/cleanup`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        columns: [
          COLUMN.BACKLOG,
          3, // Review
          COLUMN.BLOCKED,
        ],
        exclude_card_ids:
          activeCardIds.length > 0 ? activeCardIds : undefined,
      }),
    });
    const bulkData = bulkRes.ok
      ? ((await bulkRes.json()) as { deleted: number })
      : { deleted: 0 };

    // Step 4: Done 카드 TTL (3일)
    const threeDaysAgo = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);
    const doneRes = await fetch(`${BASE_URL}/cards/cleanup`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        columns: [COLUMN.DONE],
        before: threeDaysAgo,
      }),
    });
    const doneData = doneRes.ok
      ? ((await doneRes.json()) as { deleted: number })
      : { deleted: 0 };

    const total = moved + bulkData.deleted + doneData.deleted;
    console.log(
      `[kanban-sync] cleanup 완료: Blocked이동=${moved} stale삭제=${bulkData.deleted} Done만료=${doneData.deleted}`,
    );
    return total;
  } catch (err) {
    console.warn('[kanban-sync] cleanupOrphanCards 오류:', err);
    return 0;
  }
};
