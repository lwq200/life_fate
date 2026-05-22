import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '浮生渡',
  description: 'AI 驱动的沉浸式人生体验',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="font-serif antialiased">{children}</body>
    </html>
  );
}
