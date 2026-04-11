'use client';
import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card as CardType } from '@/lib/types';
import { PRIORITY_CONFIG } from '@/lib/constants';

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

function getProgressLevel(progress: number): 'zero' | 'high' | 'medium' | 'low' {
  if (progress === 0) return 'zero';
  if (progress >= 67) return 'high';
  if (progress >= 34) return 'medium';
  return 'low';
}

function getProgressColor(progress: number): string {
  if (progress >= 67) return 'var(--color-progress-high)';
  if (progress >= 34) return 'var(--color-progress-medium)';
  return 'var(--color-progress-low)';
}

function AgentAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      title={name}
      data-agent={name.toLowerCase()}
      className="agent-avatar"
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

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const progress = card.progress ?? 0;
  const priorityCfg = PRIORITY_CONFIG[card.priority] ?? PRIORITY_CONFIG.medium;
  const progressLevel = getProgressLevel(progress);
  const dueDateStatus = getDueDateStatus(card.due_date ?? null);
  const tags = card.tags ?? [];

  const dueDateAriaLabel = card.due_date
    ? `마감일 ${card.due_date}${dueDateStatus === 'overdue' ? ' — 기한 초과' : dueDateStatus === 'soon' ? ' — 임박' : ''}`
    : '';

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      data-testid="card-item"
      {...attributes}
      {...listeners}
      role="article"
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
        className={[
          'card-item card-base',
          isFiltered ? 'card-base--filtered-out' : '',
          isDragging ? 'card-item--dragging opacity-60' : '',
        ].filter(Boolean).join(' ')}
        data-testid="card-edit-btn"
      >
        {/* 제목 행 — 우선순위 점 + 제목 + 삭제 버튼 */}
        <div className="flex items-start gap-2">
          <span
            aria-hidden="true"
            data-priority={card.priority}
            className="priority-dot"
          />
          <p className="text-text-primary text-[13px] font-medium leading-[1.45] flex-1 m-0">
            {card.title}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
            aria-label={`${card.title} 카드 삭제`}
            className="delete-btn card-delete-btn"
            data-testid="card-delete-btn"
          >
            ✕
          </button>
        </div>

        {/* 설명 — 최대 2줄 */}
        {card.description && (
          <p className="text-text-secondary text-xs leading-[1.5] mt-1.5 ml-[15px] line-clamp-2">
            {card.description}
          </p>
        )}

        {/* 진행률 바 */}
        <div className="mt-2.5 pl-[15px]">
          <div className="flex justify-between mb-[5px]">
            <span className="text-text-muted text-[11px]">진행률</span>
            <span
              className="text-[11px] font-semibold"
              data-progress-level={progressLevel}
            >
              {progress === 0 ? '시작 전' : `${progress}%`}
            </span>
          </div>
          <div className="progress-bar-track">
            {progress > 0 && (
              <div
                className="progress-fill"
                style={{
                  '--progress-width': `${progress}%`,
                  '--progress-color': getProgressColor(progress),
                } as React.CSSProperties}
              />
            )}
          </div>
        </div>

        {/* 태그 pills */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pl-[15px]">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="tag-pill"
                title={tag}
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span
                title={tags.slice(3).join(', ')}
                className="text-text-muted text-[10px] px-1 py-px cursor-default"
              >
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* 하단: 우선순위 배지 + 마감일 + 담당자 */}
        <div className="flex items-center gap-1.5 mt-2.5 pl-[15px] flex-wrap">
          {/* 우선순위 배지 */}
          <span className={`badge badge-priority-${card.priority}`}>
            <span
              aria-hidden="true"
              data-priority={card.priority}
              className="priority-dot-sm"
            />
            {priorityCfg.label}
          </span>

          {/* 마감일 배지 */}
          {card.due_date && dueDateStatus && (
            <span
              aria-label={dueDateAriaLabel}
              className={`due-badge due-badge--${dueDateStatus}`}
            >
              {formatDueDate(card.due_date)}
            </span>
          )}

          {/* 담당자 */}
          {card.assignee && (
            <div className="ml-auto flex items-center gap-1">
              <AgentAvatar name={card.assignee} />
              <span
                className="text-text-muted text-[11px]"
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
