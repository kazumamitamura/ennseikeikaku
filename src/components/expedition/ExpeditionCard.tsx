'use client';

import Link from 'next/link';
import { Copy, Trash2, ExternalLink } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/lib/calculations';
import type { Expedition } from '@/types/expedition';
import clsx from 'clsx';

interface ExpeditionCardProps {
  expedition: Expedition;
  balance?: number;
  memberCount?: number;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ExpeditionCard({
  expedition,
  balance,
  memberCount,
  onDuplicate,
  onDelete,
}: ExpeditionCardProps) {
  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-primary">{expedition.name}</h3>
            <Badge status={expedition.status} />
          </div>
          <p className="text-gray-600 text-sm mb-1">{expedition.competition_name}</p>
          <p className="text-gray-500 text-sm">
            {formatDateShort(expedition.start_date)}〜{formatDateShort(expedition.end_date)}
            {' | '}{expedition.destination}
          </p>
          <div className="flex flex-wrap gap-4 mt-2 text-sm">
            {memberCount !== undefined && (
              <span className="text-gray-600">参加: {memberCount}名</span>
            )}
            {balance !== undefined && (
              <span className={clsx(
                'font-semibold',
                balance >= 0 ? 'balance-positive' : 'balance-negative'
              )}>
                収支: {balance >= 0 ? '▲' : '▼'}{formatCurrency(Math.abs(balance))}
                {balance >= 0 ? '（黒字）' : '（赤字）'}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/expedition/${expedition.id}`}>
            <Button size="sm">
              <ExternalLink className="w-4 h-4 mr-1" />
              詳細を開く
            </Button>
          </Link>
          <Button size="sm" variant="secondary" onClick={() => onDuplicate(expedition.id)}>
            <Copy className="w-4 h-4 mr-1" />
            複製
          </Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(expedition.id)}>
            <Trash2 className="w-4 h-4 mr-1" />
            削除
          </Button>
        </div>
      </div>
    </Card>
  );
}
