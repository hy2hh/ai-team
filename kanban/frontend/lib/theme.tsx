'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
});

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // class 기반 (Tailwind v4 dark variant + Toss 토큰)
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
  // data-theme 속성 (기존 Apple 토큰 호환)
  root.setAttribute('data-theme', theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  // 초기 로드: localStorage → 시스템 다크모드 → 기본 dark 순으로 결정
  useEffect(() => {
    const saved = localStorage.getItem('kanban-theme') as Theme | null;
    let initial: Theme = 'dark';
    if (saved === 'light' || saved === 'dark') {
      initial = saved;
    } else if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      initial = 'light';
    }
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('kanban-theme', next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
