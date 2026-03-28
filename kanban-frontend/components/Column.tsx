'use client';
import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ColumnWithCards, Card as CardType } from '@/lib/types';
import Card from './Card';
import AddCardModal from './AddCardModal';
import { api } from '@/lib/api';

interface Props {
  column: ColumnWithCards;
  onRefresh: () => void;
}

export default function Column({ column, onRefresh }: Props) {
  const [showModal, setShowModal] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: `col-${column.id}` });

  const handleAdd = async (data: { title: string; description: string; priority: string; assignee: string }) => {
    await api.createCard({ column_id: column.id, ...data });
    setShowModal(false);
    onRefresh();
  };

  const handleDelete = async (cardId: number) => {
    await api.deleteCard(cardId);
    onRefresh();
  };

  const cardIds = column.cards.map((c: CardType) => `card-${c.id}`);

  return (
    <>
      <div className={`flex flex-col w-72 shrink-0 rounded-xl bg-slate-800 ${isOver ? 'ring-2 ring-blue-400' : ''}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-white font-semibold text-sm">{column.name}</h3>
          <span className="bg-slate-700 text-slate-300 text-xs rounded-full px-2 py-0.5">
            {column.cards.length}{column.wip_limit ? `/${column.wip_limit}` : ''}
          </span>
        </div>
        <div
          ref={setNodeRef}
          className="flex flex-col gap-2 p-3 min-h-[120px] flex-1"
        >
          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            {column.cards.map((card: CardType) => (
              <Card key={card.id} card={card} onDelete={handleDelete} />
            ))}
          </SortableContext>
        </div>
        <div className="px-3 pb-3">
          <button
            onClick={() => setShowModal(true)}
            className="w-full text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg py-2 text-sm transition-colors text-left px-3"
          >
            + 카드 추가
          </button>
        </div>
      </div>
      {showModal && (
        <AddCardModal columnId={column.id} onAdd={handleAdd} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
