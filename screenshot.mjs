import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'kanban-thread-summary.html');
const outPath = path.join(__dirname, 'kanban-thread-summary.png');

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  headless: 'new',
});

const page = await browser.newPage();
await page.setViewport({ width: 1040, height: 900, deviceScaleFactor: 2 });
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

// Full page screenshot
const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
await page.setViewport({ width: 1040, height: bodyHeight + 80, deviceScaleFactor: 2 });
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

await page.screenshot({ path: outPath, fullPage: true });
await browser.close();

const stat = fs.statSync(outPath);
console.log(`✅ PNG 생성 완료: ${outPath}`);
console.log(`   크기: ${(stat.size / 1024).toFixed(1)} KB`);
