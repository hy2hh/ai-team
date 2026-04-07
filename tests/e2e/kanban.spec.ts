/**
 * 칸반 카드 CRUD e2e 테스트
 *
 * 전제 조건:
 * - 칸반 백엔드: ALLOW_TEST_RESET=true 환경변수로 포트 3001 실행
 * - 칸반 프론트엔드: 포트 3003 실행 (playwright.config.ts baseURL 참조)
 *
 * beforeEach: fixture를 통해 POST /test/reset → 모든 카드 삭제 후 DB 초기 상태 보장
 */

import { type Page } from '@playwright/test';
import { test, expect } from './fixtures';

/** 페이지 이동 후 칸반 컬럼이 렌더링될 때까지 대기 */
async function gotoKanban(page: Page) {
  await page.goto('/');
  // Next.js SSR + fetch 완료 후 컬럼이 DOM에 나타날 때까지 대기
  await page.waitForSelector('[data-testid="column-container"]', { timeout: 10000 });
}

const TEST_TITLE = 'e2e 테스트 카드';
const UPDATED_TITLE = 'e2e 수정된 카드 제목';
const BACKEND_URL = 'http://localhost:3001';

test.describe('칸반 카드 CRUD', () => {

  // ─── 1. 카드 생성 ──────────────────────────────────────────────────────────
  test('카드 생성: 제목 입력 후 생성 버튼 클릭 시 카드 목록에 노출', async ({ page, columns }) => {
    await gotoKanban(page);

    // Backlog 컬럼 로드 대기
    const backlogColumn = page.getByRole('region', { name: /Backlog 컬럼/ });
    await expect(backlogColumn).toBeVisible();

    // 카드 생성 버튼 클릭
    await backlogColumn.getByTestId('card-create-btn').click();

    // AddCardModal 표시 확인
    const addModal = page.getByRole('dialog');
    await expect(addModal).toBeVisible();

    // 제목 입력
    await addModal.getByTestId('card-title-input').fill(TEST_TITLE);

    // 추가 버튼 클릭 (submit type — 태그 추가 버튼과 구분)
    await addModal.locator('button[type="submit"]').click();

    // 모달 닫힘 확인
    await expect(addModal).not.toBeVisible();

    // Backlog 컬럼에 카드 노출 확인
    await expect(
      backlogColumn.getByTestId('card-item').filter({ hasText: TEST_TITLE })
    ).toBeVisible();
  });

  // ─── 2. 카드 조회 ──────────────────────────────────────────────────────────
  test('카드 조회: 생성된 카드가 올바른 컬럼에 위치', async ({ page, backlogColumnId, inProgressColumnId }) => {
    // API로 Backlog 컬럼에 카드 생성
    const res = await page.request.post(`${BACKEND_URL}/cards`, {
      data: { column_id: backlogColumnId, title: TEST_TITLE },
    });
    expect(res.ok()).toBeTruthy();

    await gotoKanban(page);

    // Backlog 컬럼에 카드가 있어야 함
    const backlogColumn = page.getByRole('region', { name: /Backlog 컬럼/ });
    await expect(backlogColumn).toBeVisible();
    await expect(
      backlogColumn.getByTestId('card-item').filter({ hasText: TEST_TITLE })
    ).toBeVisible();

    // In Progress 컬럼에는 없어야 함
    const inProgressColumn = page.getByRole('region', { name: /In Progress 컬럼/ });
    await expect(inProgressColumn).toBeVisible();
    await expect(
      inProgressColumn.getByTestId('card-item').filter({ hasText: TEST_TITLE })
    ).not.toBeVisible();
  });

  // ─── 3. 카드 수정 ──────────────────────────────────────────────────────────
  test('카드 수정: 제목 변경 후 저장 시 변경 내용 반영', async ({ page, backlogColumnId }) => {
    // API로 카드 생성
    const res = await page.request.post(`${BACKEND_URL}/cards`, {
      data: { column_id: backlogColumnId, title: TEST_TITLE },
    });
    expect(res.ok()).toBeTruthy();

    await gotoKanban(page);

    const backlogColumn = page.getByRole('region', { name: /Backlog 컬럼/ });

    // 카드 아이템 확인
    const cardItem = backlogColumn.getByTestId('card-item').filter({ hasText: TEST_TITLE });
    await expect(cardItem).toBeVisible();

    // card-edit-btn(내부 클릭 영역) 클릭 → 상세 모달 열기
    await cardItem.getByTestId('card-edit-btn').click();

    // 상세 모달 표시 확인
    const detailModal = page.getByRole('dialog');
    await expect(detailModal).toBeVisible();

    // 제목 클릭 → 인라인 편집 모드 진입
    await detailModal.locator('#detail-modal-title').click();

    // 편집 인풋 등장 확인
    const titleInput = detailModal.getByLabel('카드 제목 편집');
    await expect(titleInput).toBeVisible();

    // 제목 변경 후 Enter로 저장
    await titleInput.clear();
    await titleInput.fill(UPDATED_TITLE);
    await titleInput.press('Enter');

    // 저장 토스트 확인
    await expect(page.getByText('저장되었습니다')).toBeVisible();

    // 모달 닫기
    await detailModal.getByLabel('모달 닫기').click();
    await expect(detailModal).not.toBeVisible();

    // 카드 목록에 변경된 제목 반영 확인
    await expect(
      backlogColumn.getByTestId('card-item').filter({ hasText: UPDATED_TITLE })
    ).toBeVisible();

    // 이전 제목은 더 이상 없어야 함
    await expect(
      backlogColumn.getByTestId('card-item').filter({ hasText: TEST_TITLE })
    ).not.toBeVisible();
  });

  // ─── 4. 카드 삭제 ──────────────────────────────────────────────────────────
  test('카드 삭제: 삭제 버튼 클릭 시 카드 목록에서 제거', async ({ page, backlogColumnId }) => {
    // API로 카드 생성
    const res = await page.request.post(`${BACKEND_URL}/cards`, {
      data: { column_id: backlogColumnId, title: TEST_TITLE },
    });
    expect(res.ok()).toBeTruthy();

    await gotoKanban(page);

    const backlogColumn = page.getByRole('region', { name: /Backlog 컬럼/ });

    // 카드 아이템 확인
    const cardItem = backlogColumn.getByTestId('card-item').filter({ hasText: TEST_TITLE });
    await expect(cardItem).toBeVisible();

    // 카드에 호버 → 삭제 버튼 가시화 (CSS opacity: 0 → 1)
    await cardItem.hover();

    // 삭제 버튼 클릭 (force: true로 opacity 미전환 시 대비)
    await cardItem.getByTestId('card-delete-btn').click({ force: true });

    // 카드가 목록에서 제거됨 확인
    await expect(cardItem).not.toBeVisible();
  });

});
