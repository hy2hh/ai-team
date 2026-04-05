'use client';

interface DisclaimerBannerProps {
  variant?: 'fixed-bottom' | 'inline';
  className?: string;
}

export function DisclaimerBanner({ variant = 'inline', className }: DisclaimerBannerProps) {
  const style: React.CSSProperties =
    variant === 'fixed-bottom'
      ? {
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
        }
      : {};

  return (
    <div
      role="note"
      aria-label="법적 면책 고지"
      className={className}
      style={{
        ...style,
        background: '#1C2236',
        borderLeft: '3px solid #FE9B0E',
        borderRadius: variant === 'inline' ? '8px' : '0',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1.5, flexShrink: 0 }}>
        ⚠
      </span>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: '#9AAAC4',
          lineHeight: 1.6,
        }}
      >
        이 서비스는 법률 정보를 제공하며, 변호사의 법률 자문을 대체하지 않습니다.
        중요한 결정 전 반드시 변호사와 상담하세요.
      </p>
    </div>
  );
}
