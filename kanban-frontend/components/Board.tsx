'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Board as BoardType, Card as CardType } from '@/lib/types';
import { api } from '@/lib/api';
import Column from './Column';

export default function Board() {
  const [board, setBoard] = useState<BoardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const load = useCallback(async () => {
    try {
      const data = await api.getBoard(1);
      setBoard(data);
      setError(null);
    } catch {
      setError('백엔드 서버에 연결할 수 없습니다. http://localhost:3001 을 확인하세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !board) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (!activeId.startsWith('card-')) return;

    const cardId = parseInt(activeId.replace('card-', ''));

    let targetColumnId: number | null = null;
    if (overId.startsWith('col-')) {
      targetColumnId = parseInt(overId.replace('col-', ''));
    } else if (overId.startsWith('card-')) {
      const targetCardId = parseInt(overId.replace('card-', ''));
      for (const col of board.columns) {
        if (col.cards.some((c: CardType) => c.id === targetCardId)) {
          targetColumnId = col.id;
          break;
        }
      }
    }

    if (targetColumnId === null) return;

    // Find source column and moving card
    let sourceColumnId: number | null = null;
    let movingCard: CardType | null = null;
    for (const col of board.columns) {
      const found = col.cards.find((c: CardType) => c.id === cardId);
      if (found) {
        sourceColumnId = col.id;
        movingCard = found;
        break;
      }
    }

    if (sourceColumnId === targetColumnId || !movingCard) return;

    // 낙관적 UI 업데이트: API 응답 전 즉시 상태 반영
    const optimisticBoard = {
      ...board,
      columns: board.columns.map(col => {
        if (col.id === sourceColumnId) {
          return { ...col, cards: col.cards.filter((c: CardType) => c.id !== cardId) };
        }
        if (col.id === targetColumnId) {
          return { ...col, cards: [...col.cards, { ...movingCard!, column_id: targetColumnId! }] };
        }
        return col;
      }),
    };
    setBoard(optimisticBoard);

    try {
      await api.moveCard(cardId, targetColumnId);
      await load(); // 서버 상태와 최종 동기화
    } catch (e) {
      console.error('Failed to move card', e);
      await load(); // 실패 시 서버 상태로 롤백
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-[var(--color-text-secondary)] text-sm animate-pulse">보드 로딩 중...</div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-red-400 text-sm text-center">{error}</div>
    </div>
  );

  if (!board) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 items-start">
        {board.columns.map((col) => (
          <Column key={col.id} column={col} onRefresh={load} />
        ))}
      </div>
    </DndContext>
  );
}
