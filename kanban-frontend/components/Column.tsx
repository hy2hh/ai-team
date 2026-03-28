'use client';
import { useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ColumnWithCards, Card as CardType } from '@/lib/types';
import Card from './Card';
import AddCardModal from './AddCardModal';
import CardDetailModal from './CardDetailModal';
import { api } from '@/lib/api';

interface Props {
  column: ColumnWithCards;
  onRefresh: () => void;
}

export default function Column({ column, onRefresh }: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [colError, setColError] = useState<string | null>(null);
  const { setNodeRef, isOver } = useDroppable({ id: `col-${column.id}` });

  const isWipExceeded = column.wip_limit != null && column.cards.length >= column.wip_limit;

  const handleAdd = async (data: { title: string; description: string; priority: string; assignee: string; progress: number }) => {
    if (isWipExceeded) {
      setColError(`WIP 한도(${column.wip_limit})에 도달했습니다.`);
      setTimeout(() => setColError(null), 3000);
      return;
    }
    try {
      await api.createCard({ column_id: column.id, ...data });
      setShowAddModal(false);
      onRefresh();
    } catch (e) {
      console.error('Failed to create card', e);
      setColError('카드 생성에 실패했습니다. 다시 시도해주세요.');
      setTimeout(() => setColError(null), 3000);
    }
  };

  const handleDelete = async (cardId: number) => {
    try {
      await api.deleteCard(cardId);
      onRefresh();
    } catch (e) {
      console.error('Failed to delete card', e);
      setColError('카드 삭제에 실패했습니다. 다시 시도해주세요.');
      setTimeout(() => setColError(null), 3000);
    }
  };

  const cardIds = useMemo(
    () => column.cards.map((c: CardType) => `card-${c.id}`),
    [column.cards]
  );

  return (
    <>
      <div className={`flex flex-col w-72 shrink-0 rounded-xl bg-[var(--color-bg-elevated)] transition-colors duration-200 ${isOver ? 'ring-2 ring-[var(--color-drag-over)]' : ''}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-[var(--color-text-primary)] font-semibold text-sm">{column.name}</h3>
          <span className={`bg-[var(--color-bg-card)] text-xs rounded-full px-2 py-0.5 ${isWipExceeded ? 'text-red-400 font-semibold' : 'text-[var(--color-text-secondary)]'}`}>
            {column.cards.length}{column.wip_limit ? `/${column.wip_limit}` : ''}
          </span>
        </div>
        {colError && (
          <div className="mx-3 mt-2 text-xs text-red-400 bg-red-400/10 rounded px-2 py-1">{colError}</div>
        )}
        <div
          ref={setNodeRef}
          className="flex flex-col gap-2 p-3 min-h-[120px] flex-1"
        >
          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            {column.cards.map((card: CardType) => (
              <Card key={card.id} card={card} onDelete={handleDelete} onCardClick={setSelectedCard} />
            ))}
          </SortableContext>
        </div>
        <div className="px-3 pb-3">
          <button
            onClick={() => setShowAddModal(true)}
            disabled={isWipExceeded}
            className="w-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)] rounded-lg py-2 text-sm transition-colors text-left px-3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + 카드 추가
          </button>
        </div>
      </div>
      {showAddModal && (
        <AddCardModal onAdd={handleAdd} onClose={() => setShowAddModal(false)} />
      )}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          columnName={column.name}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </>
  );
}
