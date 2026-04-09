/**
 * TestButton — 사용 예시 (Storybook 호환)
 *
 * 실행 확인용: 각 케이스를 복사해 페이지에 붙여넣기
 */

import { TestButton } from "@/components/test-button";

// ─── 기본 ──────────────────────────────────────────────────────────────────

export function PrimaryDefault() {
  return (
    <TestButton variant="primary" onClick={() => alert("primary clicked!")}>
      테스트 실행
    </TestButton>
  );
}

// ─── 모든 Variant ─────────────────────────────────────────────────────────

export function AllVariants() {
  return (
    <div className="flex gap-3 flex-wrap">
      <TestButton variant="primary">Primary</TestButton>
      <TestButton variant="secondary">Secondary</TestButton>
      <TestButton variant="ghost">Ghost</TestButton>
      <TestButton variant="danger">Danger</TestButton>
    </div>
  );
}

// ─── 모든 Size ────────────────────────────────────────────────────────────

export function AllSizes() {
  return (
    <div className="flex items-center gap-3">
      <TestButton size="sm">Small</TestButton>
      <TestButton size="md">Medium</TestButton>
      <TestButton size="lg">Large</TestButton>
    </div>
  );
}

// ─── 로딩 상태 ────────────────────────────────────────────────────────────

export function LoadingState() {
  return (
    <div className="flex gap-3">
      <TestButton variant="primary" isLoading>
        저장 중...
      </TestButton>
      <TestButton variant="secondary" isLoading>
        처리 중
      </TestButton>
    </div>
  );
}

// ─── 비활성 상태 ──────────────────────────────────────────────────────────

export function DisabledState() {
  return (
    <div className="flex gap-3">
      <TestButton variant="primary" disabled>
        비활성 Primary
      </TestButton>
      <TestButton variant="secondary" disabled>
        비활성 Secondary
      </TestButton>
    </div>
  );
}

// ─── 전체 너비 ────────────────────────────────────────────────────────────

export function FullWidth() {
  return (
    <div className="w-80">
      <TestButton variant="primary" size="lg" fullWidth>
        전체 너비 버튼
      </TestButton>
    </div>
  );
}

// ─── 아이콘 포함 ──────────────────────────────────────────────────────────

export function WithIcons() {
  const PlusIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );

  const ArrowIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );

  return (
    <div className="flex gap-3">
      <TestButton variant="primary" leftIcon={<PlusIcon />}>
        추가하기
      </TestButton>
      <TestButton variant="secondary" rightIcon={<ArrowIcon />}>
        다음으로
      </TestButton>
    </div>
  );
}
