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

const BOARD_ID = Number(process.env.NEXT_PUBLIC_BOARD_ID ?? 1);

export default function Board() {
  const [board, setBoard] = useState<BoardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const load = useCallback(async () => {
    try {
      const data = await api.getBoard(BOARD_ID);
      setBoard(data);
      setError(null);
    } catch {
      setError('백엔드 서버에 연결할 수 없습니다. http://localhost:3001 을 확인하세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 5000);
    return () => clearInterval(interval);
  }, [load]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
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

    const targetCol = board.columns.find(col => col.id === targetColumnId);
    if (targetCol?.wip_limit && targetCol.cards.length >= targetCol.wip_limit) {
      setDragError(`"${targetCol.name}" 컬럼이 WIP 한도(${targetCol.wip_limit})에 도달했습니다.`);
      setTimeout(() => setDragError(null), 3000);
      return;
    }

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
      await load();
    } catch (e) {
      console.error('Failed to move card', e);
      setDragError('카드 이동에 실패했습니다. 잠시 후 다시 시도해주세요.');
      setTimeout(() => setDragError(null), 3000);
      await load();
    }
  }, [board, load]);

  if (loading) return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 320,
        gap: 16,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: '3px solid var(--color-border-strong)',
          borderTopColor: 'var(--color-action-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: 0 }}>보드 로딩 중...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 320,
        gap: 12,
      }}
    >
      <div style={{ fontSize: 32 }}>⚠️</div>
      <p style={{ color: '#f87171', fontSize: 14, textAlign: 'center', margin: 0, maxWidth: 360 }}>
        {error}
      </p>
      <button
        onClick={() => void load()}
        style={{
          marginTop: 8,
          padding: '8px 20px',
          background: 'var(--color-action-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        다시 시도
      </button>
    </div>
  );

  if (!board) return null;

  return (
    <>
      {/* 드래그 에러 토스트 */}
      {dragError && (
        <div
          style={{
            position: 'fixed',
            top: 72,
            right: 24,
            zIndex: 100,
            background: 'rgba(248,113,113,0.12)',
            border: '1px solid rgba(248,113,113,0.3)',
            color: '#f87171',
            fontSize: 13,
            fontWeight: 500,
            padding: '10px 16px',
            borderRadius: 10,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'toastIn 200ms ease-out',
          }}
        >
          <span>⚠️</span>
          {dragError}
        </div>
      )}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div
          style={{
            display: 'flex',
            gap: 16,
            overflowX: 'auto',
            paddingBottom: 16,
            alignItems: 'flex-start',
          }}
        >
          {board.columns.map((col, idx) => (
            <Column key={col.id} column={col} onRefresh={load} columnIndex={idx} />
          ))}
        </div>
      </DndContext>
    </>
  );
}
