'use client';
import { Board } from '@/lib/types';
import { Widget, SkeletonLine } from '@/components/dashboard/skeleton-widget';

interface WipMonitorProps {
  board: Board | null;
  loading?: boolean;
  error?: boolean;
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

export default function WipMonitor({ board, loading = false, error = false }: WipMonitorProps) {
  const wipColumns = board?.columns.filter(
    (col) => !isDoneColumn(col.name) && col.wip_limit !== null
  ) ?? [];

  const exceededCols = wipColumns.filter(
    (col) => col.wip_limit !== null && col.cards.length > col.wip_limit
  );

  const busiestCol = board?.columns
    .filter((col) => !isDoneColumn(col.name))
    .reduce<{ name: string; count: number } | null>((best, col) => {
      if (!best || col.cards.length > best.count) {
        return { name: col.name, count: col.cards.length };
      }
      return best;
    }, null);

  return (
    <Widget title="WIP Monitor" ariaLabel="WIP 한도 모니터">
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SkeletonLine width={90} height={12} />
              <SkeletonLine height={8} style={{ flex: 1, borderRadius: 4 }} />
              <SkeletonLine width={36} height={12} />
            </div>
          ))}
        </div>
      ) : error ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '12px 0' }}>
          WIP 데이터를 불러올 수 없습니다
        </p>
      ) : !board || board.columns.length === 0 ? (
        <div className="empty-state">카드가 없습니다</div>
      ) : exceededCols.length === 0 && wipColumns.length === 0 ? (
        <p
          style={{
            fontSize: 13,
            color: 'var(--color-col-done)',
            textAlign: 'center',
            padding: '12px 0',
          }}
        >
          ✅ WIP 한도 설정된 컬럼이 없습니다
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {board.columns
              .filter((col) => !isDoneColumn(col.name))
              .map((col) => {
                const count = col.cards.length;
                const limit = col.wip_limit;
                const hasLimit = limit !== null;
                const isExceeded = hasLimit && count > limit!;
                const isWarning = hasLimit && count === limit!;
                const pct = hasLimit ? Math.min((count / limit!) * 100, 100) : 0;
                const color = getColumnColor(col.name);

                let fillColor = color;
                if (isExceeded) fillColor = 'var(--color-priority-high)';
                else if (isWarning) fillColor = 'var(--color-priority-medium)';

                return (
                  <div
                    key={col.id}
                    style={{
                      background: isExceeded ? 'rgba(248,113,113,0.08)' : 'transparent',
                      borderRadius: 8,
                      padding: isExceeded ? '8px 10px' : '0',
                      border: isExceeded ? '1px solid rgba(248,113,113,0.2)' : '1px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: hasLimit ? 6 : 0 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: isExceeded ? 'var(--color-priority-high)' : 'var(--color-text-primary)',
                          width: 90,
                          flexShrink: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col.name}
                      </span>

                      <span
                        style={{
                          fontSize: 12,
                          color: isExceeded
                            ? 'var(--color-priority-high)'
                            : isWarning
                            ? 'var(--color-priority-medium)'
                            : 'var(--color-text-muted)',
                          fontWeight: isExceeded || isWarning ? 600 : 400,
                          marginLeft: 'auto',
                          flexShrink: 0,
                        }}
                      >
                        {hasLimit ? `${count} / ${limit}` : `${count} / ∞`}
                      </span>

                      {isExceeded && (
                        <span aria-label="WIP 초과" style={{ fontSize: 13, flexShrink: 0 }}>⚠️</span>
                      )}
                    </div>

                    {hasLimit && (
                      <div
                        role="progressbar"
                        aria-valuenow={count}
                        aria-valuemax={limit!}
                        aria-label={`${col.name} WIP: ${count}/${limit}`}
                        style={{
                          height: 8,
                          background: 'var(--color-border)',
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: fillColor,
                            borderRadius: 4,
                            transition: 'width var(--duration-slow)',
                          }}
                        />
                      </div>
                    )}

                    {isExceeded && (
                      <p
                        style={{
                          fontSize: 11,
                          color: 'var(--color-priority-high)',
                          margin: '4px 0 0',
                          fontWeight: 600,
                        }}
                      >
                        WIP 초과! ({count - limit!}개 초과)
                      </p>
                    )}
                  </div>
                );
              })}
          </div>

          {exceededCols.length === 0 && wipColumns.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--color-col-done)', margin: 0, textAlign: 'center' }}>
              ✅ 모든 컬럼 WIP 정상
            </p>
          )}

          {busiestCol && busiestCol.count > 0 && (
            <div
              style={{
                borderTop: '1px solid var(--color-border)',
                paddingTop: 10,
                marginTop: 4,
              }}
            >
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
                가장 부하 높은 컬럼:{' '}
                <strong style={{ color: 'var(--color-text-primary)' }}>
                  {busiestCol.name}
                </strong>{' '}
                ({busiestCol.count}장)
              </p>
            </div>
          )}
        </>
      )}
    </Widget>
  );
}
