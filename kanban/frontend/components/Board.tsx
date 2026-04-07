'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import useSWR from 'swr';
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
import { Button } from '@bifrost-platform/ui-kit-front';
import { Card as CardType } from '@/lib/types';
import { api } from '@/lib/api';
import { PRIORITY_CONFIG, AGENT_COLORS } from '@/lib/constants';
import Column from './Column';
import FilterBar, { FilterState } from './filter-bar';

const BOARD_ID = Number(process.env.NEXT_PUBLIC_BOARD_ID ?? 1);
const FILTER_STORAGE_KEY = 'kanban-filter-v1';

/** 드래그 중 포탈에 표시되는 카드 미리보기 */
function DragOverlayCard({ card }: { card: CardType }) {
  const p = PRIORITY_CONFIG[card.priority] ?? PRIORITY_CONFIG.medium;
  const agentColor = AGENT_COLORS[card.assignee?.toLowerCase() ?? ''] ?? '#7a90b8';
  return (
    <div
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-strong)',
        borderRadius: 12,
        padding: '14px 16px',
        width: 260,
        cursor: 'grabbing',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        transform: 'rotate(1.5deg) scale(1.02)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 제목 — 우선순위 점 인라인 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0, marginTop: 5 }} />
        <p className="text-text-primary text-[13px] font-medium" style={{ lineHeight: 1.45, margin: 0, flex: 1 }}>
          {card.title}
        </p>
      </div>
      {/* 하단: 배지 + 담당자 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, paddingLeft: 15 }}>
        <span style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}`, padding: '1px 7px', fontSize: 11, borderRadius: 20, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          {p.label}
        </span>
        {card.assignee && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: agentColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
              {card.assignee.charAt(0).toUpperCase()}
            </span>
            <span className="text-text-muted text-[11px]">{card.assignee}</span>
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

function loadFilter(): FilterState {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return EMPTY_FILTER;
    const parsed = JSON.parse(raw) as { assignees?: string[]; priorities?: string[] };
    return {
      assignees: new Set(parsed.assignees ?? []),
      priorities: new Set(parsed.priorities ?? []),
    };
  } catch {
    return EMPTY_FILTER;
  }
}

function saveFilter(filter: FilterState): void {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
      assignees: Array.from(filter.assignees),
      priorities: Array.from(filter.priorities),
    }));
  } catch {
    // localStorage 불가 환경 무시
  }
}

export default function Board() {
  // P0: useEffect 페칭 → SWR 교체
  const {
    data: board,
    error,
    isLoading,
    mutate,
  } = useSWR(`board-${BOARD_ID}`, () => api.getBoard(BOARD_ID), {
    revalidateOnFocus: false,
  });

  const [dragError, setDragError] = useState<string | null>(null);
  const dragErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filter, setFilter] = useState<FilterState>(() => {
    if (typeof window === 'undefined') { return EMPTY_FILTER; }
    return loadFilter();
  });
  const [activeCard, setActiveCard] = useState<CardType | null>(null);

  // 언마운트 시 드래그 에러 타이머 정리
  useEffect(() => {
    return () => {
      if (dragErrorTimerRef.current) { clearTimeout(dragErrorTimerRef.current); }
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // P2: WebSocket — WS 이벤트만 처리 (데이터 페칭은 SWR mutate), debounce 300ms 적용
  useEffect(() => {
    const wsUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/^http/, 'ws');
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) { return; }
      // 이전 소켓이 남아있으면 정리
      if (ws) {
        ws.onclose = null;
        ws.onmessage = null;
        ws.close();
      }
      ws = new WebSocket(wsUrl);
      ws.onmessage = () => {
        if (debounceTimer) { clearTimeout(debounceTimer); }
        debounceTimer = setTimeout(() => void mutate(), 300);
      };
      ws.onclose = () => {
        if (!disposed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (debounceTimer) { clearTimeout(debounceTimer); }
      if (reconnectTimer) { clearTimeout(reconnectTimer); }
      if (ws) {
        ws.onclose = null;
        ws.onmessage = null;
        ws.close();
      }
    };
  }, [mutate]);

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
      if (dragErrorTimerRef.current) { clearTimeout(dragErrorTimerRef.current); }
      dragErrorTimerRef.current = setTimeout(() => setDragError(null), 3000);
      return;
    }

    // 낙관적 업데이트
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
    void mutate(optimisticBoard, false);

    try {
      await api.moveCard(cardId, targetColumnId);
      void mutate();
    } catch (e) {
      console.error('Failed to move card', e);
      setDragError('카드 이동에 실패했습니다. 잠시 후 다시 시도해주세요.');
      if (dragErrorTimerRef.current) { clearTimeout(dragErrorTimerRef.current); }
      dragErrorTimerRef.current = setTimeout(() => setDragError(null), 3000);
      void mutate();
    }
  }, [board, mutate]);

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

  // 필터 상태 localStorage 동기화
  useEffect(() => {
    saveFilter(filter);
  }, [filter]);

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
  if (isLoading) return (
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
      <p className="text-text-muted text-sm m-0">보드 로딩 중...</p>
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
        백엔드 서버에 연결할 수 없습니다. http://localhost:3001 을 확인하세요.
      </p>
      <Button
        variant="primary"
        size="medium"
        onClick={() => void mutate()}
        style={{ marginTop: 8 }}
      >
        다시 시도
      </Button>
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
              onRefresh={mutate}
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
