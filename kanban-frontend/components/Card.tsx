'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card as CardType } from '@/lib/types';

const priorityColors = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-slate-700 rounded-lg p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-white text-sm font-medium leading-snug flex-1">{card.title}</p>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
          className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs shrink-0"
        >
          ✕
        </button>
      </div>
      {card.description && (
        <p className="text-slate-400 text-xs mt-1 line-clamp-2">{card.description}</p>
      )}
      <div className="flex items-center gap-2 mt-2">
        <span className={`inline-block w-2 h-2 rounded-full ${priorityColors[card.priority]}`} />
        <span className="text-slate-400 text-xs capitalize">{card.priority}</span>
        {card.assignee && (
          <span className="ml-auto text-slate-400 text-xs">@{card.assignee}</span>
        )}
      </div>
    </div>
  );
}
