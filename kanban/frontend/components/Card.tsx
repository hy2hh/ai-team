'use client';
import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card as CardType } from '@/lib/types';
import { PRIORITY_CONFIG, AGENT_COLORS } from '@/lib/constants';

function getProgressColor(progress: number): string {
  if (progress >= 67) return 'var(--color-progress-high)';
  if (progress >= 34) return 'var(--color-progress-medium)';
  return 'var(--color-progress-low)';
}

const DUE_SOON_DAYS = 3;

function getDueDateStatus(dueDate: string | null): 'overdue' | 'soon' | 'normal' | null {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= DUE_SOON_DAYS) return 'soon';
  return 'normal';
}

function formatDueDate(dueDate: string): string {
  const d = new Date(dueDate);
  return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

function AgentAvatar({ name }: { name: string }) {
  const key = name.toLowerCase();
  const color = AGENT_COLORS[key] ?? '#7a90b8';
  return (
    <span
      aria-hidden="true"
      title={name}
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: color,
        border: '1.5px solid var(--color-bg-card)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        fontWeight: 700,
        color: '#ffffff',
        flexShrink: 0,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

interface Props {
  card: CardType;
  onDelete: (id: number) => void;
  onCardClick: (card: CardType) => void;
  isFiltered?: boolean;
}

const Card = memo(function Card({ card, onDelete, onCardClick, isFiltered = false }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `card-${card.id}`,
    data: { type: 'card', card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const progress = card.progress ?? 0;
  const priorityCfg = PRIORITY_CONFIG[card.priority] ?? PRIORITY_CONFIG.medium;
  const progressColor = getProgressColor(progress);
  const dueDateStatus = getDueDateStatus(card.due_date ?? null);
  const tags = card.tags ?? [];

  const dueDateAriaLabel = card.due_date
    ? `마감일 ${card.due_date}${dueDateStatus === 'overdue' ? ' — 기한 초과' : dueDateStatus === 'soon' ? ' — 임박' : ''}`
    : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-label={`카드: ${card.title}. 우선순위 ${priorityCfg.label}${card.assignee ? `. 담당자 ${card.assignee}` : ''}${card.due_date ? `. ${dueDateAriaLabel}` : ''}. Enter 키로 상세 보기.`}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCardClick(card);
        }
      }}
    >
      <div
        onClick={() => onCardClick(card)}
        className={`card-item${isFiltered ? ' card-base--filtered-out' : ''}${isDragging ? ' card-item--dragging' : ''}`}
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '14px 16px',
          cursor: isDragging ? 'grabbing' : 'grab',
          opacity: isDragging ? 0.6 : 1,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: isDragging
            ? '0 8px 32px rgba(0,0,0,0.4)'
            : '0 1px 3px rgba(0,0,0,0.15)',
        }}
      >
        {/* 제목 행 — 우선순위 점 인라인 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {/* 우선순위 점 (좌측 바 → 인라인 점으로 교체) */}
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: priorityCfg.color,
              display: 'inline-block',
              flexShrink: 0,
              marginTop: 5,
            }}
          />
          <p
            style={{
              color: 'var(--color-text-primary)',
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1.45,
              flex: 1,
              margin: 0,
            }}
          >
            {card.title}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
            aria-label={`${card.title} 카드 삭제`}
            className="delete-btn"
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              opacity: 0,
              transition: 'opacity var(--duration-fast), color var(--duration-fast), background var(--duration-fast)',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* 설명 — 점 너비(7px) + 간격(8px) = 15px 들여쓰기로 제목 텍스트와 정렬 */}
        {card.description && (
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 12,
              lineHeight: 1.5,
              margin: '6px 0 0 15px',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {card.description}
          </p>
        )}

        {/* 진행률 바 */}
        <div style={{ marginTop: 10, paddingLeft: 15 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>진행률</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: progress === 0 ? 'var(--color-text-muted)' : progressColor }}>
              {progress === 0 ? '시작 전' : `${progress}%`}
            </span>
          </div>
          <div className="progress-bar-track">
            {progress > 0 && (
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${progressColor}80 0%, ${progressColor} 100%)`,
                  borderRadius: 2,
                  transition: `width var(--duration-slow) ease-out`,
                }}
              />
            )}
          </div>
        </div>

        {/* 태그 pills */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8, paddingLeft: 15 }}>
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="tag-pill"
                title={tag}
                style={{ fontSize: 10, padding: '1px 6px', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span
                title={tags.slice(3).join(', ')}
                style={{ fontSize: 10, color: 'var(--color-text-muted)', padding: '1px 4px', cursor: 'default' }}
              >
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* 하단: 우선순위 배지 + 마감일 + 담당자 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 10,
            paddingLeft: 15,
            flexWrap: 'wrap',
          }}
        >
          {/* 우선순위 배지 */}
          <span
            className="badge"
            style={{
              background: priorityCfg.bg,
              color: priorityCfg.color,
              border: `1px solid ${priorityCfg.border}`,
              padding: '1px 7px',
              fontSize: 11,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: priorityCfg.color,
                display: 'inline-block',
              }}
            />
            {priorityCfg.label}
          </span>

          {/* 마감일 뱃지 — 이모지 없이 텍스트만 */}
          {card.due_date && dueDateStatus && (
            <span
              aria-label={dueDateAriaLabel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 11,
                fontWeight: 500,
                padding: '1px 7px',
                borderRadius: 10,
                background: dueDateStatus === 'overdue'
                  ? 'var(--color-due-overdue-bg)'
                  : dueDateStatus === 'soon'
                    ? 'var(--color-due-warning-bg)'
                    : 'transparent',
                color: dueDateStatus === 'overdue'
                  ? 'var(--color-due-overdue)'
                  : dueDateStatus === 'soon'
                    ? 'var(--color-due-warning)'
                    : 'var(--color-text-muted)',
                border: `1px solid ${
                  dueDateStatus === 'overdue'
                    ? 'var(--color-due-overdue-border)'
                    : dueDateStatus === 'soon'
                      ? 'var(--color-due-warning-border)'
                      : 'var(--color-border)'
                }`,
              }}
            >
              {formatDueDate(card.due_date)}
            </span>
          )}

          {/* 담당자 */}
          {card.assignee && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AgentAvatar name={card.assignee} />
              <span
                style={{ fontSize: 11, color: 'var(--color-text-muted)' }}
                aria-label={`담당자: ${card.assignee}`}
              >
                {card.assignee}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default Card;
