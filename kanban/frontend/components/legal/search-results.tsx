'use client';

import type { SearchResult } from '@/lib/legal-types';
import ResultCard from './result-card';

interface Props {
  results: SearchResult[];
  total: number;
  isLoading?: boolean;
  error?: string | null;
  onResultClick?: (result: SearchResult) => void;
}

export default function SearchResults({
  results,
  total,
  isLoading = false,
  error = null,
  onResultClick,
}: Props) {
  // 로딩 상태
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="검색 중"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 48,
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: '3px solid var(--color-border)',
            borderTopColor: 'var(--color-accent)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p
          style={{
            margin: 0,
            fontSize: 16,
            color: 'var(--color-text-secondary)',
          }}
        >
          관련 판례를 검색하고 있습니다...
        </p>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div
        role="alert"
        style={{
          padding: 24,
          background: 'var(--color-due-overdue-bg)',
          border: '1px solid var(--color-due-overdue-border)',
          borderRadius: 12,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 16,
            color: 'var(--color-due-overdue)',
            fontWeight: 500,
          }}
        >
          검색 중 오류가 발생했습니다
        </p>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 14,
            color: 'var(--color-text-muted)',
          }}
        >
          {error}
        </p>
      </div>
    );
  }

  // 결과 없음
  if (results.length === 0) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 48,
          }}
          aria-hidden="true"
        >
          📭
        </p>
        <p
          style={{
            margin: '16px 0 0',
            fontSize: 18,
            color: 'var(--color-text-primary)',
            fontWeight: 500,
          }}
        >
          검색 결과가 없습니다
        </p>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 14,
            color: 'var(--color-text-muted)',
          }}
        >
          다른 검색어나 필터 조건을 시도해 보세요
        </p>
      </div>
    );
  }

  // 결과 목록
  return (
    <div>
      {/* 결과 요약 */}
      <div
        role="status"
        aria-live="polite"
        style={{
          marginBottom: 16,
          fontSize: 14,
          color: 'var(--color-text-secondary)',
        }}
      >
        <strong>{total.toLocaleString()}</strong>건의 관련 판례를 찾았습니다
      </div>

      {/* 결과 리스트 */}
      <div
        role="list"
        aria-label="검색 결과 목록"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {results.map((result) => (
          <div key={result.chunk.id} role="listitem">
            <ResultCard
              result={result}
              onClick={onResultClick ? () => onResultClick(result) : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
