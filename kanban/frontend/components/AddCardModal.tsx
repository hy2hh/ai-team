'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@bifrost-platform/ui-kit-front';
import { AGENTS, AGENT_COLORS, PRIORITY_OPTIONS, getProgressColor } from '@/lib/constants';

interface Props {
  onAdd: (data: { title: string; description: string; priority: string; assignee: string; progress: number; due_date: string | null; tags: string[] }) => void;
  onClose: () => void;
}

export default function AddCardModal({ onAdd, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignee, setAssignee] = useState('');
  const [progress, setProgress] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || tags.includes(tag) || tags.length >= 10) return;
    setTags((prev) => [...prev, tag]);
    setTagInput('');
  };

  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag));

  useEffect(() => {
    titleRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ title: title.trim(), description, priority, assignee, progress, due_date: dueDate || null, tags });
  };

  const progressColor = getProgressColor(progress);

  return (
    <div
      onClick={onClose}
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-card-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--color-bg-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '0 16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-container modal-container--md"
      >
        {/* 헤더 */}
        <div className="modal-header">
          <h2 id="add-card-modal-title" className="modal-title">
            새 카드 추가
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="modal-close-btn"
          >
            ×
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ gap: 14 }}>
            {/* 제목 */}
            <div>
              <label className="field-label">제목 *</label>
              <input
                ref={titleRef}
                type="text"
                placeholder="카드 제목을 입력하세요"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field"
              />
            </div>

            {/* 설명 */}
            <div>
              <label className="field-label">설명</label>
              <textarea
                placeholder="상세 설명 (선택)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="textarea-field"
                style={{ resize: 'none' }}
              />
            </div>

            {/* 우선순위 */}
            <div>
              <label className="field-label">우선순위</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-caption)',
                      fontWeight: 500,
                      border: `1px solid ${priority === opt.value ? opt.color : 'var(--color-border)'}`,
                      background: priority === opt.value ? opt.bg : 'var(--color-bg-input)',
                      color: priority === opt.value ? opt.color : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      minHeight: 44,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: opt.color, display: 'inline-block' }} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 담당자 */}
            <div>
              <label className="field-label">담당자</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setAssignee('')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 500,
                    border: `1px solid ${assignee === '' ? 'var(--color-border-strong)' : 'var(--color-border)'}`,
                    background: assignee === '' ? 'var(--color-bg-card)' : 'transparent',
                    color: assignee === '' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                >
                  없음
                </button>
                {AGENTS.map((agent) => {
                  const key = agent.toLowerCase();
                  const color = AGENT_COLORS[key] ?? '#7a90b8';
                  const isSelected = assignee === agent;
                  return (
                    <button
                      key={agent}
                      type="button"
                      onClick={() => setAssignee(agent)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 500,
                        border: `1px solid ${isSelected ? color : 'var(--color-border)'}`,
                        background: isSelected ? `${color}15` : 'transparent',
                        color: isSelected ? color : 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 150ms',
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: color,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontWeight: 700,
                          color: '#fff',
                        }}
                      >
                        {agent.charAt(0)}
                      </span>
                      {agent}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 마감일 */}
            <div>
              <label className="field-label">마감일 (선택)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label="마감일"
                className="input-field"
                style={{ cursor: 'pointer' }}
              />
            </div>

            {/* 태그 */}
            <div>
              <label className="field-label">태그 (선택)</label>
              {tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                  {tags.map((tag) => (
                    <span key={tag} className="tag-pill">
                      {tag}
                      <button onClick={() => removeTag(tag)} aria-label={`태그 ${tag} 삭제`} type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-tag-text)', padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
              {tags.length < 10 && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="태그 입력 후 Enter"
                    aria-label="새 태그 입력"
                    maxLength={50}
                    className="input-field"
                    style={{ flex: 1, padding: '7px 10px' }}
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    disabled={!tagInput.trim()}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-caption)',
                      fontWeight: 500,
                      background: tagInput.trim() ? 'var(--color-point-subtle)' : 'var(--color-bg-input)',
                      color: tagInput.trim() ? 'var(--color-point)' : 'var(--color-text-muted)',
                      border: '1px solid var(--color-border)',
                      cursor: tagInput.trim() ? 'pointer' : 'default',
                    }}
                  >
                    추가
                  </button>
                </div>
              )}
            </div>

            {/* 진행률 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label className="field-label" style={{ marginBottom: 0 }}>진행률</label>
                <span style={{ fontSize: 'var(--text-body-sm)', fontWeight: 700, color: progressColor }}>{progress}%</span>
              </div>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    height: 4,
                    background: 'var(--color-border)',
                    borderRadius: 2,
                    marginBottom: 8,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${progress}%`,
                      background: `linear-gradient(90deg, ${progressColor}80 0%, ${progressColor} 100%)`,
                      borderRadius: 2,
                      transition: 'width 100ms',
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  style={{ width: '100%', accentColor: progressColor, cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* 버튼 */}
          <div className="modal-footer">
            <Button
              type="submit"
              variant="primary"
              size="medium"
              disabled={!title.trim()}
              style={{ flex: 1, minHeight: 44 }}
            >
              추가
            </Button>
            <Button
              type="button"
              variant="outline"
              size="medium"
              onClick={onClose}
              style={{ flex: 1, minHeight: 44 }}
            >
              취소
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
