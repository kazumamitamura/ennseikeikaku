'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Sidebar from '@/components/layout/Sidebar';
import CostCalculator from '@/components/expedition/CostCalculator';
import SubsidyRatesForm from '@/components/expedition/SubsidyRatesForm';
import PersonalCostMatrix from '@/components/expedition/PersonalCostMatrix';
import { useExpedition } from '@/hooks/useExpedition';
import { formatDate } from '@/lib/calculations';
import type { SubsidyRates } from '@/types/expedition';
import { calcSummary } from '@/lib/personalCostCalc';

interface PageProps {
  params: { id: string };
}

const TABS = [
  { id: 'summary', label: '📊 収支計算' },
  { id: 'subsidy', label: '🏨 補助対象費' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function ExpeditionDetailPage({ params }: PageProps) {
  const { id } = params;
  const { data, loading, error } = useExpedition(id);
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [subsidyRates, setSubsidyRates] = useState<SubsidyRates>({
    expedition_id: id,
    accommodation_rate: 0,
    breakfast_rate: 0,
    lunch_rate: 0,
    dinner_rate: 0,
  });

  const handleRatesChange = useCallback((rates: SubsidyRates) => {
    setSubsidyRates(rates);
  }, []);

  const handleSummaryChange = useCallback((_s: ReturnType<typeof calcSummary>) => {
    // 補助サマリー変更時（収入自動計上は PersonalCostMatrix 内で処理）
  }, []);

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

  const { expedition, members } = data;

  return (
    <div>
      <div className="mb-4">
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

      <div className="flex gap-1 mb-4 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="md:w-48 flex-shrink-0">
          <Sidebar expeditionId={id} />
        </div>
        <div className="flex-1">
          {activeTab === 'summary' && (
            <CostCalculator initialData={data} />
          )}
          {activeTab === 'subsidy' && (
            <div className="space-y-4">
              <SubsidyRatesForm
                expeditionId={id}
                onRatesChange={handleRatesChange}
              />
              <PersonalCostMatrix
                expeditionId={id}
                members={members}
                startDate={expedition.start_date}
                endDate={expedition.end_date}
                rates={subsidyRates}
                onSummaryChange={handleSummaryChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
