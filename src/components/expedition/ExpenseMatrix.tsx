'use client';

import { Plus, Trash2, Info } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency, parseInteger } from '@/lib/calculations';
import { getIndividualMembers } from '@/lib/memberRoles';
import type {
  Member, MealCost, MemberMealRecord,
  MemberAccommodationRecord, MemberTransportRecord, IndividualTransportType,
  AccommodationCost,
} from '@/types/expedition';
import { MEMBER_ROLE_LABELS, INDIVIDUAL_TRANSPORT_LABELS } from '@/types/expedition';

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

export default function ExpenseMatrix({
  members,
  transportRecords,
  onChangeTransportRecords,
  expeditionId,
}: ExpenseMatrixProps) {
  const individuals = getIndividualMembers(members);

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
    <Card title="④ 公共交通費（顧問・外部指導者 個別）">
      <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
        <Info className="w-3 h-3" />
        飛行機・新幹線・電車・バス等の公共交通機関のみ個別入力。レンタカー・高速代等は⑤共通交通費へ。
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
                <span className="font-mono font-bold text-sm text-accent">
                  {memberTotal > 0 ? formatCurrency(memberTotal) : '—'}
                </span>
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
                    <input
                      type="text"
                      value={tr.label}
                      onChange={(e) => updateTransport(tr.id, 'label', e.target.value)}
                      className="border rounded px-2 py-1.5 text-sm focus:outline-none"
                      placeholder="区間・詳細"
                    />
                    <input
                      type="date"
                      value={tr.travel_date || ''}
                      onChange={(e) => updateTransport(tr.id, 'travel_date', e.target.value)}
                      className="border rounded px-2 py-1.5 text-sm focus:outline-none"
                    />
                    <input
                      type="number"
                      value={tr.amount}
                      onChange={(e) => updateTransport(tr.id, 'amount', parseInteger(e.target.value))}
                      className="input-currency w-32 text-sm"
                    />
                    <button
                      onClick={() => removeTransport(tr.id)}
                      className="text-gray-400 hover:text-danger p-1 rounded transition-colors"
                    >
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
  );
}
