'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import useSWR from 'swr';
import { useAppStore } from '@/stores/app-store';
import { fetcher, apiPaths } from '@/lib/api';
import type { SearchResult } from '@/lib/types';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [focused, setFocused] = useState(false);
  const { selectFile, expandFolder } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results } = useSWR<SearchResult[]>(
    debouncedQuery.length >= 2 ? apiPaths.search(debouncedQuery) : null,
    fetcher<SearchResult[]>
  );

  const handleSelect = useCallback((path: string) => {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      expandFolder(parts.slice(0, i).join('/'));
    }
    selectFile(path);
    setShowResults(false);
    setQuery('');
  }, [selectFile, expandFolder]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setShowResults(true);
      }
      if (e.key === 'Escape') {
        setShowResults(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2 transition-colors h-9 px-3 bg-[var(--color-bg-input)] border rounded-[var(--radius-md)] ${focused ? 'border-[var(--color-point-border)]' : 'border-[var(--color-border)]'}`}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setFocused(false);
          }
        }}
      >
        <Search size={14} className="text-[var(--color-text-muted)] shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="검색... (⌘K)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          className="flex-1 bg-transparent outline-none text-[13px] text-[var(--color-text-primary)]"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setShowResults(false); }}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] text-[var(--color-text-muted)] bg-transparent -mx-3"
            aria-label="검색 지우기"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {showResults && results && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 overflow-hidden z-50 overflow-y-auto bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-[var(--radius-lg)] max-h-[320px]">
          {results.map((result) => (
            <button
              key={result.path}
              onClick={() => handleSelect(result.path)}
              className="search-result-row w-full text-left transition-colors duration-150 px-3 py-2 min-h-[44px] border-b border-[var(--color-border)] bg-transparent"
            >
              <div className="text-[13px] font-medium text-[var(--color-text-primary)]">
                {result.name}
              </div>
              <div className="text-xs mt-0.5 text-[var(--color-text-muted)]">
                {result.path}
              </div>
              {result.matches.slice(0, 2).map((m, i) => (
                <div key={i} className="truncate text-xs mt-1 text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-text-muted)]">L{m.lineNumber}:</span> {m.line}
                </div>
              ))}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
