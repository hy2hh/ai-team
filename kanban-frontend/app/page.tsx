'use client';
import Board from '@/components/Board';
import { useTheme } from '@/lib/theme';

export default function Home() {
  const { theme, toggle } = useTheme();

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] transition-colors duration-200">
      <header className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
        <h1 className="text-[var(--color-text-primary)] text-xl font-bold">AI Team Kanban</h1>
        <button
          onClick={toggle}
          aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          className="p-2 rounded-lg transition-colors hover:bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>
      <div className="p-6">
        <Board />
      </div>
    </main>
  );
}
