'use client';

import { useCallback } from 'react';
import { AGENTS, AGENT_COLORS, PRIORITY_OPTIONS } from '@/lib/constants';

// ── 타입 ───────────────────────────────────────────────────────────────────

export type DueDateFilter = 'all' | 'overdue' | 'due-today' | 'due-week';

export interface BoardFilterState {
  assignees: Set<string>;
  priorities: Set<string>;
  search: string;
  dueDateFilter: DueDateFilter;
}

export const EMPTY_BOARD_FILTER: BoardFilterState = {
  assignees: new Set<string>(),
  priorities: new Set<string>(),
  search: '',
  dueDateFilter: 'all',
};

interface BoardFilterProps {
  filter: BoardFilterState;
  onToggleAssignee: (name: string) => void;
  onTogglePriority: (p: string) => void;
  onSearchChange: (value: string) => void;
  onDueDateChange: (value: DueDateFilter) => void;
  onReset: () => void;
  totalCards: number;
  visibleCards: number;
}

// ── 마감일 필터 옵션 ───────────────────────────────────────────────────────

const DUE_DATE_OPTIONS: { value: DueDateFilter; label: string }[] = [
  { value: 'all',       label: '전체' },
  { value: 'overdue',   label: '기한 초과' },
  { value: 'due-today', label: '오늘 마감' },
  { value: 'due-week',  label: '이번 주' },
];

// ── 유틸 ───────────────────────────────────────────────────────────────────

/** 카드가 마감일 필터 조건에 해당하는지 판단 */
export function matchesDueDate(dueDateStr: string | null, filter: DueDateFilter): boolean {
  if (filter === 'all') return true;
  if (!dueDateStr) return false;

  const now = new Date();
  const due = new Date(dueDateStr);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday   = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
  const endOfWeek    = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

  if (filter === 'overdue')   return due < startOfToday;
  if (filter === 'due-today') return due >= startOfToday && due <= endOfToday;
  if (filter === 'due-week')  return due >= startOfToday && due <= endOfWeek;
  return true;
}

// ── 컴포넌트 ───────────────────────────────────────────────────────────────

export default function BoardFilter({
  filter,
  onToggleAssignee,
  onTogglePriority,
  onSearchChange,
  onDueDateChange,
  onReset,
  totalCards,
  visibleCards,
}: BoardFilterProps) {
  const isFiltering =
    filter.assignees.size > 0 ||
    filter.priorities.size > 0 ||
    filter.search.trim() !== '' ||
    filter.dueDateFilter !== 'all';

  const hiddenCount = totalCards - visibleCards;

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value),
    [onSearchChange],
  );

  return (
    <div
      role="group"
      aria-label="카드 필터"
      className="flex flex-col gap-2 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]"
    >
      {/* 상단 행: 검색 + 초기화 + 통계 */}
      <div className="flex items-center gap-3">
        {/* 검색 입력 */}
        <div className="relative flex-1 max-w-xs">
          <span
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-sm pointer-events-none"
          >
            🔍
          </span>
          <input
            type="search"
            value={filter.search}
            onChange={handleSearchChange}
            placeholder="카드 제목 검색..."
            aria-label="카드 제목 검색"
            className="
              w-full h-[44px] pl-9 pr-3 rounded-xl text-sm
              bg-[var(--color-bg-card)] border border-[var(--color-border)]
              text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
              focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20
              transition-colors duration-150
            "
          />
        </div>

        {/* 마감일 필터 */}
        <div className="flex items-center gap-1" role="group" aria-label="마감일 필터">
          {DUE_DATE_OPTIONS.map((opt) => {
            const active = filter.dueDateFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onDueDateChange(opt.value)}
                aria-pressed={active}
                aria-label={`마감일 필터: ${opt.label}`}
                className={`
                  h-[44px] min-w-[44px] px-3 rounded-xl text-xs font-medium
                  border transition-all duration-150
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50
                  ${active
                    ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                    : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
                  }
                `}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* 스페이서 */}
        <div className="flex-1" />

        {/* 필터 상태 통계 */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`text-xs shrink-0 ${isFiltering ? 'text-[var(--color-text-secondary)] font-medium' : 'text-[var(--color-text-muted)]'}`}
        >
          {isFiltering
            ? `${visibleCards}/${totalCards}개 표시 (${hiddenCount}개 숨김)`
            : `전체 ${totalCards}개`}
        </div>

        {/* 초기화 버튼 */}
        <button
          type="button"
          onClick={isFiltering ? onReset : undefined}
          disabled={!isFiltering}
          aria-label={isFiltering ? '필터 초기화' : '적용된 필터 없음'}
          className={`
            h-[44px] min-w-[44px] px-3 rounded-xl text-xs font-medium
            border transition-all duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-due-overdue)]/40
            ${isFiltering
              ? 'bg-[var(--color-due-overdue-bg)] border-[var(--color-due-overdue-border)] text-[var(--color-due-overdue)] cursor-pointer'
              : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)] opacity-50 cursor-default'
            }
          `}
        >
          ✕ 초기화
        </button>
      </div>

      {/* 하단 행: 담당자 + 우선순위 필터 pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* 담당자 레이블 */}
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)] mr-1 self-center">
          담당자
        </span>

        {AGENTS.map((agent) => {
          const key = agent.toLowerCase();
          const color = AGENT_COLORS[key] ?? 'var(--color-text-muted)';
          const active = filter.assignees.has(agent);
          return (
            <button
              key={agent}
              type="button"
              onClick={() => onToggleAssignee(agent)}
              aria-pressed={active}
              aria-label={`${agent} 담당자 필터 ${active ? '해제' : '적용'}`}
              className={`
                inline-flex items-center gap-1.5 h-[44px] min-w-[44px] px-2.5 rounded-full
                text-xs font-medium border transition-all duration-150
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40
                ${active
                  ? 'text-[var(--color-text-primary)]'
                  : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
                }
              `}
              style={active
                ? { border: `1px solid ${color}`, background: `color-mix(in srgb, ${color} 12%, transparent)`, color }
                : undefined
              }
            >
              <span
                aria-hidden="true"
                className="w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                style={{ background: color }}
              >
                {agent.charAt(0)}
              </span>
              {agent}
            </button>
          );
        })}

        {/* 구분선 */}
        <div aria-hidden="true" className="w-px h-[22px] bg-[var(--color-border)] mx-1 self-center" />

        {/* 우선순위 레이블 */}
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)] mr-1 self-center">
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
              className={`
                inline-flex items-center gap-1.5 h-[44px] min-w-[44px] px-3 rounded-full
                text-xs font-medium border transition-all duration-150
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40
                ${active
                  ? ''
                  : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
                }
              `}
              style={active
                ? { border: `1px solid ${opt.border}`, background: opt.bg, color: opt.color }
                : undefined
              }
            >
              <span
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                style={{ background: opt.color }}
              />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* 스크린 리더 전용 — 검색 결과 실시간 알림 */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {isFiltering ? `필터 적용됨: ${totalCards}개 중 ${visibleCards}개 표시` : ''}
      </div>
    </div>
  );
}
