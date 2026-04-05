'use client';
import { Notification } from '@/lib/dashboard-types';
import { Widget, SkeletonLine } from '@/components/dashboard/skeleton-widget';

interface NotificationPreviewProps {
  notifications: Notification[];
  loading?: boolean;
  error?: boolean;
  onMarkAllRead?: () => void;
}

const TYPE_ICON_MAP: Record<string, string> = {
  'card:created':  '🆕',
  'card:moved':    '➡️',
  'card:updated':  '✏️',
  'card:deleted':  '🗑️',
  'card:assigned': '👤',
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

export default function NotificationPreview({
  notifications,
  loading = false,
  error = false,
  onMarkAllRead,
}: NotificationPreviewProps) {
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Widget
      title="Notifications"
      ariaLabel="알림 센터 미리보기"
      style={{ padding: 16 }}
      headerRight={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {unreadCount > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-point)',
                background: 'var(--color-point-subtle)',
                border: '1px solid var(--color-point-border)',
                borderRadius: 6,
                padding: '2px 8px',
              }}
            >
              미읽음 {unreadCount}
            </span>
          )}
          {unreadCount > 0 && onMarkAllRead && (
            <button
              onClick={onMarkAllRead}
              style={{
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 0',
                minHeight: 44,
                transition: 'color var(--duration-fast)',
              }}
            >
              모두 읽음
            </button>
          )}
        </div>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'center', gap: 10 }}
              aria-busy="true"
              aria-label="로딩 중"
            >
              <SkeletonLine width={8} height={8} borderRadius="50%" />
              <SkeletonLine style={{ flex: 1 }} />
              <SkeletonLine width={40} />
            </div>
          ))}
        </div>
      ) : error ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '12px 0' }}>
          알림을 불러올 수 없습니다
        </p>
      ) : notifications.length === 0 ? (
        <p
          style={{
            fontSize: 13,
            color: 'var(--color-col-done)',
            textAlign: 'center',
            padding: '12px 0',
          }}
        >
          ✅ 새 알림이 없습니다
        </p>
      ) : (
        <div
          role="log"
          aria-live="assertive"
          aria-label="알림 목록"
          style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
        >
          {notifications.map((notif) => {
            const isUnread = !notif.is_read;
            const icon = TYPE_ICON_MAP[notif.type] ?? '🔔';

            return (
              <div
                key={notif.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 10px 10px 12px',
                  borderRadius: 8,
                  marginBottom: 4,
                  background: isUnread ? 'var(--color-bg-card)' : 'transparent',
                  borderLeft: isUnread
                    ? '4px solid var(--color-point)'
                    : '4px solid transparent',
                  position: 'relative',
                }}
              >
                {/* 미읽음 닷 */}
                {isUnread && (
                  <div
                    aria-label="읽지 않은 알림"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--color-point)',
                      flexShrink: 0,
                    }}
                  />
                )}
                {!isUnread && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      flexShrink: 0,
                    }}
                  />
                )}

                {/* 아이콘 */}
                <span aria-hidden="true" style={{ fontSize: 14, flexShrink: 0 }}>
                  {icon}
                </span>

                {/* 메시지 */}
                <p
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: isUnread ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {notif.message}
                  {notif.actor && (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                        marginLeft: 6,
                      }}
                    >
                      — {notif.actor}
                    </span>
                  )}
                </p>

                {/* 시간 */}
                <time
                  dateTime={notif.created_at}
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatRelativeTime(notif.created_at)}
                </time>
              </div>
            );
          })}

          <a
            href="/dashboard#notifications"
            style={{
              display: 'block',
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--color-point)',
              textDecoration: 'none',
              padding: '10px 0 4px',
              borderTop: '1px solid var(--color-border)',
              marginTop: 4,
              minHeight: 44,
              lineHeight: '34px',
            }}
          >
            알림 센터 전체 보기 →
          </a>
        </div>
      )}
    </Widget>
  );
}
