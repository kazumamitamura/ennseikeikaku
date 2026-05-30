'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Calculator, Users, Calendar, FileText } from 'lucide-react';

interface SidebarProps {
  expeditionId: string;
}

const navItems = [
  { href: '', label: '収支計算', icon: Calculator },
  { href: '/members', label: '名簿管理', icon: Users },
  { href: '/schedule', label: 'スケジュール', icon: Calendar },
  { href: '/report', label: '報告書出力', icon: FileText },
];

export default function Sidebar({ expeditionId }: SidebarProps) {
  const pathname = usePathname();
  const basePath = `/expedition/${expeditionId}`;

  return (
    <nav className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 mb-4 md:mb-0">
      <ul className="flex md:flex-col gap-1 overflow-x-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const fullPath = `${basePath}${href}`;
          const isActive = href === ''
            ? pathname === basePath
            : pathname.startsWith(fullPath);
          return (
            <li key={href} className="flex-shrink-0">
              <Link
                href={fullPath}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
