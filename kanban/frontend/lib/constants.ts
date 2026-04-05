// 공통 상수 — 디자인 시스템 통합
// 모든 컴포넌트에서 이 파일을 import하여 사용

// 에이전트 목록
export const AGENTS = ['Homer', 'Bart', 'Marge', 'Lisa', 'Krusty', 'Sid', 'Chalmers', 'Wiggum'] as const;
export type AgentName = typeof AGENTS[number];

// 우선순위 설정 (CSS 변수 기반)
export const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  high:   { color: 'var(--color-priority-high)',   bg: 'var(--color-priority-high-bg)',   border: 'var(--color-priority-high-border)',   label: '높음' },
  medium: { color: 'var(--color-priority-medium)', bg: 'var(--color-priority-medium-bg)', border: 'var(--color-priority-medium-border)', label: '보통' },
  low:    { color: 'var(--color-priority-low)',    bg: 'var(--color-priority-low-bg)',    border: 'var(--color-priority-low-border)',    label: '낮음' },
};

// 우선순위 옵션 (폼 UI용)
export const PRIORITY_OPTIONS = [
  { value: 'high',   ...PRIORITY_CONFIG.high },
  { value: 'medium', ...PRIORITY_CONFIG.medium },
  { value: 'low',    ...PRIORITY_CONFIG.low },
] as const;

// 에이전트 색상 (CSS 변수 기반)
export const AGENT_COLORS: Record<string, string> = {
  homer:    'var(--color-agent-homer)',
  bart:     'var(--color-agent-bart)',
  marge:    'var(--color-agent-marge)',
  lisa:     'var(--color-agent-lisa)',
  krusty:   'var(--color-agent-krusty)',
  sid:      'var(--color-agent-sid)',
  chalmers: 'var(--color-agent-chalmers)',
  wiggum:   'var(--color-agent-wiggum)',
};

// 에이전트 색상 헬퍼 함수
export function getAgentColor(name: string): string {
  return AGENT_COLORS[name.toLowerCase()] ?? 'var(--color-text-muted)';
}

// 진행률 색상 헬퍼 함수
export function getProgressColor(progress: number): string {
  if (progress >= 67) return 'var(--color-progress-high)';
  if (progress >= 34) return 'var(--color-progress-medium)';
  return 'var(--color-progress-low)';
}
