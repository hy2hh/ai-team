/**
 * generate-report.mjs
 *
 * 상세 조사 보고서를 PDF로 생성하고 Slack에 업로드합니다.
 *
 * 사용법:
 *   node scripts/generate-report.mjs --report <json-file> --channel <channel-id> --thread <thread-ts>
 *
 * JSON 구조 예시: scripts/report-template.json 참조
 */

import puppeteer from 'puppeteer-core';
import { WebClient } from '../socket-bridge/node_modules/@slack/web-api/dist/index.js';
import { config } from '../socket-bridge/node_modules/dotenv/lib/main.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

// ─── CLI 인수 파싱 ───────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const reportFile = getArg('--report');
const channel = getArg('--channel');
const threadTs = getArg('--thread');
const outputPath = getArg('--output') ?? join(__dirname, '..', '/tmp/report.pdf');

if (!reportFile) {
  console.error('❌ --report <json-file> 인수가 필요합니다.');
  process.exit(1);
}

// ─── 보고서 데이터 로드 ──────────────────────────────────────
let report;
try {
  report = JSON.parse(readFileSync(reportFile, 'utf-8'));
} catch (e) {
  console.error(`❌ 보고서 파일 로드 실패: ${e.message}`);
  process.exit(1);
}

// ─── HTML 생성 ───────────────────────────────────────────────
function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSection(section) {
  const items = (section.items ?? []).map(item => {
    if (typeof item === 'string') {
      return `<li>${escapeHtml(item)}</li>`;
    }
    if (item.label) {
      return `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</li>`;
    }
    return `<li>${escapeHtml(JSON.stringify(item))}</li>`;
  }).join('\n');

  const subsections = (section.subsections ?? []).map(sub => `
    <div class="subsection">
      <h4>${escapeHtml(sub.title)}</h4>
      ${sub.content ? `<p>${escapeHtml(sub.content).replace(/\n/g, '<br>')}</p>` : ''}
      ${sub.items?.length ? `<ul>${sub.items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : ''}
      ${sub.code ? `<pre><code>${escapeHtml(sub.code)}</code></pre>` : ''}
    </div>
  `).join('');

  return `
    <div class="section">
      <h3>${escapeHtml(section.title)}</h3>
      ${section.summary ? `<p class="summary">${escapeHtml(section.summary)}</p>` : ''}
      ${items ? `<ul>${items}</ul>` : ''}
      ${section.content ? `<p>${escapeHtml(section.content).replace(/\n/g, '<br>')}</p>` : ''}
      ${subsections}
    </div>
  `;
}

function generateHtml(report) {
  const sections = (report.sections ?? []).map(renderSection).join('\n');
  const date = report.date ?? new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
      font-size: 13px;
      line-height: 1.7;
      color: #1a1a2e;
      background: #ffffff;
      padding: 40px 48px;
      max-width: 860px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 3px solid #4a6cf7;
      padding-bottom: 20px;
      margin-bottom: 32px;
    }
    .header .badge {
      display: inline-block;
      background: #4a6cf7;
      color: white;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      color: #1a1a2e;
      margin-bottom: 6px;
    }
    .meta {
      font-size: 12px;
      color: #666;
    }
    .meta span { margin-right: 16px; }
    .executive-summary {
      background: #f0f4ff;
      border-left: 4px solid #4a6cf7;
      padding: 16px 20px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 32px;
    }
    .executive-summary h2 {
      font-size: 12px;
      font-weight: 700;
      color: #4a6cf7;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .executive-summary p {
      font-size: 13px;
      color: #333;
    }
    .section {
      margin-bottom: 28px;
      border: 1px solid #e8ecf8;
      border-radius: 8px;
      overflow: hidden;
    }
    .section h3 {
      font-size: 14px;
      font-weight: 700;
      background: #f8f9fe;
      padding: 12px 18px;
      border-bottom: 1px solid #e8ecf8;
      color: #1a1a2e;
    }
    .section .summary {
      padding: 12px 18px;
      background: #fffdf0;
      border-bottom: 1px solid #e8ecf8;
      font-style: italic;
      color: #555;
      font-size: 12px;
    }
    .section ul {
      padding: 12px 18px 12px 36px;
    }
    .section li {
      margin-bottom: 6px;
      color: #333;
    }
    .section li strong { color: #1a1a2e; }
    .section p {
      padding: 12px 18px;
      color: #333;
    }
    .subsection {
      padding: 10px 18px;
      border-top: 1px solid #f0f0f0;
    }
    .subsection h4 {
      font-size: 12px;
      font-weight: 700;
      color: #4a6cf7;
      margin-bottom: 6px;
    }
    pre {
      background: #1e1e2e;
      color: #cdd6f4;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', 'Menlo', monospace;
      font-size: 11px;
      overflow-x: auto;
      margin: 8px 18px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e8ecf8;
      font-size: 11px;
      color: #999;
      text-align: center;
    }
    .tag {
      display: inline-block;
      background: #e8ecf8;
      color: #4a6cf7;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 10px;
      margin-right: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="badge">${escapeHtml(report.type ?? 'Investigation Report')}</div>
    <h1>${escapeHtml(report.title)}</h1>
    <div class="meta">
      <span>📅 ${escapeHtml(date)}</span>
      ${report.author ? `<span>👤 ${escapeHtml(report.author)}</span>` : ''}
      ${(report.tags ?? []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
    </div>
  </div>

  ${report.executiveSummary ? `
  <div class="executive-summary">
    <h2>핵심 요약</h2>
    <p>${escapeHtml(report.executiveSummary).replace(/\n/g, '<br>')}</p>
  </div>
  ` : ''}

  ${sections}

  <div class="footer">
    AI Team · Homer (Backend) · ${escapeHtml(date)}
  </div>
</body>
</html>`;
}

// ─── PDF 생성 ────────────────────────────────────────────────
async function generatePdf(html, outputPath) {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: 'new',
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
  });

  await browser.close();
  console.log(`✅ PDF 생성 완료: ${outputPath}`);
}

// ─── Slack 업로드 ─────────────────────────────────────────────
async function uploadToSlack(pdfPath, channel, threadTs) {
  const token = process.env.SLACK_BOT_TOKEN_PM;
  if (!token) {
    console.warn('⚠️  SLACK_BOT_TOKEN_PM 없음 — Slack 업로드 건너뜀');
    return null;
  }

  const client = new WebClient(token);
  const filename = `report-${Date.now()}.pdf`;

  try {
    const result = await client.filesUploadV2({
      channel_id: channel,
      thread_ts: threadTs,
      filename,
      file: readFileSync(pdfPath),
      title: report.title ?? 'Investigation Report',
      initial_comment: `📄 *${escapeHtml(report.title)}* — 상세 보고서`,
    });
    console.log(`✅ Slack 업로드 완료: ${result.files?.[0]?.permalink ?? '(permalink 없음)'}`);
    return result;
  } catch (err) {
    console.error(`❌ Slack 업로드 실패: ${err.message}`);
    throw err;
  }
}

// ─── 메인 ─────────────────────────────────────────────────────
try {
  const html = generateHtml(report);
  const htmlDebugPath = outputPath.replace('.pdf', '.html');
  writeFileSync(htmlDebugPath, html);
  console.log(`📝 HTML 생성: ${htmlDebugPath}`);

  await generatePdf(html, outputPath);

  if (channel) {
    await uploadToSlack(outputPath, channel, threadTs);
  } else {
    console.log('ℹ️  --channel 미지정 — PDF만 생성 (업로드 건너뜀)');
    console.log(`   파일 경로: ${outputPath}`);
  }
} catch (err) {
  console.error('❌ 보고서 생성 실패:', err);
  process.exit(1);
}
