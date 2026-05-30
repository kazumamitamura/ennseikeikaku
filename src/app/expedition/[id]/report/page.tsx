'use client';

import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import ReportExport from '@/components/expedition/ReportExport';
import Card from '@/components/ui/Card';
import { useExpedition } from '@/hooks/useExpedition';
import { useCalculations } from '@/hooks/useCalculations';
import { getEffectiveIncomeItems } from '@/components/expedition/IncomeSection';
import { formatCurrency } from '@/lib/calculations';
import clsx from 'clsx';

interface PageProps {
  params: { id: string };
}

export default function ReportPage({ params }: PageProps) {
  const { id } = params;
  const { data, loading, error } = useExpedition(id);

  const selfPaymentTotal = data?.members.reduce((s, m) => s + m.self_payment, 0) ?? 0;
  const effectiveIncome = getEffectiveIncomeItems(data?.incomeItems ?? [], selfPaymentTotal);
  const summary = useCalculations(
    data?.members ?? [],
    effectiveIncome,
    data?.accommodation ?? null,
    data?.mealCosts ?? [],
    data?.transportCosts ?? [],
    data?.otherCosts ?? []
  );

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

  return (
    <div>
      <Link href={`/expedition/${id}`} className="inline-flex items-center text-sm text-gray-500 hover:text-primary mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" />
        収支計算に戻る
      </Link>
      <h2 className="text-xl font-bold text-primary mb-4">収支報告書出力 - {data.expedition.name}</h2>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="md:w-48 flex-shrink-0">
          <Sidebar expeditionId={id} />
        </div>
        <div className="flex-1 max-w-lg space-y-4">
          <Card title="収支プレビュー">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>収入合計</span>
                <span className="font-mono">{formatCurrency(summary.totalIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span>支出合計</span>
                <span className="font-mono">{formatCurrency(summary.totalExpense)}</span>
              </div>
              <hr />
              <div className="flex justify-between font-semibold">
                <span>収支差額</span>
                <span className={clsx(
                  'font-mono',
                  summary.balance >= 0 ? 'balance-positive' : 'balance-negative'
                )}>
                  {formatCurrency(summary.balance)}
                </span>
              </div>
            </div>
          </Card>

          <Card title="出力">
            <p className="text-sm text-gray-600 mb-4">
              PDF形式またはExcel形式で収支報告書をダウンロードできます。
            </p>
            <ReportExport
              expedition={data.expedition}
              members={data.members}
              incomeItems={data.incomeItems}
              accommodation={data.accommodation}
              mealCosts={data.mealCosts}
              transportCosts={data.transportCosts}
              otherCosts={data.otherCosts}
              summary={summary}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
