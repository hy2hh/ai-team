'use client';
import { Board } from '@/lib/types';
import { Widget, SkeletonLine } from '@/components/dashboard/skeleton-widget';

interface ColumnStatusOverviewProps {
  board: Board | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

function getColumnColor(name: string): string {
  const n = name.toLowerCase().replace(/\s+/g, '');
  if (n.includes('todo') || n.includes('할일')) return 'var(--color-col-todo)';
  if (n.includes('inprogress') || n.includes('진행') || n.includes('doing')) return 'var(--color-col-inprogress)';
  if (n.includes('review') || n.includes('검토')) return 'var(--color-col-review)';
  if (n.includes('done') || n.includes('완료')) return 'var(--color-col-done)';
  return 'var(--color-col-default)';
}

function isDoneColumn(name: string): boolean {
  const n = name.toLowerCase().replace(/\s+/g, '');
  return n.includes('done') || n.includes('완료');
}

export default function ColumnStatusOverview({
  board,
  loading = false,
  error = false,
  onRetry,
}: ColumnStatusOverviewProps) {
  const totalCards = board?.columns.reduce((sum, col) => sum + col.cards.length, 0) ?? 0;

  return (
    <Widget
      title="Column Status"
      ariaLabel="컬럼별 카드 현황"
      headerRight={
        !loading && !error && board ? (
          <span
            style={{
              fontSize: 12,
              color: 'var(--color-text-muted)',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: '2px 8px',
            }}
          >
            총 {totalCards}장
          </span>
        ) : null
      }
    >
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SkeletonLine width={80} height={12} />
              <SkeletonLine height={6} style={{ flex: 1, borderRadius: 3 }} />
              <SkeletonLine width={40} height={12} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>
            데이터를 불러올 수 없습니다
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
      ) : !board || board.columns.length === 0 ? (
        <div
          className="empty-state"
          style={{ height: 80 }}
        >
          <span aria-hidden="true">📋</span>
          <span>카드가 없습니다</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {board.columns.map((col) => {
            const count = col.cards.length;
            const limit = col.wip_limit;
            const isExceeded = limit !== null && count > limit;
            const isDone = isDoneColumn(col.name);
            const pct = totalCards > 0 ? (count / totalCards) * 100 : 0;
            const color = getColumnColor(col.name);

            return (
              <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* 컬럼명 */}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--color-text-primary)',
                    width: 100,
                    flexShrink: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.name}
                </span>

                {/* 진행 바 */}
                <div
                  role="progressbar"
                  aria-valuenow={count}
                  aria-valuemax={totalCards}
                  aria-label={`${col.name}: ${count}장`}
                  style={{
                    flex: 1,
                    height: 6,
                    background: 'var(--color-border)',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: isExceeded ? 'var(--color-priority-high)' : color,
                      borderRadius: 3,
                      transition: 'width var(--duration-slow)',
                    }}
                  />
                </div>

                {/* 수치 + WIP */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexShrink: 0,
                    minWidth: 80,
                    justifyContent: 'flex-end',
                  }}
                >
                  {!isDone && limit !== null ? (
                    <span
                      style={{
                        fontSize: 12,
                        color: isExceeded ? 'var(--color-priority-high)' : 'var(--color-text-muted)',
                        fontWeight: isExceeded ? 600 : 400,
                      }}
                    >
                      {count} / {limit}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {count}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {pct.toFixed(0)}%
                  </span>
                  {isExceeded && (
                    <span aria-label="WIP 초과" style={{ fontSize: 13 }}>⚠️</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Widget>
  );
}
