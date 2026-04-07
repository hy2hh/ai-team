import { test as base, expect } from '@playwright/test';

const BACKEND_URL = 'http://localhost:3001';

export interface Column {
  id: number;
  name: string;
  position: number;
  wip_limit: number | null;
}

export interface KanbanFixtures {
  /** 보드의 컬럼 목록 (position 순) */
  columns: Column[];
  /** Backlog 컬럼 ID */
  backlogColumnId: number;
  /** In Progress 컬럼 ID */
  inProgressColumnId: number;
}

/**
 * e2e 테스트용 베이스 fixture
 *
 * 사용 전 조건:
 * - 칸반 백엔드가 ALLOW_TEST_RESET=true 로 실행 중 (port 3001)
 * - 칸반 프론트엔드가 실행 중 (port 3000)
 *
 * beforeEach: POST /test/reset → 모든 카드 삭제 후 컬럼 목록 반환
 */
export const test = base.extend<KanbanFixtures>({
  columns: async ({}, use) => {
    const res = await fetch(`${BACKEND_URL}/test/reset`, { method: 'POST' });
    if (!res.ok) {
      throw new Error(
        `[fixture] POST /test/reset 실패 (${res.status}). ` +
        `백엔드를 ALLOW_TEST_RESET=true 로 실행했는지 확인하세요.`
      );
    }
    const data = await res.json() as { ok: boolean; columns: Column[] };
    await use(data.columns);
  },

  backlogColumnId: async ({ columns }, use) => {
    const col = columns.find(c => c.name === 'Backlog');
    if (!col) throw new Error('[fixture] Backlog 컬럼을 찾을 수 없습니다');
    await use(col.id);
  },

  inProgressColumnId: async ({ columns }, use) => {
    const col = columns.find(c => c.name === 'In Progress');
    if (!col) throw new Error('[fixture] In Progress 컬럼을 찾을 수 없습니다');
    await use(col.id);
  },
});

export { expect };
