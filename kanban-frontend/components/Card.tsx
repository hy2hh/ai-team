'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card as CardType } from '@/lib/types';

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  high:   { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)', label: '높음' },
  medium: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)',  label: '보통' },
  low:    { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.25)',  label: '낮음' },
};

const AGENT_COLORS: Record<string, string> = {
  homer:  '#4f7ef0',
  bart:   '#22d3ee',
  marge:  '#c084fc',
  lisa:   '#4ade80',
  krusty: '#fb923c',
  sid:    '#f472b6',
};

function getProgressColor(progress: number): string {
  if (progress >= 67) return '#4ade80';
  if (progress >= 34) return '#fbbf24';
  return '#f87171';
}

function AgentAvatar({ name }: { name: string }) {
  const key = name.toLowerCase();
  const color = AGENT_COLORS[key] ?? '#7a90b8';
  return (
    <span
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
}

export default function Card({ card, onDelete, onCardClick, accentColor }: Props) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <div
        onClick={() => onCardClick(card)}
        className="card-item"
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
            <div
              style={{
                height: 3,
                background: 'var(--color-border-strong)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
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

        {/* 하단: 우선순위 배지 + 담당자 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 8,
            paddingLeft: 8,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: priorityCfg.bg,
              color: priorityCfg.color,
              border: `1px solid ${priorityCfg.border}`,
              borderRadius: 20,
              padding: '1px 7px',
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            <span
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
          {card.assignee && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
              <AgentAvatar name={card.assignee} />
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{card.assignee}</span>
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
