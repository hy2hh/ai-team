'use client';

import { useCallback } from 'react';
import type { SearchFilters, CaseType, CourtLevel, Verdict } from '@/lib/legal-types';
import { CASE_TYPE_LABELS, COURT_LEVEL_LABELS, VERDICT_LABELS } from '@/lib/legal-types';

interface Props {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const CASE_TYPES: CaseType[] = ['civil', 'criminal', 'administrative', 'family', 'patent', 'labor', 'tax'];
const COURT_LEVELS: CourtLevel[] = ['supreme', 'high', 'district', 'family', 'administrative', 'patent'];
const VERDICTS: Verdict[] = ['plaintiff_win', 'defendant_win', 'partial', 'dismissed', 'rejected', 'settlement'];

export default function FilterPanel({
  filters,
  onFiltersChange,
  expanded = true,
  onToggleExpand,
}: Props) {
  const toggleArrayFilter = useCallback(
    <T extends string>(key: keyof SearchFilters, value: T) => {
      const current = (filters[key] as T[] | undefined) || [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onFiltersChange({ ...filters, [key]: next.length > 0 ? next : undefined });
    },
    [filters, onFiltersChange]
  );

  const updateDateFilter = useCallback(
    (key: 'dateFrom' | 'dateTo', value: string) => {
      onFiltersChange({ ...filters, [key]: value || undefined });
    },
    [filters, onFiltersChange]
  );

  const clearFilters = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  const hasFilters = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 : !!v
  );

  return (
    <div
      role="group"
      aria-label="검색 필터"
      style={{
        padding: 16,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: expanded ? 16 : 0,
        }}
      >
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-controls="filter-content"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 0',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            minHeight: 44,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 150ms',
            }}
          >
            ▶
          </span>
          필터 옵션
          {hasFilters && (
            <span
              style={{
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 600,
                background: 'var(--color-accent)',
                color: '#fff',
                borderRadius: 10,
              }}
            >
              활성
            </span>
          )}
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            aria-label="모든 필터 초기화"
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              background: 'var(--color-due-overdue-bg)',
              color: 'var(--color-due-overdue)',
              border: '1px solid var(--color-due-overdue-border)',
              borderRadius: 6,
              cursor: 'pointer',
              minHeight: 32,
            }}
          >
            ✕ 초기화
          </button>
        )}
      </div>

      {/* 필터 내용 */}
      {expanded && (
        <div
          id="filter-content"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* 사건 유형 */}
          <FilterSection title="사건 유형">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CASE_TYPES.map((type) => (
                <FilterChip
                  key={type}
                  label={CASE_TYPE_LABELS[type]}
                  active={filters.caseType?.includes(type) ?? false}
                  onClick={() => toggleArrayFilter('caseType', type)}
                />
              ))}
            </div>
          </FilterSection>

          {/* 법원 계층 */}
          <FilterSection title="법원">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {COURT_LEVELS.map((level) => (
                <FilterChip
                  key={level}
                  label={COURT_LEVEL_LABELS[level]}
                  active={filters.courtLevel?.includes(level) ?? false}
                  onClick={() => toggleArrayFilter('courtLevel', level)}
                />
              ))}
            </div>
          </FilterSection>

          {/* 판결 결과 */}
          <FilterSection title="판결 결과">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {VERDICTS.map((verdict) => (
                <FilterChip
                  key={verdict}
                  label={VERDICT_LABELS[verdict]}
                  active={filters.verdict?.includes(verdict) ?? false}
                  onClick={() => toggleArrayFilter('verdict', verdict)}
                />
              ))}
            </div>
          </FilterSection>

          {/* 기간 */}
          <FilterSection title="판결 기간">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => updateDateFilter('dateFrom', e.target.value)}
                aria-label="시작일"
                className="focus-ring"
                style={{
                  padding: '8px 12px',
                  fontSize: 14,
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-primary)',
                  minHeight: 44,
                }}
              />
              <span style={{ color: 'var(--color-text-muted)' }}>~</span>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => updateDateFilter('dateTo', e.target.value)}
                aria-label="종료일"
                className="focus-ring"
                style={{
                  padding: '8px 12px',
                  fontSize: 14,
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-primary)',
                  minHeight: 44,
                }}
              />
            </div>
          </FilterSection>
        </div>
      )}
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <span
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 8,
        }}
      >
        {title}
      </span>
      {children}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="focus-ring"
      style={{
        padding: '6px 14px',
        fontSize: 13,
        fontWeight: 500,
        borderRadius: 20,
        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
        background: active ? 'var(--color-accent)' : 'transparent',
        color: active ? '#fff' : 'var(--color-text-secondary)',
        cursor: 'pointer',
        transition: 'all 150ms',
        minHeight: 36,
      }}
    >
      {label}
    </button>
  );
}
