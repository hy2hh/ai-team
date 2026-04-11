import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 버튼 스타일 변형 */
  variant?: ButtonVariant;
  /**
   * 버튼 크기
   * - sm: 시각적으로 작지만 min-h-[44px]로 터치 타겟 보장 (WCAG 2.1 SC 2.5.5)
   * - md: h-11 (44px) — 기본값
   * - lg: h-14 (56px)
   */
  size?: ButtonSize;
  /** 로딩 상태 — 로딩 중 버튼 비활성화 및 스피너 표시 */
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
    "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 disabled:bg-blue-300",
  secondary:
    "bg-gray-100 text-gray-900 border border-gray-200 hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40",
  danger:
    "bg-red-500 text-white hover:bg-red-600 active:bg-red-700 disabled:bg-red-300",
};

/**
 * 모든 사이즈에서 최소 44×44px 터치 타겟 보장 (WCAG 2.1 SC 2.5.5)
 *
 * - sm: 시각적 높이는 작지만 min-h-[44px]으로 터치 영역 확보
 * - md: h-11 = 44px (딱 맞춤)
 * - lg: h-14 = 56px
 */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-[44px] px-4 py-1 text-sm gap-1.5",
  md: "h-11 px-5 text-base gap-2",
  lg: "h-14 px-6 text-lg gap-2.5",
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
 * Button — 기본 버튼 컴포넌트
 *
 * 토스 디자인 시스템 기반. 모든 사이즈에서 44×44px 터치 타겟 보장.
 * forwardRef를 통해 외부에서 DOM ref 접근 가능.
 *
 * @example
 * // 기본 사용
 * <Button variant="primary" onClick={handleClick}>저장</Button>
 *
 * @example
 * // 로딩 상태
 * <Button variant="primary" isLoading>제출 중...</Button>
 *
 * @example
 * // 아이콘 포함
 * <Button variant="secondary" leftIcon={<PlusIcon />} size="sm">추가</Button>
 *
 * @example
 * // 전체 너비
 * <Button variant="primary" size="lg" fullWidth>확인</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
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
        aria-busy={isLoading || undefined}
        aria-disabled={isDisabled || undefined}
        className={[
          // Base
          "inline-flex items-center justify-center",
          "font-medium rounded-xl",
          "transition-colors duration-150",
          // 모바일 300ms 딜레이 제거
          "select-none touch-manipulation",
          // Focus — 키보드 접근성
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          // Disabled
          "disabled:cursor-not-allowed",
          // Variant
          VARIANT_CLASSES[variant],
          // Size (모든 사이즈 44px 터치 타겟 보장)
          SIZE_CLASSES[size],
          // Full width
          fullWidth ? "w-full" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {/* 로딩 중: 스피너만 표시 (leftIcon 숨김) */}
        {isLoading ? (
          <Spinner />
        ) : (
          leftIcon && (
            <span aria-hidden="true" className="shrink-0">
              {leftIcon}
            </span>
          )
        )}

        <span>{children}</span>

        {/* 로딩 중에는 rightIcon 숨김 */}
        {!isLoading && rightIcon && (
          <span aria-hidden="true" className="shrink-0">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
