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
import { formatYen } from '@/lib/subsidyCalculations';
import type {
  MemberMealRecord, MemberTransportRecord, MemberAccommodationRecord, SubsidySummary,
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
  mealRecords?: MemberMealRecord[];
  memberTransport?: MemberTransportRecord[];
  memberAccommodation?: MemberAccommodationRecord[];
  subsidySummary?: SubsidySummary | null;
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
  mealRecords,
  memberTransport,
  memberAccommodation,
  subsidySummary,
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
        <h4 className="font-semibold text-gray-700 mb-3">📋 費目別内訳</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">宿泊費</span>
            <span className="font-mono">{formatCurrency(summary.accommodationTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">食事費</span>
            <span className="font-mono">{formatCurrency(summary.mealTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">交通費</span>
            <span className="font-mono">{formatCurrency(summary.transportTotal)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t">
            <span className="text-gray-600">その他</span>
            <span className="font-mono">{formatCurrency(summary.otherTotal)}</span>
          </div>
        </div>
      </div>

      {/* 役職別集計 */}
      {summary.roleGroupSummaries && summary.roleGroupSummaries.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h4 className="font-semibold text-gray-700 mb-3 text-sm">👥 役職別集計</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="pb-1 text-left">役職</th>
                <th className="pb-1 text-right">宿泊</th>
                <th className="pb-1 text-right">食事</th>
                <th className="pb-1 text-right">計</th>
              </tr>
            </thead>
            <tbody>
              {summary.roleGroupSummaries.map(g => (
                <tr key={g.role} className={`border-b border-gray-50 ${!g.isSubsidized ? 'text-orange-700' : ''}`}>
                  <td className="py-0.5">
                    {g.label}
                    <span className="text-gray-400 ml-1">({g.memberCount}名)</span>
                    {!g.isSubsidized && <span className="ml-1 text-xs text-red-500">対象外</span>}
                  </td>
                  <td className="py-0.5 text-right font-mono">{g.accommodationTotal > 0 ? formatCurrency(g.accommodationTotal) : '—'}</td>
                  <td className="py-0.5 text-right font-mono">{g.mealTotal > 0 ? formatCurrency(g.mealTotal) : '—'}</td>
                  <td className="py-0.5 text-right font-mono font-medium">{g.total > 0 ? formatCurrency(g.total) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-xs font-semibold">
              <tr className="border-t border-gray-200 text-green-700">
                <td colSpan={3} className="pt-1">補助対象計</td>
                <td className="pt-1 text-right font-mono">{formatCurrency(summary.subsidizedTotal)}</td>
              </tr>
              <tr className="text-orange-600">
                <td colSpan={3}>補助対象外計</td>
                <td className="text-right font-mono">{formatCurrency(summary.nonSubsidizedTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 補助対象費サマリー */}
      {subsidySummary && subsidySummary.total_actual_expense > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h4 className="font-semibold text-gray-700 mb-3 text-sm">🏨 補助対象費内訳</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="pb-1 text-left"></th>
                <th className="pb-1 text-right text-blue-700">実支出</th>
                <th className="pb-1 text-right text-green-700">補助額</th>
                <th className="pb-1 text-right text-amber-700">差額</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-50">
                <td className="py-1">🏨 宿泊費</td>
                <td className="py-1 text-right font-mono text-blue-700">{formatYen(subsidySummary.accommodation_actual)}</td>
                <td className="py-1 text-right font-mono text-green-700">{formatYen(subsidySummary.accommodation_subsidy)}</td>
                <td className="py-1 text-right font-mono text-amber-700">{formatYen(subsidySummary.accommodation_net)}</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-1">🍱 食事費</td>
                <td className="py-1 text-right font-mono text-blue-700">{formatYen(subsidySummary.meal_actual)}</td>
                <td className="py-1 text-right font-mono text-green-700">{formatYen(subsidySummary.meal_subsidy)}</td>
                <td className="py-1 text-right font-mono text-amber-700">{formatYen(subsidySummary.meal_net)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 font-semibold text-xs">
                <td className="pt-1">合計</td>
                <td className="pt-1 text-right font-mono text-blue-700">{formatYen(subsidySummary.total_actual_expense)}</td>
                <td className="pt-1 text-right font-mono text-green-700">{formatYen(subsidySummary.total_subsidy_income)}</td>
                <td className="pt-1 text-right font-mono text-amber-700">{formatYen(subsidySummary.total_net_expense)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="text-xs text-green-700 mt-2">↑ 補助額 {formatYen(subsidySummary.total_subsidy_income)} は収入として自動計上</p>
        </div>
      )}

      <ReportExport
        expedition={expedition}
        members={members}
        incomeItems={incomeItems}
        accommodation={accommodation}
        mealCosts={mealCosts}
        transportCosts={transportCosts}
        otherCosts={otherCosts}
        summary={summary}
        mealRecords={mealRecords}
        memberTransport={memberTransport}
        memberAccommodation={memberAccommodation}
      />
    </div>
  );
}
