import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-primary text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <Link href="/" className="block hover:opacity-90 transition-opacity">
          <h1 className="text-xl md:text-2xl font-bold">🏋️ 遠征収支管理システム</h1>
          <p className="text-sm text-blue-200 mt-1">羽黒高校 ウェイトリフティング部</p>
        </Link>
      </div>
    </header>
  );
}
