'use client';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useAppStore } from '@/stores/app-store';
import { fetcher, apiPaths } from '@/lib/api';
import type { Backlink, FileContent } from '@/lib/types';

const OUTLINE_STYLE_MAP: Record<number, string> = {
  1: 'outline-h1',
  2: 'outline-h2',
  3: 'outline-h3',
};

function OutlineView({ content }: { content: string }) {
  const headings = useMemo(() => {
    const lines = content.split('\n');
    const result: { level: number; text: string; line: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(#{1,4})\s+(.+)/);
      if (match) {
        result.push({ level: match[1].length, text: match[2], line: i + 1 });
      }
    }
    return result;
  }, [content]);

  if (headings.length === 0) {
    return <div className="panel-empty">헤딩 없음</div>;
  }

  return (
    <div className="py-2">
      {headings.map((h, i) => (
        <div
          key={i}
          className={`truncate outline-item ${OUTLINE_STYLE_MAP[h.level] || 'outline-h4'}`}
          style={{ '--outline-indent': h.level - 1 } as React.CSSProperties}
        >
          {h.text}
        </div>
      ))}
    </div>
  );
}

export default function BacklinksPanel() {
  const { selectedFile, selectFile, expandFolder, rightPanelTab, setRightPanelTab } = useAppStore();

  const { data: backlinks } = useSWR<Backlink[]>(
    selectedFile ? apiPaths.backlinks(selectedFile) : null,
    fetcher<Backlink[]>
  );

  const { data: fileData } = useSWR<FileContent>(
    selectedFile ? apiPaths.fileContent(selectedFile) : null,
    fetcher<FileContent>
  );

  const handleBacklinkClick = useCallback((path: string) => {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      expandFolder(parts.slice(0, i).join('/'));
    }
    selectFile(path);
  }, [selectFile, expandFolder]);

  return (
    <div className="h-full flex flex-col">
      {/* Tab Header */}
      <div className="flex flex-shrink-0 tab-header">
        <button
          onClick={() => setRightPanelTab('backlinks')}
          className={`tab-btn ${rightPanelTab === 'backlinks' ? 'tab-btn-active' : ''}`}
        >
          백링크 {backlinks ? `(${backlinks.length})` : ''}
        </button>
        <button
          onClick={() => setRightPanelTab('outline')}
          className={`tab-btn ${rightPanelTab === 'outline' ? 'tab-btn-active' : ''}`}
        >
          아웃라인
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto scrollbar-auto">
        {!selectedFile ? (
          <div className="panel-empty">파일을 선택하세요</div>
        ) : rightPanelTab === 'backlinks' ? (
          backlinks && backlinks.length > 0 ? (
            <div>
              {backlinks.map((bl, i) => (
                <button
                  key={i}
                  onClick={() => handleBacklinkClick(bl.sourcePath)}
                  className="backlink-row w-full text-left px-4 py-3 bg-transparent cursor-pointer border-none"
                >
                  <div className="backlink-source">{bl.sourceName}</div>
                  <div className="truncate backlink-context">
                    L{bl.lineNumber}: {bl.context}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="panel-empty">이 파일을 참조하는 문서 없음</div>
          )
        ) : (
          fileData ? <OutlineView content={fileData.content} /> : null
        )}
      </div>
    </div>
  );
}
