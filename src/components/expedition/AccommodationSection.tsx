'use client';

import { useState, useMemo } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Card from '@/components/ui/Card';
import { formatCurrency, parseInteger, formatDateShort, getDateRange, cycleMealStatus, MEAL_TYPES } from '@/lib/calculations';
import { getLodgingStudentCount, getMealStatus, getStudentMembers, getIndividualMembers, countMealsByStatus } from '@/lib/memberRoles';
import type { AccommodationCost, Member, MealType, MealStatus, MemberMealRecord } from '@/types/expedition';
import { MEMBER_ROLE_LABELS, MEAL_TYPE_LABELS, MEAL_STATUS_LABELS } from '@/types/expedition';

interface AccommodationSectionProps {
  accommodation: AccommodationCost | null;
  onChange: (acc: AccommodationCost) => void;
  members: Member[];
  expeditionId: string;
  mealRecords: MemberMealRecord[];
  onChangeMealRecords: (records: MemberMealRecord[]) => void;
  startDate: string;
  endDate: string;
}

const MEAL_STATUS_STYLE: Record<MealStatus, string> = {
  eat: 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200',
  skip: 'bg-amber-100 text-amber-900 border-amber-400 hover:bg-amber-200',
  none: 'bg-gray-100 text-gray-400 border-gray-300 hover:bg-gray-200',
};
const MEAL_STATUS_ICON: Record<MealStatus, string> = { eat: '○', skip: '欠', none: '－' };

const TH = 'border border-gray-200 bg-yellow-50 text-center py-1.5 px-2 text-xs font-semibold text-gray-700';
const TH_DATE = 'border border-gray-200 bg-primary/10 text-center py-1.5 px-1 text-xs font-bold text-primary';
const TD_VAL = 'border border-gray-200 text-right px-3 py-2 font-mono text-sm';
const TD_LABEL = 'border border-gray-200 px-3 py-2 text-sm font-medium';

export default function AccommodationSection({
  accommodation,
  onChange,
  members,
  expeditionId,
  mealRecords,
  onChangeMealRecords,
  startDate,
  endDate,
}: AccommodationSectionProps) {
  const [showStudentDetail, setShowStudentDetail] = useState(false);
  const dates = useMemo(() => getDateRange(startDate, endDate), [startDate, endDate]);

  const acc: AccommodationCost = accommodation ?? {
    id: `temp-acc-${expeditionId}`,
    expedition_id: expeditionId,
    plan_type: '1泊2食',
    unit_price: 0,
    breakfast_price: 0,
    breakfast_subsidy: 0,
    nights: 1,
    subsidy_per_person: 0,
    lunch_price: 0,
    lunch_subsidy: 0,
    dinner_price: 0,
    dinner_subsidy: 0,
  };

  const update = (field: keyof AccommodationCost, value: string | number) =>
    onChange({ ...acc, [field]: value });

  const studentCount = getLodgingStudentCount(members);
  const students = getStudentMembers(members);
  const individuals = getIndividualMembers(members);

  // 宿泊費計算（食事別計上）
  const lodgingGross = acc.unit_price * studentCount * acc.nights;
  const lodgingSubsidy = acc.subsidy_per_person * studentCount * acc.nights;
  const lodgingNet = lodgingGross - lodgingSubsidy;

  // 食事カウント（マトリクスから）
  const countEat = (mealType: MealType) =>
    members.filter(m => {
      const statuses = dates.map(d => getMealStatus(mealRecords, m.id, d, mealType));
      return statuses.filter(s => s === 'eat').length;
    }).reduce((s, _) => s, 0);

  const mealEatCounts = useMemo(() => {
    const result: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0 };
    for (const mealType of MEAL_TYPES) {
      let total = 0;
      for (const m of members) {
        for (const date of dates) {
          if (getMealStatus(mealRecords, m.id, date, mealType) === 'eat') total++;
        }
      }
      result[mealType] = total;
    }
    return result;
  }, [members, mealRecords, dates]);

  const breakfastGross = acc.breakfast_price * mealEatCounts.breakfast;
  const breakfastSubsidy = (acc.breakfast_subsidy ?? 0) * mealEatCounts.breakfast;
  const breakfastNet = breakfastGross - breakfastSubsidy;

  const lunchGross = (acc.lunch_price ?? 0) * mealEatCounts.lunch;
  const lunchSubsidy = (acc.lunch_subsidy ?? 0) * mealEatCounts.lunch;
  const lunchNet = lunchGross - lunchSubsidy;

  const dinnerGross = (acc.dinner_price ?? 0) * mealEatCounts.dinner;
  const dinnerSubsidy = (acc.dinner_subsidy ?? 0) * mealEatCounts.dinner;
  const dinnerNet = dinnerGross - dinnerSubsidy;

  const grandTotal = lodgingNet + breakfastNet + lunchNet + dinnerNet;

  // 食事マトリクス操作
  const toggleMeal = (memberId: string, date: string, mealType: MealType) => {
    const statusKey = `${mealType}_status` as keyof MemberMealRecord;
    const existing = mealRecords.find(r => r.member_id === memberId && r.date === date);
    if (existing) {
      onChangeMealRecords(mealRecords.map(r =>
        r.member_id === memberId && r.date === date
          ? { ...r, [statusKey]: cycleMealStatus(r[statusKey] as MealStatus) }
          : r
      ));
    } else {
      onChangeMealRecords([...mealRecords, {
        id: `temp-meal-${memberId}-${date}`,
        expedition_id: expeditionId,
        member_id: memberId,
        date,
        breakfast_status: 'eat' as MealStatus,
        lunch_status: 'eat' as MealStatus,
        dinner_status: 'eat' as MealStatus,
        [statusKey]: cycleMealStatus('eat'),
      }]);
    }
  };

  const renderMealCell = (memberId: string, date: string, mealType: MealType) => {
    const status = getMealStatus(mealRecords, memberId, date, mealType);
    return (
      <button
        type="button"
        onClick={() => toggleMeal(memberId, date, mealType)}
        className={clsx('w-9 h-9 rounded border text-sm font-bold transition-colors', MEAL_STATUS_STYLE[status])}
        title={`${MEAL_STATUS_LABELS[status]}（クリックで切替）`}
      >
        {MEAL_STATUS_ICON[status]}
      </button>
    );
  };

  const numCols = dates.length * MEAL_TYPES.length;
  const minW = 180 + dates.length * 180;

  return (
    <Card title="③ 宿泊費・食事費（生徒一括）">
      <p className="text-xs text-gray-500 mb-4">
        生徒（選手+セコンド）の宿泊費を一括計算します。食事単価を入力しマトリクスで欠食を切り替えると自動計算されます。教員宿泊は④で個別入力。
      </p>

      {/* ── 基本設定 ── */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs text-gray-500 mb-1">宿泊プラン</label>
          <select
            value={acc.plan_type}
            onChange={(e) => update('plan_type', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="1泊2食">1泊2食</option>
            <option value="1泊1食">1泊1食</option>
            <option value="素泊まり">素泊まり</option>
            <option value="朝食付き">朝食付き</option>
          </select>
        </div>
        <div className="w-20">
          <label className="block text-xs text-gray-500 mb-1">泊数</label>
          <input
            type="number" inputMode="numeric" value={acc.nights} min={1}
            onChange={(e) => update('nights', parseInteger(e.target.value) || 1)}
            className="input-currency w-full"
          />
        </div>
        <div className="flex items-end">
          <p className="text-sm text-gray-600 pb-2">
            宿泊対象（選手+セコンド）: <span className="font-bold text-primary">{studentCount}名</span>
            　全員: <span className="font-bold text-gray-700">{members.length}名</span>
          </p>
        </div>
      </div>

      {/* ── 単価・補助入力表 ── */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-500 mb-1">■ 単価・補助設定（/人）</p>
        <div className="overflow-x-auto">
          <table className="border-collapse w-full min-w-[500px] text-sm">
            <thead>
              <tr>
                <th className={`${TH} text-left px-3 w-28`}>費目</th>
                <th className={TH}>単価（円）</th>
                <th className={TH}>補助（円）</th>
                <th className={TH}>差額（/人）</th>
                <th className={TH}>食事人数</th>
              </tr>
            </thead>
            <tbody>
              {/* 宿泊料（×人数×泊数） */}
              <tr>
                <td className={`${TD_LABEL} bg-blue-50`}>宿泊料</td>
                <td className="border border-gray-200 p-0">
                  <input type="number" inputMode="numeric" value={acc.unit_price}
                    onChange={(e) => update('unit_price', parseInteger(e.target.value))}
                    className="w-full text-right font-mono px-3 py-2 text-sm focus:outline-none focus:bg-blue-50" />
                </td>
                <td className="border border-gray-200 p-0">
                  <input type="number" inputMode="numeric" value={acc.subsidy_per_person}
                    onChange={(e) => update('subsidy_per_person', parseInteger(e.target.value))}
                    className="w-full text-right font-mono px-3 py-2 text-sm focus:outline-none focus:bg-yellow-50" />
                </td>
                <td className={`${TD_VAL} ${acc.unit_price - acc.subsidy_per_person > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(acc.unit_price - acc.subsidy_per_person)}
                </td>
                <td className="border border-gray-200 text-center text-xs text-gray-500 px-2">
                  {studentCount}名×{acc.nights}泊
                </td>
              </tr>
              {/* 朝食 */}
              <tr>
                <td className={`${TD_LABEL} bg-orange-50`}>朝食</td>
                <td className="border border-gray-200 p-0">
                  <input type="number" inputMode="numeric" value={acc.breakfast_price}
                    onChange={(e) => update('breakfast_price', parseInteger(e.target.value))}
                    className="w-full text-right font-mono px-3 py-2 text-sm focus:outline-none" />
                </td>
                <td className="border border-gray-200 p-0">
                  <input type="number" inputMode="numeric" value={acc.breakfast_subsidy ?? 0}
                    onChange={(e) => update('breakfast_subsidy', parseInteger(e.target.value))}
                    className="w-full text-right font-mono px-3 py-2 text-sm focus:outline-none focus:bg-yellow-50" />
                </td>
                <td className={`${TD_VAL} text-gray-700`}>
                  {formatCurrency((acc.breakfast_price ?? 0) - (acc.breakfast_subsidy ?? 0))}
                </td>
                <td className="border border-gray-200 text-center text-xs text-emerald-700 font-bold px-2">
                  {mealEatCounts.breakfast}食
                </td>
              </tr>
              {/* 昼食 */}
              <tr>
                <td className={`${TD_LABEL} bg-yellow-50`}>昼食</td>
                <td className="border border-gray-200 p-0">
                  <input type="number" inputMode="numeric" value={acc.lunch_price ?? 0}
                    onChange={(e) => update('lunch_price', parseInteger(e.target.value))}
                    className="w-full text-right font-mono px-3 py-2 text-sm focus:outline-none" />
                </td>
                <td className="border border-gray-200 p-0">
                  <input type="number" inputMode="numeric" value={acc.lunch_subsidy ?? 0}
                    onChange={(e) => update('lunch_subsidy', parseInteger(e.target.value))}
                    className="w-full text-right font-mono px-3 py-2 text-sm focus:outline-none focus:bg-yellow-50" />
                </td>
                <td className={`${TD_VAL} text-gray-700`}>
                  {formatCurrency((acc.lunch_price ?? 0) - (acc.lunch_subsidy ?? 0))}
                </td>
                <td className="border border-gray-200 text-center text-xs text-emerald-700 font-bold px-2">
                  {mealEatCounts.lunch}食
                </td>
              </tr>
              {/* 夕食 */}
              <tr>
                <td className={`${TD_LABEL} bg-red-50`}>夕食</td>
                <td className="border border-gray-200 p-0">
                  <input type="number" inputMode="numeric" value={acc.dinner_price ?? 0}
                    onChange={(e) => update('dinner_price', parseInteger(e.target.value))}
                    className="w-full text-right font-mono px-3 py-2 text-sm focus:outline-none" />
                </td>
                <td className="border border-gray-200 p-0">
                  <input type="number" inputMode="numeric" value={acc.dinner_subsidy ?? 0}
                    onChange={(e) => update('dinner_subsidy', parseInteger(e.target.value))}
                    className="w-full text-right font-mono px-3 py-2 text-sm focus:outline-none focus:bg-yellow-50" />
                </td>
                <td className={`${TD_VAL} text-gray-700`}>
                  {formatCurrency((acc.dinner_price ?? 0) - (acc.dinner_subsidy ?? 0))}
                </td>
                <td className="border border-gray-200 text-center text-xs text-emerald-700 font-bold px-2">
                  {mealEatCounts.dinner}食
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 合計表 ── */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-500 mb-1">■ 費目別合計</p>
        <div className="overflow-x-auto">
          <table className="border-collapse w-full min-w-[460px] text-sm">
            <thead>
              <tr>
                <th className={`${TH} text-left px-3 w-28`}>費目</th>
                <th className={TH}>支払額（総額）</th>
                <th className={TH}>補助計</th>
                <th className={TH}>差額実費</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${TD_LABEL} bg-blue-50`}>宿泊（{studentCount}名×{acc.nights}泊）</td>
                <td className={TD_VAL}>{formatCurrency(lodgingGross)}</td>
                <td className={`${TD_VAL} text-green-700`}>{formatCurrency(lodgingSubsidy)}</td>
                <td className={`${TD_VAL} font-bold bg-green-50 text-green-800`}>{formatCurrency(lodgingNet)}</td>
              </tr>
              <tr>
                <td className={`${TD_LABEL} bg-orange-50`}>朝食（{mealEatCounts.breakfast}食）</td>
                <td className={TD_VAL}>{formatCurrency(breakfastGross)}</td>
                <td className={`${TD_VAL} text-green-700`}>{formatCurrency(breakfastSubsidy)}</td>
                <td className={`${TD_VAL} font-bold bg-orange-50 text-orange-800`}>{formatCurrency(breakfastNet)}</td>
              </tr>
              <tr>
                <td className={`${TD_LABEL} bg-yellow-50`}>昼食（{mealEatCounts.lunch}食）</td>
                <td className={TD_VAL}>{formatCurrency(lunchGross)}</td>
                <td className={`${TD_VAL} text-green-700`}>{formatCurrency(lunchSubsidy)}</td>
                <td className={`${TD_VAL} font-bold bg-yellow-50 text-yellow-800`}>{formatCurrency(lunchNet)}</td>
              </tr>
              <tr>
                <td className={`${TD_LABEL} bg-red-50`}>夕食（{mealEatCounts.dinner}食）</td>
                <td className={TD_VAL}>{formatCurrency(dinnerGross)}</td>
                <td className={`${TD_VAL} text-green-700`}>{formatCurrency(dinnerSubsidy)}</td>
                <td className={`${TD_VAL} font-bold bg-red-50 text-red-800`}>{formatCurrency(dinnerNet)}</td>
              </tr>
              <tr className="bg-gray-50 font-bold">
                <td className="border border-gray-300 px-3 py-2 text-sm">合計</td>
                <td className={`${TD_VAL} text-base`}>{formatCurrency(lodgingGross + breakfastGross + lunchGross + dinnerGross)}</td>
                <td className={`${TD_VAL} text-green-700 text-base`}>{formatCurrency(lodgingSubsidy + breakfastSubsidy + lunchSubsidy + dinnerSubsidy)}</td>
                <td className={`${TD_VAL} text-lg text-green-800 bg-green-100`}>{formatCurrency(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 食事マトリクス ── */}
      {dates.length > 0 && members.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">
            ■ 食事マトリクス（クリックで ○食事 / 欠欠食 / －対象外 を切替）
          </p>
          <div className="flex flex-wrap gap-3 mb-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-6 h-6 rounded border border-emerald-300 bg-emerald-100 text-emerald-800 text-center font-bold leading-6">○</span>食事あり
            </span>
            <span className="flex items-center gap-1">
              <span className="w-6 h-6 rounded border border-amber-400 bg-amber-100 text-amber-900 text-center font-bold leading-6">欠</span>欠食
            </span>
            <span className="flex items-center gap-1">
              <span className="w-6 h-6 rounded border border-gray-300 bg-gray-100 text-gray-400 text-center font-bold leading-6">－</span>対象外
            </span>
          </div>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="border-collapse w-full" style={{ minWidth: `${minW}px` }}>
              <thead>
                <tr>
                  <th className={`${TH} text-left px-3 sticky left-0 z-20 min-w-[120px]`} rowSpan={2}>氏名</th>
                  <th className={`${TH} min-w-[56px]`} rowSpan={2}>区分</th>
                  {dates.map(date => (
                    <th key={date} colSpan={3} className={TH_DATE}>{formatDateShort(date)}</th>
                  ))}
                </tr>
                <tr>
                  {dates.map(date =>
                    MEAL_TYPES.map(mt => (
                      <th key={`${date}-${mt}`} className={TH}>{MEAL_TYPE_LABELS[mt]}</th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {/* 生徒 一括行 */}
                <tr className="bg-blue-50/80 border-b-2 border-blue-200">
                  <td className="border border-blue-200 px-3 py-2 sticky left-0 bg-blue-50/95 z-10">
                    <button type="button" onClick={() => setShowStudentDetail(!showStudentDetail)}
                      className="flex items-center gap-1 font-semibold text-primary text-sm">
                      {showStudentDetail ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      生徒 一括（{students.length}名）
                    </button>
                  </td>
                  <td className="border border-blue-200 text-center py-2 text-xs text-gray-500">生徒会費</td>
                  {dates.map(date =>
                    MEAL_TYPES.map(mealType => {
                      const eat = countMealsByStatus(members, mealRecords, date, mealType, 'eat', true);
                      const skip = countMealsByStatus(members, mealRecords, date, mealType, 'skip', true);
                      return (
                        <td key={`${date}-${mealType}`} className="border border-blue-200 py-1 px-1 text-center text-xs">
                          <span className="text-emerald-700 font-bold">{eat}</span>
                          {skip > 0 && <span className="text-amber-700 ml-0.5">/{skip}欠</span>}
                          <span className="text-gray-400">/{students.length}</span>
                        </td>
                      );
                    })
                  )}
                </tr>
                {/* 生徒 個別展開 */}
                {showStudentDetail && students.map(m => (
                  <tr key={m.id} className="border-b border-blue-100 bg-blue-50/20">
                    <td className="border border-blue-100 px-3 py-1.5 pl-8 sticky left-0 bg-blue-50/40 z-10 text-sm">{m.name}</td>
                    <td className="border border-blue-100 px-1 py-1 text-center text-xs text-gray-500">{MEMBER_ROLE_LABELS[m.role]}</td>
                    {dates.map(date =>
                      MEAL_TYPES.map(mt => (
                        <td key={`${m.id}-${date}-${mt}`} className="border border-blue-100 py-1 px-1 text-center">
                          {renderMealCell(m.id, date, mt)}
                        </td>
                      ))
                    )}
                  </tr>
                ))}
                {/* 教員・外部指導者 */}
                {individuals.length > 0 && (
                  <tr>
                    <td colSpan={2 + numCols}
                      className="border border-orange-200 bg-orange-50/80 px-3 py-1.5 text-xs font-semibold text-accent sticky left-0">
                      ▼ 教員・外部指導者（個別計算）
                    </td>
                  </tr>
                )}
                {individuals.map(m => (
                  <tr key={m.id} className="border-b border-gray-100 hover:bg-orange-50/20">
                    <td className="border border-gray-200 px-3 py-2 sticky left-0 bg-white z-10 font-medium text-sm">{m.name}</td>
                    <td className="border border-gray-200 px-1 py-1 text-center">
                      <span className="text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-full">
                        {MEMBER_ROLE_LABELS[m.role]}
                      </span>
                    </td>
                    {dates.map(date =>
                      MEAL_TYPES.map(mt => (
                        <td key={`${m.id}-${date}-${mt}`} className="border border-gray-200 py-1 px-1 text-center">
                          {renderMealCell(m.id, date, mt)}
                        </td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 食事集計 */}
          <div className="mt-3 overflow-x-auto">
            <table className="border-collapse text-xs" style={{ minWidth: `${minW}px` }}>
              <thead>
                <tr>
                  <th className={`${TH} text-left px-3 w-28`}></th>
                  {dates.map(d => <th key={d} colSpan={3} className={TH_DATE}>{formatDateShort(d)}</th>)}
                </tr>
                <tr>
                  <th className={`${TH} text-left px-3`}>集計</th>
                  {dates.map(d => MEAL_TYPES.map(mt => (
                    <th key={`${d}-${mt}`} className={TH}>{MEAL_TYPE_LABELS[mt]}</th>
                  )))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 px-3 py-1 bg-blue-50 font-medium">食事あり(人)</td>
                  {dates.map(d => MEAL_TYPES.map(mt => {
                    const n = members.filter(m => getMealStatus(mealRecords, m.id, d, mt) === 'eat').length;
                    return <td key={`${d}-${mt}`} className="border border-gray-200 text-center py-1 font-mono font-bold text-emerald-700">{n}</td>;
                  }))}
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-1 bg-amber-50 font-medium">欠食(人)</td>
                  {dates.map(d => MEAL_TYPES.map(mt => {
                    const n = members.filter(m => getMealStatus(mealRecords, m.id, d, mt) === 'skip').length;
                    return <td key={`${d}-${mt}`} className={`border border-gray-200 text-center py-1 font-mono ${n > 0 ? 'text-amber-700 font-bold bg-amber-50' : 'text-gray-300'}`}>{n > 0 ? n : '—'}</td>;
                  }))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
