'use client';

import { useState, useMemo } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, Plus, Trash2, Info } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import {
  formatCurrency, formatDateShort, getDateRange, parseInteger,
  cycleMealStatus, MEAL_TYPES, calcPersonExpenseDetails,
} from '@/lib/calculations';
import {
  getMealStatus, getMealUnitPrice, getStudentMembers, getIndividualMembers,
  isStudentRole, needsIndividualTracking, countMealsByStatus,
} from '@/lib/memberRoles';
import type {
  Member, MealCost, MealType, MealStatus, MemberMealRecord,
  MemberAccommodationRecord, MemberTransportRecord, IndividualTransportType,
} from '@/types/expedition';
import {
  MEMBER_ROLE_LABELS, MEAL_TYPE_LABELS, MEAL_STATUS_LABELS,
  INDIVIDUAL_TRANSPORT_LABELS, ACCOMMODATION_PLAN_OPTIONS,
} from '@/types/expedition';

interface ExpenseMatrixProps {
  members: Member[];
  mealCosts: MealCost[];
  onChangeMealCosts: (costs: MealCost[]) => void;
  mealRecords: MemberMealRecord[];
  onChangeMealRecords: (records: MemberMealRecord[]) => void;
  accommodationRecords: MemberAccommodationRecord[];
  onChangeAccommodationRecords: (records: MemberAccommodationRecord[]) => void;
  transportRecords: MemberTransportRecord[];
  onChangeTransportRecords: (records: MemberTransportRecord[]) => void;
  expeditionId: string;
  startDate: string;
  endDate: string;
}

const MEAL_STATUS_STYLE: Record<MealStatus, string> = {
  eat: 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200',
  skip: 'bg-amber-100 text-amber-900 border-amber-400 hover:bg-amber-200',
  none: 'bg-gray-100 text-gray-400 border-gray-300 hover:bg-gray-200',
};

const MEAL_STATUS_ICON: Record<MealStatus, string> = {
  eat: '○',
  skip: '欠',
  none: '－',
};

const TH = 'border border-gray-200 bg-yellow-50 text-center py-2 px-1 text-xs font-semibold text-gray-700';
const TH_DATE = 'border border-gray-200 bg-primary/10 text-center py-2 px-1 text-xs font-bold text-primary';
const TD = 'border border-gray-200 text-center py-1 px-1';
const TD_LABEL = 'border border-gray-200 px-3 py-2 text-sm font-medium bg-gray-50 whitespace-nowrap';

export default function ExpenseMatrix({
  members,
  mealCosts,
  onChangeMealCosts,
  mealRecords,
  onChangeMealRecords,
  accommodationRecords,
  onChangeAccommodationRecords,
  transportRecords,
  onChangeTransportRecords,
  expeditionId,
  startDate,
  endDate,
}: ExpenseMatrixProps) {
  const dates = getDateRange(startDate, endDate);
  const [showStudentDetail, setShowStudentDetail] = useState(false);
  const students = getStudentMembers(members);
  const individuals = getIndividualMembers(members);

  const personDetails = useMemo(
    () => calcPersonExpenseDetails(members, mealRecords, mealCosts, accommodationRecords, transportRecords, dates),
    [members, mealRecords, mealCosts, accommodationRecords, transportRecords, dates]
  );

  const updateMealPrice = (date: string, mealType: MealType, field: 'unit_price' | 'staff_unit_price', value: number) => {
    const existing = mealCosts.find(m => m.date === date && m.meal_type === mealType);
    if (existing) {
      onChangeMealCosts(mealCosts.map(m =>
        m.date === date && m.meal_type === mealType ? { ...m, [field]: value } : m
      ));
    } else {
      onChangeMealCosts([...mealCosts, {
        id: `temp-${date}-${mealType}`,
        expedition_id: expeditionId,
        date,
        meal_type: mealType,
        target_count: 0,
        non_target_count: 0,
        subsidy_count: 0,
        unit_price: field === 'unit_price' ? value : 0,
        staff_unit_price: field === 'staff_unit_price' ? value : 0,
        student_count: 0,
        staff_count: 0,
        subsidy_student_count: 0,
      }]);
    }
  };

  const toggleMeal = (memberId: string, date: string, mealType: MealType) => {
    const existing = mealRecords.find(r => r.member_id === memberId && r.date === date);
    const statusKey = `${mealType}_status` as 'breakfast_status' | 'lunch_status' | 'dinner_status';
    if (existing) {
      onChangeMealRecords(mealRecords.map(r =>
        r.member_id === memberId && r.date === date
          ? { ...r, [statusKey]: cycleMealStatus(r[statusKey]) }
          : r
      ));
    } else {
      const newRecord: MemberMealRecord = {
        id: `temp-meal-${memberId}-${date}`,
        expedition_id: expeditionId,
        member_id: memberId,
        date,
        breakfast_status: 'eat',
        lunch_status: 'eat',
        dinner_status: 'eat',
        [statusKey]: cycleMealStatus('eat'),
      };
      onChangeMealRecords([...mealRecords, newRecord]);
    }
  };

  const getAccRecord = (memberId: string): MemberAccommodationRecord =>
    accommodationRecords.find(r => r.member_id === memberId) || {
      id: `temp-acc-${memberId}`,
      expedition_id: expeditionId,
      member_id: memberId,
      plan_type: '1泊2食',
      unit_price: 0,
      breakfast_price: 0,
      nights: 1,
      start_date: startDate,
      end_date: endDate,
      subsidy_amount: 0,
    };

  const updateAcc = (memberId: string, field: keyof MemberAccommodationRecord, value: string | number) => {
    const existing = accommodationRecords.find(r => r.member_id === memberId);
    if (existing) {
      onChangeAccommodationRecords(
        accommodationRecords.map(r => r.member_id === memberId ? { ...r, [field]: value } : r)
      );
    } else {
      onChangeAccommodationRecords([...accommodationRecords, { ...getAccRecord(memberId), [field]: value }]);
    }
  };

  const addTransport = (memberId: string) => {
    onChangeTransportRecords([...transportRecords, {
      id: `temp-trans-${memberId}-${Date.now()}`,
      expedition_id: expeditionId,
      member_id: memberId,
      transport_type: 'shinkansen',
      label: '新幹線',
      amount: 0,
      sort_order: transportRecords.length,
    }]);
  };

  const updateTransport = (id: string, field: keyof MemberTransportRecord, value: string | number) => {
    onChangeTransportRecords(transportRecords.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeTransport = (id: string) => {
    onChangeTransportRecords(transportRecords.filter(r => r.id !== id));
  };

  const renderMealCell = (memberId: string, date: string, mealType: MealType) => {
    const status = getMealStatus(mealRecords, memberId, date, mealType);
    return (
      <button
        type="button"
        onClick={() => toggleMeal(memberId, date, mealType)}
        className={clsx(
          'w-9 h-9 rounded border text-sm font-bold transition-colors shadow-sm',
          MEAL_STATUS_STYLE[status]
        )}
        title={`${MEAL_STATUS_LABELS[status]}（クリックで切替）`}
      >
        {MEAL_STATUS_ICON[status]}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* ====== 食事単価設定 ====== */}
      <Card title="④ 食事単価・食事マトリクス">

        {/* 凡例 */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-6 h-6 rounded border border-emerald-300 bg-emerald-100 text-emerald-800 text-center font-bold leading-6">○</span>食事あり
          </span>
          <span className="flex items-center gap-1">
            <span className="w-6 h-6 rounded border border-amber-400 bg-amber-100 text-amber-900 text-center font-bold leading-6">欠</span>欠食
          </span>
          <span className="flex items-center gap-1">
            <span className="w-6 h-6 rounded border border-gray-300 bg-gray-100 text-gray-400 text-center font-bold leading-6">－</span>対象外（未参加日）
          </span>
          <span className="flex items-center gap-1 text-gray-400">
            <Info className="w-3 h-3" />教員・外部指導者のみ個別切替可
          </span>
        </div>

        {/* === 食事単価入力グリッド === */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 mb-1">■ 食事単価（円/食）</p>
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs" style={{ minWidth: `${200 + dates.length * 190}px` }}>
              <thead>
                <tr>
                  <th className={`${TH} text-left px-3 w-28`} rowSpan={2}>区分</th>
                  {dates.map(date => (
                    <th key={date} colSpan={3} className={TH_DATE}>
                      {formatDateShort(date)}
                    </th>
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
                <tr>
                  <td className="border border-gray-200 px-3 py-1 text-xs bg-blue-50 font-medium">生徒単価</td>
                  {dates.map(date =>
                    MEAL_TYPES.map(mt => (
                      <td key={`${date}-${mt}-sp`} className={TD}>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={getMealUnitPrice(mealCosts, date, mt, false)}
                          onChange={(e) => updateMealPrice(date, mt, 'unit_price', parseInteger(e.target.value))}
                          className="w-16 text-right border rounded px-1 py-1 font-mono text-xs focus:outline-none focus:border-blue-400"
                        />
                      </td>
                    ))
                  )}
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-1 text-xs bg-orange-50 font-medium">教員単価</td>
                  {dates.map(date =>
                    MEAL_TYPES.map(mt => (
                      <td key={`${date}-${mt}-tp`} className={TD}>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={getMealUnitPrice(mealCosts, date, mt, true)}
                          onChange={(e) => updateMealPrice(date, mt, 'staff_unit_price', parseInteger(e.target.value))}
                          className="w-16 text-right border rounded px-1 py-1 font-mono text-xs focus:outline-none focus:border-orange-400"
                        />
                      </td>
                    ))
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* === 食事マトリクス === */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">■ 食事マトリクス（クリックで○欠－を切替）</p>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="border-collapse w-full" style={{ minWidth: `${200 + dates.length * 190}px` }}>
              <thead>
                <tr>
                  <th className={`${TH} text-left px-3 sticky left-0 z-20 min-w-[120px]`} rowSpan={2}>氏名</th>
                  <th className={`${TH} min-w-[60px]`} rowSpan={2}>区分</th>
                  {dates.map(date => (
                    <th key={date} colSpan={3} className={TH_DATE}>
                      {formatDateShort(date)}
                    </th>
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
                    <button
                      type="button"
                      onClick={() => setShowStudentDetail(!showStudentDetail)}
                      className="flex items-center gap-1 font-semibold text-primary text-sm"
                    >
                      {showStudentDetail
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />
                      }
                      生徒 一括（{students.length}名）
                    </button>
                  </td>
                  <td className="border border-blue-200 px-2 py-2 text-xs text-center text-gray-500">生徒会費</td>
                  {dates.map(date =>
                    MEAL_TYPES.map(mealType => {
                      const eat = countMealsByStatus(members, mealRecords, date, mealType, 'eat', true);
                      const skip = countMealsByStatus(members, mealRecords, date, mealType, 'skip', true);
                      const total = students.length;
                      return (
                        <td key={`${date}-${mealType}`} className="border border-blue-200 py-1 px-1 text-center text-xs">
                          <span className="text-emerald-700 font-bold">{eat}</span>
                          {skip > 0 && <span className="text-amber-700 ml-0.5">/{skip}欠</span>}
                          <span className="text-gray-400">/{total}</span>
                        </td>
                      );
                    })
                  )}
                </tr>

                {/* 生徒 個別展開 */}
                {showStudentDetail && students.map(m => (
                  <tr key={m.id} className="border-b border-blue-100 bg-blue-50/20">
                    <td className="border border-blue-100 px-3 py-1.5 sticky left-0 bg-blue-50/40 z-10 pl-8 text-sm">{m.name}</td>
                    <td className="border border-blue-100 px-2 py-1 text-xs text-center text-gray-500">{MEMBER_ROLE_LABELS[m.role]}</td>
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
                    <td
                      colSpan={2 + dates.length * 3}
                      className="border border-orange-200 bg-orange-50/80 px-3 py-1.5 text-xs font-semibold text-accent sticky left-0"
                    >
                      ▼ 教員・外部指導者（個別計算）
                    </td>
                  </tr>
                )}
                {individuals.map(m => {
                  const detail = personDetails.find(d => d.memberId === m.id);
                  return (
                    <tr key={m.id} className="border-b border-gray-100 hover:bg-orange-50/20">
                      <td className="border border-gray-200 px-3 py-2 sticky left-0 bg-white z-10 font-medium text-sm">{m.name}</td>
                      <td className="border border-gray-200 px-2 py-1 text-xs text-center">
                        <span className="inline-block bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-full text-xs">
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 食事集計サマリー */}
        {dates.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <p className="text-xs font-semibold text-gray-500 mb-1">■ 食事人数集計</p>
            <table className="border-collapse text-xs" style={{ minWidth: `${200 + dates.length * 190}px` }}>
              <thead>
                <tr>
                  <th className={`${TH} text-left px-3 w-28`}></th>
                  {dates.map(date => (
                    <th key={date} colSpan={3} className={TH_DATE}>{formatDateShort(date)}</th>
                  ))}
                </tr>
                <tr>
                  <th className={`${TH} text-left px-3`}>集計</th>
                  {dates.map(date =>
                    MEAL_TYPES.map(mt => (
                      <th key={`${date}-${mt}`} className={TH}>{MEAL_TYPE_LABELS[mt]}</th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 px-3 py-1 bg-blue-50 font-medium">生徒（食）</td>
                  {dates.map(date =>
                    MEAL_TYPES.map(mt => {
                      const n = countMealsByStatus(members, mealRecords, date, mt, 'eat', true);
                      return (
                        <td key={`${date}-${mt}`} className="border border-gray-200 text-center py-1 font-mono font-bold text-emerald-700">
                          {n}
                        </td>
                      );
                    })
                  )}
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-1 bg-orange-50 font-medium">教員（食）</td>
                  {dates.map(date =>
                    MEAL_TYPES.map(mt => {
                      const n = countMealsByStatus(members, mealRecords, date, mt, 'eat', false);
                      return (
                        <td key={`${date}-${mt}`} className="border border-gray-200 text-center py-1 font-mono font-bold text-orange-700">
                          {n}
                        </td>
                      );
                    })
                  )}
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-1 bg-amber-50 font-medium">欠食数</td>
                  {dates.map(date =>
                    MEAL_TYPES.map(mt => {
                      const n = members.filter(m =>
                        getMealStatus(mealRecords, m.id, date, mt) === 'skip'
                      ).length;
                      return (
                        <td key={`${date}-${mt}`} className={`border border-gray-200 text-center py-1 font-mono ${n > 0 ? 'text-amber-700 font-bold bg-amber-50' : 'text-gray-300'}`}>
                          {n > 0 ? n : '—'}
                        </td>
                      );
                    })
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ====== 教員・外部指導者 宿泊 ====== */}
      {individuals.length > 0 && (
        <Card title="教員・外部指導者 宿泊（個別）">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[700px]">
              <thead>
                <tr>
                  <th className={`${TH} text-left px-3`}>氏名</th>
                  <th className={TH}>区分</th>
                  <th className={TH}>プラン</th>
                  <th className={TH}>1泊料金</th>
                  <th className={TH}>朝食代</th>
                  <th className={TH}>泊数</th>
                  <th className={TH}>開始日</th>
                  <th className={TH}>終了日</th>
                  <th className={TH}>補助</th>
                  <th className={`${TH} bg-green-50`}>小計</th>
                </tr>
              </thead>
              <tbody>
                {individuals.map(m => {
                  const acc = getAccRecord(m.id);
                  const subtotal = (acc.unit_price + acc.breakfast_price) * acc.nights - acc.subsidy_amount;
                  return (
                    <tr key={m.id} className="border-b border-gray-100 hover:bg-orange-50/20">
                      <td className={TD_LABEL}>{m.name}</td>
                      <td className="border border-gray-200 text-center py-1 px-1">
                        <span className="text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-full">
                          {MEMBER_ROLE_LABELS[m.role]}
                        </span>
                      </td>
                      <td className="border border-gray-200 py-1 px-1">
                        <select
                          value={acc.plan_type}
                          onChange={(e) => updateAcc(m.id, 'plan_type', e.target.value)}
                          className="border rounded px-1 py-1 text-xs w-full focus:outline-none"
                        >
                          {ACCOMMODATION_PLAN_OPTIONS.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-200 py-1 px-1">
                        <input type="number" value={acc.unit_price}
                          onChange={(e) => updateAcc(m.id, 'unit_price', parseInteger(e.target.value))}
                          className="input-currency w-24 text-sm" />
                      </td>
                      <td className="border border-gray-200 py-1 px-1">
                        <input type="number" value={acc.breakfast_price}
                          onChange={(e) => updateAcc(m.id, 'breakfast_price', parseInteger(e.target.value))}
                          className="input-currency w-20 text-sm" />
                      </td>
                      <td className="border border-gray-200 py-1 px-1">
                        <input type="number" value={acc.nights}
                          onChange={(e) => updateAcc(m.id, 'nights', parseInteger(e.target.value) || 1)}
                          className="input-currency w-14 text-sm" />
                      </td>
                      <td className="border border-gray-200 py-1 px-1">
                        <input type="date" value={acc.start_date || startDate}
                          onChange={(e) => updateAcc(m.id, 'start_date', e.target.value)}
                          className="border rounded px-1 py-1 text-xs focus:outline-none" />
                      </td>
                      <td className="border border-gray-200 py-1 px-1">
                        <input type="date" value={acc.end_date || endDate}
                          onChange={(e) => updateAcc(m.id, 'end_date', e.target.value)}
                          className="border rounded px-1 py-1 text-xs focus:outline-none" />
                      </td>
                      <td className="border border-gray-200 py-1 px-1">
                        <input type="number" value={acc.subsidy_amount}
                          onChange={(e) => updateAcc(m.id, 'subsidy_amount', parseInteger(e.target.value))}
                          className="input-currency w-20 text-sm" />
                      </td>
                      <td className="border border-gray-200 text-right px-3 py-2 font-mono font-bold text-sm bg-green-50 text-green-800">
                        {formatCurrency(subtotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ====== 教員・外部指導者 交通費（個別） ====== */}
      {individuals.length > 0 && (
        <Card title="教員・外部指導者 公共交通費（個別）">
          <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
            <Info className="w-3 h-3" />
            飛行機・新幹線・電車・バス等の公共交通機関のみ個別入力。レンタカー・高速代等は⑤共通費用へ。
          </p>
          <div className="space-y-3">
            {individuals.map(m => {
              const memberTrans = transportRecords.filter(r => r.member_id === m.id);
              const memberTotal = memberTrans.reduce((s, r) => s + r.amount, 0);
              return (
                <div key={m.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-2 bg-orange-50 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{m.name}</span>
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                        {MEMBER_ROLE_LABELS[m.role]}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-sm text-accent">{formatCurrency(memberTotal)}</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {memberTrans.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">交通費未登録</p>
                    )}
                    {memberTrans.map(tr => (
                      <div key={tr.id} className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto_auto_auto] gap-2 items-center bg-gray-50 rounded p-2">
                        <select
                          value={tr.transport_type}
                          onChange={(e) => {
                            const type = e.target.value as IndividualTransportType;
                            updateTransport(tr.id, 'transport_type', type);
                            updateTransport(tr.id, 'label', INDIVIDUAL_TRANSPORT_LABELS[type]);
                          }}
                          className="border rounded px-2 py-1.5 text-sm focus:outline-none"
                        >
                          {Object.entries(INDIVIDUAL_TRANSPORT_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <input type="text" value={tr.label}
                          onChange={(e) => updateTransport(tr.id, 'label', e.target.value)}
                          className="border rounded px-2 py-1.5 text-sm focus:outline-none"
                          placeholder="区間・詳細" />
                        <input type="date" value={tr.travel_date || ''}
                          onChange={(e) => updateTransport(tr.id, 'travel_date', e.target.value)}
                          className="border rounded px-2 py-1.5 text-sm focus:outline-none" />
                        <input type="number" value={tr.amount}
                          onChange={(e) => updateTransport(tr.id, 'amount', parseInteger(e.target.value))}
                          className="input-currency w-32 text-sm" />
                        <button onClick={() => removeTransport(tr.id)}
                          className="text-gray-400 hover:text-danger p-1 rounded transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <Button variant="secondary" size="sm" onClick={() => addTransport(m.id)}>
                      <Plus className="w-3 h-3 mr-1" /> 交通費を追加
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ====== 個人経費サマリー ====== */}
      {personDetails.length > 0 && (
        <Card title="教員・外部指導者 個人経費サマリー">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={`${TH} text-left px-3`}>氏名</th>
                  <th className={TH}>区分</th>
                  <th className={`${TH} bg-orange-50`}>食事費</th>
                  <th className={`${TH} bg-blue-50`}>宿泊費</th>
                  <th className={`${TH} bg-cyan-50`}>交通費</th>
                  <th className={`${TH} bg-green-100`}>合計</th>
                </tr>
              </thead>
              <tbody>
                {personDetails.map(d => (
                  <tr key={d.memberId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className={TD_LABEL}>{d.memberName}</td>
                    <td className="border border-gray-200 text-center py-2 px-1">
                      <span className="text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-full">
                        {MEMBER_ROLE_LABELS[d.role]}
                      </span>
                    </td>
                    <td className="border border-gray-200 text-right px-3 py-2 font-mono">{formatCurrency(d.mealTotal)}</td>
                    <td className="border border-gray-200 text-right px-3 py-2 font-mono">{formatCurrency(d.accommodationTotal)}</td>
                    <td className="border border-gray-200 text-right px-3 py-2 font-mono">{formatCurrency(d.transportTotal)}</td>
                    <td className="border border-gray-200 text-right px-3 py-2 font-mono font-bold text-green-800 bg-green-50">
                      {formatCurrency(d.total)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={2} className="border border-gray-300 px-3 py-2 text-sm">合計</td>
                  <td className="border border-gray-300 text-right px-3 py-2 font-mono">
                    {formatCurrency(personDetails.reduce((s, d) => s + d.mealTotal, 0))}
                  </td>
                  <td className="border border-gray-300 text-right px-3 py-2 font-mono">
                    {formatCurrency(personDetails.reduce((s, d) => s + d.accommodationTotal, 0))}
                  </td>
                  <td className="border border-gray-300 text-right px-3 py-2 font-mono">
                    {formatCurrency(personDetails.reduce((s, d) => s + d.transportTotal, 0))}
                  </td>
                  <td className="border border-gray-300 text-right px-3 py-2 font-mono text-green-800 bg-green-50 text-base">
                    {formatCurrency(personDetails.reduce((s, d) => s + d.total, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
