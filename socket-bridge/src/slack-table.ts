/**
 * Markdown 테이블 → Slack Block Kit Table Block 변환 유틸리티
 *
 * Slack Table Block은 2025년 8월 추가된 Block Kit 요소로,
 * `chat.postMessage`의 `blocks` 파라미터를 통해 실제 표로 렌더링됩니다.
 *
 * 제약사항 (Slack API):
 * - 메시지당 테이블 1개
 * - 최대 100행 × 20열
 */

type RawTextCell = { type: 'raw_text'; text: string };
type TableRow = RawTextCell[];

export interface SlackTableBlock {
  type: 'table';
  rows: TableRow[];
}

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
  const sepIdx = tableLines.findIndex((l) => /^\|([\s\-:|]+\|)+$/.test(l));
  if (sepIdx === -1) return null;

  // 셀 파싱: 파이프로 분리 후 양끝 빈 요소 제거
  const parseCells = (line: string): RawTextCell[] =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => ({ type: 'raw_text' as const, text: cell.trim() }));

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
