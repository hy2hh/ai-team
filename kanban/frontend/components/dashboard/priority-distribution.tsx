'use client';
import { useRouter } from 'next/navigation';
import { Card } from '@/lib/types';
import { Widget, SkeletonCircle, SkeletonLine } from '@/components/dashboard/skeleton-widget';

interface PriorityDistributionProps {
  cards: Card[];
  loading?: boolean;
  error?: boolean;
}

const PRIORITY_CONFIG = {
  high:   { label: '높음', color: 'var(--color-priority-high)',   varName: '--color-priority-high' },
  medium: { label: '보통', color: 'var(--color-priority-medium)', varName: '--color-priority-medium' },
  low:    { label: '낮음', color: 'var(--color-priority-low)',    varName: '--color-priority-low' },
} as const;

const CIRCUMFERENCE = 2 * Math.PI * 40;

interface DonutSegmentProps {
  color: string;
  dashLength: number;
  offset: number;
}

function DonutSegment({ color, dashLength, offset }: DonutSegmentProps) {
  return (
    <circle
      cx="50"
      cy="50"
      r="40"
      fill="none"
      stroke={color}
      strokeWidth="12"
      strokeDasharray={`${dashLength} ${CIRCUMFERENCE}`}
      strokeDashoffset={-offset}
      transform="rotate(-90, 50, 50)"
    />
  );
}

export default function PriorityDistribution({
  cards,
  loading = false,
  error = false,
}: PriorityDistributionProps) {
  const router = useRouter();

  const counts = {
    high:   cards.filter((c) => c.priority === 'high').length,
    medium: cards.filter((c) => c.priority === 'medium').length,
    low:    cards.filter((c) => c.priority === 'low').length,
  };
  const total = cards.length;

  // Compute donut segments
  const segments = (
    ['high', 'medium', 'low'] as const
  ).reduce<{ key: string; color: string; dashLength: number; offset: number }[]>(
    (acc, key) => {
      const proportion = total > 0 ? counts[key] / total : 0;
      const dashLength = proportion * CIRCUMFERENCE;
      const offset = acc.reduce((sum, s) => sum + s.dashLength, 0);
      acc.push({ key, color: PRIORITY_CONFIG[key].color, dashLength, offset });
      return acc;
    },
    []
  );

  const handlePriorityClick = (priority: string) => {
    const params = new URLSearchParams();
    params.set('priority', priority);
    router.push(`/?${params.toString()}`);
  };

  return (
    <Widget title="Priority Distribution" ariaLabel="우선순위 분포">
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <SkeletonCircle size={100} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SkeletonLine width="80%" height={12} />
            <SkeletonLine width="60%" height={12} />
            <SkeletonLine width="40%" height={12} />
          </div>
        </div>
      ) : error ? (
        <p className="text-text-muted text-center text-[13px]" style={{ padding: '12px 0' }}>
          데이터를 불러올 수 없습니다
        </p>
      ) : total === 0 ? (
        <div className="empty-state">카드가 없습니다</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* SVG 도넛 차트 */}
          <div style={{ flexShrink: 0 }}>
            <svg
              width={100}
              height={100}
              aria-label="우선순위 도넛 차트"
              role="img"
            >
              {/* 배경 원 */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="12"
              />
              {/* 세그먼트 */}
              {segments.map((seg) =>
                seg.dashLength > 0 ? (
                  <DonutSegment
                    key={seg.key}
                    color={seg.color}
                    dashLength={seg.dashLength}
                    offset={seg.offset}
                  />
                ) : null
              )}
              {/* 중앙 텍스트 */}
              <text
                x="50"
                y="46"
                textAnchor="middle"
                fontSize="18"
                fontWeight="700"
                fill="var(--color-text-primary)"
                dominantBaseline="middle"
              >
                {total}
              </text>
              <text
                x="50"
                y="62"
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-text-muted)"
              >
                총 카드
              </text>
            </svg>
          </div>

          {/* 범례 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['high', 'medium', 'low'] as const).map((priority) => {
              const cfg = PRIORITY_CONFIG[priority];
              const count = counts[priority];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;

              return (
                <button
                  key={priority}
                  onClick={() => handlePriorityClick(priority)}
                  title={`${cfg.label} 우선순위 카드 보기`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'none',
                    border: 'none',
                    padding: '4px 0',
                    cursor: 'pointer',
                    borderRadius: 6,
                    minHeight: 44,
                    textAlign: 'left',
                    transition: 'background var(--duration-fast)',
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: cfg.color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    className="text-text-secondary"
                    style={{ fontSize: 13, flex: 1 }}
                  >
                    {cfg.label}
                  </span>
                  <span
                    className="text-text-primary"
                    style={{ fontSize: 13, fontWeight: 600 }}
                  >
                    {count}장
                  </span>
                  <span
                    className="text-text-muted text-[11px] text-right"
                    style={{ minWidth: 36 }}
                  >
                    ({pct}%)
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Widget>
  );
}
