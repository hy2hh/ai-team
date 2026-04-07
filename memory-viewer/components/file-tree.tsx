'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronRight, Folder, FileText, FileJson, File, Plus, Check, X } from 'lucide-react';
import useSWR from 'swr';
import { useAppStore } from '@/stores/app-store';
import { fetcher, apiPaths, createFile } from '@/lib/api';
import { getFolderColor } from '@/lib/types';
import type { FileNode } from '@/lib/types';

function FileIcon({ name, type }: { name: string; type: 'file' | 'directory' }) {
  if (type === 'directory') return <Folder size={14} className="text-[var(--color-text-muted)] shrink-0" />;
  if (name.endsWith('.md')) return <FileText size={14} className="text-[var(--color-text-muted)] shrink-0" />;
  if (name.endsWith('.jsonl')) return <FileJson size={14} className="text-[var(--color-text-muted)] shrink-0" />;
  return <File size={14} className="text-[var(--color-text-muted)] shrink-0" />;
}

function TreeNode({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const { selectedFile, selectFile, expandedFolders, toggleFolder } = useAppStore();
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedFile === node.path;

  const handleClick = useCallback(() => {
    if (node.type === 'directory') {
      toggleFolder(node.path);
    } else {
      selectFile(node.path);
    }
  }, [node, toggleFolder, selectFile]);

  const folderColor = node.type === 'directory' ? getFolderColor(node.name) : undefined;

  return (
    <div>
      <button
        onClick={handleClick}
        className={`tree-node w-full flex items-center gap-1.5 text-left transition-colors duration-150 py-2 pr-2 min-h-[44px] rounded-[var(--radius-md)] border-l-2 ${isSelected ? 'tree-node-selected text-[var(--color-text-primary)] border-[var(--color-point)] bg-[var(--color-point-subtle)]' : 'text-[var(--color-text-secondary)] border-transparent'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {node.type === 'directory' && (
          <span
            className={`flex items-center text-[var(--color-text-muted)] transition-transform duration-150 shrink-0 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
          >
            <ChevronRight size={12} />
          </span>
        )}
        <FileIcon name={node.name} type={node.type} />
        <span
          className={`truncate text-[13px] ${!folderColor ? (isSelected ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]') : ''}`}
          style={folderColor ? { color: folderColor } : undefined}
        >
          {node.name}
        </span>
        {node.type === 'file' && node.size !== undefined && (
          <span className="ml-auto flex-shrink-0 text-[11px] text-[var(--color-text-muted)]">
            {node.size < 1024 ? `${node.size}B` : `${(node.size / 1024).toFixed(1)}K`}
          </span>
        )}
      </button>
      {node.type === 'directory' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// 새 파일 인라인 생성 폼
function NewFileInput({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleConfirm = async () => {
    const trimmed = value.trim();
    if (!trimmed || isCreating) return;
    setIsCreating(true);
    await onConfirm(trimmed);
    setIsCreating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1.5">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="파일명.md"
        className="input-base flex-1 h-7 px-2 text-[13px]"
        disabled={isCreating}
      />
      <button
        onClick={handleConfirm}
        disabled={!value.trim() || isCreating}
        className="icon-btn flex items-center justify-center w-6 h-6 rounded-[var(--radius-xs)] text-[var(--color-positive)]"
        title="확인 (Enter)"
      >
        <Check size={12} />
      </button>
      <button
        onClick={onCancel}
        disabled={isCreating}
        className="icon-btn flex items-center justify-center w-6 h-6 rounded-[var(--radius-xs)] text-[var(--color-text-tertiary)]"
        title="취소 (Esc)"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default function FileTree() {
  const { selectFile } = useAppStore();
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: tree, error, isLoading, mutate } = useSWR<FileNode[]>(
    apiPaths.fileTree,
    fetcher<FileNode[]>
  );

  const handleCreateConfirm = async (fileName: string) => {
    setCreateError(null);
    try {
      // .md 확장자 자동 추가
      const filePath = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
      await createFile(filePath, '');
      await mutate();
      setIsCreatingFile(false);
      selectFile(filePath);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '파일 생성 실패');
    }
  };

  if (isLoading) {
    return (
      <div className="py-2 px-2 space-y-1">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="skeleton h-9 rounded-[var(--radius-md)]"
            style={{ width: `${70 + (i % 3) * 10}%` }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-[13px] text-[var(--color-negative)]">
        파일 트리 로드 실패
      </div>
    );
  }

  return (
    <div className="py-1">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between px-2 mb-1">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Files
        </span>
        <button
          onClick={() => {
            setIsCreatingFile(true);
            setCreateError(null);
          }}
          className="icon-btn flex items-center justify-center w-6 h-6 rounded-[var(--radius-xs)] text-[var(--color-text-tertiary)]"
          title="새 파일"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* 인라인 새 파일 생성 */}
      {isCreatingFile && (
        <NewFileInput
          onConfirm={handleCreateConfirm}
          onCancel={() => {
            setIsCreatingFile(false);
            setCreateError(null);
          }}
        />
      )}

      {/* 에러 */}
      {createError && (
        <div
          className="mx-2 mb-1 px-2 py-1 rounded-[var(--radius-xs)] text-[11px]"
          style={{
            background: 'rgba(236,45,48,0.10)',
            color: 'var(--color-negative)',
          }}
        >
          {createError}
        </div>
      )}

      {/* 파일 트리 */}
      {!tree || tree.length === 0 ? (
        <div className="p-4 text-[13px] text-[var(--color-text-muted)] text-center">
          메모리 파일이 없습니다
        </div>
      ) : (
        tree.map((node) => <TreeNode key={node.path} node={node} />)
      )}
    </div>
  );
}
