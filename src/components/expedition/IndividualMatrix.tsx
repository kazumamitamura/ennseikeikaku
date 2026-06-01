'use client';

import { useState, useMemo } from 'react';
import Card from '@/components/ui/Card';
import { formatCurrency, parseInteger, formatDateWithDay, cycleMealStatus } from '@/lib/calculations';
import type {
  Member, MemberMealRecord, MemberAccommodationRecord, MemberRole,
} from '@/types/expedition';
import { MEMBER_ROLE_LABELS } from '@/types/expedition';

// 補助対象外の役職
const NON_SUBSIDIZED_ROLES: MemberRole[] = ['external_coach', 'supporter'];
// 役職の表示順
const ROLE_ORDER: MemberRole[] = ['advisor', 'external_coach', 'staff', 'athlete', 'second', 'supporter'];

interface IndividualMatrixProps {
  members: Member[];
  mealRecords: MemberMealRecord[];
  onChangeMealRecords: (records: MemberMealRecord[]) => void;
  accommodationRecords: MemberAccommodationRecord[];
  onChangeAccommodationRecords: (records: MemberAccommodationRecord[]) => void;
  expeditionId: string;
  startDate: string;
  endDate: string;
}

function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export default function IndividualMatrix({
  members,
  mealRecords,
  onChangeMealRecords,
  accommodationRecords,
  onChangeAccommodationRecords,
  expeditionId,
  startDate,
  endDate,
}: IndividualMatrixProps) {
  const dates = useMemo(() => getDateRange(startDate, endDate), [startDate, endDate]);
  // 宿泊可能な夜: 最終日以外
  const nightDates = useMemo(() => dates.slice(0, -1), [dates]);

  const [activeDate, setActiveDate] = useState<string>(dates[0] || '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 一括設定用の入力値
  const [bulkStays, setBulkStays] = useState(true);
  const [bulkRoomPrice, setBulkRoomPrice] = useState(0);
  const [bulkBreakfastPrice, setBulkBreakfastPrice] = useState(0);
  const [bulkLunchPrice, setBulkLunchPrice] = useState(0);
  const [bulkDinnerPrice, setBulkDinnerPrice] = useState(0);

  const isNightDate = nightDates.includes(activeDate);
  const sortedMembers = useMemo(() =>
    [...members].sort((a, b) =>
      ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.sort_order - b.sort_order
    ), [members]);

  // ─── ヘルパー ──────────────────────────────────────────────────
  const getAccRec = (memberId: string, date: string): MemberAccommodationRecord | undefined =>
    accommodationRecords.find(r => r.member_id === memberId && r.date === date);

  const getMealRec = (memberId: string, date: string): MemberMealRecord | undefined =>
    mealRecords.find(r => r.member_id === memberId && r.date === date);

  // ─── 宿泊レコード更新 ─────────────────────────────────────────
  const updateAccRec = (memberId: string, date: string, patch: Partial<MemberAccommodationRecord>) => {
    const existing = getAccRec(memberId, date);
    if (existing) {
      onChangeAccommodationRecords(
        accommodationRecords.map(r =>
          r.member_id === memberId && r.date === date ? { ...r, ...patch } : r
        )
      );
    } else {
      onChangeAccommodationRecords([
        ...accommodationRecords,
        {
          id: `temp-acc-${memberId}-${date}`,
          expedition_id: expeditionId,
          member_id: memberId,
          date,
          stays: true,
          unit_price: 0,
          ...patch,
        },
      ]);
    }
  };

  // ─── 食事レコード更新 ─────────────────────────────────────────
  const updateMealRec = (memberId: string, date: string, patch: Partial<MemberMealRecord>) => {
    const existing = getMealRec(memberId, date);
    if (existing) {
      onChangeMealRecords(
        mealRecords.map(r =>
          r.member_id === memberId && r.date === date ? { ...r, ...patch } : r
        )
      );
    } else {
      onChangeMealRecords([
        ...mealRecords,
        {
          id: `temp-meal-${memberId}-${date}`,
          expedition_id: expeditionId,
          member_id: memberId,
          date,
          breakfast_status: 'eat',
          lunch_status: 'eat',
          dinner_status: 'eat',
          breakfast_price: 0,
          lunch_price: 0,
          dinner_price: 0,
          ...patch,
        },
      ]);
    }
  };

  // ─── 一括適用 ─────────────────────────────────────────────────
  const applyBulk = () => {
    const ids = Array.from(selectedIds);
    const date = activeDate;

    // 宿泊（夜のある日のみ）
    if (isNightDate) {
      ids.forEach(memberId => {
        updateAccRec(memberId, date, { stays: bulkStays, unit_price: bulkRoomPrice });
      });
    }

    // 食事
    ids.forEach(memberId => {
      updateMealRec(memberId, date, {
        breakfast_price: bulkBreakfastPrice,
        lunch_price: bulkLunchPrice,
        dinner_price: bulkDinnerPrice,
      });
    });

    setSelectedIds(new Set());
  };

  // ─── 集計 ─────────────────────────────────────────────────────
  const roleSummary = useMemo(() => {
    return ROLE_ORDER
      .filter(role => members.some(m => m.role === role))
      .map(role => {
        const roleMembers = members.filter(m => m.role === role);
        const ids = new Set(roleMembers.map(m => m.id));
        const accTotal = accommodationRecords
          .filter(r => ids.has(r.member_id) && r.stays !== false)
          .reduce((s, r) => s + (r.unit_price || 0), 0);
        const mealTotal = mealRecords
          .filter(r => ids.has(r.member_id))
          .reduce((s, r) => {
            let t = 0;
            if (r.breakfast_status === 'eat') t += r.breakfast_price || 0;
            if (r.lunch_status === 'eat') t += r.lunch_price || 0;
            if (r.dinner_status === 'eat') t += r.dinner_price || 0;
            return s + t;
          }, 0);
        return {
          role,
          label: MEMBER_ROLE_LABELS[role],
          count: roleMembers.length,
          accTotal,
          mealTotal,
          total: accTotal + mealTotal,
          isSubsidized: !NON_SUBSIDIZED_ROLES.includes(role),
        };
      });
  }, [members, accommodationRecords, mealRecords]);

  const grandTotal = roleSummary.reduce((s, g) => s + g.total, 0);
  const subsidizedTotal = roleSummary.filter(g => g.isSubsidized).reduce((s, g) => s + g.total, 0);
  const nonSubsidizedTotal = roleSummary.filter(g => !g.isSubsidized).reduce((s, g) => s + g.total, 0);

  // 日付ごとの小計
  const dayTotal = useMemo(() => {
    const acc = isNightDate
      ? accommodationRecords
        .filter(r => r.date === activeDate && r.stays !== false)
        .reduce((s, r) => s + (r.unit_price || 0), 0)
      : 0;
    const meals = mealRecords
      .filter(r => r.date === activeDate)
      .reduce((s, r) => {
        let t = 0;
        if (r.breakfast_status === 'eat') t += r.breakfast_price || 0;
        if (r.lunch_status === 'eat') t += r.lunch_price || 0;
        if (r.dinner_status === 'eat') t += r.dinner_price || 0;
        return s + t;
      }, 0);
    return { acc, meals, total: acc + meals };
  }, [activeDate, isNightDate, accommodationRecords, mealRecords]);

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });
  const toggleAll = () => {
    setSelectedIds(prev =>
      prev.size === sortedMembers.length ? new Set() : new Set(sortedMembers.map(m => m.id))
    );
  };
  const allSelected = sortedMembers.length > 0 && selectedIds.size === sortedMembers.length;

  // 役職ラベルの色
  const roleBadgeClass = (role: MemberRole) => {
    switch (role) {
      case 'advisor': return 'bg-purple-100 text-purple-800';
      case 'external_coach': return 'bg-pink-100 text-pink-800';
      case 'staff': return 'bg-orange-100 text-orange-800';
      case 'athlete': return 'bg-blue-100 text-blue-800';
      case 'second': return 'bg-cyan-100 text-cyan-800';
      case 'supporter': return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (members.length === 0) {
    return (
      <Card title="③ 個人別 宿泊・食事マトリクス">
        <p className="text-gray-400 text-sm text-center py-4">
          先に名簿にメンバーを追加してください。
        </p>
      </Card>
    );
  }

  return (
    <Card title="③ 個人別 宿泊・食事マトリクス">
      {/* 日付タブ */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {dates.map(date => (
          <button
            key={date}
            onClick={() => { setActiveDate(date); setSelectedIds(new Set()); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeDate === date
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {formatDateWithDay(date)}
            {nightDates.includes(date) ? '🌙' : '☀️'}
          </button>
        ))}
      </div>

      {/* 一括設定パネル */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-blue-800 mb-2">
            📋 選択した {selectedIds.size}名 に一括適用
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-2">
            {isNightDate && (
              <>
                <div>
                  <label className="text-xs text-gray-600 block mb-0.5">宿泊</label>
                  <select
                    value={bulkStays ? '1' : '0'}
                    onChange={e => setBulkStays(e.target.value === '1')}
                    className="border-2 border-gray-400 rounded-lg px-2 py-1.5 text-sm text-gray-900 bg-white w-full focus:border-blue-600 focus:outline-none"
                  >
                    <option value="1">○ 宿泊</option>
                    <option value="0">ー なし</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-0.5">宿泊料 ¥</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={bulkRoomPrice || ''}
                    onChange={e => setBulkRoomPrice(parseInteger(e.target.value))}
                    className="input-num disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="0"
                    disabled={!bulkStays}
                  />
                </div>
              </>
            )}
            <div>
              <label className="text-xs text-gray-600 block mb-0.5">朝食 ¥</label>
              <input
                type="number"
                inputMode="numeric"
                value={bulkBreakfastPrice || ''}
                onChange={e => setBulkBreakfastPrice(parseInteger(e.target.value))}
                className="input-num"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-0.5">昼食 ¥</label>
              <input
                type="number"
                inputMode="numeric"
                value={bulkLunchPrice || ''}
                onChange={e => setBulkLunchPrice(parseInteger(e.target.value))}
                className="input-num"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-0.5">夕食 ¥</label>
              <input
                type="number"
                inputMode="numeric"
                value={bulkDinnerPrice || ''}
                onChange={e => setBulkDinnerPrice(parseInteger(e.target.value))}
                className="input-num"
                placeholder="0"
              />
            </div>
          </div>
          <button
            onClick={applyBulk}
            className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {selectedIds.size}名に適用
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-2 text-xs text-gray-500 underline"
          >
            選択解除
          </button>
        </div>
      )}

      {/* マトリクステーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-300 text-gray-700">
              <th className="pb-2 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 accent-primary"
                  title="全選択"
                />
              </th>
              <th className="pb-2 text-left w-6 text-gray-400">#</th>
              <th className="pb-2 text-left min-w-[80px]">氏名</th>
              <th className="pb-2 text-center w-16">役職</th>
              {isNightDate && (
                <>
                  <th className="pb-2 text-center w-12">宿泊</th>
                  <th className="pb-2 text-right w-20">宿泊料</th>
                </>
              )}
              <th className="pb-2 text-center w-10">朝</th>
              <th className="pb-2 text-right w-20">朝食料</th>
              <th className="pb-2 text-center w-10">昼</th>
              <th className="pb-2 text-right w-20">昼食料</th>
              <th className="pb-2 text-center w-10">夕</th>
              <th className="pb-2 text-right w-20">夕食料</th>
              <th className="pb-2 text-right w-24">1日計</th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((member, idx) => {
              const accRec = getAccRec(member.id, activeDate);
              const mealRec = getMealRec(member.id, activeDate);
              const stays = accRec?.stays !== false && accRec !== undefined;
              const accPrice = accRec?.unit_price || 0;
              const bfPrice = mealRec?.breakfast_price || 0;
              const lnPrice = mealRec?.lunch_price || 0;
              const dnPrice = mealRec?.dinner_price || 0;
              const bfStatus = mealRec?.breakfast_status || 'eat';
              const lnStatus = mealRec?.lunch_status || 'eat';
              const dnStatus = mealRec?.dinner_status || 'eat';

              const dayPersonTotal =
                (isNightDate && stays ? accPrice : 0) +
                (bfStatus === 'eat' ? bfPrice : 0) +
                (lnStatus === 'eat' ? lnPrice : 0) +
                (dnStatus === 'eat' ? dnPrice : 0);

              const isSelected = selectedIds.has(member.id);
              const isNonSubsidized = NON_SUBSIDIZED_ROLES.includes(member.role);

              return (
                <tr
                  key={member.id}
                  className={`border-b border-gray-100 ${
                    isSelected ? 'bg-blue-50' : isNonSubsidized ? 'bg-yellow-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="py-1 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(member.id)}
                      className="w-4 h-4 accent-primary"
                    />
                  </td>
                  <td className="py-1 text-gray-400">{idx + 1}</td>
                  <td className="py-1 pr-1 font-medium">
                    {member.name || <span className="text-gray-300">未入力</span>}
                  </td>
                  <td className="py-1 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs ${roleBadgeClass(member.role)}`}>
                      {MEMBER_ROLE_LABELS[member.role]}
                    </span>
                  </td>

                  {/* 宿泊（夜のある日のみ） */}
                  {isNightDate && (
                    <>
                      <td className="py-1 text-center">
                        <button
                          onClick={() => updateAccRec(member.id, activeDate, { stays: !stays, unit_price: accPrice })}
                          className={`w-8 h-7 rounded text-xs font-bold transition-colors ${
                            stays
                              ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          {stays ? '○' : 'ー'}
                        </button>
                      </td>
                      <td className="py-1 pr-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={accPrice || ''}
                          onChange={e => updateAccRec(member.id, activeDate, { stays, unit_price: parseInteger(e.target.value) })}
                          disabled={!stays}
                          className="input-num disabled:opacity-40 disabled:cursor-not-allowed"
                          placeholder="0"
                        />
                      </td>
                    </>
                  )}

                  {/* 朝食 */}
                  <td className="py-1 px-0.5 text-center">
                    <button
                      onClick={() => updateMealRec(member.id, activeDate, { breakfast_status: cycleMealStatus(bfStatus), breakfast_price: bfPrice })}
                      className={`w-8 h-7 rounded text-xs font-bold transition-colors border ${
                        bfStatus === 'eat'  ? 'bg-green-100 text-green-700 border-green-300' :
                        bfStatus === 'skip' ? 'bg-red-100 text-red-600 border-red-300' :
                        'bg-gray-100 text-gray-400 border-gray-300'
                      }`}
                    >
                      {bfStatus === 'eat' ? '○' : bfStatus === 'skip' ? '欠' : 'ー'}
                    </button>
                  </td>
                  <td className="py-1 pr-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={bfPrice || ''}
                      onChange={e => updateMealRec(member.id, activeDate, { breakfast_status: bfStatus, breakfast_price: parseInteger(e.target.value) })}
                      disabled={bfStatus === 'none'}
                      className="input-num disabled:opacity-40 disabled:cursor-not-allowed"
                      placeholder="0"
                    />
                  </td>

                  {/* 昼食 */}
                  <td className="py-1 px-0.5 text-center">
                    <button
                      onClick={() => updateMealRec(member.id, activeDate, { lunch_status: cycleMealStatus(lnStatus), lunch_price: lnPrice })}
                      className={`w-8 h-7 rounded text-xs font-bold transition-colors border ${
                        lnStatus === 'eat'  ? 'bg-green-100 text-green-700 border-green-300' :
                        lnStatus === 'skip' ? 'bg-red-100 text-red-600 border-red-300' :
                        'bg-gray-100 text-gray-400 border-gray-300'
                      }`}
                    >
                      {lnStatus === 'eat' ? '○' : lnStatus === 'skip' ? '欠' : 'ー'}
                    </button>
                  </td>
                  <td className="py-1 pr-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={lnPrice || ''}
                      onChange={e => updateMealRec(member.id, activeDate, { lunch_status: lnStatus, lunch_price: parseInteger(e.target.value) })}
                      disabled={lnStatus === 'none'}
                      className="input-num disabled:opacity-40 disabled:cursor-not-allowed"
                      placeholder="0"
                    />
                  </td>

                  {/* 夕食 */}
                  <td className="py-1 px-0.5 text-center">
                    <button
                      onClick={() => updateMealRec(member.id, activeDate, { dinner_status: cycleMealStatus(dnStatus), dinner_price: dnPrice })}
                      className={`w-8 h-7 rounded text-xs font-bold transition-colors border ${
                        dnStatus === 'eat'  ? 'bg-green-100 text-green-700 border-green-300' :
                        dnStatus === 'skip' ? 'bg-red-100 text-red-600 border-red-300' :
                        'bg-gray-100 text-gray-400 border-gray-300'
                      }`}
                    >
                      {dnStatus === 'eat' ? '○' : dnStatus === 'skip' ? '欠' : 'ー'}
                    </button>
                  </td>
                  <td className="py-1 pr-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={dnPrice || ''}
                      onChange={e => updateMealRec(member.id, activeDate, { dinner_status: dnStatus, dinner_price: parseInteger(e.target.value) })}
                      disabled={dnStatus === 'none'}
                      className="input-num disabled:opacity-40 disabled:cursor-not-allowed"
                      placeholder="0"
                    />
                  </td>

                  <td className="py-1 text-right font-mono font-medium">
                    {dayPersonTotal > 0 ? formatCurrency(dayPersonTotal) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-medium">
              <td colSpan={isNightDate ? 4 : 4} className="pt-2 text-right text-gray-600 text-xs">
                日計
              </td>
              {isNightDate && (
                <td colSpan={2} className="pt-2 text-right font-mono pr-1">
                  {formatCurrency(dayTotal.acc)}
                </td>
              )}
              <td colSpan={2} className="pt-2 text-right font-mono pr-1">—</td>
              <td colSpan={2} className="pt-2 text-right font-mono pr-1">—</td>
              <td colSpan={2} className="pt-2 text-right font-mono pr-1">—</td>
              <td className="pt-2 text-right font-mono text-primary">{formatCurrency(dayTotal.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
        <span>🌙=宿泊あり日 ☀️=最終日</span>
        <span className="bg-yellow-50 px-2 py-0.5 rounded">黄=補助対象外（外部指導・応援）</span>
        <span>○=食事あり ｜ 欠=欠食 ｜ ー=対象外</span>
      </div>

      {/* 役職別集計 */}
      <div className="mt-6 pt-4 border-t-2 border-gray-200">
        <h4 className="font-semibold text-gray-700 mb-3 text-sm">📊 役職別集計（全日程合計）</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200 text-gray-600 text-xs">
                <th className="pb-1 text-left">役職</th>
                <th className="pb-1 text-center w-12">人数</th>
                <th className="pb-1 text-right w-24">宿泊計</th>
                <th className="pb-1 text-right w-24">食事計</th>
                <th className="pb-1 text-right w-28">小計</th>
                <th className="pb-1 text-center w-24">補助区分</th>
              </tr>
            </thead>
            <tbody>
              {roleSummary.map(g => (
                <tr key={g.role} className={`border-b border-gray-100 ${!g.isSubsidized ? 'text-orange-700' : ''}`}>
                  <td className="py-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                      g.role === 'advisor' ? 'bg-purple-100 text-purple-800' :
                      g.role === 'external_coach' ? 'bg-pink-100 text-pink-800' :
                      g.role === 'staff' ? 'bg-orange-100 text-orange-800' :
                      g.role === 'athlete' ? 'bg-blue-100 text-blue-800' :
                      g.role === 'second' ? 'bg-cyan-100 text-cyan-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {g.label}
                    </span>
                  </td>
                  <td className="py-1 text-center">{g.count}名</td>
                  <td className="py-1 text-right font-mono">{g.accTotal > 0 ? formatCurrency(g.accTotal) : '—'}</td>
                  <td className="py-1 text-right font-mono">{g.mealTotal > 0 ? formatCurrency(g.mealTotal) : '—'}</td>
                  <td className="py-1 text-right font-mono font-medium">{g.total > 0 ? formatCurrency(g.total) : '—'}</td>
                  <td className="py-1 text-center">
                    {g.isSubsidized
                      ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">補助対象</span>
                      : <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">対象外</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 text-xs">
                <td colSpan={4} className="pt-1.5 text-right text-green-700 font-medium">補助対象合計</td>
                <td className="pt-1.5 text-right font-mono font-semibold text-green-700">{formatCurrency(subsidizedTotal)}</td>
                <td></td>
              </tr>
              <tr className="text-xs">
                <td colSpan={4} className="py-0.5 text-right text-orange-600 font-medium">補助対象外合計</td>
                <td className="py-0.5 text-right font-mono font-semibold text-orange-600">{formatCurrency(nonSubsidizedTotal)}</td>
                <td></td>
              </tr>
              <tr className="text-xs border-t border-gray-200">
                <td colSpan={4} className="pt-1.5 text-right text-primary font-bold">総合計</td>
                <td className="pt-1.5 text-right font-mono font-bold text-primary text-base">{formatCurrency(grandTotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Card>
  );
}
