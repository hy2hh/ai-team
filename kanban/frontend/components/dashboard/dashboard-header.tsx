'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/lib/theme';

interface DashboardHeaderProps {
  unreadCount?: number;
}

export default function DashboardHeader({ unreadCount = 0 }: DashboardHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  const isBoard = pathname === '/';
  const isDashboard = pathname === '/dashboard';

  return (
    <header
      style={{
        background: 'var(--color-bg-surface)',
        borderBottom: '1px solid var(--color-border)',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        gap: 16,
        flexShrink: 0,
      }}
    >
      {/* 로고 + 탭 네비게이션 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, var(--color-point) 0%, #c084fc 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            📋
          </div>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Team Kanban
          </span>
        </div>

        {/* 탭 */}
        <nav
          aria-label="페이지 네비게이션"
          style={{ display: 'flex', alignItems: 'center', gap: 0 }}
        >
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 52,
              padding: '0 14px',
              fontSize: 14,
              fontWeight: 500,
              color: isBoard ? 'var(--color-point)' : 'var(--color-text-secondary)',
              textDecoration: 'none',
              borderBottom: isBoard ? '2px solid var(--color-point)' : '2px solid transparent',
              transition: 'color var(--duration-fast), border-color var(--duration-fast)',
              whiteSpace: 'nowrap',
            }}
          >
            Board
          </Link>
          <Link
            href="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 52,
              padding: '0 14px',
              fontSize: 14,
              fontWeight: 500,
              color: isDashboard ? 'var(--color-point)' : 'var(--color-text-secondary)',
              textDecoration: 'none',
              borderBottom: isDashboard ? '2px solid var(--color-point)' : '2px solid transparent',
              transition: 'color var(--duration-fast), border-color var(--duration-fast)',
              whiteSpace: 'nowrap',
            }}
          >
            Dashboard
          </Link>
        </nav>
      </div>

      {/* 오른쪽: 알림 벨 + 테마 토글 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* 알림 벨 */}
        <button
          aria-label={`알림 ${unreadCount}개`}
          style={{
            position: 'relative',
            width: 36,
            height: 36,
            minHeight: 44,
            minWidth: 44,
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-elevated)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            transition: 'background var(--duration-fast), border-color var(--duration-fast)',
            flexShrink: 0,
          }}
        >
          🔔
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                minWidth: 14,
                height: 14,
                borderRadius: 7,
                background: 'var(--color-priority-high)',
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                lineHeight: 1,
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* 테마 토글 */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          style={{
            width: 36,
            height: 36,
            minHeight: 44,
            minWidth: 44,
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-elevated)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            transition: 'background var(--duration-fast), border-color var(--duration-fast)',
            flexShrink: 0,
          }}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
