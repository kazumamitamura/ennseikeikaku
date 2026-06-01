'use client';

import { useState, useEffect, useCallback } from 'react';
import BulkSubsidyInput from './BulkSubsidyInput';
import SubsidyPersonTable from './SubsidyPersonTable';
import { getSubsidyPersonItems, syncSubsidyPersonToIncome } from '@/lib/subsidyPersonApi';
import { calcGroupSummary, yen } from '@/lib/subsidyPersonCalc';
import type { Member, SubsidyPersonItem } from '@/types/expedition';

interface Props {
  expeditionId: string;
  members: Member[];
  startDate: string;
  endDate: string;
  onSummaryChange?: (summary: {
    totalSubsidy: number;
    totalActual: number;
    totalNet: number;
  }) => void;
}

export default function SubsidyPersonSection({
  expeditionId, members, startDate, endDate, onSummaryChange,
}: Props) {
  const [items, setItems] = useState<SubsidyPersonItem[]>([]);
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [bulkForMemberId, setBulkForMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSubsidyPersonItems(expeditionId);
      setItems(data);

      const summary = calcGroupSummary(data);
      onSummaryChange?.({
        totalSubsidy: summary.total_subsidy,
        totalActual:  summary.total_actual,
        totalNet:     summary.total_net,
      });

      const accSubsidy = calcGroupSummary(
        data.filter(i => i.item_type === 'accommodation')
      ).total_subsidy;
      const mealSubsidy = calcGroupSummary(
        data.filter(i => i.item_type !== 'accommodation')
      ).total_subsidy;

      await syncSubsidyPersonToIncome(expeditionId, summary.total_subsidy, {
        accommodation: accSubsidy,
        meal: mealSubsidy,
      });
    } catch (e) {
      console.error('補助対象費の読み込みに失敗:', e);
    } finally {
      setLoading(false);
    }
  }, [expeditionId, onSummaryChange]);

  useEffect(() => { load(); }, [load]);

  const summary = calcGroupSummary(items);

  const handleOpenBulkForMember = (memberId: string) => {
    setBulkForMemberId(memberId);
    setShowBulkInput(true);
  };

  const handleBulkComplete = () => {
    setShowBulkInput(false);
    setBulkForMemberId(null);
    load();
  };

  const handleBulkCancel = () => {
    setShowBulkInput(false);
    setBulkForMemberId(null);
  };

  return (
    <div className="space-y-4">
      {/* サマリーバー */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
            🏨 選手・監督 補助対象費
          </h2>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 text-xs">実支出</span>
              <span className="font-bold text-blue-800 font-mono">{yen(summary.total_actual)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 text-xs">補助額</span>
              <span className="font-bold text-green-700 font-mono">{yen(summary.total_subsidy)}</span>
              <span className="text-xs text-gray-400">↑収入計上</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 text-xs">差額負担</span>
              <span className="font-bold text-amber-700 font-mono">{yen(summary.total_net)}</span>
            </div>
          </div>
          <button
            className="bg-blue-800 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-900 transition-colors flex items-center gap-2"
            onClick={() => { setBulkForMemberId(null); setShowBulkInput(true); }}
          >
            ＋ 一括入力
          </button>
        </div>
      </div>

      {/* 使い方ガイド（データ0件のとき） */}
      {!loading && items.length === 0 && !showBulkInput && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-bold mb-2">💡 使い方</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>「＋ 一括入力」ボタンをクリック</li>
            <li>費用区分（宿泊・朝食など）と日付を選択</li>
            <li>対象者を役職グループで一括選択</li>
            <li>実支出額と補助額を入力して「〇名に登録」</li>
          </ol>
        </div>
      )}

      {/* 一括入力パネル */}
      {showBulkInput && (
        <BulkSubsidyInput
          expeditionId={expeditionId}
          members={members}
          startDate={startDate}
          endDate={endDate}
          onComplete={handleBulkComplete}
          onCancel={handleBulkCancel}
          preSelectedIds={
            bulkForMemberId
              ? members.filter(m => m.id !== bulkForMemberId).map(m => m.id)
              : undefined
          }
        />
      )}

      {/* 個人別明細テーブル */}
      <SubsidyPersonTable
        items={items}
        members={members}
        loading={loading}
        onUpdate={load}
        onOpenBulkForMember={handleOpenBulkForMember}
      />
    </div>
  );
}
