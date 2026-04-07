'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, PanelRight, LogOut } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import FileTree from '@/components/file-tree';
import SearchBar from '@/components/search-bar';
import MarkdownViewer from '@/components/markdown-viewer';
import BacklinksPanel from '@/components/backlinks-panel';

export default function Home() {
  const router = useRouter();
  const { sidebarOpen, rightPanelOpen, toggleSidebar, toggleRightPanel } = useAppStore();

  // 키보드 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        toggleRightPanel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSidebar, toggleRightPanel]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg-base)]">
      {/* 타이틀 바 — 48px */}
      <header className="flex items-center justify-between px-4 flex-shrink-0 h-12 bg-[var(--color-bg-surface)] border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="icon-btn flex items-center justify-center transition-colors duration-150 min-w-[44px] min-h-[44px] text-[var(--color-text-secondary)] bg-transparent rounded-[var(--radius-md)]"
            title="사이드바 토글 (⌘B)"
          >
            <Menu size={16} />
          </button>
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">
            .memory/
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleRightPanel}
            className={`icon-btn flex items-center justify-center transition-colors duration-150 min-w-[44px] min-h-[44px] bg-transparent rounded-[var(--radius-md)] ${rightPanelOpen ? 'text-[var(--color-point-light)]' : 'text-[var(--color-text-secondary)]'}`}
            title="백링크 패널 토글 (⌘/)"
          >
            <PanelRight size={16} />
          </button>
          <button
            onClick={handleLogout}
            className="icon-btn flex items-center justify-center transition-colors duration-150 w-7 h-7 text-[var(--color-text-secondary)] bg-transparent rounded-[var(--radius-xs)]"
            title="로그아웃"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* 메인 레이아웃 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 모바일 드로어 오버레이 */}
        {sidebarOpen && (
          <div
            className="drawer-overlay md:hidden"
            onClick={toggleSidebar}
          />
        )}

        {/* 좌측 사이드바 */}
        {sidebarOpen && (
          <aside
            className="flex flex-col flex-shrink-0 overflow-hidden sidebar-drawer
              fixed md:relative top-0 bottom-0 left-0 md:top-auto md:bottom-auto
              z-50 md:z-auto w-[280px] md:w-[240px] lg:w-[260px]
              bg-[var(--color-bg-surface)] border-r border-[var(--color-border)]"
          >
            <div className="p-3">
              <SearchBar />
            </div>
            <div className="flex-1 overflow-y-auto">
              <FileTree />
            </div>
            <div className="flex-shrink-0 px-3 py-2 text-[11px] text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
              AI Team Shared Memory
            </div>
          </aside>
        )}

        {/* 중앙 — 마크다운 뷰어 */}
        <main className="flex-1 overflow-hidden bg-[var(--color-bg-base)]">
          <MarkdownViewer />
        </main>

        {/* 우측 패널 — 태블릿 이상에서만 고정 패널, 모바일은 오버레이 */}
        {rightPanelOpen && (
          <>
            {/* 태블릿 오버레이 */}
            <div
              className="drawer-overlay hidden sm:block lg:hidden"
              onClick={toggleRightPanel}
            />
            <aside
              className="flex-shrink-0 overflow-hidden
                fixed sm:absolute lg:relative right-0 top-0 bottom-0
                sm:top-auto sm:bottom-auto z-50 lg:z-auto
                w-[260px] bg-[var(--color-bg-surface)] border-l border-[var(--color-border)]"
            >
              <BacklinksPanel />
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
