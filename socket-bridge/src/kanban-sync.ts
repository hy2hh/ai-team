/**
 * Kanban Sync Module
 * bridge 태스크 상태 전이 시 칸반 REST API를 fire-and-forget으로 호출
 */

const BASE_URL = process.env.KANBAN_API_URL || 'http://localhost:3001';

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
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[kanban-sync] createCard 실패: ${res.status} ${body.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
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
    const res = await fetch(`${BASE_URL}/cards/${cardId}/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column_id: COLUMN.IN_PROGRESS }),
    });
    if (!res.ok) {
      console.warn(`[kanban-sync] moveToInProgress 실패: card=${cardId} ${res.status}`);
      return;
    }
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
    // 먼저 Done 컬럼으로 이동
    const moveRes = await fetch(`${BASE_URL}/cards/${cardId}/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column_id: COLUMN.DONE }),
    });
    if (!moveRes.ok) {
      console.warn(`[kanban-sync] moveToDone 이동 실패: card=${cardId} ${moveRes.status}`);
      return;
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
    const res = await fetch(`${BASE_URL}/cards/${cardId}/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column_id: COLUMN.BLOCKED }),
    });
    if (!res.ok) {
      console.warn(`[kanban-sync] moveToBlocked 실패: card=${cardId} ${res.status}`);
      return;
    }
    console.log(`[kanban-sync] Blocked 이동: card #${cardId}`);
  } catch (err) {
    console.warn('[kanban-sync] moveToBlocked 오류:', err);
  }
};

/**
 * Bridge 시작 시 In Progress에 남은 고아 카드를 Blocked로 이동
 * - 재시작으로 중단된 작업의 카드가 In Progress에 방치되는 문제 해결
 */
export const cleanupOrphanCards = async (): Promise<number> => {
  try {
    const res = await fetch(`${BASE_URL}/boards/1`);
    if (!res.ok) {
      console.warn('[kanban-sync] cleanupOrphanCards: 보드 조회 실패');
      return 0;
    }
    const board = await res.json() as {
      columns: Array<{ id: number; cards: Array<{ id: number; title: string }> }>;
    };
    const inProgressCol = board.columns.find((c) => c.id === COLUMN.IN_PROGRESS);
    if (!inProgressCol || inProgressCol.cards.length === 0) {
      return 0;
    }

    let moved = 0;
    for (const card of inProgressCol.cards) {
      await moveToBlocked(card.id);
      moved++;
    }
    console.log(`[kanban-sync] 고아 카드 ${moved}개 → Blocked 이동 완료`);
    return moved;
  } catch (err) {
    console.warn('[kanban-sync] cleanupOrphanCards 오류:', err);
    return 0;
  }
};
