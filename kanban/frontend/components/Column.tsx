'use client';
import { useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ColumnWithCards, Card as CardType } from '@/lib/types';
import { FilterState } from './filter-bar';
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
  filter: FilterState | null;
}

function isCardFiltered(card: CardType, filter: FilterState | null): boolean {
  if (!filter) return false;
  if (filter.assignees.size > 0 && !filter.assignees.has(card.assignee ?? '')) return true;
  if (filter.priorities.size > 0 && !filter.priorities.has(card.priority)) return true;
  return false;
}

export default function Column({ column, onRefresh, columnIndex, filter }: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [colError, setColError] = useState<string | null>(null);
  const { setNodeRef, isOver } = useDroppable({ id: `col-${column.id}` });

  const accentColor = COLUMN_ACCENTS[columnIndex % COLUMN_ACCENTS.length];
  const accentBg = COLUMN_ACCENT_BG[columnIndex % COLUMN_ACCENT_BG.length];

  const isWipExceeded = column.wip_limit != null && column.cards.length >= column.wip_limit;
  const wipPercent = column.wip_limit ? Math.min((column.cards.length / column.wip_limit) * 100, 100) : 0;

  const visibleCount = useMemo(
    () => column.cards.filter((c) => !isCardFiltered(c, filter)).length,
    [column.cards, filter]
  );
  const allFiltered = filter && column.cards.length > 0 && visibleCount === 0;

  const handleAdd = async (data: { title: string; description: string; priority: string; assignee: string; progress: number; due_date: string | null; tags: string[] }) => {
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

  const handleUpdate = async (
    id: number,
    data: Partial<Pick<CardType, 'title' | 'description' | 'priority' | 'assignee' | 'progress' | 'due_date' | 'tags'>>
  ) => {
    await api.updateCard(id, data as Parameters<typeof api.updateCard>[1]);
    onRefresh();
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
        className={`column-container${isWipExceeded ? ' column-wip-exceeded' : ''}`}
        role="region"
        aria-label={`${column.name} 컬럼, 카드 ${column.cards.length}개${column.wip_limit ? `, WIP 한도 ${column.wip_limit}` : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 14,
          background: isOver ? `${accentBg}` : 'var(--color-bg-elevated)',
          border: `1px solid ${isOver ? accentColor : isWipExceeded ? 'rgba(248,113,113,0.45)' : 'var(--color-border)'}`,
          boxShadow: isOver
            ? `0 0 0 1px ${accentColor}40, 0 4px 24px rgba(0,0,0,0.2)`
            : isWipExceeded
              ? '0 0 0 1px rgba(248,113,113,0.25), 0 2px 12px rgba(0,0,0,0.15)'
              : '0 2px 12px rgba(0,0,0,0.15)',
          transition: 'border-color var(--duration-fast), box-shadow var(--duration-fast), background var(--duration-fast)',
          overflow: 'hidden',
        }}
      >
        {/* 상단 accent 바 */}
        <div
          aria-hidden="true"
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
              aria-hidden="true"
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
            aria-label={`카드 수 ${column.cards.length}${column.wip_limit ? ` / WIP 한도 ${column.wip_limit}` : ''}`}
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
            role="progressbar"
            aria-valuenow={column.cards.length}
            aria-valuemin={0}
            aria-valuemax={column.wip_limit}
            aria-label={`WIP 진행률 ${column.cards.length}/${column.wip_limit}`}
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
            role="alert"
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
                isFiltered={isCardFiltered(card, filter)}
              />
            ))}
          </SortableContext>

          {column.cards.length === 0 && (
            <div className="empty-state">
              카드 없음
            </div>
          )}

          {/* 필터 후 빈 상태 */}
          {allFiltered && (
            <div
              role="status"
              aria-live="polite"
              className="empty-state"
              style={{ marginTop: 8 }}
            >
              <span aria-hidden="true">🔍</span>
              <span>필터 조건에 맞는 카드 없음</span>
            </div>
          )}
        </div>

        {/* 카드 추가 버튼 — CSS custom property 기반 hover */}
        <div style={{ padding: '0 12px 12px' }}>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={isWipExceeded}
            aria-label={`${column.name} 컬럼에 카드 추가${isWipExceeded ? ' (WIP 한도 도달)' : ''}`}
            className="add-card-btn"
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
              transition: 'all var(--duration-fast)',
              opacity: isWipExceeded ? 0.4 : 1,
              minHeight: 44,
              // CSS custom properties for hover (globals.css .add-card-btn:not(:disabled):hover)
              '--col-accent': accentColor,
              '--col-accent-bg': accentBg,
            } as React.CSSProperties}
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
          onUpdate={handleUpdate}
        />
      )}
    </>
  );
}
