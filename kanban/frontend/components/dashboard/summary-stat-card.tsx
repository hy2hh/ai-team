'use client';
import { SkeletonLine } from '@/components/dashboard/skeleton-widget';

interface SummaryStatCardProps {
  icon: string;
  value: number | string;
  label: string;
  accentColor: string;
  loading?: boolean;
  error?: boolean;
  trend?: string;
  onClick?: () => void;
}

export default function SummaryStatCard({
  icon,
  value,
  label,
  accentColor,
  loading = false,
  error = false,
  trend,
  onClick,
}: SummaryStatCardProps) {
  return (
    <div
      role="region"
      aria-label={label}
      onClick={onClick}
      style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background var(--duration-fast)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 96,
      }}
    >
      {/* 왼쪽 accent 바 */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 12,
          bottom: 12,
          width: 4,
          background: accentColor,
          borderRadius: '0 4px 4px 0',
        }}
      />

      <div style={{ paddingLeft: 10 }}>
        {/* 아이콘 + 수치 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
            {icon}
          </span>
          <div
            aria-live="polite"
            aria-atomic="true"
            className={error ? 'text-[color:var(--color-priority-high)]' : 'text-text-primary'}
            style={{
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1,
              minHeight: 32,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {loading ? (
              <SkeletonLine width={64} height={28} />
            ) : error ? (
              <span style={{ fontSize: 13, fontWeight: 500 }}>오류</span>
            ) : (
              value
            )}
          </div>
        </div>

        {/* 레이블 */}
        <p
          className="text-text-secondary text-xs font-medium m-0"
        >
          {label}
        </p>

        {/* 트렌드 */}
        {trend && !loading && !error && (
          <p
            className="text-text-muted text-[11px]"
          style={{ margin: '4px 0 0' }}
          >
            {trend}
          </p>
        )}

        {error && (
          <p
            className="text-[11px] text-[color:var(--color-priority-high)]"
          style={{ margin: '4px 0 0' }}
          >
            데이터 로드 실패
          </p>
        )}
      </div>
    </div>
  );
}
