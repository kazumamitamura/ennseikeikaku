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

export default function TransportSection({
  transportCosts,
  onChange,
  expeditionId,
}: TransportSectionProps) {
  const updateCost = (index: number, field: keyof TransportCost, value: string | number | boolean) => {
    const updated = [...transportCosts];
    updated[index] = { ...updated[index], [field]: value };
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
        per_person: false,
        person_count: 1,
        sort_order: transportCosts.length,
      },
    ]);
  };

  const removeCost = (index: number) => {
    onChange(transportCosts.filter((_, i) => i !== index));
  };

  const total = transportCosts.reduce((sum, t) => {
    return sum + (t.per_person ? t.amount * t.person_count : t.amount);
  }, 0);

  return (
    <Card title="⑤ 交通費">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="pb-2 text-left">項目</th>
              <th className="pb-2 text-right">金額</th>
              <th className="pb-2 text-left">備考</th>
              <th className="pb-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {transportCosts.map((cost, index) => (
              <tr key={cost.id} className="border-b border-gray-100">
                <td className="py-2 pr-2">
                  <input
                    type="text"
                    value={cost.label}
                    onChange={(e) => updateCost(index, 'label', e.target.value)}
                    className="w-full border rounded px-2 py-1"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={cost.amount}
                    onChange={(e) => updateCost(index, 'amount', parseInteger(e.target.value))}
                    className="input-currency w-28"
                  />
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
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="secondary" size="sm" onClick={addCost} className="mt-3">
        <Plus className="w-4 h-4 mr-1" />
        項目を追加
      </Button>
      <div className="mt-4 pt-3 border-t font-semibold">
        交通費合計: {formatCurrency(total)}
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
    per_person: false,
    person_count: 1,
    sort_order: i,
  }));
}
