'use client';

import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Sidebar from '@/components/layout/Sidebar';
import CostCalculator from '@/components/expedition/CostCalculator';
import { useExpedition } from '@/hooks/useExpedition';
import { formatDate } from '@/lib/calculations';

interface PageProps {
  params: { id: string };
}

export default function ExpeditionDetailPage({ params }: PageProps) {
  const { id } = params;
  const { data, loading, error } = useExpedition(id);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-danger mb-4">{error || '遠征が見つかりません'}</p>
        <Link href="/" className="text-primary hover:underline">一覧に戻る</Link>
      </div>
    );
  }

  const { expedition } = data;

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-primary mb-2">
          <ArrowLeft className="w-4 h-4 mr-1" />
          一覧に戻る
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-primary">{expedition.name}</h2>
          <Badge status={expedition.status} />
        </div>
        <p className="text-gray-600 mt-1">{expedition.competition_name}</p>
        <p className="text-sm text-gray-500">
          {formatDate(expedition.start_date)} 〜 {formatDate(expedition.end_date)} | {expedition.destination}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="md:w-48 flex-shrink-0">
          <Sidebar expeditionId={id} />
        </div>
        <div className="flex-1">
          <CostCalculator initialData={data} />
        </div>
      </div>
    </div>
  );
}
