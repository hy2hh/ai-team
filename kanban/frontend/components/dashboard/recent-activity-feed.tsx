'use client';
import { ActivityEvent } from '@/lib/dashboard-types';
import { Widget, SkeletonCircle, SkeletonLine } from '@/components/dashboard/skeleton-widget';

interface RecentActivityFeedProps {
  activities: ActivityEvent[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  isMobile?: boolean;
}

const AGENT_COLORS: Record<string, string> = {
  homer:    'var(--color-agent-homer)',
  bart:     'var(--color-agent-bart)',
  marge:    'var(--color-agent-marge)',
  lisa:     'var(--color-agent-lisa)',
  krusty:   'var(--color-agent-krusty)',
  sid:      'var(--color-agent-sid)',
  chalmers: 'var(--color-agent-chalmers)',
  wiggum:   'var(--color-agent-wiggum)',
};

const EVENT_CONFIG: Record<
  ActivityEvent['type'],
  { icon: string; color: string; verb: string }
> = {
  'card:created': { icon: '🆕', color: 'var(--color-col-todo)',        verb: '카드 생성' },
  'card:moved':   { icon: '➡️', color: 'var(--color-col-inprogress)',  verb: '카드 이동' },
  'card:updated': { icon: '✏️', color: 'var(--color-text-secondary)',  verb: '카드 수정' },
  'card:deleted': { icon: '🗑️', color: 'var(--color-priority-high)',   verb: '카드 삭제' },
};

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;
  if (isNaN(diff)) return '';
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  if (diff < 172_800_000) return '어제';
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

function getAgentColor(actor: string | undefined): string {
  if (!actor) return 'var(--color-text-muted)';
  return AGENT_COLORS[actor.toLowerCase()] ?? 'var(--color-col-default)';
}

function buildEventDescription(event: ActivityEvent): { pre: string; bold: string; post: string } {
  const actor = event.actor ?? '알 수 없음';
  switch (event.type) {
    case 'card:created':
      return { pre: `${actor}가 `, bold: `"${event.cardTitle}"`, post: ' 카드 생성' };
    case 'card:moved':
      return {
        pre: `${actor}가 `,
        bold: `"${event.cardTitle}"`,
        post: event.toColumn ? ` → ${event.toColumn} 이동` : ' 이동',
      };
    case 'card:updated':
      return { pre: `${actor}가 `, bold: `"${event.cardTitle}"`, post: ' 카드 수정' };
    case 'card:deleted':
      return { pre: `${actor}가 `, bold: `"${event.cardTitle}"`, post: ' 카드 삭제' };
    default:
      return { pre: '', bold: event.cardTitle, post: '' };
  }
}

export default function RecentActivityFeed({
  activities,
  loading = false,
  error = false,
  onRetry,
  isMobile = false,
}: RecentActivityFeedProps) {
  const displayActivities = isMobile ? activities.slice(0, 5) : activities;
  const skeletonCount = isMobile ? 5 : 10;

  return (
    <Widget
      title="Recent Activity"
      ariaLabel="최근 활동 피드"
      style={{ padding: 16 }}
    >
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40 }}
              aria-busy="true"
              aria-label="로딩 중"
            >
              <SkeletonCircle size={24} />
              <SkeletonLine style={{ flex: 1 }} />
              <SkeletonLine width={48} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>
            활동 내역을 불러오지 못했습니다
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                fontSize: 12,
                color: 'var(--color-action-primary)',
                background: 'none',
                border: '1px solid var(--color-action-primary)',
                borderRadius: 6,
                padding: '4px 12px',
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              재시도
            </button>
          )}
        </div>
      ) : displayActivities.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            아직 활동 내역이 없습니다
          </p>
          <a
            href="/"
            style={{
              fontSize: 13,
              color: 'var(--color-action-primary)',
              textDecoration: 'none',
              border: '1px solid var(--color-action-primary)',
              borderRadius: 8,
              padding: '8px 16px',
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            보드 시작하기
          </a>
        </div>
      ) : (
        <div
          role="log"
          aria-label="활동 목록"
          aria-live="polite"
          style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
        >
          {displayActivities.map((event) => {
            const cfg = EVENT_CONFIG[event.type] ?? EVENT_CONFIG['card:updated'];
            const desc = buildEventDescription(event);
            const agentColor = getAgentColor(event.actor);
            const initial = event.actor?.charAt(0).toUpperCase() ?? '?';

            return (
              <div
                key={event.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 40,
                  padding: '8px 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                {/* 에이전트 아바타 */}
                <div
                  aria-hidden="true"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: event.actor ? agentColor : 'var(--color-bg-card)',
                    border: event.actor ? 'none' : '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {initial}
                </div>

                {/* 이벤트 아이콘 */}
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: 13,
                    flexShrink: 0,
                    color: cfg.color,
                  }}
                >
                  {cfg.icon}
                </span>

                {/* 이벤트 텍스트 */}
                <p
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: 'var(--color-text-primary)',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {desc.pre}
                  <strong style={{ fontWeight: 600 }}>{desc.bold}</strong>
                  {desc.post}
                </p>

                {/* 타임스탬프 */}
                <time
                  dateTime={event.timestamp}
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatRelativeTime(event.timestamp)}
                </time>
              </div>
            );
          })}
        </div>
      )}
    </Widget>
  );
}
