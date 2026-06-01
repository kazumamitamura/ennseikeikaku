'use client';

import clsx from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import type { ExpeditionSummary } from '@/types/expedition';
import ReportExport from './ReportExport';
import type {
  Expedition, Member, IncomeItem, AccommodationCost,
  MealCost, TransportCost, OtherCost
} from '@/types/expedition';

interface SummaryPanelProps {
  summary: ExpeditionSummary;
  expedition: Expedition;
  members: Member[];
  incomeItems: IncomeItem[];
  accommodation: AccommodationCost | null;
  mealCosts: MealCost[];
  transportCosts: TransportCost[];
  otherCosts: OtherCost[];
}

export default function SummaryPanel({
  summary,
  expedition,
  members,
  incomeItems,
  accommodation,
  mealCosts,
  transportCosts,
  otherCosts,
}: SummaryPanelProps) {
  const isPositive = summary.balance >= 0;

  return (
    <div className="sticky top-4 space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
          📊 収支サマリー
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">収入合計</span>
            <span className="font-mono text-lg font-semibold">{formatCurrency(summary.totalIncome)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">支出合計</span>
            <span className="font-mono text-lg font-semibold">{formatCurrency(summary.totalExpense)}</span>
          </div>
          <hr className="border-gray-200" />
          <div className="flex justify-between items-center">
            <span className="font-medium">収支差額</span>
            <span className={clsx(
              'font-mono text-xl font-bold flex items-center gap-1',
              isPositive ? 'balance-positive' : 'balance-negative'
            )}>
              {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              {isPositive ? '+' : ''}{formatCurrency(summary.balance)}
            </span>
          </div>
          <p className={clsx('text-center text-sm font-medium', isPositive ? 'balance-positive' : 'balance-negative')}>
            {isPositive ? '▲ 黒字' : '▼ 赤字'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h4 className="font-semibold text-gray-700 mb-3">📋 内訳</h4>
        <div className="space-y-3 text-sm">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">宿泊費</span>
              <span className="font-mono">{formatCurrency(summary.accommodationTotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 pl-2">
              <span>生徒 / 教員</span>
              <span>{formatCurrency(summary.accommodationSplit.student)} / {formatCurrency(summary.accommodationSplit.staff)}</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">食事費</span>
              <span className="font-mono">{formatCurrency(summary.mealTotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 pl-2">
              <span>生徒 / 教員</span>
              <span>{formatCurrency(summary.mealSplit.student)} / {formatCurrency(summary.mealSplit.staff)}</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">交通費</span>
              <span className="font-mono">{formatCurrency(summary.transportTotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 pl-2">
              <span>生徒 / 教員</span>
              <span>{formatCurrency(summary.transportSplit.student)} / {formatCurrency(summary.transportSplit.staff)}</span>
            </div>
          </div>
          <div className="flex justify-between pt-1 border-t">
            <span className="text-gray-600">その他</span>
            <span className="font-mono">{formatCurrency(summary.otherTotal)}</span>
          </div>
        </div>
      </div>

      <ReportExport
        expedition={expedition}
        members={members}
        incomeItems={incomeItems}
        accommodation={accommodation}
        mealCosts={mealCosts}
        transportCosts={transportCosts}
        otherCosts={otherCosts}
        summary={summary}
      />
    </div>
  );
}
