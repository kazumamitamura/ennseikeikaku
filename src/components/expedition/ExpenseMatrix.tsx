'use client';

import { useMemo } from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency, parseInteger, getDateRange, calcPersonExpenseDetails, MEAL_TYPES } from '@/lib/calculations';
import { getIndividualMembers } from '@/lib/memberRoles';
import type {
  Member, MealCost, MemberMealRecord,
  MemberAccommodationRecord, MemberTransportRecord, IndividualTransportType,
  AccommodationCost,
} from '@/types/expedition';
import {
  MEMBER_ROLE_LABELS, INDIVIDUAL_TRANSPORT_LABELS, ACCOMMODATION_PLAN_OPTIONS,
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
  groupAccommodation?: AccommodationCost | null;
}

const TH = 'border border-gray-200 bg-yellow-50 text-center py-2 px-1 text-xs font-semibold text-gray-700';
const TD_LABEL = 'border border-gray-200 px-3 py-2 text-sm font-medium bg-gray-50 whitespace-nowrap';
const TD_VAL = 'border border-gray-200 text-right px-3 py-2 font-mono text-sm';

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
  groupAccommodation,
}: ExpenseMatrixProps) {
  const dates = getDateRange(startDate, endDate);
  const individuals = getIndividualMembers(members);

  const personDetails = useMemo(
    () => calcPersonExpenseDetails(
      members, mealRecords, mealCosts, accommodationRecords, transportRecords, dates, groupAccommodation
    ),
    [members, mealRecords, mealCosts, accommodationRecords, transportRecords, dates, groupAccommodation]
  );

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

  if (individuals.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* 教員・外部指導者 宿泊 */}
      <Card title="④ 教員・外部指導者 宿泊（個別）">
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
                      <select value={acc.plan_type}
                        onChange={(e) => updateAcc(m.id, 'plan_type', e.target.value)}
                        className="border rounded px-1 py-1 text-xs w-full focus:outline-none">
                        {ACCOMMODATION_PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
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

      {/* 教員・外部指導者 交通費 */}
      <Card title="⑤ 教員・外部指導者 公共交通費（個別）">
        <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
          <Info className="w-3 h-3" />
          飛行機・新幹線・電車・バス等の公共交通機関のみ個別入力。レンタカー・高速代等は⑥共通費用へ。
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
                      <select value={tr.transport_type}
                        onChange={(e) => {
                          const type = e.target.value as IndividualTransportType;
                          updateTransport(tr.id, 'transport_type', type);
                          updateTransport(tr.id, 'label', INDIVIDUAL_TRANSPORT_LABELS[type]);
                        }}
                        className="border rounded px-2 py-1.5 text-sm focus:outline-none">
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

      {/* 個人経費サマリー */}
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
                    <td className={TD_VAL}>{formatCurrency(d.mealTotal)}</td>
                    <td className={TD_VAL}>{formatCurrency(d.accommodationTotal)}</td>
                    <td className={TD_VAL}>{formatCurrency(d.transportTotal)}</td>
                    <td className="border border-gray-200 text-right px-3 py-2 font-mono font-bold text-green-800 bg-green-50">
                      {formatCurrency(d.total)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={2} className="border border-gray-300 px-3 py-2 text-sm">合計</td>
                  <td className={`${TD_VAL} font-bold`}>{formatCurrency(personDetails.reduce((s, d) => s + d.mealTotal, 0))}</td>
                  <td className={`${TD_VAL} font-bold`}>{formatCurrency(personDetails.reduce((s, d) => s + d.accommodationTotal, 0))}</td>
                  <td className={`${TD_VAL} font-bold`}>{formatCurrency(personDetails.reduce((s, d) => s + d.transportTotal, 0))}</td>
                  <td className="border border-gray-300 text-right px-3 py-2 font-mono font-bold text-green-800 bg-green-50 text-base">
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
