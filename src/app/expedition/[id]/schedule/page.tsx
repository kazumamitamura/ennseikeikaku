'use client';

import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import Card from '@/components/ui/Card';
import { useExpedition } from '@/hooks/useExpedition';
import { formatDateWithDay, formatDate } from '@/lib/calculations';

interface PageProps {
  params: { id: string };
}

export default function SchedulePage({ params }: PageProps) {
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
        <p className="text-danger">{error || '遠征が見つかりません'}</p>
      </div>
    );
  }

  const { expedition } = data;
  const start = new Date(expedition.start_date);
  const end = new Date(expedition.end_date);
  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return (
    <div>
      <Link href={`/expedition/${id}`} className="inline-flex items-center text-sm text-gray-500 hover:text-primary mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" />
        収支計算に戻る
      </Link>
      <h2 className="text-xl font-bold text-primary mb-4">試合スケジュール - {expedition.name}</h2>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="md:w-48 flex-shrink-0">
          <Sidebar expeditionId={id} />
        </div>
        <div className="flex-1 space-y-4">
          <Card title="遠征概要">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">大会名</dt>
                <dd className="font-medium">{expedition.competition_name}</dd>
              </div>
              <div>
                <dt className="text-gray-500">期間</dt>
                <dd className="font-medium">
                  {formatDate(expedition.start_date)} 〜 {formatDate(expedition.end_date)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">行先</dt>
                <dd className="font-medium">{expedition.destination}</dd>
              </div>
              <div>
                <dt className="text-gray-500">参加人数</dt>
                <dd className="font-medium">{data.members.length}名</dd>
              </div>
            </dl>
          </Card>

          <Card title="日程">
            <div className="space-y-3">
              {dates.map((date, i) => {
                const dateStr = date.toISOString().split('T')[0];
                const isFirst = i === 0;
                const isLast = i === dates.length - 1;
                return (
                  <div key={dateStr} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="font-semibold text-primary min-w-[120px]">
                      {formatDateWithDay(dateStr)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {isFirst && '遠征開始・移動'}
                      {!isFirst && !isLast && '試合日'}
                      {isLast && !isFirst && '試合・帰路'}
                      {dates.length === 1 && '試合日'}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="参加者">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {data.members.map(m => (
                <li key={m.id} className="flex justify-between p-2 bg-gray-50 rounded">
                  <span>{m.name}</span>
                  <span className="text-gray-500">{m.weight_class || m.role}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
