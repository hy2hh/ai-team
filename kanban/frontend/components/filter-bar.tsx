'use client';

import { AGENTS, AGENT_COLORS, PRIORITY_OPTIONS } from '@/lib/constants';

export interface FilterState {
  assignees: Set<string>;
  priorities: Set<string>;
}

interface Props {
  filter: FilterState;
  onToggleAssignee: (name: string) => void;
  onTogglePriority: (p: string) => void;
  onReset: () => void;
  totalCards: number;
  visibleCards: number;
}

export default function FilterBar({
  filter,
  onToggleAssignee,
  onTogglePriority,
  onReset,
  totalCards,
  visibleCards,
}: Props) {
  const isFiltering = filter.assignees.size > 0 || filter.priorities.size > 0;
  const hiddenCount = totalCards - visibleCards;

  return (
    <div
      role="group"
      aria-label="카드 필터"
      className="filter-bar-scroll"
    >
      {/* 담당자 필터 */}
      <span
        className="text-text-muted text-[11px] font-semibold uppercase self-center"
      style={{
          letterSpacing: '0.05em',
          marginRight: 4,
        }}
      >
        담당자
      </span>
      {AGENTS.map((agent) => {
        const key = agent.toLowerCase();
        const color = AGENT_COLORS[key] ?? '#7a90b8';
        const active = filter.assignees.has(agent);
        return (
          <button
            key={agent}
            type="button"
            onClick={() => onToggleAssignee(agent)}
            aria-pressed={active}
            aria-label={`${agent} 담당자 필터 ${active ? '해제' : '적용'}`}
            className={`filter-pill-btn focus-ring ${active ? '' : 'text-text-secondary'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 150ms',
              border: `1px solid ${active ? color : 'var(--color-border)'}`,
              background: active ? `${color}18` : 'transparent',
              color: active ? color : undefined,
              minHeight: 32,
              minWidth: 44,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: color,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {agent.charAt(0)}
            </span>
            {agent}
          </button>
        );
      })}

      {/* 구분선 */}
      <div
        aria-hidden="true"
        style={{ width: 1, height: 22, background: 'var(--color-border)', margin: '0 4px' }}
      />

      {/* 우선순위 필터 */}
      <span
        className="text-text-muted text-[11px] font-semibold uppercase self-center"
      style={{
          letterSpacing: '0.05em',
          marginRight: 4,
        }}
      >
        우선순위
      </span>
      {PRIORITY_OPTIONS.map((opt) => {
        const active = filter.priorities.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onTogglePriority(opt.value)}
            aria-pressed={active}
            aria-label={`${opt.label} 우선순위 필터 ${active ? '해제' : '적용'}`}
            className={`filter-pill-btn focus-ring ${active ? '' : 'text-text-secondary'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 150ms',
              border: `1px solid ${active ? opt.border : 'var(--color-border)'}`,
              background: active ? opt.bg : 'transparent',
              color: active ? opt.color : undefined,
              minHeight: 32,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: opt.color,
                display: 'inline-block',
              }}
            />
            {opt.label}
          </button>
        );
      })}

      {/* 필터 초기화 — 항상 표시, 필터 없을 때 비활성화 */}
      <button
        type="button"
        onClick={isFiltering ? onReset : undefined}
        disabled={!isFiltering}
        aria-label={isFiltering ? '필터 초기화' : '적용된 필터 없음'}
        className={`filter-pill-btn focus-ring ${isFiltering ? '' : 'text-text-muted'}`}
        style={{
          marginLeft: 4,
          padding: '5px 12px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 500,
          cursor: isFiltering ? 'pointer' : 'default',
          background: isFiltering ? 'var(--color-due-overdue-bg)' : 'transparent',
          color: isFiltering ? 'var(--color-due-overdue)' : undefined,
          border: `1px solid ${isFiltering ? 'var(--color-due-overdue-border)' : 'var(--color-border)'}`,
          transition: 'all var(--duration-fast)',
          minHeight: 32,
          opacity: isFiltering ? 1 : 0.5,
          flexShrink: 0,
        }}
      >
        ✕ 초기화
      </button>

      {/* 필터 상태 알림 (스크린리더 + 시각적 표시) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={isFiltering ? 'text-text-secondary font-medium' : 'text-text-muted font-normal'}
        style={{
          marginLeft: 'auto',
          fontSize: 12,
        }}
      >
        {isFiltering
          ? `${visibleCards}/${totalCards}개 표시 (${hiddenCount}개 숨김)`
          : `${totalCards}개 카드`
        }
      </div>
    </div>
  );
}
