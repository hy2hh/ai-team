'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import Board from '@/components/Board';
import { useTheme } from '@/lib/theme';

const AGENTS = [
  { name: 'Homer',    color: '#4f7ef0' },
  { name: 'Bart',     color: '#22d3ee' },
  { name: 'Marge',    color: '#c084fc' },
  { name: 'Lisa',     color: '#4ade80' },
  { name: 'Krusty',   color: '#fb923c' },
  { name: 'Sid',      color: '#f472b6' },
  { name: 'Chalmers', color: '#f59e0b' },
  { name: 'Wiggum',   color: '#94a3b8' },
];

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  // P3: useMemo — 렌더마다 Date 재계산 방지
  const today = useMemo(
    () => new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }),
    []
  );

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)]">
      {/* ── 헤더 ── */}
      <header
        style={{
          background: 'linear-gradient(180deg, var(--color-bg-surface) 0%, transparent 100%)',
          borderBottom: '1px solid var(--color-border)',
          padding: '16px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {/* 왼쪽: 로고 + 탭 네비게이션 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--color-point) 0%, #c084fc 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              boxShadow: '0 0 16px var(--color-point-glow)',
              flexShrink: 0,
            }}
          >
            📋
          </div>
          <div>
            <h1
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Team Kanban
            </h1>
            <p
              className="header-date"
              style={{
                fontSize: 12,
                color: 'var(--color-text-muted)',
                margin: 0,
              }}
            >
              {today}
            </p>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <nav aria-label="페이지 네비게이션" style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <Link
            href="/"
            className="nav-tab-link nav-tab-link--active"
            aria-current="page"
          >
            Board
          </Link>
          <Link
            href="/dashboard"
            className="nav-tab-link"
          >
            Dashboard
          </Link>
        </nav>

        {/* 오른쪽: 에이전트 아바타 목록 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="header-avatars" style={{ fontSize: 12, color: 'var(--color-text-muted)', marginRight: 4 }}>팀원</span>
          <div className="header-avatars" style={{ display: 'flex', alignItems: 'center' }}>
            {AGENTS.map((agent, i) => (
              <span
                key={agent.name}
                title={agent.name}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: agent.color,
                  border: '2px solid var(--color-bg-surface)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#ffffff',
                  marginLeft: i === 0 ? 0 : -6,
                  zIndex: AGENTS.length - i,
                  position: 'relative',
                  boxShadow: `0 0 8px ${agent.color}40`,
                  cursor: 'default',
                }}
              >
                {agent.name.charAt(0)}
              </span>
            ))}
          </div>
          <span
            className="header-avatars"
            style={{
              fontSize: 12,
              color: 'var(--color-text-muted)',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: '2px 8px',
              marginLeft: 8,
            }}
          >
            {AGENTS.length}명
          </span>

          {/* 테마 토글 버튼 */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            className="theme-toggle-btn focus-ring"
            style={{ marginLeft: 12 }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* ── 보드 ── */}
      <div style={{ padding: '24px 28px' }}>
        <Board />
      </div>
    </main>
  );
}
