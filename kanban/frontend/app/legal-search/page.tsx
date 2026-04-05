'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { SearchBar, FilterPanel, SearchResults } from '@/components/legal';
import { legalSearchFetcher } from '@/lib/legal-api';
import type { SearchFilters, SearchResult, SearchRequest } from '@/lib/legal-types';

export default function LegalSearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [filterExpanded, setFilterExpanded] = useState(true);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  // 검색 요청 객체
  const searchRequest: SearchRequest | null = searchQuery
    ? {
        query: searchQuery,
        limit: 20,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      }
    : null;

  // SWR로 검색 수행 (useEffect 대신)
  const { data, error, isLoading } = useSWR(
    searchRequest ? ['legal-search', searchRequest] : null,
    legalSearchFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  );

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setSelectedResult(null);
  }, []);

  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
  }, []);

  const handleResultClick = useCallback((result: SearchResult) => {
    setSelectedResult(result);
    // TODO: 상세 모달 또는 패널 표시
    console.log('Selected:', result.document.id);
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg)',
      }}
    >
      {/* 헤더 */}
      <header
        style={{
          padding: '24px 32px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span aria-hidden="true">⚖️</span>
          AI 법률 서비스
        </h1>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 14,
            color: 'var(--color-text-muted)',
          }}
        >
          법률 문제를 입력하면 관련 판례를 AI가 검색해 드립니다
        </p>
      </header>

      {/* 메인 콘텐츠 */}
      <main
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '32px 24px',
        }}
      >
        {/* 검색바 */}
        <section
          aria-label="검색"
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />
        </section>

        {/* 필터 패널 */}
        <section aria-label="필터" style={{ marginBottom: 24 }}>
          <FilterPanel
            filters={filters}
            onFiltersChange={handleFiltersChange}
            expanded={filterExpanded}
            onToggleExpand={() => setFilterExpanded((prev) => !prev)}
          />
        </section>

        {/* 검색 결과 */}
        <section aria-label="검색 결과">
          {searchQuery ? (
            <SearchResults
              results={data?.results ?? []}
              total={data?.total ?? 0}
              isLoading={isLoading}
              error={error?.message ?? null}
              onResultClick={handleResultClick}
            />
          ) : (
            <EmptyState />
          )}
        </section>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: 64,
        textAlign: 'center',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 64,
        }}
        aria-hidden="true"
      >
        🔍
      </p>
      <h2
        style={{
          margin: '24px 0 0',
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--color-text-primary)',
        }}
      >
        법률 문제를 검색해 보세요
      </h2>
      <p
        style={{
          margin: '12px 0 0',
          fontSize: 15,
          color: 'var(--color-text-muted)',
          lineHeight: 1.6,
        }}
      >
        예: &quot;임대차 보증금 반환 청구&quot;, &quot;교통사고 손해배상&quot;, &quot;부당해고 구제 신청&quot;
      </p>

      {/* 빠른 검색 예시 */}
      <div
        style={{
          marginTop: 32,
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        {['임대차 분쟁', '명예훼손', '상속 재산 분할', '근로계약 해지'].map((example) => (
          <button
            key={example}
            type="button"
            className="focus-ring"
            onClick={() => {
              // 페이지 레벨에서 처리하도록 이벤트 버블링
              const input = document.querySelector('input[type="text"]') as HTMLInputElement;
              if (input) {
                input.value = example;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
              }
            }}
            style={{
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 20,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              transition: 'all 150ms',
              minHeight: 44,
            }}
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
