#!/usr/bin/env node
/**
 * capture.js — Playwright로 URL 스크린샷 촬영
 * Usage: node capture.js <url> <output_path> [width] [height]
 */
const { chromium } = require('playwright');

const [,, url, outputPath, width = '1440', height = '900'] = process.argv;

if (!url || !outputPath) {
  console.error('Usage: node capture.js <url> <output_path> [width] [height]');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: parseInt(width), height: parseInt(height) });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  }

  await page.waitForTimeout(500);

  const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
  if (bodyHeight > parseInt(height)) {
    await page.setViewportSize({ width: parseInt(width), height: bodyHeight });
  }

  await page.screenshot({ path: outputPath, fullPage: false });
  await browser.close();

  const fs = require('fs');
  const stat = fs.statSync(outputPath);
  console.log(`✅ 스크린샷 저장: ${outputPath} (${(stat.size / 1024).toFixed(1)} KB)`);
})();
