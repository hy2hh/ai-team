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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div className="text-sm font-medium text-[var(--color-text-secondary)]">
        파일을 선택하세요
      </div>
      <div className="text-xs text-[var(--color-text-muted)]">
        왼쪽 파일 트리에서 파일을 선택하거나 ⌘K로 검색
      </div>
      <div className="flex gap-3 mt-2">
        <Shortcut keys="⌘K" label="검색" />
        <Shortcut keys="⌘B" label="사이드바" />
        <Shortcut keys="⌘/" label="백링크" />
      </div>
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 min-h-[44px] text-xs text-[var(--color-text-muted)]">
      <kbd className="font-mono bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
        {keys}
      </kbd>
      <span>{label}</span>
    </div>
  );
}

/* 스켈레톤 — Toss: Spinner 금지, Skeleton 사용 */
function SkeletonLoader() {
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="max-w-[720px] mx-auto space-y-3">
        <div className="skeleton h-7 w-3/5 mb-6" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-11/12" />
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-4 w-full mt-4" />
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
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

  // Ctrl/Cmd+S 단축키로 저장
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
        {/* 스켈레톤 헤더 */}
        <div className="flex items-center justify-between flex-shrink-0 h-12 px-6 border-b border-[var(--color-border)] bg-[var(--color-bg-base)]">
          <div className="space-y-1.5">
            <div className="skeleton h-3.5 w-36" />
            <div className="skeleton h-2.5 w-52" />
          </div>
        </div>
        <SkeletonLoader />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[13px] text-[var(--color-negative)]">파일 로드 실패</div>
      </div>
    );
  }

  const isJsonl = selectedFile.endsWith('.jsonl');
  const canEdit = !isJsonl;

  return (
    <div className="h-full flex flex-col">
      {/* 파일 헤더 — 48px */}
      <div className="flex items-center justify-between flex-shrink-0 h-12 px-6 border-b border-[var(--color-border)] bg-[var(--color-bg-base)]">
        <div>
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
            {selectedFile.split('/').pop()}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {selectedFile}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 파일 메타 정보 */}
          {!isEditing && (
            <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
              <span>{(data.size / 1024).toFixed(1)} KB</span>
              <span>{formatDate(data.modifiedAt)}</span>
            </div>
          )}

          {/* 편집 에러 */}
          {isEditing && saveError && (
            <div className="flex items-center gap-1 text-xs text-[var(--color-negative)]">
              <AlertCircle size={12} />
              <span>{saveError}</span>
            </div>
          )}

          {/* 버튼 그룹 */}
          {canEdit && (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="btn-save"
                    title="저장 (⌘S)"
                  >
                    <Check size={14} />
                    저장
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="btn-secondary"
                    title="취소 (Esc)"
                  >
                    <X size={14} />
                    취소
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEdit}
                  className="btn-secondary"
                >
                  <Pencil size={14} />
                  편집
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-[720px] mx-auto h-full">
          {isEditing ? (
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              className="textarea-editor h-full min-h-[400px] p-4"
              autoFocus
              spellCheck={false}
            />
          ) : isJsonl ? (
            <pre className="font-mono whitespace-pre-wrap text-xs text-[var(--color-text-secondary)]">
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
