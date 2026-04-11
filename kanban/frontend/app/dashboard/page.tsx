'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { Card } from '@/lib/types';
import { ActivityEvent, Notification } from '@/lib/dashboard-types';
import { api } from '@/lib/api';
import DashboardHeader from '@/components/dashboard/dashboard-header';
import SummaryStatCard from '@/components/dashboard/summary-stat-card';
import ColumnStatusOverview from '@/components/dashboard/column-status-overview';
import WipMonitor from '@/components/dashboard/wip-monitor';
import PriorityDistribution from '@/components/dashboard/priority-distribution';
import AgentWorkload from '@/components/dashboard/agent-workload';
import RecentActivityFeed from '@/components/dashboard/recent-activity-feed';
import NotificationPreview from '@/components/dashboard/notification-preview';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const BOARD_ID = Number(process.env.NEXT_PUBLIC_BOARD_ID ?? 1);

// ──────────────────────────────────────────────
// 유틸리티: 보드 데이터에서 ActivityEvent[] 파생
// ──────────────────────────────────────────────
function deriveActivitiesFromBoard(board: Awaited<ReturnType<typeof api.getBoard>>): ActivityEvent[] {
  const allCards = board.columns.flatMap((col) =>
    col.cards.map((card) => ({ ...card, columnName: col.name }))
  );
  return allCards
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 10)
    .map((card) => {
      const createdTime = new Date(card.created_at).getTime();
      const updatedTime = new Date(card.updated_at).getTime();
      const isNew = Math.abs(updatedTime - createdTime) < 5_000;
      return {
        id: `card-${card.id}-${isNew ? 'created' : 'updated'}`,
        type: (isNew ? 'card:created' : 'card:updated') as ActivityEvent['type'],
        cardId: card.id,
        cardTitle: card.title,
        actor: card.assignee ?? undefined,
        timestamp: card.updated_at,
      };
    });
}

// ──────────────────────────────────────────────
// 유틸리티: 대시보드 수치 계산
// ──────────────────────────────────────────────
function computeSummary(board: Awaited<ReturnType<typeof api.getBoard>>) {
  const allCards: Card[] = board.columns.flatMap((col) => col.cards);
  const doneCards = board.columns
    .filter((col) => {
      const n = col.name.toLowerCase().replace(/\s+/g, '');
      return n.includes('done') || n.includes('완료');
    })
    .flatMap((col) => col.cards);

  const totalCards = allCards.length;
  const completionRate =
    totalCards > 0 ? Math.round((doneCards.length / totalCards) * 100) : 0;

  const wipViolations = board.columns.filter(
    (col) => col.wip_limit !== null && col.cards.length > col.wip_limit!
  ).length;

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  const overdueCount = allCards.filter((card) => {
    if (!card.due_date) return false;
    return new Date(card.due_date) < now;
  }).length;

  const dueSoonCount = allCards.filter((card) => {
    if (!card.due_date) return false;
    const due = new Date(card.due_date);
    return due >= now && due <= tomorrow;
  }).length;

  return { totalCards, completionRate, wipViolations, dueSoonCount, overdueCount };
}

// ──────────────────────────────────────────────
// SWR fetcher — notifications
// ──────────────────────────────────────────────
async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetch(`${BASE}/notifications?limit=5`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Notification[]>;
}

export default function DashboardPage() {
  // ── SWR: 보드 데이터 ──
  const {
    data: board,
    error: boardError,
    isLoading: boardLoading,
    mutate: mutateBoard,
  } = useSWR(`dashboard-board-${BOARD_ID}`, () => api.getBoard(BOARD_ID), {
    revalidateOnFocus: false,
  });

  // ── SWR: 알림 데이터 (404 등 에러 시 빈 상태로 처리) ──
  const {
    data: notifications = [],
    isLoading: notifLoading,
    mutate: mutateNotif,
  } = useSWR('dashboard-notifications', fetchNotifications, {
    revalidateOnFocus: false,
    onErrorRetry: () => {}, // 미구현 엔드포인트 → 재시도 없이 빈 상태 유지
  });

  // 화면 폭 감지 (모바일 여부) — non-fetch useEffect, 유지
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 479px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── WebSocket — non-fetch, SWR mutate로 재검증 트리거 ──
  useEffect(() => {
    const wsUrl = BASE.replace(/^http/, 'ws');
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) { return; }
      if (ws) {
        ws.onclose = null;
        ws.onmessage = null;
        ws.close();
      }
      ws = new WebSocket(wsUrl);
      ws.onmessage = () => {
        if (debounceTimer) { clearTimeout(debounceTimer); }
        debounceTimer = setTimeout(() => {
          void mutateBoard();
          void mutateNotif();
        }, 300);
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
  }, [mutateBoard, mutateNotif]);

  // ── 파생 데이터 ──
  const activities = useMemo<ActivityEvent[]>(
    () => board ? deriveActivitiesFromBoard(board) : [],
    [board]
  );
  const allCards: Card[] = board?.columns.flatMap((col) => col.cards) ?? [];
  const summary = board ? computeSummary(board) : null;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // 낙관적 업데이트 — SWR cache를 직접 갱신 (API 호출 없음)
  const handleMarkAllRead = useCallback(() => {
    void mutateNotif(
      notifications.map((n) => ({ ...n, is_read: 1 })),
      false,
    );
  }, [mutateNotif, notifications]);

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] flex flex-col">
      {/* ── 헤더 ── */}
      <DashboardHeader unreadCount={unreadCount} />

      {/* ── 대시보드 콘텐츠 ── */}
      <div className="flex-1 p-3 sm:py-6 sm:px-7 flex flex-col gap-3 sm:gap-4 max-w-[1280px] mx-auto w-full">
        {/* Row 1 — Summary Stats (4개 수치 카드) */}
        <div className="dashboard-grid dashboard-grid--stats">
          <SummaryStatCard
            icon="📋"
            value={summary?.totalCards ?? 0}
            label="Total Cards"
            accentColor="var(--color-action-primary)"
            loading={boardLoading}
            error={!!boardError}
          />
          <SummaryStatCard
            icon="✅"
            value={summary ? `${summary.completionRate}%` : 0}
            label="Completion Rate"
            accentColor="var(--color-col-done)"
            loading={boardLoading}
            error={!!boardError}
          />
          <SummaryStatCard
            icon="⚠️"
            value={summary?.wipViolations ?? 0}
            label="WIP Violations"
            accentColor="var(--color-priority-high)"
            loading={boardLoading}
            error={!!boardError}
          />
          <SummaryStatCard
            icon="🔴"
            value={summary ? summary.dueSoonCount + summary.overdueCount : 0}
            label="Due Soon"
            accentColor="var(--color-due-warning)"
            loading={boardLoading}
            error={!!boardError}
          />
        </div>

        {/* Row 2 — Column Status + WIP Monitor */}
        <div className="dashboard-grid dashboard-grid--two-col">
          <ColumnStatusOverview
            board={board ?? null}
            loading={boardLoading}
            error={!!boardError}
            onRetry={() => void mutateBoard()}
          />
          <WipMonitor
            board={board ?? null}
            loading={boardLoading}
            error={!!boardError}
          />
        </div>

        {/* Row 3 — Priority Distribution + Agent Workload */}
        <div className="dashboard-grid dashboard-grid--half">
          <PriorityDistribution
            cards={allCards}
            loading={boardLoading}
            error={!!boardError}
          />
          <AgentWorkload
            cards={allCards}
            loading={boardLoading}
            error={!!boardError}
          />
        </div>

        {/* Row 4 — Recent Activity Feed */}
        <RecentActivityFeed
          activities={activities}
          loading={boardLoading}
          error={false}
          onRetry={() => void mutateBoard()}
          isMobile={isMobile}
        />

        {/* Row 5 — Notification Center Preview */}
        <NotificationPreview
          notifications={notifications}
          loading={notifLoading}
          error={false}
          onMarkAllRead={handleMarkAllRead}
        />
      </div>
    </main>
  );
}
