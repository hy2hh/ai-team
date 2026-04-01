'use client';
import { useState, useEffect, useRef } from 'react';

const AGENTS = ['Homer', 'Bart', 'Marge', 'Lisa', 'Krusty', 'Sid', 'Chalmers', 'Wiggum'];
const AGENT_COLORS: Record<string, string> = {
  homer:    '#4f7ef0',
  bart:     '#22d3ee',
  marge:    '#c084fc',
  lisa:     '#4ade80',
  krusty:   '#fb923c',
  sid:      '#f472b6',
  chalmers: '#f59e0b',
  wiggum:   '#94a3b8',
};

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

  const progressColor =
    progress >= 67 ? '#4ade80' :
    progress >= 34 ? '#fbbf24' :
    '#f87171';

  const PRIORITY_OPTIONS = [
    { value: 'high',   label: '높음 (High)',   color: '#f87171' },
    { value: 'medium', label: '보통 (Medium)', color: '#fbbf24' },
    { value: 'low',    label: '낮음 (Low)',    color: '#4ade80' },
  ];

  return (
    <div
      onClick={onClose}
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
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          animation: 'modalFadeIn 180ms ease-out',
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: '18px 20px 16px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 id="add-card-modal-title" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            새 카드 추가
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 150ms, color 150ms',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-card)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
            }}
          >
            ×
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 제목 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                제목 *
              </label>
              <input
                ref={titleRef}
                type="text"
                placeholder="카드 제목을 입력하세요"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--color-bg-input)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: '9px 12px',
                  fontSize: 14,
                  outline: 'none',
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-action-primary)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,126,240,0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* 설명 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                설명
              </label>
              <textarea
                placeholder="상세 설명 (선택)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  background: 'var(--color-bg-input)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: '9px 12px',
                  fontSize: 13,
                  outline: 'none',
                  resize: 'none',
                  transition: 'border-color 150ms, box-shadow 150ms',
                  lineHeight: 1.5,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-action-primary)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,126,240,0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* 우선순위 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                우선순위
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 500,
                      border: `1px solid ${priority === opt.value ? opt.color : 'var(--color-border)'}`,
                      background: priority === opt.value ? `${opt.color}15` : 'var(--color-bg-input)',
                      color: priority === opt.value ? opt.color : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: opt.color, display: 'inline-block' }} />
                    {opt.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* 담당자 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                담당자
              </label>
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
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                마감일 (선택)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label="마감일"
                style={{
                  width: '100%', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)', borderRadius: 8, padding: '9px 12px',
                  fontSize: 13, outline: 'none', cursor: 'pointer', transition: 'border-color 150ms',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-action-primary)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
              />
            </div>

            {/* 태그 */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                태그 (선택)
              </label>
              {tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                  {tags.map((tag) => (
                    <span key={tag} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500,
                      padding: '2px 8px', borderRadius: 12, background: 'rgba(79,126,240,0.12)',
                      color: '#4f7ef0', border: '1px solid rgba(79,126,240,0.25)',
                    }}>
                      {tag}
                      <button onClick={() => removeTag(tag)} aria-label={`태그 ${tag} 삭제`} type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4f7ef0', padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
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
                    style={{
                      flex: 1, background: 'var(--color-bg-input)', color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 10px',
                      fontSize: 13, outline: 'none', transition: 'border-color 150ms',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-action-primary)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    disabled={!tagInput.trim()}
                    style={{
                      padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                      background: tagInput.trim() ? 'rgba(79,126,240,0.15)' : 'var(--color-bg-input)',
                      color: tagInput.trim() ? '#4f7ef0' : 'var(--color-text-muted)',
                      border: '1px solid var(--color-border)', cursor: tagInput.trim() ? 'pointer' : 'default',
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
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  진행률
                </label>
                <span style={{ fontSize: 13, fontWeight: 700, color: progressColor }}>{progress}%</span>
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
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              gap: 8,
            }}
          >
            <button
              type="submit"
              disabled={!title.trim()}
              style={{
                flex: 1,
                background: title.trim() ? 'var(--color-action-primary)' : 'var(--color-bg-card)',
                color: title.trim() ? '#ffffff' : 'var(--color-text-muted)',
                border: 'none',
                borderRadius: 8,
                padding: '10px 0',
                fontSize: 14,
                fontWeight: 600,
                cursor: title.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => {
                if (title.trim())
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-action-primary-hover)';
              }}
              onMouseLeave={(e) => {
                if (title.trim())
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-action-primary)';
              }}
            >
              추가
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                background: 'var(--color-action-secondary)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: '10px 0',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-action-secondary-hover)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-action-secondary)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)';
              }}
            >
              취소
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
