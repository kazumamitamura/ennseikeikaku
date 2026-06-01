'use client';

import { useState, useMemo } from 'react';
import type { Member, SubsidyItemType, BulkInputForm, MemberRole } from '@/types/expedition';
import { SUBSIDY_ITEM_LABELS, ITEM_TYPE_ORDER } from '@/types/expedition';
import { yen, toJpDate, dateRange, getAutoExcludeInfo } from '@/lib/subsidyPersonCalc';
import { bulkUpsertSubsidyItems } from '@/lib/subsidyPersonApi';

interface Props {
  expeditionId: string;
  members: Member[];
  startDate: string;
  endDate: string;
  onComplete: () => void;
  onCancel: () => void;
  preSelectedIds?: string[];
}

// 役職グループ（既存の MemberRole に準拠）
const ROLE_GROUPS: { roles: MemberRole[]; label: string; defaultCheck: boolean }[] = [
  { roles: ['athlete', 'second'],      label: '選手・セコンド', defaultCheck: true  },
  { roles: ['advisor', 'external_coach'], label: '顧問・指導者',   defaultCheck: true  },
  { roles: ['supporter', 'staff'],    label: '応援・引率',     defaultCheck: false },
];

export default function BulkSubsidyInput({
  expeditionId, members, startDate, endDate,
  onComplete, onCancel, preSelectedIds,
}: Props) {
  const dates = useMemo(() => dateRange(startDate, endDate), [startDate, endDate]);
  const [itemType, setItemType]     = useState<SubsidyItemType>('accommodation');
  const [date, setDate]             = useState(dates[0] || startDate);
  const [actualAmount, setActual]   = useState(0);
  const [subsidyAmount, setSubsidy] = useState(0);
  const [isSubsidyTarget, setIsSubsidyTarget] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(preSelectedIds ?? [])
  );
  const [saving, setSaving] = useState(false);

  const autoExclude = useMemo(
    () => getAutoExcludeInfo(itemType, date, startDate, endDate),
    [itemType, date, startDate, endDate]
  );

  const netAmount = isSubsidyTarget && !autoExclude.excluded
    ? Math.max(0, actualAmount - subsidyAmount)
    : actualAmount;

  const membersByGroup = ROLE_GROUPS.map(group => ({
    ...group,
    members: members.filter(m => group.roles.includes(m.role as MemberRole)),
  }));

  const toggleGroup = (groupMembers: Member[], allSelected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      groupMembers.forEach(m => allSelected ? next.delete(m.id) : next.add(m.id));
      return next;
    });
  };

  const toggleMember = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      const form: BulkInputForm = {
        item_type: itemType,
        date,
        actual_amount: actualAmount,
        subsidy_amount: subsidyAmount,
        is_subsidy_target: isSubsidyTarget && !autoExclude.excluded,
        target_member_ids: Array.from(selectedIds),
      };
      await bulkUpsertSubsidyItems(form, expeditionId, startDate, endDate);
      onComplete();
    } catch (e) {
      console.error(e);
      alert('登録に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 max-w-2xl">
      <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
        ➕ 一括入力
      </h3>

      {/* 費用区分・日付 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">費用区分</label>
          <select
            className="w-full border-2 border-gray-200 rounded-lg p-2 text-sm focus:border-blue-600 outline-none"
            value={itemType}
            onChange={e => setItemType(e.target.value as SubsidyItemType)}
          >
            {ITEM_TYPE_ORDER.map(t => (
              <option key={t} value={t}>{SUBSIDY_ITEM_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">日付</label>
          <select
            className="w-full border-2 border-gray-200 rounded-lg p-2 text-sm focus:border-blue-600 outline-none"
            value={date}
            onChange={e => setDate(e.target.value)}
          >
            {dates.map(d => (
              <option key={d} value={d}>{toJpDate(d)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 移動日ルール警告 */}
      {autoExclude.excluded && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800 flex items-center gap-2">
          <span>⚠️</span>
          <span>{autoExclude.reason} — 補助額は自動的に¥0になります</span>
        </div>
      )}

      {/* 対象者選択 */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-bold text-gray-500 uppercase">対象者を選択</label>
          <div className="flex gap-2">
            <button
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={() => setSelectedIds(new Set(members.map(m => m.id)))}
            >全選択</button>
            <span className="text-gray-300">|</span>
            <button
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setSelectedIds(new Set())}
            >全解除</button>
          </div>
        </div>

        <div className="border-2 border-gray-100 rounded-lg overflow-hidden">
          {membersByGroup.map((group, gi) => (
            group.members.length > 0 && (
              <div key={gi} className={gi > 0 ? 'border-t border-gray-100' : ''}>
                <div className="flex justify-between items-center px-3 py-2 bg-gray-50">
                  <span className="text-xs font-bold text-gray-600">
                    {group.label}（{group.members.length}名）
                  </span>
                  <button
                    className="text-xs text-blue-600 hover:text-blue-800"
                    onClick={() => {
                      const allSelected = group.members.every(m => selectedIds.has(m.id));
                      toggleGroup(group.members, allSelected);
                    }}
                  >
                    {group.members.every(m => selectedIds.has(m.id)) ? '全解除' : '全員選択'}
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 p-2">
                  {group.members.map(m => (
                    <label
                      key={m.id}
                      className={`
                        flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-xs
                        transition-colors
                        ${selectedIds.has(m.id)
                          ? 'bg-blue-50 border border-blue-200 text-blue-800'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}
                      `}
                    >
                      <input
                        type="checkbox"
                        className="w-3 h-3 accent-blue-700"
                        checked={selectedIds.has(m.id)}
                        onChange={() => toggleMember(m.id)}
                      />
                      <span className="truncate">{m.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* 金額入力 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
            実際の支出額（円）
          </label>
          <input
            type="number" min="0" step="100"
            className="w-full border-2 border-gray-200 rounded-lg p-2 text-right text-base font-bold focus:border-blue-600 outline-none"
            value={actualAmount || ''}
            onChange={e => setActual(parseInt(e.target.value) || 0)}
            onFocus={e => e.target.select()}
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
            補助額（円）
            <select
              className="ml-2 border border-gray-200 rounded px-1 py-0 text-xs font-normal"
              value={isSubsidyTarget ? 'target' : 'non-target'}
              onChange={e => setIsSubsidyTarget(e.target.value === 'target')}
              disabled={autoExclude.excluded}
            >
              <option value="target">補助あり</option>
              <option value="non-target">補助なし</option>
            </select>
          </label>
          <input
            type="number" min="0" step="100"
            className={`
              w-full border-2 rounded-lg p-2 text-right text-base font-bold focus:border-blue-600 outline-none
              ${(!isSubsidyTarget || autoExclude.excluded)
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                : 'border-gray-200'}
            `}
            value={subsidyAmount || ''}
            onChange={e => setSubsidy(parseInt(e.target.value) || 0)}
            onFocus={e => e.target.select()}
            disabled={!isSubsidyTarget || autoExclude.excluded}
            placeholder="0"
          />
        </div>
      </div>

      {/* 差額プレビュー */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4 flex justify-between items-center">
        <span className="text-sm text-gray-600">1人当たり差額負担</span>
        <div className="text-right">
          <span className={`text-lg font-bold ${netAmount > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            {yen(netAmount)}
          </span>
          {selectedIds.size > 0 && (
            <span className="text-xs text-gray-500 ml-2">
              合計 {yen(netAmount * selectedIds.size)}（{selectedIds.size}名分）
            </span>
          )}
        </div>
      </div>

      {/* フッター */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">
          選択中: <strong>{selectedIds.size}名</strong>
        </span>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50"
            onClick={onCancel}
          >キャンセル</button>
          <button
            className={`
              px-6 py-2 rounded-lg text-sm font-bold text-white transition-colors
              ${selectedIds.size === 0 || saving
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-800 hover:bg-blue-900'}
            `}
            onClick={handleSubmit}
            disabled={selectedIds.size === 0 || saving}
          >
            {saving ? '登録中...' : `${selectedIds.size}名に登録`}
          </button>
        </div>
      </div>
    </div>
  );
}
