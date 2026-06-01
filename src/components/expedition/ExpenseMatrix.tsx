'use client';

import { useState, useMemo } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
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
  eat: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
  skip: 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200',
  none: 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200',
};

const MEAL_STATUS_ICON: Record<MealStatus, string> = {
  eat: '○',
  skip: '欠',
  none: '－',
};

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

  const getAccRecord = (memberId: string): MemberAccommodationRecord => {
    return accommodationRecords.find(r => r.member_id === memberId) || {
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
          'w-8 h-8 rounded border text-xs font-bold transition-colors',
          MEAL_STATUS_STYLE[status]
        )}
        title={`${MEAL_STATUS_LABELS[status]}（クリックで切替）`}
      >
        {MEAL_STATUS_ICON[status]}
      </button>
    );
  };

  const renderStudentSummaryRow = () => {
    return (
      <tr className="bg-blue-50/80 font-medium border-b-2 border-blue-200">
        <td className="py-2 px-3 sticky left-0 bg-blue-50/95 z-10 whitespace-nowrap">
          <button
            type="button"
            onClick={() => setShowStudentDetail(!showStudentDetail)}
            className="flex items-center gap-1 text-primary"
          >
            {showStudentDetail ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            生徒 一括（{students.length}名）
          </button>
        </td>
        <td className="py-2 px-2 text-xs text-gray-500">生徒会費</td>
        {dates.map(date =>
          MEAL_TYPES.map(mealType => {
            const eat = countMealsByStatus(members, mealRecords, date, mealType, 'eat', true);
            const skip = countMealsByStatus(members, mealRecords, date, mealType, 'skip', true);
            const total = students.length;
            return (
              <td key={`${date}-${mealType}`} className="py-1 px-1 text-center text-xs">
                <span className="text-emerald-700">{eat}</span>
                {skip > 0 && <span className="text-amber-700">/{skip}欠</span>}
                <span className="text-gray-400">/{total}</span>
              </td>
            );
          })
        )}
        <td colSpan={3} className="text-xs text-gray-500 px-2">生徒宿泊は③で一括計算</td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      <Card title="④ 個別経費マトリクス（食事・宿泊・交通）">
        <div className="flex flex-wrap gap-3 mb-4 text-xs">
          <span className="flex items-center gap-1"><span className="w-5 h-5 rounded bg-emerald-50 border border-emerald-200 text-center">○</span> 食事</span>
          <span className="flex items-center gap-1"><span className="w-5 h-5 rounded bg-amber-100 border border-amber-300 text-center">欠</span> 欠食</span>
          <span className="flex items-center gap-1"><span className="w-5 h-5 rounded bg-gray-100 border border-gray-200 text-center">－</span> 対象外（未参加日）</span>
        </div>

        {/* 単価設定行 */}
        <div className="overflow-x-auto mb-4 border rounded-lg">
          <table className="text-xs w-full min-w-[800px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="py-2 px-3 text-left sticky left-0 bg-gray-50 z-10">単価設定</th>
                <th className="py-2 px-2"></th>
                {dates.map(date => (
                  <th key={date} colSpan={3} className="py-2 px-1 text-center border-l border-gray-200">
                    {formatDateShort(date)}
                  </th>
                ))}
              </tr>
              <tr className="bg-gray-50 text-gray-500">
                <th className="sticky left-0 bg-gray-50 z-10"></th>
                <th></th>
                {dates.map(date =>
                  MEAL_TYPES.map(mt => (
                    <th key={`${date}-${mt}-h`} className="py-1 px-1 w-14">{MEAL_TYPE_LABELS[mt]}</th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="py-1 px-3 sticky left-0 bg-white z-10 text-gray-600">生徒単価</td>
                <td></td>
                {dates.map(date =>
                  MEAL_TYPES.map(mt => (
                    <td key={`${date}-${mt}-sp`} className="py-1 px-1">
                      <input
                        type="number"
                        value={getMealUnitPrice(mealCosts, date, mt, false)}
                        onChange={(e) => updateMealPrice(date, mt, 'unit_price', parseInteger(e.target.value))}
                        className="w-14 text-right border rounded px-1 py-0.5 font-mono"
                      />
                    </td>
                  ))
                )}
              </tr>
              <tr>
                <td className="py-1 px-3 sticky left-0 bg-white z-10 text-gray-600">教員単価</td>
                <td></td>
                {dates.map(date =>
                  MEAL_TYPES.map(mt => (
                    <td key={`${date}-${mt}-tp`} className="py-1 px-1">
                      <input
                        type="number"
                        value={getMealUnitPrice(mealCosts, date, mt, true)}
                        onChange={(e) => updateMealPrice(date, mt, 'staff_unit_price', parseInteger(e.target.value))}
                        className="w-14 text-right border rounded px-1 py-0.5 font-mono"
                      />
                    </td>
                  ))
                )}
              </tr>
            </tbody>
          </table>
        </div>

        {/* 食事マトリクス */}
        <div className="overflow-x-auto border rounded-lg max-h-[480px] overflow-y-auto">
          <table className="text-sm w-full min-w-[900px]">
            <thead className="sticky top-0 z-20 bg-white shadow-sm">
              <tr className="border-b bg-primary/5">
                <th className="py-2 px-3 text-left sticky left-0 bg-primary/5 z-30 min-w-[120px]">氏名</th>
                <th className="py-2 px-2 text-left min-w-[60px]">区分</th>
                {dates.map(date => (
                  <th key={date} colSpan={3} className="py-2 px-1 text-center text-xs border-l border-gray-200">
                    {formatDateShort(date)}
                  </th>
                ))}
              </tr>
              <tr className="border-b text-gray-500 text-xs bg-gray-50">
                <th className="sticky left-0 bg-gray-50 z-30"></th>
                <th></th>
                {dates.map(date =>
                  MEAL_TYPES.map(mt => (
                    <th key={`${date}-${mt}`} className="py-1 px-1 font-normal">{MEAL_TYPE_LABELS[mt]}</th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {renderStudentSummaryRow()}
              {showStudentDetail && students.map(m => (
                <tr key={m.id} className="border-b border-gray-100 bg-blue-50/30">
                  <td className="py-1 px-3 sticky left-0 bg-blue-50/50 z-10 pl-8">{m.name}</td>
                  <td className="py-1 px-2 text-xs text-gray-500">{MEMBER_ROLE_LABELS[m.role]}</td>
                  {dates.map(date =>
                    MEAL_TYPES.map(mt => (
                      <td key={`${m.id}-${date}-${mt}`} className="py-1 px-1 text-center">
                        {renderMealCell(m.id, date, mt)}
                      </td>
                    ))
                  )}
                </tr>
              ))}
              {individuals.length > 0 && (
                <tr className="bg-orange-50/80">
                  <td colSpan={2 + dates.length * 3} className="py-1 px-3 text-xs font-semibold text-accent sticky left-0">
                    教員・外部指導者（個別計算）
                  </td>
                </tr>
              )}
              {individuals.map(m => {
                const detail = personDetails.find(d => d.memberId === m.id);
                return (
                  <tr key={m.id} className="border-b border-gray-100 hover:bg-orange-50/20">
                    <td className="py-1 px-3 sticky left-0 bg-white z-10 font-medium">{m.name}</td>
                    <td className="py-1 px-2 text-xs">{MEMBER_ROLE_LABELS[m.role]}</td>
                    {dates.map(date =>
                      MEAL_TYPES.map(mt => (
                        <td key={`${m.id}-${date}-${mt}`} className="py-1 px-1 text-center">
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
      </Card>

      {/* 教員・外部 宿泊 */}
      {individuals.length > 0 && (
        <Card title="教員・外部指導者 宿泊（個別）">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-600 text-xs">
                  <th className="py-2 text-left">氏名</th>
                  <th className="py-2">プラン</th>
                  <th className="py-2">1泊料金</th>
                  <th className="py-2">朝食</th>
                  <th className="py-2">泊数</th>
                  <th className="py-2">開始日</th>
                  <th className="py-2">終了日</th>
                  <th className="py-2">補助</th>
                  <th className="py-2 text-right">小計</th>
                </tr>
              </thead>
              <tbody>
                {individuals.map(m => {
                  const acc = getAccRecord(m.id);
                  const subtotal = (acc.unit_price + acc.breakfast_price) * acc.nights - acc.subsidy_amount;
                  return (
                    <tr key={m.id} className="border-b border-gray-100">
                      <td className="py-2 font-medium">{m.name}</td>
                      <td className="py-2">
                        <select
                          value={acc.plan_type}
                          onChange={(e) => updateAcc(m.id, 'plan_type', e.target.value)}
                          className="border rounded px-1 py-1 text-xs"
                        >
                          {ACCOMMODATION_PLAN_OPTIONS.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2">
                        <input type="number" value={acc.unit_price}
                          onChange={(e) => updateAcc(m.id, 'unit_price', parseInteger(e.target.value))}
                          className="input-currency w-24 text-sm" />
                      </td>
                      <td className="py-2">
                        <input type="number" value={acc.breakfast_price}
                          onChange={(e) => updateAcc(m.id, 'breakfast_price', parseInteger(e.target.value))}
                          className="input-currency w-20 text-sm" />
                      </td>
                      <td className="py-2">
                        <input type="number" value={acc.nights}
                          onChange={(e) => updateAcc(m.id, 'nights', parseInteger(e.target.value) || 1)}
                          className="input-currency w-14 text-sm" />
                      </td>
                      <td className="py-2">
                        <input type="date" value={acc.start_date || startDate}
                          onChange={(e) => updateAcc(m.id, 'start_date', e.target.value)}
                          className="border rounded px-1 py-1 text-xs" />
                      </td>
                      <td className="py-2">
                        <input type="date" value={acc.end_date || endDate}
                          onChange={(e) => updateAcc(m.id, 'end_date', e.target.value)}
                          className="border rounded px-1 py-1 text-xs" />
                      </td>
                      <td className="py-2">
                        <input type="number" value={acc.subsidy_amount}
                          onChange={(e) => updateAcc(m.id, 'subsidy_amount', parseInteger(e.target.value))}
                          className="input-currency w-20 text-sm" />
                      </td>
                      <td className="py-2 text-right font-mono font-medium">{formatCurrency(subtotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 教員・外部 公共交通 */}
      {individuals.length > 0 && (
        <Card title="教員・外部指導者 交通費（公共交通・個別）">
          <p className="text-xs text-gray-500 mb-3">飛行機・新幹線・電車・バスのみ個別入力。レンタカー等は⑤共通費用へ。</p>
          {individuals.map(m => {
            const memberTrans = transportRecords.filter(r => r.member_id === m.id);
            const memberTotal = memberTrans.reduce((s, r) => s + r.amount, 0);
            return (
              <div key={m.id} className="mb-4 border border-gray-100 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{m.name}（{MEMBER_ROLE_LABELS[m.role]}）</span>
                  <span className="text-sm font-mono">{formatCurrency(memberTotal)}</span>
                </div>
                {memberTrans.map(tr => (
                  <div key={tr.id} className="flex flex-wrap items-center gap-2 mb-2 p-2 bg-gray-50 rounded">
                    <select
                      value={tr.transport_type}
                      onChange={(e) => {
                        const type = e.target.value as IndividualTransportType;
                        updateTransport(tr.id, 'transport_type', type);
                        updateTransport(tr.id, 'label', INDIVIDUAL_TRANSPORT_LABELS[type]);
                      }}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      {Object.entries(INDIVIDUAL_TRANSPORT_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <input type="text" value={tr.label}
                      onChange={(e) => updateTransport(tr.id, 'label', e.target.value)}
                      className="border rounded px-2 py-1 text-sm flex-1 min-w-[100px]" placeholder="区間" />
                    <input type="date" value={tr.travel_date || ''}
                      onChange={(e) => updateTransport(tr.id, 'travel_date', e.target.value)}
                      className="border rounded px-2 py-1 text-sm" />
                    <input type="number" value={tr.amount}
                      onChange={(e) => updateTransport(tr.id, 'amount', parseInteger(e.target.value))}
                      className="input-currency w-28 text-sm" />
                    <button onClick={() => removeTransport(tr.id)} className="text-danger p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={() => addTransport(m.id)}>
                  <Plus className="w-3 h-3 mr-1" /> 交通費を追加
                </Button>
              </div>
            );
          })}
        </Card>
      )}

      {/* 個人合計サマリー */}
      {personDetails.length > 0 && (
        <Card title="教員・外部指導者 個人経費サマリー">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-600">
                <th className="py-2 text-left">氏名</th>
                <th className="py-2 text-right">食事</th>
                <th className="py-2 text-right">宿泊</th>
                <th className="py-2 text-right">交通</th>
                <th className="py-2 text-right">合計</th>
              </tr>
            </thead>
            <tbody>
              {personDetails.map(d => (
                <tr key={d.memberId} className="border-b border-gray-100">
                  <td className="py-2">{d.memberName}（{MEMBER_ROLE_LABELS[d.role]}）</td>
                  <td className="py-2 text-right font-mono">{formatCurrency(d.mealTotal)}</td>
                  <td className="py-2 text-right font-mono">{formatCurrency(d.accommodationTotal)}</td>
                  <td className="py-2 text-right font-mono">{formatCurrency(d.transportTotal)}</td>
                  <td className="py-2 text-right font-mono font-semibold">{formatCurrency(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
