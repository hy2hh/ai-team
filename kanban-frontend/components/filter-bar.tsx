'use client';

const AGENTS = ['Homer', 'Bart', 'Marge', 'Lisa', 'Krusty', 'Sid', 'Chalmers', 'Wiggum'];

const AGENT_COLORS: Record<string, string> = {
  homer:    '#4f7ef0',
  bart:     '#22d3ee',
  marge:    '#c084fc',
  lisa:     '#4ade80',
  krusty:   '#fb923c',
  sid:      '#f472b6',
  chalmers: '#f59e0b',
  wiggum:   '#94a3b8',
};

const PRIORITY_OPTIONS = [
  { value: 'high',   label: '높음', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
  { value: 'medium', label: '보통', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)'  },
  { value: 'low',    label: '낮음', color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)'  },
];

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
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '10px 0 14px',
        alignItems: 'center',
      }}
    >
      {/* 담당자 필터 */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginRight: 4,
          alignSelf: 'center',
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
              color: active ? color : 'var(--color-text-secondary)',
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
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginRight: 4,
          alignSelf: 'center',
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
              color: active ? opt.color : 'var(--color-text-secondary)',
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

      {/* 필터 초기화 */}
      {isFiltering && (
        <button
          type="button"
          onClick={onReset}
          aria-label="필터 초기화"
          style={{
            marginLeft: 4,
            padding: '5px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            background: 'rgba(248,113,113,0.1)',
            color: '#f87171',
            border: '1px solid rgba(248,113,113,0.25)',
            transition: 'all 150ms',
            minHeight: 32,
          }}
        >
          ✕ 초기화
        </button>
      )}

      {/* 필터 상태 알림 (스크린리더 + 시각적 표시) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          marginLeft: 'auto',
          fontSize: 12,
          color: isFiltering ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
          fontWeight: isFiltering ? 500 : 400,
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
