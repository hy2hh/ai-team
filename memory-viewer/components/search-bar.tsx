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
  const { selectFile, expandFolder } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  // ⌘K 글로벌 단축키
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

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={wrapRef}>
      {/* Search Input — Apple command palette style */}
      <div className="search-input-wrap">
        <Search size={14} className="shrink-0 tree-icon-color" />
        <input
          ref={inputRef}
          type="text"
          placeholder="검색"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          className="search-input"
        />
        {!query && (
          <span className="kbd">⌘K</span>
        )}
        {query && (
          <button
            onClick={() => { setQuery(''); setShowResults(false); }}
            className="icon-btn icon-btn-sm"
            aria-label="검색 지우기"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && results && results.length > 0 && (
        <div className="search-dropdown">
          {results.map((result) => (
            <button
              key={result.path}
              onClick={() => handleSelect(result.path)}
              className="search-result-row w-full text-left px-4 py-3 bg-transparent cursor-pointer border-none"
            >
              <div className="search-result-name">{result.name}</div>
              <div className="search-result-path">{result.path}</div>
              {result.matches.slice(0, 2).map((m, i) => (
                <div key={i} className="truncate mt-1 search-result-match">
                  <span className="search-result-line-num">L{m.lineNumber}:</span>{' '}
                  {m.line}
                </div>
              ))}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
