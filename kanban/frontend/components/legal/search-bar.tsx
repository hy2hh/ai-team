'use client';

import { useState, useCallback, useRef } from 'react';

interface Props {
  onSearch: (query: string) => void;
  placeholder?: string;
  isLoading?: boolean;
}

export default function SearchBar({
  onSearch,
  placeholder = '법률 문제를 입력하세요 (예: 임대차 보증금 반환, 교통사고 손해배상)',
  isLoading = false,
}: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (trimmed) {
        onSearch(trimmed);
      }
    },
    [query, onSearch]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    inputRef.current?.focus();
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="법률 문서 검색"
      style={{
        display: 'flex',
        gap: 12,
        width: '100%',
        maxWidth: 800,
      }}
    >
      <div
        style={{
          flex: 1,
          position: 'relative',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          aria-label="검색어 입력"
          className="focus-ring"
          style={{
            width: '100%',
            padding: '14px 48px 14px 16px',
            fontSize: 16,
            borderRadius: 12,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            transition: 'border-color 150ms, box-shadow 150ms',
            minHeight: 52,
          }}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="검색어 지우기"
            style={{
              position: 'absolute',
              right: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              padding: 6,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              fontSize: 18,
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading || !query.trim()}
        aria-label={isLoading ? '검색 중...' : '검색하기'}
        className="focus-ring"
        style={{
          padding: '14px 28px',
          fontSize: 16,
          fontWeight: 600,
          borderRadius: 12,
          border: 'none',
          background: isLoading || !query.trim()
            ? 'var(--color-text-muted)'
            : 'var(--color-accent)',
          color: '#fff',
          cursor: isLoading || !query.trim() ? 'not-allowed' : 'pointer',
          transition: 'background 150ms, transform 100ms',
          minWidth: 100,
          minHeight: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {isLoading ? (
          <>
            <span
              aria-hidden="true"
              style={{
                width: 18,
                height: 18,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            검색 중
          </>
        ) : (
          <>
            <span aria-hidden="true">🔍</span>
            검색
          </>
        )}
      </button>
    </form>
  );
}
