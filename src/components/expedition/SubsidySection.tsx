'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlertTriangle, CheckCircle, Flag, Save } from 'lucide-react';
import Card from '@/components/ui/Card';
import {
  calcSubsidyItem, calcSubsidySummary, isSubsidyTarget,
  formatJpDate, formatYen, generateDateRange,
} from '@/lib/subsidyCalculations';
import { getSubsidyItems, upsertSubsidyItem, syncSubsidyToIncome } from '@/lib/subsidyApi';
import type { SubsidyItem, SubsidyItemType, SubsidySummary } from '@/types/expedition';
import { SUBSIDY_ITEM_TYPE_LABELS } from '@/types/expedition';

const ITEM_TYPES_PER_DATE = (isLastDay: boolean): SubsidyItemType[] =>
  isLastDay
    ? ['breakfast', 'lunch', 'dinner']
    : ['accommodation', 'breakfast', 'lunch', 'dinner'];

interface SubsidySectionProps {
  expeditionId: string;
  startDate: string;
  endDate: string;
  moveInDate?: string;
  moveOutDate?: string;
  memberCounts: {
    athletes: number;
    advisors: number;
    others: number;
    total: number;
  };
  onSummaryChange: (summary: SubsidySummary) => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function SubsidySection({
  expeditionId,
  startDate,
  endDate,
  moveInDate,
  moveOutDate,
  memberCounts,
  onSummaryChange,
}: SubsidySectionProps) {
  const dates = useMemo(() => generateDateRange(startDate, endDate), [startDate, endDate]);
  const firstDay = moveInDate || startDate;
  const lastDay = moveOutDate || endDate;

  const [items, setItems] = useState<SubsidyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDate, setActiveDate] = useState(dates[0] || '');
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const debounceRef = useRef<Record<string, NodeJS.Timeout>>({});

  // 補助対象人数のデフォルト（選手＋顧問）
  const defaultSubsidyCount = memberCounts.athletes + memberCounts.advisors;

  // ── データ取得 ─────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    getSubsidyItems(expeditionId)
      .then(data => {
        if (data.length === 0) {
          // 初期データを生成
          const initItems: SubsidyItem[] = [];
          for (const date of dates) {
            const isLastDate = date === lastDay;
            const types = ITEM_TYPES_PER_DATE(isLastDate);
            for (const itemType of types) {
              const { isTarget, reason } = isSubsidyTarget(
                itemType, date, startDate, endDate, firstDay, lastDay
              );
              initItems.push({
                id: `local-${date}-${itemType}`,
                expedition_id: expeditionId,
                date,
                item_type: itemType,
                is_subsidy_target: isTarget,
                subsidy_rule_reason: reason,
                subsidy_target_count: isTarget ? defaultSubsidyCount : 0,
                non_subsidy_count: isTarget ? 0 : defaultSubsidyCount,
                skip_count: 0,
                subsidy_amount_per_person: 0,
                actual_amount_per_person: 0,
              });
            }
          }
          setItems(initItems);
        } else {
          setItems(data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expeditionId]);

  // サマリーを親に通知
  const summary = useMemo(() => calcSubsidySummary(items), [items]);
  useEffect(() => {
    onSummaryChange(summary);
  }, [summary, onSummaryChange]);

  // ── アイテム更新（デバウンス自動保存）────────────────────────
  const updateItem = useCallback((
    date: string,
    itemType: SubsidyItemType,
    field: keyof SubsidyItem,
    value: number | boolean | string
  ) => {
    setItems(prev => prev.map(it =>
      it.date === date && it.item_type === itemType
        ? { ...it, [field]: value }
        : it
    ));

    const key = `${date}-${itemType}`;
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    setSaveStatus(s => ({ ...s, [key]: 'saving' }));

    debounceRef.current[key] = setTimeout(async () => {
      const latest = items.find(it => it.date === date && it.item_type === itemType);
      if (!latest) return;
      const updated = { ...latest, [field]: value };
      try {
        const { id, created_at, updated_at, ...upsertData } = updated;
        await upsertSubsidyItem(upsertData);
        setSaveStatus(s => ({ ...s, [key]: 'saved' }));
        // 補助収入を同期
        syncSubsidyToIncome(calcSubsidySummary(
          items.map(it => it.date === date && it.item_type === itemType ? updated : it)
        ), expeditionId).catch(console.error);
      } catch {
        setSaveStatus(s => ({ ...s, [key]: 'error' }));
      }
    }, 500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, expeditionId]);

  const getItem = (date: string, itemType: SubsidyItemType): SubsidyItem | undefined =>
    items.find(it => it.date === date && it.item_type === itemType);

  const isLastDay = activeDate === lastDay;

  if (loading) {
    return (
      <Card title="🏨 選手・監督 補助対象費">
        <p className="text-gray-400 text-center py-8">読み込み中...</p>
      </Card>
    );
  }

  return (
    <Card title="🏨 選手・監督 補助対象費">
      <p className="text-xs text-gray-500 mb-4">
        移動日ルール: 初日の朝食・昼食、最終日の夕食は補助対象外。補助額は収入として自動計上されます。
      </p>

      {/* 日付タブ */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {dates.map(date => {
          const isFirst = date === firstDay;
          const isLast = date === lastDay;
          return (
            <button
              key={date}
              onClick={() => setActiveDate(date)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                activeDate === date
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {formatJpDate(date)}
              {isFirst && <span className="bg-yellow-400 text-yellow-900 px-1 rounded text-xs">⚠️移動日</span>}
              {isLast && !isFirst && <span className="bg-red-400 text-white px-1 rounded text-xs">🏁最終日</span>}
            </button>
          );
        })}
      </div>

      {/* 日付ラベル */}
      <div className="mb-3">
        <h4 className="font-semibold text-gray-700">
          {formatJpDate(activeDate)}
          {activeDate === firstDay && (
            <span className="ml-2 text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
              ⚠️ 朝食・昼食は補助対象外（移動日ルール）
            </span>
          )}
          {activeDate === lastDay && activeDate !== firstDay && (
            <span className="ml-2 text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
              🏁 夕食は補助対象外（最終日ルール）
            </span>
          )}
        </h4>
      </div>

      {/* マトリクステーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-300">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 w-28">区分</th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-gray-700 w-20">補助対象<br/>人数</th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-gray-700 w-20">対象外<br/>人数</th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-gray-700 w-16">欠席<br/>人数</th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-[#1b6b3a] w-24">補助単価<br/>（/人）</th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-[#1d4ed8] w-24">実支出<br/>（/人）</th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-[#92400e] w-24">差額<br/>（/人）</th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-gray-700 w-28">実支出計</th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-[#1b6b3a] w-24">補助計</th>
              <th className="py-2 px-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {ITEM_TYPES_PER_DATE(isLastDay).map(itemType => {
              const item = getItem(activeDate, itemType);
              if (!item) return null;
              const calc = calcSubsidyItem(item);
              const isTarget = item.is_subsidy_target;
              const key = `${activeDate}-${itemType}`;
              const status = saveStatus[key] || 'idle';
              const diff = item.actual_amount_per_person - item.subsidy_amount_per_person;

              return (
                <tr
                  key={itemType}
                  className={`border-b border-gray-100 ${
                    !isTarget ? 'bg-gray-50 opacity-70' : 'hover:bg-blue-50/20'
                  }`}
                >
                  <td className="py-2 px-3">
                    <span className="font-medium text-sm">{SUBSIDY_ITEM_TYPE_LABELS[itemType]}</span>
                    {!isTarget && (
                      <div className="text-xs text-gray-500 mt-0.5">{item.subsidy_rule_reason}</div>
                    )}
                  </td>

                  {/* 補助対象人数 */}
                  <td className="py-1.5 px-2">
                    {isTarget ? (
                      <input
                        type="number"
                        min="0"
                        value={item.subsidy_target_count}
                        onChange={e => updateItem(activeDate, itemType, 'subsidy_target_count', parseInt(e.target.value) || 0)}
                        onFocus={e => e.target.select()}
                        className="input-currency w-full text-right"
                      />
                    ) : (
                      <div className="text-center text-gray-400 text-xs bg-gray-100 rounded py-1.5 cursor-not-allowed">
                        ×補助対象外
                      </div>
                    )}
                  </td>

                  {/* 対象外人数 */}
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      min="0"
                      value={item.non_subsidy_count}
                      onChange={e => updateItem(activeDate, itemType, 'non_subsidy_count', parseInt(e.target.value) || 0)}
                      onFocus={e => e.target.select()}
                      className="input-currency w-full text-right"
                    />
                  </td>

                  {/* 欠席人数（朝食のみ・宿泊以外） */}
                  <td className="py-1.5 px-2">
                    {itemType !== 'accommodation' ? (
                      <input
                        type="number"
                        min="0"
                        value={item.skip_count}
                        onChange={e => updateItem(activeDate, itemType, 'skip_count', parseInt(e.target.value) || 0)}
                        onFocus={e => e.target.select()}
                        className="input-currency w-full text-right"
                      />
                    ) : (
                      <div className="text-center text-gray-300 text-xs">—</div>
                    )}
                  </td>

                  {/* 補助単価 */}
                  <td className="py-1.5 px-2">
                    {isTarget ? (
                      <input
                        type="number"
                        min="0"
                        value={item.subsidy_amount_per_person}
                        onChange={e => updateItem(activeDate, itemType, 'subsidy_amount_per_person', parseInt(e.target.value) || 0)}
                        onFocus={e => e.target.select()}
                        className="input-currency w-full text-right border-green-300 focus:border-green-500"
                      />
                    ) : (
                      <div className="text-center text-gray-300 text-xs bg-gray-100 rounded py-1.5">—</div>
                    )}
                  </td>

                  {/* 実支出単価 */}
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      min="0"
                      value={item.actual_amount_per_person}
                      onChange={e => updateItem(activeDate, itemType, 'actual_amount_per_person', parseInt(e.target.value) || 0)}
                      onFocus={e => e.target.select()}
                      className="input-currency w-full text-right border-blue-300 focus:border-blue-500"
                    />
                  </td>

                  {/* 差額（1人分） */}
                  <td className="py-1.5 px-2 text-right">
                    {isTarget ? (
                      <span className={`font-mono text-sm font-medium ${
                        diff < 0 ? 'text-red-600' : diff === 0 ? 'text-green-700' : 'text-amber-700'
                      }`}>
                        {diff < 0 ? '⚠️ ' : ''}{formatYen(diff)}
                      </span>
                    ) : (
                      <span className="font-mono text-sm text-gray-500">{formatYen(item.actual_amount_per_person)}</span>
                    )}
                  </td>

                  {/* 実支出計 */}
                  <td className="py-1.5 px-2 text-right">
                    <span className="font-mono text-sm text-blue-700 font-medium">
                      {formatYen(calc.grand_total_actual)}
                    </span>
                  </td>

                  {/* 補助計 */}
                  <td className="py-1.5 px-2 text-right">
                    <span className="font-mono text-sm text-green-700 font-medium">
                      {isTarget ? formatYen(calc.grand_total_subsidy) : '—'}
                    </span>
                  </td>

                  {/* 保存ステータス */}
                  <td className="py-1.5 px-1 text-center">
                    {status === 'saving' && <span className="text-gray-400 text-xs">💾</span>}
                    {status === 'saved' && <CheckCircle className="w-3.5 h-3.5 text-green-500 inline" />}
                    {status === 'error' && <span className="text-red-500 text-xs">✗</span>}
                  </td>
                </tr>
              );
            })}

            {/* 日計行 */}
            <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
              <td className="py-2 px-3 text-sm">日計</td>
              <td colSpan={6}></td>
              <td className="py-2 px-2 text-right font-mono text-sm text-blue-700">
                {formatYen(
                  ITEM_TYPES_PER_DATE(isLastDay)
                    .map(t => getItem(activeDate, t))
                    .filter(Boolean)
                    .reduce((s, it) => s + calcSubsidyItem(it!).grand_total_actual, 0)
                )}
              </td>
              <td className="py-2 px-2 text-right font-mono text-sm text-green-700">
                {formatYen(
                  ITEM_TYPES_PER_DATE(isLastDay)
                    .map(t => getItem(activeDate, t))
                    .filter(Boolean)
                    .reduce((s, it) => s + calcSubsidyItem(it!).grand_total_subsidy, 0)
                )}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 人数整合チェック */}
      {ITEM_TYPES_PER_DATE(isLastDay).map(itemType => {
        const item = getItem(activeDate, itemType);
        if (!item) return null;
        const total = item.subsidy_target_count + item.non_subsidy_count + item.skip_count;
        if (total > memberCounts.total && memberCounts.total > 0) {
          return (
            <div key={itemType} className="mt-2 flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
              <AlertTriangle className="w-3.5 h-3.5" />
              {SUBSIDY_ITEM_TYPE_LABELS[itemType]}: 入力合計{total}名が参加者{memberCounts.total}名を超えています
            </div>
          );
        }
        return null;
      })}

      {/* 全体サマリーパネル */}
      <div className="mt-6 pt-4 border-t-2 border-gray-200">
        <h4 className="font-semibold text-gray-700 mb-3 text-sm">📊 補助対象費サマリー（全日程合計）</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="pb-1 text-left"></th>
                <th className="pb-1 text-right text-blue-700">実支出</th>
                <th className="pb-1 text-right text-green-700">補助額<br/><span className="text-xs text-gray-400">↑収入計上</span></th>
                <th className="pb-1 text-right text-amber-700">差額負担</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 font-medium">🏨 宿泊費</td>
                <td className="py-1.5 text-right font-mono text-blue-700">{formatYen(summary.accommodation_actual)}</td>
                <td className="py-1.5 text-right font-mono text-green-700">{formatYen(summary.accommodation_subsidy)}</td>
                <td className="py-1.5 text-right font-mono text-amber-700">{formatYen(summary.accommodation_net)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 font-medium">🍱 食事費</td>
                <td className="py-1.5 text-right font-mono text-blue-700">{formatYen(summary.meal_actual)}</td>
                <td className="py-1.5 text-right font-mono text-green-700">{formatYen(summary.meal_subsidy)}</td>
                <td className="py-1.5 text-right font-mono text-amber-700">{formatYen(summary.meal_net)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-bold">
                <td className="pt-2">合計</td>
                <td className="pt-2 text-right font-mono text-blue-700 text-base">{formatYen(summary.total_actual_expense)}</td>
                <td className="pt-2 text-right font-mono text-green-700 text-base">{formatYen(summary.total_subsidy_income)}</td>
                <td className="pt-2 text-right font-mono text-amber-700 text-base">{formatYen(summary.total_net_expense)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Card>
  );
}
