'use client';
import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ColumnWithCards, Card as CardType } from '@/lib/types';
import { FilterState } from './filter-bar';
import Card from './Card';
import AddCardModal from './AddCardModal';
import CardDetailModal from './CardDetailModal';
import { api } from '@/lib/api';

interface Props {
  column: ColumnWithCards;
  onRefresh: () => void;
  filter: FilterState | null;
}

function isCardFiltered(card: CardType, filter: FilterState | null): boolean {
  if (!filter) return false;
  if (filter.assignees.size > 0 && !filter.assignees.has(card.assignee ?? '')) return true;
  if (filter.priorities.size > 0 && !filter.priorities.has(card.priority)) return true;
  return false;
}

const Column = memo(function Column({ column, onRefresh, filter }: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [colError, setColError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { setNodeRef, isOver } = useDroppable({ id: `col-${column.id}` });

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) { clearTimeout(errorTimerRef.current); }
    };
  }, []);

  const isWipExceeded = column.wip_limit != null && column.cards.length >= column.wip_limit;
  const wipPercent = column.wip_limit ? Math.min((column.cards.length / column.wip_limit) * 100, 100) : 0;

  const visibleCount = useMemo(
    () => column.cards.filter((c) => !isCardFiltered(c, filter)).length,
    [column.cards, filter]
  );
  const allFiltered = filter && column.cards.length > 0 && visibleCount === 0;

  const handleAdd = useCallback(async (data: { title: string; description: string; priority: string; assignee: string; progress: number; due_date: string | null; tags: string[] }) => {
    if (isWipExceeded) {
      setColError(`WIP 한도(${column.wip_limit})에 도달했습니다.`);
      if (errorTimerRef.current) { clearTimeout(errorTimerRef.current); }
      errorTimerRef.current = setTimeout(() => setColError(null), 3000);
      return;
    }
    try {
      await api.createCard({ column_id: column.id, ...data });
      setShowAddModal(false);
      onRefresh();
    } catch (e) {
      console.error('Failed to create card', e);
      setColError('카드 생성에 실패했습니다. 다시 시도해주세요.');
      if (errorTimerRef.current) { clearTimeout(errorTimerRef.current); }
      errorTimerRef.current = setTimeout(() => setColError(null), 3000);
    }
  }, [column.id, column.wip_limit, isWipExceeded, onRefresh]);

  const handleUpdate = useCallback(async (
    id: number,
    data: Partial<Pick<CardType, 'title' | 'description' | 'priority' | 'assignee' | 'progress' | 'due_date' | 'tags'>>
  ) => {
    await api.updateCard(id, data as Parameters<typeof api.updateCard>[1]);
    onRefresh();
  }, [onRefresh]);

  const handleDelete = useCallback(async (cardId: number) => {
    try {
      await api.deleteCard(cardId);
      onRefresh();
    } catch (e) {
      console.error('Failed to delete card', e);
      setColError('카드 삭제에 실패했습니다. 다시 시도해주세요.');
      if (errorTimerRef.current) { clearTimeout(errorTimerRef.current); }
      errorTimerRef.current = setTimeout(() => setColError(null), 3000);
    }
  }, [onRefresh]);

  const cardIds = useMemo(
    () => column.cards.map((c: CardType) => `card-${c.id}`),
    [column.cards]
  );

  return (
    <>
      <div
        className={`column-container${isWipExceeded ? ' column-wip-exceeded' : ''}`}
        data-testid="column-container"
        role="region"
        aria-label={`${column.name} 컬럼, 카드 ${column.cards.length}개${column.wip_limit ? `, WIP 한도 ${column.wip_limit}` : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 16,
          background: isOver ? 'var(--color-point-subtle)' : 'var(--color-bg-elevated)',
          border: `1px solid ${
            isOver
              ? 'var(--color-point-border)'
              : isWipExceeded
                ? 'var(--color-wip-exceeded-border)'
                : 'var(--color-border)'
          }`,
          boxShadow: isOver
            ? '0 0 0 1px var(--color-point-border), 0 4px 24px rgba(0,0,0,0.2)'
            : isWipExceeded
              ? '0 0 0 1px var(--color-wip-exceeded-shadow), 0 2px 12px rgba(0,0,0,0.15)'
              : '0 2px 12px rgba(0,0,0,0.12)',
          transition: 'border-color var(--duration-fast), box-shadow var(--duration-fast), background var(--duration-fast)',
          overflow: 'hidden',
        }}
      >
        {/* 컬럼 헤더 */}
        <div
          style={{
            padding: '14px 16px 12px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {/* 중립 상태 점 — 브랜드 포인트 고정 (rainbow 제거) */}
            <span
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: isOver
                  ? 'var(--color-point)'
                  : 'var(--color-border-strong)',
                flexShrink: 0,
                transition: 'background var(--duration-fast)',
              }}
            />
            <h3
              className="text-text-primary text-[13px] font-semibold m-0 overflow-hidden text-ellipsis whitespace-nowrap"
              style={{
                letterSpacing: '-0.01em',
              }}
            >
              {column.name}
            </h3>
          </div>

          {/* 카드 수 / WIP 배지 */}
          <span
            aria-label={`카드 수 ${column.cards.length}${column.wip_limit ? ` / WIP 한도 ${column.wip_limit}` : ''}`}
            style={{
              background: isWipExceeded ? 'var(--color-priority-high-bg)' : 'transparent',
              color: isWipExceeded ? 'var(--color-priority-high)' : 'var(--color-text-muted)',
              border: `1px solid ${isWipExceeded ? 'var(--color-priority-high-border)' : 'var(--color-border)'}`,
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

        {/* WIP 진행 바 — 포인트컬러 단일 색상 */}
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
                background: isWipExceeded ? 'var(--color-priority-high)' : 'var(--color-point)',
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
              background: 'var(--color-priority-high-bg)',
              border: '1px solid var(--color-priority-high-border)',
              borderRadius: 8,
              padding: '6px 10px',
            }}
            className="text-[color:var(--color-priority-high)]"
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
                isFiltered={isCardFiltered(card, filter)}
              />
            ))}
          </SortableContext>

          {column.cards.length === 0 && (
            <div
              className="empty-state empty-state--column"
              role="status"
              aria-label={`${column.name} 컬럼에 카드가 없습니다`}
            >
              <svg
                className="empty-state__icon"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M9 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="empty-state__title">아직 카드가 없어요</span>
              <span className="empty-state__desc">아래 버튼을 눌러 첫 카드를 추가해보세요</span>
            </div>
          )}

          {allFiltered && (
            <div
              role="status"
              aria-live="polite"
              className="empty-state empty-state--column"
            >
              <svg
                className="empty-state__icon"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M11 8v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16.5 16.5L20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="empty-state__title">필터 결과 없음</span>
              <span className="empty-state__desc">현재 필터 조건에 맞는 카드가 없어요</span>
            </div>
          )}
        </div>

        {/* 카드 추가 버튼 — 포인트컬러 hover */}
        <div style={{ padding: '0 12px 12px' }}>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={isWipExceeded}
            aria-label={`${column.name} 컬럼에 카드 추가${isWipExceeded ? ' (WIP 한도 도달)' : ''}`}
            className={`add-card-btn ${isWipExceeded ? 'text-text-muted' : 'text-text-secondary'}`}
            data-testid="card-create-btn"
            style={{
              width: '100%',
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
              // 포인트컬러 hover (globals.css .add-card-btn:not(:disabled):hover)
              '--col-accent': 'var(--color-point)',
              '--col-accent-bg': 'var(--color-point-subtle)',
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
});

export default Column;
