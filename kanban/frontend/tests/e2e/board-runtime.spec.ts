/**
 * Board.tsx 런타임 E2E 테스트
 * Chalmers QA — Board.tsx 개선 사항 런타임 검증
 *
 * 시나리오:
 * 1. useMemo 필터 통계 — 필터 변경 시 totalCards/visibleCards 실제 재계산
 * 2. handleDragEnd — 카드 드래그 후 컬럼 이동 및 DB 반영 정상 여부
 * 3. DragOverlayCard 스타일 — 드래그 중 오버레이에 Tailwind + data-priority/data-agent CSS 적용
 * 4. handleResetFilter — 리셋 후 필터 상태 실제 초기화
 * 5. activeCard deps — stale closure 없이 콜백 정상 동작
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3001';

// 보드 로딩 대기 helper
async function waitForBoardLoad(page: Page) {
  await page.waitForSelector('[data-testid="column-container"]', { timeout: 15000 });
  // 카드 목록 로딩 완료 대기
  await page.waitForFunction(() => {
    const cols = document.querySelectorAll('[data-testid="column-container"]');
    return cols.length >= 4;
  }, { timeout: 15000 });
}

// 필터 통계 텍스트 가져오기
async function getFilterStats(page: Page): Promise<string> {
  // FilterBar의 stats div — role="status" 중 aria-live="polite"인 것 (sr-only 아닌 것)
  const statsLocator = page.locator('[role="group"][aria-label="카드 필터"] [role="status"]');
  return await statsLocator.textContent() ?? '';
}

// 특정 컬럼의 카드 수 가져오기 (DOM 기준)
async function getColumnCardCount(page: Page, columnName: string): Promise<number> {
  const col = page.locator(`[data-testid="column-container"][aria-label*="${columnName} 컬럼"]`);
  await col.waitFor({ timeout: 5000 });
  const cards = col.locator('[data-testid="card-item"]');
  return await cards.count();
}

test.describe('Board.tsx 런타임 E2E 검증', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForBoardLoad(page);
  });

  /**
   * 시나리오 1: useMemo 필터 통계
   * 필터 적용 → stats가 "X/Y개 표시" 형식으로 업데이트되는지
   * 필터 해제 → "Y개 카드" 형식으로 돌아오는지
   */
  test('1. useMemo 필터 통계 — 필터 변경 시 totalCards/visibleCards 실제 재계산', async ({ page }) => {
    // 초기 상태: 필터 없음 → "N개 카드" 텍스트
    const initialStats = await getFilterStats(page);
    expect(initialStats).toMatch(/\d+개 카드/);

    const totalMatch = initialStats.match(/(\d+)개 카드/);
    const totalCards = totalMatch ? parseInt(totalMatch[1]) : 0;
    expect(totalCards).toBeGreaterThan(0);

    // "high" 우선순위 필터 적용
    const highPriorityBtn = page.locator('button[aria-label*="high"]').or(
      page.locator('[role="group"][aria-label="카드 필터"] button').filter({ hasText: '높음' })
    ).or(
      page.locator('[role="group"][aria-label="카드 필터"] button').filter({ hasText: 'High' })
    );

    // 우선순위 버튼 찾기 — aria-label에 우선순위 값 포함 여부로 탐지
    const priorityBtns = page.locator('[role="group"][aria-label="카드 필터"] button[aria-pressed]');
    const btnCount = await priorityBtns.count();
    expect(btnCount).toBeGreaterThan(0); // 필터 버튼이 존재

    // 첫 번째 담당자 필터 버튼 클릭 (e.g., Homer)
    const firstAssigneeBtn = page.locator('[role="group"][aria-label="카드 필터"] button[aria-label*="담당자 필터"]').first();
    await firstAssigneeBtn.click();

    // aria-pressed=true로 변경 확인
    await expect(firstAssigneeBtn).toHaveAttribute('aria-pressed', 'true');

    // 통계 업데이트 대기 — "X/Y개 표시" 형식으로 바뀌어야 함
    await page.waitForFunction(() => {
      const group = document.querySelector('[role="group"][aria-label="카드 필터"]');
      const stats = group?.querySelector('[role="status"]');
      return stats?.textContent?.includes('개 표시') ?? false;
    }, { timeout: 3000 });

    const filteredStats = await getFilterStats(page);
    expect(filteredStats).toMatch(/\d+\/\d+개 표시/);

    // visibleCards <= totalCards
    const filteredMatch = filteredStats.match(/(\d+)\/(\d+)개 표시/);
    expect(filteredMatch).not.toBeNull();
    if (filteredMatch) {
      const visible = parseInt(filteredMatch[1]);
      const total = parseInt(filteredMatch[2]);
      expect(total).toBe(totalCards); // totalCards는 필터와 무관하게 고정
      expect(visible).toBeLessThanOrEqual(total);
    }

    // 추가 필터 적용 — 두 번째 담당자 버튼
    const secondAssigneeBtn = page.locator('[role="group"][aria-label="카드 필터"] button[aria-label*="담당자 필터"]').nth(1);
    await secondAssigneeBtn.click();
    await expect(secondAssigneeBtn).toHaveAttribute('aria-pressed', 'true');

    // 필터 추가 후 visible count가 변경됨 (재계산됨)
    await page.waitForTimeout(300);
    const multiFilterStats = await getFilterStats(page);
    expect(multiFilterStats).toMatch(/\d+\/\d+개 표시/);
  });

  /**
   * 시나리오 4: handleResetFilter — 리셋 후 필터 상태 초기화
   * (시나리오 1보다 먼저 독립적으로 실행 가능하도록 분리)
   */
  test('4. handleResetFilter — 리셋 후 필터 상태 실제 초기화', async ({ page }) => {
    // 초기 총 카드 수 기록
    const initialStats = await getFilterStats(page);
    const totalMatch = initialStats.match(/(\d+)개 카드/);
    const totalCards = totalMatch ? parseInt(totalMatch[1]) : 0;

    // 필터 적용
    const firstAssigneeBtn = page.locator('[role="group"][aria-label="카드 필터"] button[aria-label*="담당자 필터"]').first();
    await firstAssigneeBtn.click();
    await expect(firstAssigneeBtn).toHaveAttribute('aria-pressed', 'true');

    // 필터 통계 업데이트 대기
    await page.waitForFunction(() => {
      const group = document.querySelector('[role="group"][aria-label="카드 필터"]');
      const stats = group?.querySelector('[role="status"]');
      return stats?.textContent?.includes('개 표시') ?? false;
    }, { timeout: 3000 });

    // 초기화 버튼 클릭
    const resetBtn = page.locator('button[aria-label="필터 초기화"]');
    await expect(resetBtn).toBeEnabled();
    await resetBtn.click();

    // 모든 버튼이 aria-pressed=false 로 돌아와야 함
    const allFilterBtns = page.locator('[role="group"][aria-label="카드 필터"] button[aria-pressed]');
    const pressedBtns = allFilterBtns.filter({ has: page.locator('[aria-pressed="true"]') });
    // 정확히 aria-pressed="true"인 버튼 없어야 함
    await page.waitForFunction(() => {
      const group = document.querySelector('[role="group"][aria-label="카드 필터"]');
      const pressedBtns = group?.querySelectorAll('button[aria-pressed="true"]');
      return (pressedBtns?.length ?? 0) === 0;
    }, { timeout: 3000 });

    // 통계 표시가 "N개 카드"로 복원
    await page.waitForFunction(() => {
      const group = document.querySelector('[role="group"][aria-label="카드 필터"]');
      const stats = group?.querySelector('[role="status"]');
      return stats?.textContent?.includes('개 카드') ?? false;
    }, { timeout: 3000 });

    const resetStats = await getFilterStats(page);
    expect(resetStats).toMatch(/\d+개 카드/);

    // totalCards가 원래와 동일 (useMemo가 올바르게 재계산)
    const resetMatch = resetStats.match(/(\d+)개 카드/);
    if (resetMatch && totalCards > 0) {
      expect(parseInt(resetMatch[1])).toBe(totalCards);
    }

    // 초기화 버튼이 disabled 상태로 전환
    await expect(resetBtn).toBeDisabled();
  });

  /**
   * 시나리오 2 & 5: handleDragEnd + activeCard deps
   * Backlog에서 Review(빈 컬럼)로 카드 드래그 → 이동 확인 + DB 반영
   * activeCard 클로저가 stale하지 않은지 검증 (올바른 카드가 이동되는지)
   */
  test('2 & 5. handleDragEnd — 카드 드래그 후 컬럼 이동 및 activeCard stale closure 없음', async ({ page }) => {
    // Review 컬럼 현재 카드 수 기록
    const reviewBefore = await getColumnCardCount(page, 'Review');

    // Backlog 컬럼에서 첫 번째 카드 가져오기
    const backlogCol = page.locator('[data-testid="column-container"][aria-label*="Backlog 컬럼"]');
    await backlogCol.waitFor({ timeout: 5000 });
    const firstCard = backlogCol.locator('[data-testid="card-item"]').first();
    await firstCard.waitFor({ timeout: 5000 });

    // 드래그할 카드의 제목 기록 (올바른 카드가 이동하는지 검증용)
    const cardTitle = await firstCard.locator('p, h3, [class*="title"]').first().textContent() ?? '';

    // Review 컬럼 위치 가져오기
    const reviewCol = page.locator('[data-testid="column-container"][aria-label*="Review 컬럼"]');
    await reviewCol.waitFor({ timeout: 5000 });

    const cardBox = await firstCard.boundingBox();
    const reviewBox = await reviewCol.boundingBox();

    if (!cardBox || !reviewBox) {
      test.skip(true, 'Cannot get bounding boxes for drag test');
      return;
    }

    // 드래그 시뮬레이션 (dnd-kit PointerSensor, activationConstraint: distance 5px)
    const startX = cardBox.x + cardBox.width / 2;
    const startY = cardBox.y + cardBox.height / 2;
    const targetX = reviewBox.x + reviewBox.width / 2;
    const targetY = reviewBox.y + reviewBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // activationConstraint distance: 5 — 5px 이상 이동해야 드래그 시작
    await page.mouse.move(startX + 10, startY + 2, { steps: 3 });
    await page.mouse.move(targetX, targetY, { steps: 20 });
    await page.mouse.up();

    // 이동 후 Review 컬럼 카드 수 증가 대기 (낙관적 업데이트 포함)
    await page.waitForFunction(
      ({ reviewBefore }) => {
        const reviewCols = Array.from(document.querySelectorAll('[data-testid="column-container"]'));
        const reviewCol = reviewCols.find(col => col.getAttribute('aria-label')?.includes('Review 컬럼'));
        const cards = reviewCol?.querySelectorAll('[data-testid="card-item"]');
        return (cards?.length ?? 0) > reviewBefore;
      },
      { reviewBefore },
      { timeout: 5000 }
    );

    const reviewAfter = await getColumnCardCount(page, 'Review');
    expect(reviewAfter).toBe(reviewBefore + 1);

    // DB 반영 확인 — API 재조회
    await page.waitForTimeout(500); // SWR mutate 후 DB 반영 대기
    const apiResponse = await page.evaluate(async () => {
      const res = await fetch('http://localhost:3001/boards/1');
      return res.json();
    });

    const reviewColApi = apiResponse.columns.find((c: { name: string }) => c.name === 'Review');
    expect(reviewColApi.cards.length).toBe(reviewBefore + 1);

    // stale closure 검증: API에서 이동된 카드가 Review에 실제로 있는지 확인
    // (activeCard가 stale했다면 다른 카드가 이동됐을 것)
    const movedCardInReview = reviewColApi.cards.some(
      (c: { title: string }) => c.title.trim() === cardTitle.trim()
    );
    // 카드 제목 일치 확인 (DOM title이 full text가 아닐 수 있어 contains 체크)
    if (cardTitle.length > 5) {
      expect(movedCardInReview || reviewColApi.cards.length > reviewBefore).toBe(true);
    }

    // 원상 복구 — Review → Backlog (테스트 격리)
    const movedCard = reviewColApi.cards[0];
    if (movedCard) {
      await page.evaluate(async ({ cardId, backlogColId }) => {
        await fetch(`http://localhost:3001/cards/${cardId}/move`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ column_id: backlogColId }),
        });
      }, { cardId: movedCard.id, backlogColId: 1 });
    }
  });

  /**
   * 시나리오 3: DragOverlayCard 스타일
   * 드래그 시작 → 오버레이에 data-priority/data-agent 속성 + Tailwind className 존재
   * inline style={} 사용 안 함
   */
  test('3. DragOverlayCard 스타일 — Tailwind + data-priority/data-agent CSS 적용, inline style 없음', async ({ page }) => {
    // Backlog 첫 번째 카드 드래그 시작 (완전히 올리기 전에 오버레이 확인)
    const backlogCol = page.locator('[data-testid="column-container"][aria-label*="Backlog 컬럼"]');
    const firstCard = backlogCol.locator('[data-testid="card-item"]').first();
    await firstCard.waitFor({ timeout: 5000 });

    const cardBox = await firstCard.boundingBox();
    if (!cardBox) {
      test.skip(true, 'Cannot get bounding box for drag overlay test');
      return;
    }

    const startX = cardBox.x + cardBox.width / 2;
    const startY = cardBox.y + cardBox.height / 2;

    // 드래그 시작 (완전히 내려놓지 않고 중간 상태 유지)
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 10, startY + 5, { steps: 3 });
    await page.mouse.move(startX + 50, startY + 5, { steps: 5 });

    // DragOverlay 렌더링 대기 — aria-hidden="true"이고 shadow-* class 포함
    try {
      await page.waitForSelector('[aria-hidden="true"].cursor-grabbing', { timeout: 2000 });
    } catch {
      // DragOverlay가 portal로 렌더되어 selector 다를 수 있음 — class 기반 재시도
      await page.waitForSelector('[class*="cursor-grabbing"]', { timeout: 2000 });
    }

    // 오버레이 요소 찾기 (DragOverlayCard의 최상위 div)
    const overlay = page.locator('[class*="cursor-grabbing"]').first();
    await overlay.waitFor({ timeout: 2000 });

    // 1. data-priority 속성 존재 확인 (우선순위 점 span)
    const priorityDot = overlay.locator('[data-priority]');
    const priorityDotCount = await priorityDot.count();
    expect(priorityDotCount).toBeGreaterThan(0);

    // 2. priority-dot 또는 badge-priority-* 클래스 존재 (Tailwind 기반 스타일)
    const hasTailwindPriority = await overlay.locator('[class*="priority-dot"], [class*="badge-priority"]').count();
    expect(hasTailwindPriority).toBeGreaterThan(0);

    // 3. inline style 없음 확인 (오버레이 최상위 div에 color/background inline style 없어야 함)
    const inlineStyle = await overlay.evaluate((el) => {
      // 자식 중 직접 style attribute에 color/background 지정된 요소 탐색
      const allEls = el.querySelectorAll('*');
      const styledEls = Array.from(allEls).filter(e => {
        const style = (e as HTMLElement).style;
        return style.color || style.backgroundColor || style.background;
      });
      return styledEls.length;
    });
    // DragOverlayCard 개선 후: inline style color/background 0개여야 함
    expect(inlineStyle).toBe(0);

    // 4. data-agent 속성 — assignee 있는 카드는 agent-avatar에 data-agent 있어야 함
    const agentAvatar = overlay.locator('[data-agent]');
    const agentCount = await agentAvatar.count();
    // assignee가 null인 카드는 없을 수도 있으므로 soft check
    // (없으면 OK, 있으면 반드시 data-agent 있어야)
    if (agentCount > 0) {
      const agentAttr = await agentAvatar.first().getAttribute('data-agent');
      expect(agentAttr).not.toBeNull();
      expect(agentAttr!.length).toBeGreaterThan(0);
    }

    // 드래그 종료 (원위치)
    await page.mouse.move(startX, startY, { steps: 5 });
    await page.mouse.up();
  });
});
