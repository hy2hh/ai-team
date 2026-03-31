'use client';
import { createContext, useContext, useEffect } from 'react';

// 다크 모드 전용 — 라이트 모드 미지원
interface ThemeContextValue {
  theme: 'dark';
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark' });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('kanban-theme', 'dark');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
