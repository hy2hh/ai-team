'use client';
import { useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ColumnWithCards, Card as CardType } from '@/lib/types';
import Card from './Card';
import AddCardModal from './AddCardModal';
import CardDetailModal from './CardDetailModal';
import { api } from '@/lib/api';

// 컬럼 인덱스에 따른 accent 색상
const COLUMN_ACCENTS = ['#4f7ef0', '#fbbf24', '#c084fc', '#4ade80', '#fb923c', '#f472b6'];
const COLUMN_ACCENT_BG = [
  'rgba(79,126,240,0.08)',
  'rgba(251,191,36,0.08)',
  'rgba(192,132,252,0.08)',
  'rgba(74,222,128,0.08)',
  'rgba(251,146,60,0.08)',
  'rgba(244,114,182,0.08)',
];

interface Props {
  column: ColumnWithCards;
  onRefresh: () => void;
  columnIndex: number;
}

export default function Column({ column, onRefresh, columnIndex }: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [colError, setColError] = useState<string | null>(null);
  const { setNodeRef, isOver } = useDroppable({ id: `col-${column.id}` });

  const accentColor = COLUMN_ACCENTS[columnIndex % COLUMN_ACCENTS.length];
  const accentBg = COLUMN_ACCENT_BG[columnIndex % COLUMN_ACCENT_BG.length];

  const isWipExceeded = column.wip_limit != null && column.cards.length >= column.wip_limit;
  const wipPercent = column.wip_limit ? Math.min((column.cards.length / column.wip_limit) * 100, 100) : 0;

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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 288,
          flexShrink: 0,
          borderRadius: 14,
          background: isOver ? `${accentBg}` : 'var(--color-bg-elevated)',
          border: `1px solid ${isOver ? accentColor : 'var(--color-border)'}`,
          boxShadow: isOver
            ? `0 0 0 1px ${accentColor}40, 0 4px 24px rgba(0,0,0,0.2)`
            : '0 2px 12px rgba(0,0,0,0.15)',
          transition: 'border-color 150ms, box-shadow 150ms, background 150ms',
          overflow: 'hidden',
        }}
      >
        {/* 상단 accent 바 */}
        <div
          style={{
            height: 3,
            background: `linear-gradient(90deg, ${accentColor} 0%, ${accentColor}60 100%)`,
            borderRadius: '14px 14px 0 0',
            flexShrink: 0,
          }}
        />

        {/* 컬럼 헤더 */}
        <div
          style={{
            padding: '12px 16px 10px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: accentColor,
                flexShrink: 0,
                boxShadow: `0 0 6px ${accentColor}80`,
              }}
            />
            <h3
              style={{
                color: 'var(--color-text-primary)',
                fontSize: 13,
                fontWeight: 600,
                margin: 0,
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {column.name}
            </h3>
          </div>
          <span
            style={{
              background: isWipExceeded ? 'rgba(248,113,113,0.12)' : 'var(--color-bg-card)',
              color: isWipExceeded ? '#f87171' : 'var(--color-text-secondary)',
              border: isWipExceeded ? '1px solid rgba(248,113,113,0.3)' : '1px solid var(--color-border)',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 20,
              padding: '2px 8px',
              flexShrink: 0,
              transition: 'all 150ms',
            }}
          >
            {column.cards.length}{column.wip_limit ? `/${column.wip_limit}` : ''}
          </span>
        </div>

        {/* WIP 진행 바 */}
        {column.wip_limit != null && (
          <div
            style={{
              height: 2,
              background: 'var(--color-border)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${wipPercent}%`,
                background: isWipExceeded ? '#f87171' : accentColor,
                transition: 'width 300ms ease-out, background 150ms',
              }}
            />
          </div>
        )}

        {/* 에러 메시지 */}
        {colError && (
          <div
            style={{
              margin: '8px 12px 0',
              fontSize: 12,
              color: '#f87171',
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.2)',
              borderRadius: 6,
              padding: '6px 10px',
            }}
          >
            {colError}
          </div>
        )}

        {/* 카드 목록 */}
        <div
          ref={setNodeRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 12,
            minHeight: 120,
            flex: 1,
          }}
        >
          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            {column.cards.map((card: CardType) => (
              <Card
                key={card.id}
                card={card}
                onDelete={handleDelete}
                onCardClick={setSelectedCard}
                accentColor={accentColor}
              />
            ))}
          </SortableContext>
          {column.cards.length === 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 80,
                color: 'var(--color-text-muted)',
                fontSize: 12,
                borderRadius: 8,
                border: `1px dashed var(--color-border)`,
                transition: 'border-color 150ms',
              }}
            >
              카드 없음
            </div>
          )}
        </div>

        {/* 카드 추가 버튼 */}
        <div style={{ padding: '0 12px 12px' }}>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={isWipExceeded}
            style={{
              width: '100%',
              color: isWipExceeded ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
              background: 'transparent',
              border: `1px dashed ${isWipExceeded ? 'var(--color-border)' : 'var(--color-border-strong)'}`,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 500,
              cursor: isWipExceeded ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              transition: 'all 150ms',
              opacity: isWipExceeded ? 0.4 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isWipExceeded) {
                (e.currentTarget as HTMLButtonElement).style.color = accentColor;
                (e.currentTarget as HTMLButtonElement).style.borderColor = accentColor;
                (e.currentTarget as HTMLButtonElement).style.background = accentBg;
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border-strong)';
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
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
