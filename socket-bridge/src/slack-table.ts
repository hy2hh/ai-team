/**
 * Markdown → Slack Block Kit 변환 유틸리티
 *
 * 처리 대상:
 * - 마크다운 테이블 → Slack Table Block (메시지당 1개만 - Slack API 제한)
 * - ## / ### 헤딩 → *bold* 텍스트
 * - - [ ] / - [x] 체크박스 → ☐ / ☑ 이모지
 * - Slack mrkdwn 미지원 문법 정리
 *
 * 제약사항 (Slack API):
 * - 메시지당 최대 50 블록
 * - 메시지당 테이블 1개만 허용 (초과 시 invalid_attachments 에러)
 * - section 블록 텍스트 최대 3000자
 * - table 블록 최대 100행 × 20열
 */

type RawTextCell = { type: 'raw_text'; text: string };
type TableRow = RawTextCell[];

export interface SlackTableBlock {
  type: 'table';
  rows: TableRow[];
}

interface SlackSectionBlock {
  type: 'section';
  text: { type: 'mrkdwn'; text: string };
}

/** Block Kit actions block (버튼 등 인터랙티브 요소) */
export interface SlackActionsBlock {
  type: 'actions';
  block_id: string;
  elements: Array<{
    type: string;
    text: { type: string; text: string; emoji?: boolean };
    style?: string;
    action_id: string;
    value: string;
  }>;
}

type SlackBlock = SlackTableBlock | SlackSectionBlock | SlackActionsBlock;

const SLACK_SECTION_MAX = 3000;

/**
 * 마크다운 텍스트를 Slack mrkdwn 호환 포맷으로 변환
 */
function convertMarkdownToMrkdwn(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      // ## / ### / #### 헤딩 → *bold*
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        return `*${headingMatch[2].trim()}*`;
      }
      // - [ ] 체크박스 → ☐
      if (/^\s*-\s*\[ \]/.test(line)) {
        return line.replace(/^(\s*)-\s*\[ \]/, '$1☐');
      }
      // - [x] / - [X] 체크박스 → ☑
      if (/^\s*-\s*\[[xX]\]/.test(line)) {
        return line.replace(/^(\s*)-\s*\[[xX]\]/, '$1☑');
      }
      return line;
    })
    .join('\n');
}

/**
 * 테이블 라인 배열을 Slack Table Block으로 변환
 */
function parseTableLines(tableLines: string[]): SlackTableBlock | null {
  if (tableLines.length < 2) {
    return null;
  }

  // 구분자 행 탐지: | --- | :---: | :----- | 등
  const sepIdx = tableLines.findIndex(
    (l) => l.length <= 500 && /^\|([\s\-:|]+\|)+$/.test(l),
  );
  if (sepIdx === -1) {
    return null;
  }

  // 셀 파싱
  const parseCells = (line: string): RawTextCell[] =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => {
        const sanitized = cell
          .trim()
          .replace(/[\x00-\x1F\x7F]/g, '')
          .slice(0, 500);
        return { type: 'raw_text' as const, text: sanitized };
      });

  const headerRow = parseCells(tableLines[0]);
  const dataRows = tableLines.slice(sepIdx + 1).map(parseCells);

  const rows = [headerRow, ...dataRows].filter(
    (r) => r.length > 0 && r.some((c) => c.text.length > 0),
  );

  if (rows.length === 0) {
    return null;
  }

  // Slack 제약 적용: 최대 100행 × 20열
  return { type: 'table', rows: rows.slice(0, 100).map((r) => r.slice(0, 20)) };
}

/** 테이블 행인지 판별 */
function isTableLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|') && t.length > 2;
}

/**
 * 긴 텍스트를 Slack section 블록 배열로 분할 (최대 3000자/블록)
 */
function toSectionBlocks(text: string): SlackSectionBlock[] {
  const converted = convertMarkdownToMrkdwn(text).trim();
  if (!converted) {
    return [];
  }
  const blocks: SlackSectionBlock[] = [];
  let remaining = converted;
  while (remaining.length > 0) {
    const chunk = remaining.slice(0, SLACK_SECTION_MAX);
    remaining = remaining.slice(SLACK_SECTION_MAX);
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: chunk } });
  }
  return blocks;
}

/**
 * 텍스트에서 첫 번째 마크다운 테이블을 추출해 Slack Block Kit Table Block으로 변환.
 * 유효한 테이블이 없으면 null 반환.
 */
export function extractTableBlock(text: string): SlackTableBlock | null {
  const lines = text.split('\n');

  const tableStart = lines.findIndex((l) => isTableLine(l));
  if (tableStart === -1) {
    return null;
  }

  const tableLines: string[] = [];
  for (let i = tableStart; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('|') && t.endsWith('|')) {
      tableLines.push(t);
    } else {
      break;
    }
  }

  return parseTableLines(tableLines);
}

/**
 * 전체 메시지 텍스트를 Slack Block Kit 배열로 변환.
 *
 * 마크다운 테이블 중 첫 번째만 Table Block으로 변환 (Slack API 제한: 메시지당 1개).
 * 두 번째 이상 테이블은 mrkdwn 텍스트로 처리.
 * 테이블 사이/앞/뒤 텍스트는 mrkdwn 변환 후 section 블록으로 처리.
 * 테이블이 없으면 마크다운→mrkdwn 변환만 수행한 section 블록을 반환.
 */
export function buildMessageBlocks(text: string): SlackBlock[] | null {
  const lines = text.split('\n');
  const blocks: SlackBlock[] = [];
  let textBuffer: string[] = [];

  /** 버퍼에 쌓인 텍스트를 section 블록으로 flush */
  const flushTextBuffer = () => {
    if (textBuffer.length > 0) {
      blocks.push(...toSectionBlocks(textBuffer.join('\n')));
      textBuffer = [];
    }
  };

  let i = 0;
  let hasTable = false;

  while (i < lines.length) {
    if (isTableLine(lines[i])) {
      // 테이블 시작 — 연속된 테이블 라인 수집
      const tableLines: string[] = [];
      while (i < lines.length && isTableLine(lines[i])) {
        tableLines.push(lines[i].trim());
        i++;
      }

      const tableBlock = parseTableLines(tableLines);
      if (tableBlock && !hasTable) {
        // Slack API 제한: 메시지당 테이블 1개만 허용
        flushTextBuffer();
        blocks.push(tableBlock);
        hasTable = true;
      } else {
        // 유효한 테이블이 아니거나 두 번째 이상 테이블이면 코드블록으로 처리
        // (raw markdown은 section에서 깨지므로 monospace로 정렬 유지)
        if (tableBlock) {
          textBuffer.push('```');
          textBuffer.push(...tableLines);
          textBuffer.push('```');
        } else {
          textBuffer.push(...tableLines);
        }
      }
    } else {
      textBuffer.push(lines[i]);
      i++;
    }
  }

  flushTextBuffer();

  // 테이블이 없어도 마크다운 변환이 필요한 경우 블록 반환
  if (!hasTable) {
    // 마크다운 변환이 실제로 발생했는지 확인
    const hasMarkdown = /^#{1,6}\s|^\s*-\s*\[[xX ]\]/.test(text);
    if (!hasMarkdown) {
      return null;
    }
  }

  return blocks.slice(0, 50);
}
