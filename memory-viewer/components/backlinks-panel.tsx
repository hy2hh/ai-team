'use client';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useAppStore } from '@/stores/app-store';
import { fetcher, apiPaths } from '@/lib/api';
import type { Backlink, FileContent } from '@/lib/types';

function getHeadingClass(level: number): string {
  if (level === 1) return 'text-[var(--color-text-primary)] font-semibold';
  if (level === 2) return 'text-[var(--color-text-primary)] font-medium';
  if (level === 3) return 'text-[var(--color-text-secondary)] font-normal';
  return 'text-[var(--color-text-muted)] font-normal';
}

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
    return (
      <div className="p-4 text-xs text-[var(--color-text-muted)]">
        헤딩 없음
      </div>
    );
  }

  return (
    <div className="py-2">
      {headings.map((h, i) => (
        <div
          key={i}
          className={`truncate text-xs py-2 pr-3 ${getHeadingClass(h.level)}`}
          style={{ paddingLeft: `${(h.level - 1) * 12 + 12}px` }}
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
      {/* 탭 헤더 — 44px */}
      <div className="flex flex-shrink-0 border-b border-[var(--color-border)]">
        <button
          onClick={() => setRightPanelTab('backlinks')}
          className={`flex-1 transition-colors duration-150 h-11 text-xs font-medium bg-transparent border-b-2 ${rightPanelTab === 'backlinks' ? 'text-[var(--color-point-light)] border-[var(--color-point)]' : 'text-[var(--color-text-muted)] border-transparent'}`}
        >
          백링크 {backlinks ? `(${backlinks.length})` : ''}
        </button>
        <button
          onClick={() => setRightPanelTab('outline')}
          className={`flex-1 transition-colors duration-150 h-11 text-xs font-medium bg-transparent border-b-2 ${rightPanelTab === 'outline' ? 'text-[var(--color-point-light)] border-[var(--color-point)]' : 'text-[var(--color-text-muted)] border-transparent'}`}
        >
          아웃라인
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {!selectedFile ? (
          <div className="p-4 text-xs text-[var(--color-text-muted)]">
            파일을 선택하세요
          </div>
        ) : rightPanelTab === 'backlinks' ? (
          backlinks && backlinks.length > 0 ? (
            <div>
              {backlinks.map((bl, i) => (
                <button
                  key={i}
                  onClick={() => handleBacklinkClick(bl.sourcePath)}
                  className="backlink-row w-full text-left transition-colors duration-150 px-3 py-2 min-h-[44px] border-b border-[var(--color-border)] bg-transparent cursor-pointer"
                >
                  <div className="text-xs font-medium text-[var(--color-point-light)]">
                    {bl.sourceName}
                  </div>
                  <div className="truncate text-xs mt-0.5 text-[var(--color-text-muted)]">
                    L{bl.lineNumber}: {bl.context}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-xs text-[var(--color-text-muted)]">
              이 파일을 참조하는 문서 없음
            </div>
          )
        ) : (
          fileData ? <OutlineView content={fileData.content} /> : null
        )}
      </div>
    </div>
  );
}
