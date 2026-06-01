'use client';

import { Plus, Trash2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency, parseInteger } from '@/lib/calculations';
import type { TransportCost, TransportType } from '@/types/expedition';
import { TRANSPORT_TYPE_LABELS } from '@/types/expedition';

interface TransportSectionProps {
  transportCosts: TransportCost[];
  onChange: (costs: TransportCost[]) => void;
  expeditionId: string;
}

function getStudentAmount(cost: TransportCost): number {
  const student = cost.student_amount ?? 0;
  const staff = cost.staff_amount ?? 0;
  if (student === 0 && staff === 0) return cost.amount;
  return student;
}

function getStaffAmount(cost: TransportCost): number {
  return cost.staff_amount ?? 0;
}

export default function TransportSection({
  transportCosts,
  onChange,
  expeditionId,
}: TransportSectionProps) {
  const updateCost = (index: number, field: keyof TransportCost, value: string | number | boolean) => {
    const updated = [...transportCosts];
    const row = { ...updated[index], [field]: value };

    if (field === 'student_amount' || field === 'staff_amount') {
      const student = field === 'student_amount' ? Number(value) : getStudentAmount(row);
      const staff = field === 'staff_amount' ? Number(value) : getStaffAmount(row);
      row.amount = student + staff;
      row.student_amount = student;
      row.staff_amount = staff;
    }

    updated[index] = row;
    onChange(updated);
  };

  const addCost = () => {
    onChange([
      ...transportCosts,
      {
        id: `temp-${Date.now()}`,
        expedition_id: expeditionId,
        transport_type: 'other' as TransportType,
        label: 'その他',
        amount: 0,
        student_amount: 0,
        staff_amount: 0,
        per_person: false,
        person_count: 1,
        sort_order: transportCosts.length,
      },
    ]);
  };

  const removeCost = (index: number) => {
    onChange(transportCosts.filter((_, i) => i !== index));
  };

  const studentTotal = transportCosts.reduce((sum, t) => sum + getStudentAmount(t), 0);
  const staffTotal = transportCosts.reduce((sum, t) => sum + getStaffAmount(t), 0);

  return (
    <Card title="⑤ 交通費（生徒/教員別）">
      <p className="text-xs text-gray-500 mb-3">
        各項目を生徒負担・教員負担に分けて入力してください。
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="pb-2 text-left">項目</th>
              <th className="pb-2 text-right">生徒</th>
              <th className="pb-2 text-right">教員</th>
              <th className="pb-2 text-right">合計</th>
              <th className="pb-2 text-left">備考</th>
              <th className="pb-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {transportCosts.map((cost, index) => {
              const student = getStudentAmount(cost);
              const staff = getStaffAmount(cost);
              return (
                <tr key={cost.id} className="border-b border-gray-100">
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      value={cost.label}
                      onChange={(e) => updateCost(index, 'label', e.target.value)}
                      className="w-full border rounded px-2 py-1 min-w-[100px]"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={student}
                      onChange={(e) => updateCost(index, 'student_amount', parseInteger(e.target.value))}
                      className="input-currency w-24"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={staff}
                      onChange={(e) => updateCost(index, 'staff_amount', parseInteger(e.target.value))}
                      className="input-currency w-24"
                    />
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-gray-600 whitespace-nowrap">
                    {formatCurrency(student + staff)}
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      value={cost.notes || ''}
                      onChange={(e) => updateCost(index, 'notes', e.target.value)}
                      className="w-full border rounded px-2 py-1"
                    />
                  </td>
                  <td className="py-2">
                    <button onClick={() => removeCost(index)} className="text-danger p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button variant="secondary" size="sm" onClick={addCost} className="mt-3">
        <Plus className="w-4 h-4 mr-1" />
        項目を追加
      </Button>
      <div className="mt-4 pt-3 border-t space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">生徒 交通費小計</span>
          <span className="font-mono">{formatCurrency(studentTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">教員 交通費小計</span>
          <span className="font-mono">{formatCurrency(staffTotal)}</span>
        </div>
        <div className="flex justify-between font-semibold pt-1 border-t">
          <span>交通費合計</span>
          <span className="font-mono">{formatCurrency(studentTotal + staffTotal)}</span>
        </div>
      </div>
    </Card>
  );
}

export function createDefaultTransportCosts(expeditionId: string): TransportCost[] {
  const types: TransportType[] = [
    'rental_car', 'travel_agency', 'fuel', 'shinkansen', 'train',
    'taxi', 'charter', 'highway', 'parking', 'other',
  ];
  return types.map((type, i) => ({
    id: `temp-trans-${type}`,
    expedition_id: expeditionId,
    transport_type: type,
    label: TRANSPORT_TYPE_LABELS[type],
    amount: 0,
    student_amount: 0,
    staff_amount: 0,
    per_person: false,
    person_count: 1,
    sort_order: i,
  }));
}
