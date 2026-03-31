'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card as CardType } from '@/lib/types';

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  high:   { color: 'var(--color-priority-high)',   bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)', label: '높음' },
  medium: { color: 'var(--color-priority-medium)', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)',  label: '보통' },
  low:    { color: 'var(--color-priority-low)',    bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.25)',  label: '낮음' },
};

const AGENT_COLORS: Record<string, string> = {
  homer:  'var(--color-agent-homer)',
  bart:   'var(--color-agent-bart)',
  marge:  'var(--color-agent-marge)',
  lisa:   'var(--color-agent-lisa)',
  krusty: 'var(--color-agent-krusty)',
  sid:    'var(--color-agent-sid)',
};

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
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: color,
        border: '1.5px solid var(--color-bg-card)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
        color: '#ffffff',
        flexShrink: 0,
        boxShadow: `0 0 6px ${color}50`,
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
  accentColor?: string;
  isFiltered?: boolean;
}

export default function Card({ card, onDelete, onCardClick, accentColor, isFiltered = false }: Props) {
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

  // 마감일 aria-label
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
        // Space 및 방향키는 dnd-kit이 처리
      }}
    >
      <div
        onClick={() => onCardClick(card)}
        className={`card-item${isFiltered ? ' card-base--filtered-out' : ''}`}
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: '10px 12px',
          cursor: isDragging ? 'grabbing' : 'grab',
          opacity: isDragging ? 0.4 : 1,
          position: 'relative',
          overflow: 'hidden',
          transition: 'transform 150ms, box-shadow 150ms, border-color 150ms',
          boxShadow: isDragging
            ? '0 8px 32px rgba(0,0,0,0.4)'
            : '0 1px 4px rgba(0,0,0,0.2)',
        }}
        onMouseEnter={(e) => {
          if (isFiltered) return;
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = 'translateY(-1px)';
          el.style.boxShadow = `0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px ${accentColor ?? 'var(--color-border-strong)'}40`;
          el.style.borderColor = accentColor ? `${accentColor}50` : 'var(--color-border-strong)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = '';
          el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';
          el.style.borderColor = 'var(--color-border)';
        }}
      >
        {/* 우선순위 왼쪽 바 */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            background: priorityCfg.color,
            borderRadius: '0 3px 3px 0',
            opacity: 0.8,
          }}
        />

        {/* 제목 행 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingLeft: 8 }}>
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
              fontSize: 12,
              opacity: 0,
              transition: 'opacity 150ms, color 150ms, background 150ms',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#f87171';
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            ✕
          </button>
        </div>

        {/* 설명 */}
        {card.description && (
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 12,
              lineHeight: 1.5,
              margin: '5px 0 0 20px',
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
        {progress > 0 && (
          <div style={{ marginTop: 8, paddingLeft: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>진행률</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: progressColor }}>{progress}%</span>
            </div>
            <div className="progress-bar-track">
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${progressColor}90 0%, ${progressColor} 100%)`,
                  borderRadius: 2,
                  transition: 'width 300ms ease-out',
                }}
              />
            </div>
          </div>
        )}

        {/* 태그 pills */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, paddingLeft: 8 }}>
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="tag-pill" style={{ fontSize: 10, padding: '1px 6px', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)', padding: '1px 4px' }}>
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
            marginTop: 8,
            paddingLeft: 8,
            flexWrap: 'wrap',
          }}
        >
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

          {/* 마감일 뱃지 */}
          {card.due_date && dueDateStatus && (
            <span
              aria-label={dueDateAriaLabel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 10,
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 10,
                background: dueDateStatus === 'overdue'
                  ? 'var(--color-due-overdue-bg)'
                  : dueDateStatus === 'soon'
                    ? 'var(--color-due-warning-bg)'
                    : 'rgba(148,163,184,0.1)',
                color: dueDateStatus === 'overdue'
                  ? 'var(--color-due-overdue)'
                  : dueDateStatus === 'soon'
                    ? 'var(--color-due-warning)'
                    : 'var(--color-text-muted)',
                border: `1px solid ${dueDateStatus === 'overdue' ? 'rgba(248,113,113,0.3)' : dueDateStatus === 'soon' ? 'var(--color-due-warning-border)' : 'var(--color-border)'}`,
              }}
            >
              <span aria-hidden="true">
                {dueDateStatus === 'overdue' ? '⚠' : dueDateStatus === 'soon' ? '🔔' : '📅'}
              </span>
              {formatDueDate(card.due_date)}
            </span>
          )}

          {card.assignee && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
              <AgentAvatar name={card.assignee} />
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }} aria-label={`담당자: ${card.assignee}`}>{card.assignee}</span>
            </div>
          )}
        </div>
      </div>

      {/* hover 시 삭제 버튼 표시 */}
      <style>{`
        .card-item:hover .delete-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
