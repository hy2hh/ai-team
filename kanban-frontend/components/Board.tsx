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

    // Find source column
    let sourceColumnId: number | null = null;
    for (const col of board.columns) {
      if (col.cards.some((c: CardType) => c.id === cardId)) {
        sourceColumnId = col.id;
        break;
      }
    }

    if (sourceColumnId === targetColumnId) return;

    try {
      await api.moveCard(cardId, targetColumnId);
      await load();
    } catch (e) {
      console.error('Failed to move card', e);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400 text-sm animate-pulse">보드 로딩 중...</div>
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
