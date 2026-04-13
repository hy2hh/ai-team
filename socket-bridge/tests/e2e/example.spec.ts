import { test, expect } from '@playwright/test';

/**
 * 플레이스홀더 테스트 — Playwright 인프라 검증용
 * 실제 E2E 테스트는 이 파일을 기반으로 확장.
 */
test.describe('Kanban Board E2E (Placeholder)', () => {
  test('should have correct page title', async ({ page }) => {
    // 실제 서버가 실행 중일 때 활성화
    // await page.goto('/');
    // await expect(page).toHaveTitle(/Kanban/);
    expect(true).toBe(true); // infra smoke test
  });
});
