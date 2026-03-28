import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Team Kanban',
  description: 'AI Team Kanban Board',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-slate-900 text-white antialiased">{children}</body>
    </html>
  );
}
