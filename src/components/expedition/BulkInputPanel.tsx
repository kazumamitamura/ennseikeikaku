'use client';

import { useState, useMemo } from 'react';
import type { SubsidyRates, PersonalCostItemType, Member, MemberRole } from '@/types/expedition';
import { ITEM_LABELS, ITEM_ORDER, PERSONAL_COST_ROLE_GROUPS } from '@/types/expedition';
import { autoExcludeCheck, makeDateRange, jpDate, rateForItem, yen, isSubsidyEligible } from '@/lib/personalCostCalc';
import { bulkUpsertPersonalCosts } from '@/lib/personalCostApi';

interface Props {
  expeditionId: string;
  members: Member[];
  startDate: string;
  endDate: string;
  rates: SubsidyRates;
  presetItemType?: PersonalCostItemType;
  presetDate?: string;
  presetActual?: number;
  onComplete: () => void;
  onCancel: () => void;
}

export default function BulkInputPanel({
  expeditionId, members, startDate, endDate, rates,
  presetItemType, presetDate, presetActual,
  onComplete, onCancel,
}: Props) {
  const dates = makeDateRange(startDate, endDate);
  const [itemType, setItemType] = useState<PersonalCostItemType>(presetItemType || 'accommodation');
  const [date, setDate] = useState(presetDate || dates[0] || startDate);
  const [actualAmount, setActualAmount] = useState(presetActual ?? 0);
  const [subsidyAmount, setSubsidyAmount] = useState(() =>
    rateForItem(presetItemType || 'accommodation', rates)
  );
  const [isSubsidyTarget, setIsSubsidyTarget] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const autoEx = useMemo(
    () => autoExcludeCheck(itemType, date, startDate, endDate),
    [itemType, date, startDate, endDate]
  );

  const handleItemTypeChange = (t: PersonalCostItemType) => {
    setItemType(t);
    setSubsidyAmount(rateForItem(t, rates));
  };

  const netPerPerson = isSubsidyTarget && !autoEx.excluded
    ? Math.max(0, actualAmount - subsidyAmount)
    : actualAmount;

  const toggleMember = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (groupMembers: Member[]) => {
    const allOn = groupMembers.every(m => selectedIds.has(m.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      groupMembers.forEach(m => (allOn ? next.delete(m.id) : next.add(m.id)));
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      const effectiveSubsidy = (isSubsidyTarget && !autoEx.excluded) ? subsidyAmount : 0;
      const rows = Array.from(selectedIds).map(memberId => {
        const member = members.find(m => m.id === memberId);
        const eligible = member ? isSubsidyEligible(member.role as MemberRole) : false;
        const target = isSubsidyTarget && !autoEx.excluded && eligible;
        return {
          expedition_id: expeditionId,
          member_id: memberId,
          item_type: itemType,
          date,
          actual_amount: actualAmount,
          subsidy_amount: target ? effectiveSubsidy : 0,
          is_subsidy_target: target,
          is_skipped: false,
          auto_excluded: autoEx.excluded,
          auto_exclude_reason: autoEx.reason,
        };
      });
      await bulkUpsertPersonalCosts(rows);
      onComplete();
    } catch {
      alert('登録に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border-2 border-blue-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-gray-800">一括入力</h4>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">費用区分</label>
          <select
            value={itemType}
            onChange={e => handleItemTypeChange(e.target.value as PersonalCostItemType)}
            className="input-select w-full"
          >
            {ITEM_ORDER.map(t => (
              <option key={t} value={t}>{ITEM_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">日付</label>
          <select
            value={date}
            onChange={e => setDate(e.target.value)}
            className="input-select w-full"
          >
            {dates.map(d => (
              <option key={d} value={d}>{jpDate(d)}</option>
            ))}
          </select>
        </div>
      </div>

      {autoEx.excluded && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 mb-3 flex items-start gap-2">
          <span className="flex-shrink-0">⚠️</span>
          <span>{autoEx.reason} — 補助額は自動的に¥0になります</span>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-gray-500 uppercase">対象者を選択</label>
          <div className="flex gap-3 text-xs">
            <button
              onClick={() => setSelectedIds(new Set(members.map(m => m.id)))}
              className="text-blue-600 hover:underline"
            >全選択</button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-gray-500 hover:underline"
            >全解除</button>
          </div>
        </div>
        <div className="border-2 border-gray-100 rounded-xl overflow-hidden">
          {PERSONAL_COST_ROLE_GROUPS.map((group, gi) => {
            const gMembers = members.filter(m => group.roles.includes(m.role));
            if (gMembers.length === 0) return null;
            const allOn = gMembers.every(m => selectedIds.has(m.id));
            return (
              <div key={gi} className={gi > 0 ? 'border-t border-gray-100' : ''}>
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                  <span className="text-xs font-bold text-gray-600">
                    {group.label}（{gMembers.length}名）
                  </span>
                  <button
                    onClick={() => toggleGroup(gMembers)}
                    className="text-xs text-blue-600 hover:underline"
                  >{allOn ? '解除' : '全員選択'}</button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 p-2">
                  {gMembers.map(m => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-xs border transition-colors ${
                        selectedIds.has(m.id)
                          ? 'bg-blue-50 border-blue-300 text-blue-800'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="w-3 h-3 flex-shrink-0 accent-blue-700"
                        checked={selectedIds.has(m.id)}
                        onChange={() => toggleMember(m.id)}
                      />
                      <span className="truncate">{m.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">実支出額（/人）</label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">¥</span>
            <input
              type="number" min="0" step="1"
              value={actualAmount || ''}
              onChange={e => setActualAmount(parseInt(e.target.value) || 0)}
              onFocus={e => e.target.select()}
              placeholder="0"
              className="input-num w-full"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">※金額が人によって異なる場合は後でセルを個別編集</p>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-2">
            補助額（/人）
            <select
              value={isSubsidyTarget ? 'yes' : 'no'}
              onChange={e => setIsSubsidyTarget(e.target.value === 'yes')}
              disabled={autoEx.excluded}
              className="border border-gray-200 rounded px-1.5 py-0.5 text-xs font-normal"
            >
              <option value="yes">補助あり</option>
              <option value="no">補助なし</option>
            </select>
          </label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">¥</span>
            <input
              type="number" min="0" step="1"
              value={subsidyAmount || ''}
              onChange={e => setSubsidyAmount(parseInt(e.target.value) || 0)}
              onFocus={e => e.target.select()}
              disabled={!isSubsidyTarget || autoEx.excluded}
              placeholder="0"
              className={`input-num-green w-full ${
                (!isSubsidyTarget || autoEx.excluded) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between mb-4">
        <span className="text-xs text-gray-600">1人当たり差額負担（学校実質支出）</span>
        <div className="text-right">
          <span className={`text-lg font-bold ${netPerPerson > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            {yen(netPerPerson)}
          </span>
          {selectedIds.size > 0 && (
            <span className="text-xs text-gray-500 ml-2">
              合計 {yen(netPerPerson * selectedIds.size)}（{selectedIds.size}名分）
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">
          選択中: <strong>{selectedIds.size}名</strong>
        </span>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50"
          >キャンセル</button>
          <button
            onClick={handleSubmit}
            disabled={selectedIds.size === 0 || saving}
            className={`px-5 py-2 rounded-lg text-sm font-bold text-white ${
              selectedIds.size === 0 || saving
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-800 hover:bg-blue-900'
            }`}
          >
            {saving ? '登録中...' : `${selectedIds.size}名に一括登録`}
          </button>
        </div>
      </div>
    </div>
  );
}
