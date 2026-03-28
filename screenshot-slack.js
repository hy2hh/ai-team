const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('file:///Users/sid/git/ai-team/kanban-thread-slack.html');
  await page.waitForTimeout(500);
  const body = await page.$('body');
  await body.screenshot({ path: '/Users/sid/git/ai-team/kanban-thread-slack.png' });
  await browser.close();
})();
