import { test, expect } from './fixtures';

test('debug page structure with longer wait', async ({ page, columns }) => {
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
  });

  await page.goto('/');
  // networkidle로 완전 로드 대기
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const title = await page.title();
  console.log('page title:', title);
  const bodyText = await page.locator('body').innerText().catch(() => 'FAIL');
  console.log('body text (first 500):', bodyText.substring(0, 500));

  const allTestIds = await page.locator('[data-testid]').all();
  console.log('total data-testid elements:', allTestIds.length);
  for (const el of allTestIds.slice(0, 15)) {
    const tid = await el.getAttribute('data-testid');
    console.log(' data-testid=' + tid);
  }

  const regions = await page.locator('[role="region"]').all();
  console.log('region count:', regions.length);
  for (const r of regions) {
    const label = await r.getAttribute('aria-label');
    console.log(' region aria-label=' + label);
  }
  expect(true).toBe(true);
});
