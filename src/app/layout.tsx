import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: '遠征収支管理システム | 羽黒高校 ウェイトリフティング部',
  description: '部活動遠征の収支計算・管理システム',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
          {children}
        </main>
        <Footer />
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
