/**
 * Markdown 테이블 → Slack Block Kit Table Block 변환 유틸리티
 *
 * Slack Table Block은 2025년 8월 추가된 Block Kit 요소로,
 * `chat.postMessage`의 `blocks` 파라미터를 통해 실제 표로 렌더링됩니다.
 *
 * 제약사항 (Slack API):
 * - 메시지당 테이블 1개
 * - 최대 100행 × 20열
 * - section 블록 텍스트 최대 3000자
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

type SlackBlock = SlackTableBlock | SlackSectionBlock;

const SLACK_SECTION_MAX = 3000;

/**
 * 텍스트에서 첫 번째 마크다운 테이블을 추출해 Slack Block Kit Table Block으로 변환.
 * 유효한 테이블이 없으면 null 반환.
 *
 * 입력 형식:
 * ```
 * | 헤더1 | 헤더2 |
 * | --- | --- |
 * | 값1   | 값2   |
 * ```
 */
export function extractTableBlock(text: string): SlackTableBlock | null {
  const lines = text.split('\n');

  // 첫 번째 테이블 시작 인덱스 탐색
  const tableStart = lines.findIndex((l) => {
    const t = l.trim();
    return t.startsWith('|') && t.endsWith('|') && t.length > 2;
  });
  if (tableStart === -1) return null;

  // 연속된 테이블 라인 수집
  const tableLines: string[] = [];
  for (let i = tableStart; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('|') && t.endsWith('|')) {
      tableLines.push(t);
    } else {
      break;
    }
  }

  if (tableLines.length < 2) return null;

  // 구분자 행 탐지: | --- | :---: | :----- | 등
  // ReDoS 방어: 500자 초과 라인은 구분자 행으로 간주하지 않음
  const sepIdx = tableLines.findIndex(
    (l) => l.length <= 500 && /^\|([\s\-:|]+\|)+$/.test(l),
  );
  if (sepIdx === -1) return null;

  // 셀 파싱: 파이프로 분리 후 양끝 빈 요소 제거
  // 제어 문자 제거(Slack invalid_blocks 방지) + 셀 텍스트 500자 truncate
  const parseCells = (line: string): RawTextCell[] =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => {
        const sanitized = cell
          .trim()
          .replace(/[\x00-\x1F\x7F]/g, '') // 이슈 3: 제어 문자 제거
          .slice(0, 500); // 이슈 2: 셀 텍스트 500자 제한
        return { type: 'raw_text' as const, text: sanitized };
      });

  const headerRow = parseCells(tableLines[0]);
  const dataRows = tableLines.slice(sepIdx + 1).map(parseCells);

  // 빈 행 제거
  const rows = [headerRow, ...dataRows].filter(
    (r) => r.length > 0 && r.some((c) => c.text.length > 0),
  );

  if (rows.length === 0) return null;

  // Slack 제약 적용: 최대 100행 × 20열
  const limitedRows = rows.slice(0, 100).map((r) => r.slice(0, 20));

  return { type: 'table', rows: limitedRows };
}

/**
 * 긴 텍스트를 Slack section 블록 배열로 분할 (최대 3000자/블록).
 */
function toSectionBlocks(text: string): SlackSectionBlock[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  const blocks: SlackSectionBlock[] = [];
  let remaining = trimmed;
  while (remaining.length > 0) {
    const chunk = remaining.slice(0, SLACK_SECTION_MAX);
    remaining = remaining.slice(SLACK_SECTION_MAX);
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: chunk } });
  }
  return blocks;
}

/**
 * 전체 메시지 텍스트를 Slack Block Kit 배열로 변환.
 *
 * 마크다운 테이블이 포함된 경우 테이블 앞뒤 텍스트를 section 블록으로,
 * 테이블은 table 블록으로 변환하여 모든 내용이 표시되도록 합니다.
 * 테이블이 없으면 null 반환 (호출자는 text-only 모드로 폴백).
 *
 * @param text - 전체 메시지 텍스트 (마크다운 테이블 포함 가능)
 * @returns Slack blocks 배열 또는 null
 */
export function buildMessageBlocks(text: string): SlackBlock[] | null {
  const lines = text.split('\n');

  // 테이블 시작 라인 탐색
  const tableStart = lines.findIndex((l) => {
    const t = l.trim();
    return t.startsWith('|') && t.endsWith('|') && t.length > 2;
  });
  if (tableStart === -1) return null;

  // 테이블 끝 라인 탐색
  let tableEnd = tableStart;
  for (let i = tableStart + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('|') && t.endsWith('|')) {
      tableEnd = i;
    } else {
      break;
    }
  }

  // 테이블 블록 변환
  const tableText = lines.slice(tableStart, tableEnd + 1).join('\n');
  const tableBlock = extractTableBlock(tableText);
  if (!tableBlock) return null;

  // 테이블 앞뒤 텍스트
  const beforeText = lines.slice(0, tableStart).join('\n');
  const afterText = lines.slice(tableEnd + 1).join('\n');

  const blocks: SlackBlock[] = [
    ...toSectionBlocks(beforeText),
    tableBlock,
    ...toSectionBlocks(afterText),
  ];

  // Slack 최대 50 블록 제한
  return blocks.slice(0, 50);
}
