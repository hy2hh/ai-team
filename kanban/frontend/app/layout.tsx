import type { Metadata } from 'next';
import './globals.css';
import './ui-kit.css';
import { ThemeProvider } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Team Kanban',
  description: 'Team Kanban Board',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
