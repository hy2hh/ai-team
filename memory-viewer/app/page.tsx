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
    <div className="h-screen flex flex-col bg-[var(--bg-primary)]">
      {/* Global Navigation — 52px Apple Glass */}
      <header className="nav-glass flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSidebar}
            className="icon-btn"
            aria-label="사이드바 토글 (⌘B)"
          >
            <Menu size={18} strokeWidth={1.5} />
          </button>
          <span className="nav-title select-none">.memory/</span>
        </div>

        <div className="flex items-center gap-0">
          <button
            onClick={toggleRightPanel}
            className={`icon-btn ${rightPanelOpen ? 'icon-btn-active' : ''}`}
            aria-label="백링크 패널 토글 (⌘/)"
          >
            <PanelRight size={18} strokeWidth={1.5} />
          </button>
          <button
            onClick={handleLogout}
            className="icon-btn"
            aria-label="로그아웃"
          >
            <LogOut size={16} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 모바일 드로어 오버레이 */}
        {sidebarOpen && (
          <div
            className="drawer-overlay md:hidden"
            onClick={toggleSidebar}
          />
        )}

        {/* Left Sidebar — Apple Finder */}
        {sidebarOpen && (
          <aside
            className="sidebar flex flex-col flex-shrink-0 overflow-hidden sidebar-drawer
              fixed md:relative top-0 bottom-0 left-0 md:top-auto md:bottom-auto
              z-50 md:z-auto"
          >
            {/* Search */}
            <div className="px-3 pt-3 pb-2">
              <SearchBar />
            </div>

            <div className="sidebar-divider" />

            {/* File Tree */}
            <div className="flex-1 overflow-y-auto scrollbar-auto py-1">
              <FileTree />
            </div>

            {/* Footer */}
            <div className="sidebar-divider" />
            <div className="flex-shrink-0 px-4 py-3">
              <span className="sidebar-label">AI Team Memory</span>
            </div>
          </aside>
        )}

        {/* Center: Markdown Viewer */}
        <main className="flex-1 overflow-hidden bg-[var(--bg-primary)]">
          <MarkdownViewer />
        </main>

        {/* Right Panel: Backlinks & Outline */}
        {rightPanelOpen && (
          <>
            <div
              className="drawer-overlay hidden sm:block lg:hidden"
              onClick={toggleRightPanel}
            />
            <aside
              className="right-panel flex-shrink-0 overflow-hidden border-l
                fixed sm:absolute lg:relative right-0 top-0 bottom-0
                sm:top-auto sm:bottom-auto z-50 lg:z-auto"
            >
              <BacklinksPanel />
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
