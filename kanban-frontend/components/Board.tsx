'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Board as BoardType, Card as CardType } from '@/lib/types';
import { api } from '@/lib/api';
import Column from './Column';
import FilterBar, { FilterState } from './filter-bar';

const BOARD_ID = Number(process.env.NEXT_PUBLIC_BOARD_ID ?? 1);

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  high:   { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)', label: '높음' },
  medium: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)',  label: '보통' },
  low:    { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.25)',  label: '낮음' },
};

const AGENT_COLORS: Record<string, string> = {
  homer: '#f59e0b', bart: '#3b82f6', marge: '#8b5cf6',
  lisa: '#10b981', krusty: '#ef4444', sid: '#06b6d4',
};

/** 드래그 중 포탈에 표시되는 카드 미리보기 */
function DragOverlayCard({ card }: { card: CardType }) {
  const p = PRIORITY_CONFIG[card.priority] ?? PRIORITY_CONFIG.medium;
  const agentColor = AGENT_COLORS[card.assignee?.toLowerCase() ?? ''] ?? '#7a90b8';
  return (
    <div
      style={{
        background: 'var(--color-bg-card)',
        border: `1px solid ${p.color}60`,
        borderRadius: 10,
        padding: '10px 12px',
        width: 260,
        cursor: 'grabbing',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
        transform: 'rotate(2deg) scale(1.03)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 왼쪽 우선순위 바 */}
      <div style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, background: p.color, borderRadius: '0 3px 3px 0', opacity: 0.8 }} />
      {/* 제목 */}
      <p style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 500, lineHeight: 1.45, margin: 0, paddingLeft: 8 }}>
        {card.title}
      </p>
      {/* 하단: 배지 + 담당자 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingLeft: 8 }}>
        <span style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}`, padding: '1px 7px', fontSize: 11, borderRadius: 20, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          {p.label}
        </span>
        {card.assignee && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: agentColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', boxShadow: `0 0 6px ${agentColor}50` }}>
              {card.assignee.charAt(0).toUpperCase()}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{card.assignee}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const EMPTY_FILTER: FilterState = {
  assignees: new Set<string>(),
  priorities: new Set<string>(),
};

export default function Board() {
  const [board, setBoard] = useState<BoardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [activeCard, setActiveCard] = useState<CardType | null>(null);

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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const activeId = String(active.id);
    if (!activeId.startsWith('card-') || !board) {
      return;
    }
    const cardId = parseInt(activeId.replace('card-', ''));
    for (const col of board.columns) {
      const found = col.cards.find((c: CardType) => c.id === cardId);
      if (found) {
        setActiveCard(found);
        break;
      }
    }
  }, [board]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveCard(null);
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

  // ── 필터 핸들러 ────────────────────────────────────────────────────────────
  const handleToggleAssignee = useCallback((name: string) => {
    setFilter((prev) => {
      const next = new Set(prev.assignees);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return { ...prev, assignees: next };
    });
  }, []);

  const handleTogglePriority = useCallback((p: string) => {
    setFilter((prev) => {
      const next = new Set(prev.priorities);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return { ...prev, priorities: next };
    });
  }, []);

  const handleResetFilter = useCallback(() => {
    setFilter(EMPTY_FILTER);
  }, []);

  // ── 필터 통계 ─────────────────────────────────────────────────────────────
  const isFiltering = filter.assignees.size > 0 || filter.priorities.size > 0;
  const totalCards = board?.columns.reduce((acc, col) => acc + col.cards.length, 0) ?? 0;
  const visibleCards = board?.columns.reduce((acc, col) => {
    return acc + col.cards.filter((card) => {
      if (filter.assignees.size > 0 && !filter.assignees.has(card.assignee ?? '')) return false;
      if (filter.priorities.size > 0 && !filter.priorities.has(card.priority)) return false;
      return true;
    }).length;
  }, 0) ?? 0;

  // ── 로딩 상태 ─────────────────────────────────────────────────────────────
  if (loading) return (
    <div
      role="status"
      aria-label="보드 로딩 중"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 320,
        gap: 16,
      }}
    >
      <div className="loading-spinner" />
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: 0 }}>보드 로딩 중...</p>
    </div>
  );

  if (error) return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 320,
        gap: 12,
      }}
    >
      <div style={{ fontSize: 32 }} aria-hidden="true">⚠️</div>
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
          minHeight: 44,
        }}
      >
        다시 시도
      </button>
    </div>
  );

  if (!board) return null;

  return (
    <main aria-label={`${board.name} 칸반보드`}>
      {/* 드래그 에러 토스트 */}
      {dragError && (
        <div
          role="alert"
          aria-live="assertive"
          className="toast"
          style={{
            background: 'rgba(248,113,113,0.12)',
            border: '1px solid rgba(248,113,113,0.3)',
            color: '#f87171',
          }}
        >
          <span aria-hidden="true">⚠️</span>
          {dragError}
        </div>
      )}

      {/* Phase 4 — 필터 바 */}
      <FilterBar
        filter={filter}
        onToggleAssignee={handleToggleAssignee}
        onTogglePriority={handleTogglePriority}
        onReset={handleResetFilter}
        totalCards={totalCards}
        visibleCards={visibleCards}
      />

      {/* Phase 3 — 반응형 보드 컨테이너 */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div
          className="board-container"
          role="region"
          aria-label="칸반 컬럼 목록"
        >
          {board.columns.map((col, idx) => (
            <Column
              key={col.id}
              column={col}
              onRefresh={load}
              columnIndex={idx}
              filter={isFiltering ? filter : null}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null} zIndex={9999}>
          {activeCard ? <DragOverlayCard card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>
    </main>
  );
}
