'use client';
import { useEffect, useState, useCallback } from 'react';
import { Board, Card } from '@/lib/types';
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
function deriveActivitiesFromBoard(board: Board): ActivityEvent[] {
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
function computeSummary(board: Board) {
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
// async helper — notifications
// ──────────────────────────────────────────────
async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetch(`${BASE}/notifications?limit=5`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Notification[]>;
}

export default function DashboardPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState(false);

  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifError, setNotifError] = useState(false);

  // 화면 폭 감지 (모바일 여부)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 479px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── 보드 로드 ──
  const loadBoard = useCallback(async () => {
    try {
      const data = await api.getBoard(BOARD_ID);
      setBoard(data);
      setBoardError(false);
      // 보드 데이터에서 활동 파생
      setActivities(deriveActivitiesFromBoard(data));
    } catch {
      setBoardError(true);
    } finally {
      setBoardLoading(false);
      setActivityLoading(false);
    }
  }, []);

  // ── 알림 로드 ──
  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const data = await fetchNotifications();
      setNotifications(data);
      setNotifError(false);
    } catch {
      // notifications 엔드포인트 미구현 — 빈 상태 처리
      setNotifications([]);
      setNotifError(false); // 404는 에러가 아닌 빈 상태로 처리
    } finally {
      setNotifLoading(false);
    }
  }, []);

  // ── 초기 로드 + WebSocket ──
  useEffect(() => {
    setBoardLoading(true);
    setActivityLoading(true);
    void loadBoard();
    void loadNotifications();

    const wsUrl = BASE.replace(/^http/, 'ws');
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
        debounceTimer = setTimeout(() => {
          void loadBoard();
          void loadNotifications();
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
  }, [loadBoard, loadNotifications]);

  // ── 파생 데이터 ──
  const allCards: Card[] = board?.columns.flatMap((col) => col.cards) ?? [];
  const summary = board ? computeSummary(board) : null;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg-base)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── 헤더 ── */}
      <DashboardHeader unreadCount={unreadCount} />

      {/* ── 대시보드 콘텐츠 ── */}
      <div
        style={{
          flex: 1,
          padding: isMobile ? '12px' : '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 12 : 16,
          maxWidth: 1280,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Row 1 — Summary Stats (4개 수치 카드) */}
        <div className="dashboard-grid dashboard-grid--stats">
          <SummaryStatCard
            icon="📋"
            value={summary?.totalCards ?? 0}
            label="Total Cards"
            accentColor="var(--color-action-primary)"
            loading={boardLoading}
            error={boardError}
          />
          <SummaryStatCard
            icon="✅"
            value={summary ? `${summary.completionRate}%` : 0}
            label="Completion Rate"
            accentColor="var(--color-col-done)"
            loading={boardLoading}
            error={boardError}
          />
          <SummaryStatCard
            icon="⚠️"
            value={summary?.wipViolations ?? 0}
            label="WIP Violations"
            accentColor="var(--color-priority-high)"
            loading={boardLoading}
            error={boardError}
          />
          <SummaryStatCard
            icon="🔴"
            value={summary ? summary.dueSoonCount + summary.overdueCount : 0}
            label="Due Soon"
            accentColor="var(--color-due-warning)"
            loading={boardLoading}
            error={boardError}
          />
        </div>

        {/* Row 2 — Column Status + WIP Monitor */}
        <div className="dashboard-grid dashboard-grid--two-col">
          <ColumnStatusOverview
            board={board}
            loading={boardLoading}
            error={boardError}
            onRetry={() => void loadBoard()}
          />
          <WipMonitor
            board={board}
            loading={boardLoading}
            error={boardError}
          />
        </div>

        {/* Row 3 — Priority Distribution + Agent Workload */}
        <div className="dashboard-grid dashboard-grid--half">
          <PriorityDistribution
            cards={allCards}
            loading={boardLoading}
            error={boardError}
          />
          <AgentWorkload
            cards={allCards}
            loading={boardLoading}
            error={boardError}
          />
        </div>

        {/* Row 4 — Recent Activity Feed */}
        <RecentActivityFeed
          activities={activities}
          loading={activityLoading}
          error={false}
          onRetry={() => void loadBoard()}
          isMobile={isMobile}
        />

        {/* Row 5 — Notification Center Preview */}
        <NotificationPreview
          notifications={notifications}
          loading={notifLoading}
          error={notifError}
          onMarkAllRead={handleMarkAllRead}
        />
      </div>
    </main>
  );
}
