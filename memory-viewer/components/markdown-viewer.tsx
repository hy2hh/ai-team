'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pencil, Check, X, AlertCircle } from 'lucide-react';
import useSWR from 'swr';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useAppStore } from '@/stores/app-store';
import { fetcher, apiPaths, saveFile } from '@/lib/api';
import type { FileContent } from '@/lib/types';

/* Empty State — Apple minimal */
function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-title">파일을 선택하세요</div>
      <div className="empty-state-desc">
        사이드바에서 파일을 선택하거나 ⌘K로 검색
      </div>
      <div className="flex items-center gap-4 mt-4">
        <KBD keys="⌘K" />
        <KBD keys="⌘B" />
        <KBD keys="⌘/" />
      </div>
    </div>
  );
}

function KBD({ keys }: { keys: string }) {
  return <span className="kbd">{keys}</span>;
}

/* Skeleton Loader */
function SkeletonLoader() {
  return (
    <div className="flex-1 overflow-y-auto content-area">
      <div className="content-container">
        <div className="space-y-3">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line skeleton-line-medium" />
          <div className="skeleton skeleton-line skeleton-line-short" />
          <div className="skeleton skeleton-line mt-5" />
          <div className="skeleton skeleton-line skeleton-line-shorter" />
          <div className="skeleton skeleton-line skeleton-line-long" />
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function MarkdownViewer() {
  const { selectedFile, setIsEditing: setStoreIsEditing, setEditingFile } = useAppStore();

  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR<FileContent>(
    selectedFile ? apiPaths.fileContent(selectedFile) : null,
    fetcher<FileContent>
  );

  // 파일 변경 시 편집 모드 초기화
  useEffect(() => {
    setIsEditing(false);
    setSaveError(null);
    setStoreIsEditing(false);
    setEditingFile(null);
  }, [selectedFile, setStoreIsEditing, setEditingFile]);

  const handleEdit = useCallback(() => {
    if (!data || !selectedFile) return;
    setDraftContent(data.content);
    setIsEditing(true);
    setSaveError(null);
    setStoreIsEditing(true);
    setEditingFile(selectedFile);
  }, [data, selectedFile, setStoreIsEditing, setEditingFile]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setSaveError(null);
    setStoreIsEditing(false);
    setEditingFile(null);
  }, [setStoreIsEditing, setEditingFile]);

  const handleSave = useCallback(async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveFile(selectedFile, draftContent);
      await mutate();
      setIsEditing(false);
      setStoreIsEditing(false);
      setEditingFile(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setIsSaving(false);
    }
  }, [selectedFile, draftContent, mutate, setStoreIsEditing, setEditingFile]);

  // ⌘S 저장 단축키
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isEditing, handleSave, handleCancel]);

  if (!selectedFile) return <EmptyState />;

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="content-header">
          <div className="space-y-1.5">
            <div className="skeleton skeleton-header-title" />
            <div className="skeleton skeleton-header-meta" />
          </div>
        </div>
        <SkeletonLoader />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="file-error">파일 로드 실패</span>
      </div>
    );
  }

  const isJsonl = selectedFile.endsWith('.jsonl');
  const canEdit = !isJsonl;

  return (
    <div className="h-full flex flex-col animate-content-enter">
      {/* Content Header */}
      <div className="content-header">
        <div className="min-w-0">
          <div className="truncate content-header-title">
            {selectedFile.split('/').pop()}
          </div>
          <div className="truncate content-header-path">
            {selectedFile}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* File meta */}
          {!isEditing && (
            <div className="flex items-center gap-4 content-meta">
              <span>{(data.size / 1024).toFixed(1)} KB</span>
              <span>{formatDate(data.modifiedAt)}</span>
            </div>
          )}

          {/* Save error */}
          {isEditing && saveError && (
            <div className="flex items-center gap-1 save-error">
              <AlertCircle size={12} />
              <span>{saveError}</span>
            </div>
          )}

          {/* Action buttons */}
          {canEdit && (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="btn-save"
                    aria-label="저장 (⌘S)"
                  >
                    <Check size={13} strokeWidth={2} />
                    저장
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="btn-secondary"
                    aria-label="취소 (Esc)"
                  >
                    취소
                  </button>
                </>
              ) : (
                <button onClick={handleEdit} className="btn-secondary">
                  <Pencil size={12} strokeWidth={1.5} />
                  편집
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-auto content-area">
        <div className="content-container h-full">
          {isEditing ? (
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              className="textarea-editor h-full"
              autoFocus
              spellCheck={false}
            />
          ) : isJsonl ? (
            <pre className="jsonl-viewer">
              {data.content}
            </pre>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {data.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
