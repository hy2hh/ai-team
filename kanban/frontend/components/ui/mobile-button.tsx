'use client';

import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface MobileButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 버튼 스타일 변형 */
  variant?: ButtonVariant;
  /**
   * 버튼 크기
   * - sm: 시각적으로 작지만 padding으로 44×44px 터치 타겟 보장
   * - md: h-11 (44px) — WCAG 2.1 최소 터치 타겟
   * - lg: h-14 (56px)
   */
  size?: ButtonSize;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 좌측 아이콘 */
  leftIcon?: ReactNode;
  /** 우측 아이콘 */
  rightIcon?: ReactNode;
  /** 전체 너비 */
  fullWidth?: boolean;
  children: ReactNode;
}

// ─── Style Maps ───────────────────────────────────────────────────────────────

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-point)] text-white hover:opacity-90 active:opacity-80 disabled:opacity-40',
  secondary:
    'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-subtle)] active:opacity-80 disabled:opacity-40',
  ghost:
    'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] active:opacity-80 disabled:opacity-40',
  danger:
    'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 disabled:opacity-40',
};

/**
 * 모든 사이즈에서 최소 44×44px 터치 타겟 보장
 *
 * sm: 시각적 높이는 작되, min-h-[44px]로 터치 영역 확보
 * md: h-11 = 44px (딱 맞춤)
 * lg: h-14 = 56px
 */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] px-4 py-1 text-sm gap-1.5',
  md: 'h-11 px-5 text-base gap-2',
  lg: 'h-14 px-6 text-lg gap-2.5',
};

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 shrink-0"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * MobileButton — 모바일 최적화 버튼 컴포넌트
 *
 * WCAG 2.1 Success Criterion 2.5.5 기준 최소 터치 타겟 44×44px 준수.
 * 시각적으로 작은 sm 사이즈도 min-h-[44px]로 터치 영역을 보장합니다.
 *
 * @example
 * // 기본 사용
 * <MobileButton variant="primary" size="md" onClick={handleClick}>
 *   저장
 * </MobileButton>
 *
 * @example
 * // 작은 버튼 (시각적으로 작지만 터치 타겟은 44px 보장)
 * <MobileButton variant="ghost" size="sm" leftIcon={<PlusIcon />}>
 *   추가
 * </MobileButton>
 *
 * @example
 * // 전체 너비 + 로딩
 * <MobileButton variant="primary" fullWidth isLoading>
 *   제출 중...
 * </MobileButton>
 */
export const MobileButton = forwardRef<HTMLButtonElement, MobileButtonProps>(
  function MobileButton(
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      className = '',
      ...rest
    },
    ref
  ) {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={isLoading}
        aria-disabled={isDisabled}
        className={[
          // Base — 모바일 터치 최적화
          'inline-flex items-center justify-center',
          'font-medium rounded-xl',
          'transition-colors duration-150',
          'select-none touch-manipulation', // 모바일 300ms 딜레이 제거
          // Focus — 키보드 접근성
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-point)] focus-visible:ring-offset-2',
          // Disabled
          'disabled:cursor-not-allowed',
          // Variant
          VARIANT_CLASSES[variant],
          // Size (모든 사이즈 44px 터치 타겟 보장)
          SIZE_CLASSES[size],
          // Full width
          fullWidth ? 'w-full' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {isLoading ? (
          <Spinner />
        ) : (
          leftIcon && <span aria-hidden="true" className="shrink-0">{leftIcon}</span>
        )}

        <span>{children}</span>

        {!isLoading && rightIcon && (
          <span aria-hidden="true" className="shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

MobileButton.displayName = 'MobileButton';

export default MobileButton;
