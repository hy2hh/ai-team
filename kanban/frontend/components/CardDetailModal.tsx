'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/lib/types';
import { AGENTS, PRIORITY_CONFIG, getAgentColor, getProgressColor } from '@/lib/constants';

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface CardActivity {
  id: number;
  agent: string;
  action: 'created' | 'moved' | 'progress_updated' | 'assignee_changed' | 'commented';
  detail: string;
  created_at: string;
}

interface Props {
  card: Card;
  columnName: string;
  onClose: () => void;
  onUpdate?: (id: number, data: Partial<Pick<Card, 'title' | 'description' | 'priority' | 'assignee' | 'progress' | 'due_date' | 'tags'>>) => Promise<void>;
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const DUE_SOON_DAYS = 3;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function getDueDateStatus(dueDate: string | null): 'overdue' | 'soon' | 'normal' | null {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= DUE_SOON_DAYS) return 'soon';
  return 'normal';
}

function getActivityIcon(action: CardActivity['action']): string {
  const icons: Record<CardActivity['action'], string> = {
    created: '✨', moved: '🔀', progress_updated: '📊', assignee_changed: '👤', commented: '💬',
  };
  return icons[action];
}

function getDummyActivities(card: Card): CardActivity[] {
  return [{ id: 1, agent: card.assignee ?? 'sid', action: 'created', detail: '카드가 생성되었습니다.', created_at: card.created_at }];
}

// ─── 서브 컴포넌트 ────────────────────────────────────────────────────────────

function AgentAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const color = getAgentColor(name);
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%', background: color,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size <= 28 ? 10 : 14, fontWeight: 700, color: '#ffffff', flexShrink: 0,
        border: '2px solid var(--color-bg-surface)', boxShadow: `0 0 10px ${color}40`,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function CardDetailModal({ card, columnName, onClose, onUpdate }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // 편집 상태
  const [editTitle, setEditTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(card.title);
  const [editDesc, setEditDesc] = useState(false);
  const [descVal, setDescVal] = useState(card.description ?? '');
  const [assigneeVal, setAssigneeVal] = useState(card.assignee ?? '');
  const [progressVal, setProgressVal] = useState(card.progress);
  const [priorityVal, setPriorityVal] = useState(card.priority);
  const [dueDateVal, setDueDateVal] = useState(card.due_date ?? '');
  const [tagInput, setTagInput] = useState('');
  const [tagsVal, setTagsVal] = useState<string[]>(card.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 언마운트 시 토스트 타이머 정리
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) { clearTimeout(toastTimerRef.current); }
    };
  }, []);

  const progress = progressVal;
  const progressColor = getProgressColor(progress);
  const priorityCfg = PRIORITY_CONFIG[priorityVal] ?? PRIORITY_CONFIG.medium;
  const activities = getDummyActivities(card);
  const dueDateStatus = getDueDateStatus(dueDateVal || null);

  // 토스트 표시
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) { clearTimeout(toastTimerRef.current); }
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  };

  // 필드 저장 헬퍼
  const save = useCallback(async (data: Parameters<NonNullable<typeof onUpdate>>[1]) => {
    if (!onUpdate) return;
    setSaving(true);
    try {
      await onUpdate(card.id, data);
      showToast('저장되었습니다');
    } catch {
      showToast('저장 실패 — 다시 시도하세요');
    } finally {
      setSaving(false);
    }
  }, [card.id, onUpdate]);

  // 태그 추가
  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || tagsVal.includes(tag) || tagsVal.length >= 10) return;
    const next = [...tagsVal, tag];
    setTagsVal(next);
    setTagInput('');
    void save({ tags: next });
  };

  // 태그 삭제
  const removeTag = (tag: string) => {
    const next = tagsVal.filter((t) => t !== tag);
    setTagsVal(next);
    void save({ tags: next });
  };

  // 포커스 트랩 + ESC
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key !== 'Tab') return;
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, [onClose]);

  useEffect(() => {
    closeBtnRef.current?.focus();
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="detail-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 20px', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        ref={modalRef}
        className="detail-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
          borderRadius: 18, boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
          width: '100%', maxWidth: 560, maxHeight: '88vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'detailFadeIn 200ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* ── 헤더 ── */}
        <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span className="text-text-muted text-[11px] font-medium">📋</span>
              <span className="text-text-muted text-[11px] font-medium">{columnName}</span>
            </div>
            {/* 제목 인라인 편집 */}
            {editTitle ? (
              <input
                autoFocus
                value={titleVal}
                onChange={(e) => setTitleVal(e.target.value)}
                onBlur={() => { setEditTitle(false); if (titleVal.trim()) void save({ title: titleVal.trim() }); else setTitleVal(card.title); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } if (e.key === 'Escape') { setTitleVal(card.title); setEditTitle(false); } }}
                aria-label="카드 제목 편집"
                className="text-text-primary"
                style={{
                  fontSize: 17, fontWeight: 600, lineHeight: 1.4,
                  background: 'var(--color-bg-elevated)', border: '1px solid var(--color-point)',
                  borderRadius: 6, padding: '4px 8px', width: '100%', outline: 'none',
                  boxShadow: '0 0 0 3px var(--color-point-subtle)',
                }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: onUpdate ? 'text' : 'default' }}>
                <h2
                  id="detail-modal-title"
                  onClick={() => onUpdate && setEditTitle(true)}
                  className="text-text-primary"
                  style={{
                    fontSize: 17, fontWeight: 600, lineHeight: 1.4,
                    margin: 0, letterSpacing: '-0.01em',
                    flex: 1,
                  }}
                >
                  {titleVal}
                </h2>
                {onUpdate && (
                  <span
                    aria-hidden="true"
                    onClick={() => setEditTitle(true)}
                    title="클릭하여 제목 편집"
                    className="text-text-muted"
                    style={{
                      fontSize: 12, cursor: 'text',
                      padding: '3px 5px', borderRadius: 4, flexShrink: 0, marginTop: 2,
                      background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
                      lineHeight: 1,
                    }}
                  >
                    ✎
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="모달 닫기"
            className="modal-close-btn"
          >
            ×
          </button>
        </div>

        {/* ── 바디 ── */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 메타 정보 행 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            {/* 담당자 */}
            <div>
              <p className="text-text-muted text-[11px] font-medium uppercase" style={{ margin: '0 0 6px', letterSpacing: '0.05em' }}>담당자</p>
              {onUpdate ? (
                <select
                  value={assigneeVal}
                  onChange={(e) => { setAssigneeVal(e.target.value); void save({ assignee: e.target.value || null }); }}
                  aria-label="담당자 선택"
                  className="text-text-primary"
                  style={{
                    fontSize: 13, fontWeight: 600,
                    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
                    borderRadius: 6, padding: '4px 8px', cursor: 'pointer', outline: 'none',
                  }}
                >
                  <option value="">미배정</option>
                  {AGENTS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {card.assignee ? (
                    <><AgentAvatar name={card.assignee} size={36} /><p className="text-text-primary" style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{card.assignee}</p></>
                  ) : (
                    <p className="text-text-muted italic" style={{ fontSize: 13, margin: 0 }}>미배정</p>
                  )}
                </div>
              )}
            </div>

            {/* 우선순위 */}
            <div>
              <p className="text-text-muted text-[11px] font-medium uppercase" style={{ margin: '0 0 6px', letterSpacing: '0.05em' }}>우선순위</p>
              {onUpdate ? (
                <select
                  value={priorityVal}
                  onChange={(e) => { setPriorityVal(e.target.value as Card['priority']); void save({ priority: e.target.value as Card['priority'] }); }}
                  aria-label="우선순위 선택"
                  style={{
                    fontSize: 12, fontWeight: 600,
                    background: priorityCfg.bg, color: priorityCfg.color,
                    border: `1px solid ${priorityCfg.border}`, borderRadius: 20,
                    padding: '4px 10px', cursor: 'pointer', outline: 'none',
                  }}
                >
                  <option value="high">높음</option>
                  <option value="medium">보통</option>
                  <option value="low">낮음</option>
                </select>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: priorityCfg.bg, color: priorityCfg.color, border: `1px solid ${priorityCfg.border}` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: priorityCfg.color, display: 'inline-block' }} />
                  {priorityCfg.label}
                </span>
              )}
            </div>

            {/* 날짜 */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
              <div>
                <p className="text-text-muted text-[11px] font-medium uppercase" style={{ margin: '0 0 3px', letterSpacing: '0.05em' }}>생성일</p>
                <p className="text-text-secondary font-medium" style={{ fontSize: 13, margin: 0 }}>{formatDate(card.created_at)}</p>
              </div>
              <div>
                <p className="text-text-muted text-[11px] font-medium uppercase" style={{ margin: '0 0 3px', letterSpacing: '0.05em' }}>수정일</p>
                <p className="text-text-secondary font-medium" style={{ fontSize: 13, margin: 0 }}>{formatDate(card.updated_at)}</p>
              </div>
            </div>
          </div>

          {/* 마감일 */}
          <div>
            <p className="text-text-muted text-[11px] font-semibold uppercase" style={{ margin: '0 0 8px', letterSpacing: '0.06em' }}>마감일</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {onUpdate ? (
                <input
                  type="date"
                  value={dueDateVal}
                  onChange={(e) => { setDueDateVal(e.target.value); void save({ due_date: e.target.value || null }); }}
                  aria-label="마감일"
                  className="text-text-primary"
                  style={{
                    fontSize: 13, fontWeight: 500,
                    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
                    borderRadius: 8, padding: '6px 10px', outline: 'none', cursor: 'pointer',
                  }}
                />
              ) : (
                dueDateVal ? (
                  <span className="text-text-secondary font-medium" style={{ fontSize: 13 }}>{formatDate(dueDateVal)}</span>
                ) : (
                  <span className="text-text-muted italic" style={{ fontSize: 13 }}>마감일 미설정</span>
                )
              )}
              {dueDateVal && dueDateStatus && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                  background: dueDateStatus === 'overdue' ? 'var(--color-due-overdue-bg)' : dueDateStatus === 'soon' ? 'var(--color-due-warning-bg)' : 'var(--color-due-normal-bg)',
                  color: dueDateStatus === 'overdue' ? 'var(--color-due-overdue)' : dueDateStatus === 'soon' ? 'var(--color-due-warning)' : 'var(--color-due-normal)',
                  border: `1px solid ${dueDateStatus === 'overdue' ? 'var(--color-due-overdue-border)' : dueDateStatus === 'soon' ? 'var(--color-due-warning-border)' : 'var(--color-due-normal-border)'}`,
                }}>
                  {dueDateStatus === 'overdue' ? '⚠ 기한 초과' : dueDateStatus === 'soon' ? '🔔 임박' : '✓ 정상'}
                </span>
              )}
            </div>
          </div>

          {/* 태그 */}
          <div>
            <p className="text-text-muted text-[11px] font-semibold uppercase" style={{ margin: '0 0 8px', letterSpacing: '0.06em' }}>태그</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: onUpdate ? 8 : 0 }}>
              {tagsVal.length === 0 && !onUpdate && (
                <span className="text-text-muted italic" style={{ fontSize: 13 }}>태그 없음</span>
              )}
              {tagsVal.map((tag) => (
                <span key={tag} className="tag-pill">
                  {tag}
                  {onUpdate && (
                    <button
                      onClick={() => removeTag(tag)}
                      aria-label={`태그 ${tag} 삭제`}
                      className="text-tag-text"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            {onUpdate && tagsVal.length < 10 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="태그 입력 후 Enter"
                  aria-label="새 태그 입력"
                  maxLength={50}
                  className="text-text-primary"
                  style={{
                    flex: 1, fontSize: 13,
                    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
                    borderRadius: 8, padding: '6px 10px', outline: 'none',
                  }}
                />
                <Button
                  type="button"
                  variant="primary"
                  size="medium"
                  onClick={addTag}
                  disabled={!tagInput.trim()}
                >
                  추가
                </Button>
              </div>
            )}
          </div>

          {/* 진행률 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p className="text-text-muted text-[11px] font-semibold uppercase m-0" style={{ letterSpacing: '0.05em' }}>진행률</p>
              <span style={{ fontSize: 15, fontWeight: 700, color: progressColor }}>{progress}%</span>
            </div>
            {onUpdate ? (
              <input
                type="range"
                min={0} max={100} step={10}
                value={progressVal}
                onChange={(e) => setProgressVal(Number(e.target.value))}
                onMouseUp={() => save({ progress: progressVal })}
                onTouchEnd={() => save({ progress: progressVal })}
                aria-label={`진행률 ${progressVal}%`}
                aria-valuenow={progressVal}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{ width: '100%', accentColor: progressColor, cursor: 'pointer' }}
              />
            ) : (
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`진행률 ${progress}%`}
                style={{ height: 8, borderRadius: 4, background: 'var(--color-border-strong)', overflow: 'hidden' }}
              >
                <div style={{
                  height: '100%', borderRadius: 4,
                  background: `linear-gradient(90deg, ${progressColor}80 0%, ${progressColor} 100%)`,
                  width: `${progress}%`, transition: 'width 500ms cubic-bezier(0.34,1.56,0.64,1)',
                  boxShadow: `0 0 8px ${progressColor}60`,
                }} />
              </div>
            )}
          </div>

          {/* 설명 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p className="text-text-muted text-[11px] font-semibold uppercase m-0" style={{ letterSpacing: '0.06em' }}>설명</p>
              {onUpdate && !editDesc && (
                <button
                  onClick={() => setEditDesc(true)}
                  aria-label="설명 편집"
                  className="text-text-muted"
                  style={{
                    fontSize: 11, cursor: 'pointer',
                    padding: '2px 7px', borderRadius: 4, background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)', fontWeight: 500,
                    transition: 'color var(--duration-fast), border-color var(--duration-fast)',
                  }}
                >
                  ✎ 편집
                </button>
              )}
            </div>
            {editDesc ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea
                  autoFocus
                  value={descVal}
                  onChange={(e) => setDescVal(e.target.value)}
                  rows={4}
                  aria-label="카드 설명 편집"
                  className="text-text-secondary"
                  style={{
                    fontSize: 14, lineHeight: 1.65,
                    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-point)',
                    borderRadius: 10, padding: '12px 14px', resize: 'vertical', outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <Button
                    type="button"
                    variant="outline"
                    size="medium"
                    onClick={() => { setDescVal(card.description ?? ''); setEditDesc(false); }}
                  >
                    취소
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="medium"
                    onClick={() => { setEditDesc(false); void save({ description: descVal || null }); }}
                  >
                    저장
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={descVal ? 'text-text-secondary' : 'text-text-muted'}
                style={{
                  fontSize: 14, lineHeight: 1.65,
                  fontStyle: descVal ? 'normal' : 'italic',
                  background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
                  borderRadius: 10, padding: '12px 14px',
                  cursor: 'default',
                }}
              >
                {descVal || '설명이 없습니다.'}
              </div>
            )}
          </div>

          {/* 활동 로그 */}
          <div>
            <p className="text-text-muted text-[11px] font-semibold uppercase" style={{ margin: '0 0 12px', letterSpacing: '0.06em' }}>활동</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 200, overflowY: 'auto' }}>
              {activities.length === 0 ? (
                <p className="text-text-muted italic" style={{ fontSize: 13, padding: '12px 0', margin: 0 }}>아직 활동 기록이 없습니다.</p>
              ) : (
                activities.map((act) => (
                  <div key={act.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px' }}>
                    <AgentAvatar name={act.agent} size={28} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 3 }}>
                        <span className="text-text-primary" style={{ fontSize: 13, fontWeight: 600 }}>{act.agent}</span>
                        <span className="text-text-muted text-[11px]">{formatDate(act.created_at)}</span>
                      </div>
                      <p className="text-text-secondary" style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>{getActivityIcon(act.action)} {act.detail}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── 푸터 ── */}
        <div className="modal-footer modal-footer--split" style={{ background: 'var(--color-bg-elevated)' }}>
          {/* 저장 중 표시 */}
          <span className="text-text-muted text-[length:var(--text-caption)]" style={{ opacity: saving ? 1 : 0, transition: 'opacity 200ms' }}>저장 중…</span>
          <Button variant="outline" size="medium" onClick={onClose}>
            닫기
          </Button>
        </div>

        {/* 토스트 */}
        {toast && (
          <div
            className="text-text-primary"
            style={{
              position: 'absolute', bottom: 70, left: '50%', transform: 'translateX(-50%)',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              fontSize: 13, fontWeight: 500,
              padding: '8px 18px', borderRadius: 10,
              boxShadow: '0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px var(--color-border)',
              pointerEvents: 'none', whiteSpace: 'nowrap',
              animation: 'toastIn 200ms cubic-bezier(0.16,1,0.3,1)',
            }}>
            {toast}
          </div>
        )}
      </div>

      {/* 애니메이션 + 반응형 */}
      <style>{`
        @keyframes detailFadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @media (max-width: 479px) {
          .detail-modal-overlay {
            align-items: flex-end !important;
            padding: 0 !important;
          }
          .detail-modal-container {
            max-width: 100vw !important;
            width: 100vw !important;
            max-height: 95dvh !important;
            border-radius: 18px 18px 0 0 !important;
            animation: slideUp 280ms cubic-bezier(0.16,1,0.3,1) !important;
          }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (min-width: 480px) and (max-width: 767px) {
          .detail-modal-container {
            width: calc(100vw - 40px) !important;
            max-height: 92vh !important;
          }
        }
      `}</style>
    </div>
  );
}
