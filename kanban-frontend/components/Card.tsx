'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card as CardType } from '@/lib/types';

const priorityColors = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const agentColors: Record<string, string> = {
  homer:  'bg-blue-500',
  bart:   'bg-cyan-500',
  marge:  'bg-purple-500',
  lisa:   'bg-green-500',
  krusty: 'bg-orange-500',
  sid:    'bg-pink-500',
};

function getProgressColor(progress: number) {
  if (progress >= 67) return 'bg-green-500';
  if (progress >= 34) return 'bg-yellow-500';
  return 'bg-red-500';
}

function AgentAvatar({ name }: { name: string }) {
  const key = name.toLowerCase();
  const color = agentColors[key] ?? 'bg-slate-500';
  const initial = name.charAt(0).toUpperCase();
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold shrink-0 ${color}`}
      title={name}
    >
      {initial}
    </span>
  );
}

interface Props {
  card: CardType;
  onDelete: (id: number) => void;
}

export default function Card({ card, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card-${card.id}`,
    data: { type: 'card', card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const progress = card.progress ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[var(--color-text-primary)] text-sm font-medium leading-snug flex-1">{card.title}</p>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
          className="text-[var(--color-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs shrink-0"
        >
          ✕
        </button>
      </div>
      {card.description && (
        <p className="text-[var(--color-text-secondary)] text-xs mt-1 line-clamp-2">{card.description}</p>
      )}

      {/* 진행률 바 */}
      <div className="mt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[var(--color-text-secondary)] text-xs">진행률</span>
          <span className="text-[var(--color-text-secondary)] text-xs font-medium">{progress}%</span>
        </div>
        <div className="w-full bg-[var(--color-border-strong)] rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${getProgressColor(progress)}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span className={`inline-block w-2 h-2 rounded-full ${priorityColors[card.priority]}`} />
        <span className="text-[var(--color-text-secondary)] text-xs capitalize">{card.priority}</span>
        {card.assignee && (
          <div className="ml-auto flex items-center gap-1.5">
            <AgentAvatar name={card.assignee} />
            <span className="text-[var(--color-text-secondary)] text-xs">{card.assignee}</span>
          </div>
        )}
      </div>
    </div>
  );
}
