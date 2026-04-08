'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronRight, Folder, FileText, FileJson, File, Plus, Check, X } from 'lucide-react';
import useSWR from 'swr';
import { useAppStore } from '@/stores/app-store';
import { fetcher, apiPaths, createFile } from '@/lib/api';
import { getFolderColor } from '@/lib/types';
import type { FileNode } from '@/lib/types';

function FileIcon({ name, type }: { name: string; type: 'file' | 'directory' }) {
  if (type === 'directory') return <Folder size={14} className="shrink-0 tree-icon-color" />;
  if (name.endsWith('.md')) return <FileText size={14} className="shrink-0 tree-icon-color" />;
  if (name.endsWith('.jsonl')) return <FileJson size={14} className="shrink-0 tree-icon-color" />;
  return <File size={14} className="shrink-0 tree-icon-color" />;
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
        className={`tree-node w-full text-left ${isSelected ? 'tree-node-selected' : ''}`}
        style={{ '--tree-depth': depth, '--folder-color': folderColor } as React.CSSProperties}
      >
        {/* Chevron for directories */}
        {node.type === 'directory' && (
          <span className={`tree-chevron ${isExpanded ? 'tree-chevron-open' : ''}`}>
            <ChevronRight size={11} strokeWidth={2} />
          </span>
        )}

        {/* Icon */}
        <FileIcon name={node.name} type={node.type} />

        {/* Name */}
        <span
          className={`truncate tree-name ${isSelected ? 'tree-name-selected' : ''} ${folderColor ? 'tree-name-folder' : ''}`}
        >
          {node.name}
        </span>

        {/* File size */}
        {node.type === 'file' && node.size !== undefined && (
          <span className="tree-size">
            {node.size < 1024 ? `${node.size}B` : `${(node.size / 1024).toFixed(1)}K`}
          </span>
        )}
      </button>

      {/* Children */}
      {node.type === 'directory' && isExpanded && node.children && (
        <div className="animate-content-enter">
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* New File Inline Input */
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
    <div className="flex items-center gap-1 px-3 py-2">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="파일명.md"
        disabled={isCreating}
        className="new-file-input"
      />
      <button
        onClick={handleConfirm}
        disabled={!value.trim() || isCreating}
        className="icon-btn icon-btn-xs icon-btn-green"
        aria-label="확인 (Enter)"
      >
        <Check size={12} />
      </button>
      <button
        onClick={onCancel}
        disabled={isCreating}
        className="icon-btn icon-btn-xs"
        aria-label="취소 (Esc)"
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
      <div className="py-3 px-3 space-y-2">
        {[65, 77, 89, 65, 77, 89].map((w, i) => (
          <div
            key={i}
            className={`skeleton skeleton-tree-item ${w === 65 ? 'w-[65%]' : w === 77 ? 'w-[77%]' : 'w-[89%]'}`}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 file-error">
        파일 트리 로드 실패
      </div>
    );
  }

  return (
    <div className="py-1">
      {/* Section Header */}
      <div className="flex items-center justify-between px-4 mb-1">
        <span className="sidebar-label">파일</span>
        <button
          onClick={() => {
            setIsCreatingFile(true);
            setCreateError(null);
          }}
          className="icon-btn icon-btn-sm"
          aria-label="새 파일"
        >
          <Plus size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Inline new file creation */}
      {isCreatingFile && (
        <NewFileInput
          onConfirm={handleCreateConfirm}
          onCancel={() => {
            setIsCreatingFile(false);
            setCreateError(null);
          }}
        />
      )}

      {/* Error */}
      {createError && (
        <div className="error-banner tree-error mx-3 mb-1 px-3 py-2">
          {createError}
        </div>
      )}

      {/* Tree */}
      {!tree || tree.length === 0 ? (
        <div className="p-6 text-center tree-empty">
          메모리 파일이 없습니다
        </div>
      ) : (
        tree.map((node) => <TreeNode key={node.path} node={node} />)
      )}
    </div>
  );
}
