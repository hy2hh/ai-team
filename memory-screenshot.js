const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const outDir = '/Users/sid/git/ai-team';
  const shots = [];

  async function capture(page, name) {
    await page.waitForTimeout(800);
    const filePath = path.join(outDir, `memory-${name}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    shots.push({ name, filePath });
    console.log(`✅ ${name}`);
  }

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // 로그인
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle' });
  await capture(page, '1-login');

  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:3002/', { timeout: 5000 });
  await page.waitForTimeout(1000);

  // 메인 화면
  await capture(page, '2-main');

  // decisions 폴더 클릭 (펼치기)
  await page.click('text=decisions');
  await page.waitForTimeout(800);
  await capture(page, '3-folder-open');

  // 파일 클릭 - decisions 안의 첫 파일
  const fileLinks = await page.$$('a[href*="/decisions/"]');
  if (fileLinks.length > 0) {
    await fileLinks[0].click();
    await page.waitForTimeout(1500);
    await capture(page, '4-file-view');
  }

  // index.md 클릭
  await page.click('text=index.md');
  await page.waitForTimeout(1500);
  await capture(page, '5-index-file');

  await browser.close();
  console.log('\n📸 완료:', shots.length, '장');
})();
