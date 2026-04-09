import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface TestButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 버튼 스타일 변형 */
  variant?: ButtonVariant;
  /** 버튼 크기 */
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

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 disabled:bg-blue-200",
  secondary:
    "bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300 disabled:bg-gray-50 disabled:text-gray-300",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 disabled:text-gray-300",
  danger:
    "bg-red-500 text-white hover:bg-red-600 active:bg-red-700 disabled:bg-red-200",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm gap-1.5",   // 36px — touch target은 padding으로 보완
  md: "h-11 px-5 text-base gap-2",  // 44px — WCAG 최소 터치 타겟
  lg: "h-14 px-6 text-lg gap-2.5",  // 56px
};

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
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
 * TestButton — 토스 디자인 시스템 기반 버튼 컴포넌트
 *
 * @example
 * <TestButton variant="primary" size="md" onClick={handleClick}>
 *   테스트 실행
 * </TestButton>
 *
 * @example
 * <TestButton variant="secondary" isLoading leftIcon={<IconCheck />}>
 *   저장 중...
 * </TestButton>
 */
export const TestButton = forwardRef<HTMLButtonElement, TestButtonProps>(
  function TestButton(
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      className = "",
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
          // Base
          "inline-flex items-center justify-center",
          "font-medium rounded-xl",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed",
          // sm 사이즈는 최소 44px 터치 타겟 확보 (padding)
          size === "sm" ? "min-h-[44px] py-1" : "",
          // Variant
          VARIANT_STYLES[variant],
          // Size
          SIZE_STYLES[size],
          // Full width
          fullWidth ? "w-full" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {isLoading ? (
          <Spinner />
        ) : (
          leftIcon && <span aria-hidden="true">{leftIcon}</span>
        )}

        <span>{children}</span>

        {!isLoading && rightIcon && (
          <span aria-hidden="true">{rightIcon}</span>
        )}
      </button>
    );
  }
);

TestButton.displayName = "TestButton";

export default TestButton;
