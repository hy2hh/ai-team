'use client';

import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline';
  /**
   * 버튼 크기
   * - small: min-h-[44px]로 터치 타겟 보장 (시각적으로는 작게)
   * - medium: h-11 (44px)
   * - large: h-14 (56px)
   */
  size?: 'small' | 'medium' | 'large';
  children: ReactNode;
}

// ─── Style Maps ───────────────────────────────────────────────────────────────

const VARIANT_CLASSES: Record<'primary' | 'outline', string> = {
  primary:
    'bg-[var(--color-point)] border-[var(--color-point)] text-white hover:opacity-90 active:opacity-80',
  outline:
    'bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] active:opacity-80',
};

/**
 * 모든 사이즈에서 최소 44×44px 터치 타겟 보장 (WCAG 2.1 SC 2.5.5)
 */
const SIZE_CLASSES: Record<'small' | 'medium' | 'large', string> = {
  small: 'min-h-[44px] px-[10px] py-1 text-xs',
  medium: 'h-11 px-[14px] text-[13px]',
  large: 'h-14 px-5 text-[15px]',
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Button — 기본 버튼 컴포넌트 (모바일 터치 타겟 44px 준수)
 *
 * @deprecated 새 기능은 MobileButton(@/components/ui/mobile-button)을 사용하세요.
 * 이 컴포넌트는 하위 호환성을 위해 유지됩니다.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', size = 'medium', disabled, children, className = '', ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled}
        aria-disabled={disabled}
        className={[
          'inline-flex items-center justify-center',
          'font-medium rounded-lg',
          'border',
          'transition-colors duration-150',
          'outline-none',
          'touch-manipulation select-none',
          'focus-visible:ring-2 focus-visible:ring-[var(--color-point)] focus-visible:ring-offset-2',
          'disabled:opacity-45 disabled:cursor-not-allowed',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
