export interface FileNode {
  name: string;
  path: string;       // .memory/ 기준 상대경로
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  modifiedAt?: string;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  modifiedAt: string;
}

export interface Backlink {
  sourcePath: string;
  sourceName: string;
  lineNumber: number;
  context: string;     // 참조가 있는 줄의 텍스트
}

export interface SearchResult {
  path: string;
  name: string;
  matches: {
    lineNumber: number;
    line: string;
  }[];
}

// 폴더별 색상 매핑
export const FOLDER_COLORS: Record<string, string> = {
  facts:         'var(--color-folder-facts)',
  decisions:     'var(--color-folder-decisions)',
  tasks:         'var(--color-folder-tasks)',
  handoff:       'var(--color-folder-handoff)',
  design:        'var(--color-folder-design)',
  logs:          'var(--color-folder-logs)',
  heartbeats:    'var(--color-folder-logs)',
  claims:        'var(--color-folder-handoff)',
  contracts:     'var(--color-folder-decisions)',
  conversations: 'var(--color-folder-tasks)',
  walkthroughs:  'var(--color-folder-facts)',
};

export function getFolderColor(folderName: string): string {
  return FOLDER_COLORS[folderName] ?? 'var(--color-folder-default)';
}
