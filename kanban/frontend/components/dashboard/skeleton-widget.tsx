'use client';

interface SkeletonLineProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export function SkeletonLine({
  width = '100%',
  height = 12,
  borderRadius = 6,
  style,
}: SkeletonLineProps) {
  return (
    <div
      aria-busy="true"
      aria-label="로딩 중"
      style={{
        width,
        height,
        borderRadius,
        background: 'var(--color-bg-elevated)',
        animation: 'skeletonPulse 1.5s ease-in-out infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export function SkeletonCircle({ size = 24 }: { size?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="로딩 중"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--color-bg-elevated)',
        animation: 'skeletonPulse 1.5s ease-in-out infinite',
        flexShrink: 0,
      }}
    />
  );
}

interface WidgetProps {
  title: string;
  children: React.ReactNode;
  role?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
  headerRight?: React.ReactNode;
}

export function Widget({ title, children, role = 'region', ariaLabel, style, headerRight }: WidgetProps) {
  return (
    <div
      role={role}
      aria-label={ariaLabel ?? title}
      style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h2
          className="text-text-primary text-sm font-semibold m-0"
        >
          {title}
        </h2>
        {headerRight}
      </div>
      {children}
    </div>
  );
}
