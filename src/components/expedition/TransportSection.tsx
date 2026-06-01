'use client';

import { Plus, Trash2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency, parseInteger } from '@/lib/calculations';
import type { TransportCost, TransportType } from '@/types/expedition';
import { GROUP_TRANSPORT_TYPES, TRANSPORT_TYPE_LABELS } from '@/types/expedition';

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
  const groupCosts = transportCosts.filter(c =>
    GROUP_TRANSPORT_TYPES.includes(c.transport_type)
  );

  const updateCost = (id: string, field: keyof TransportCost, value: string | number) => {
    onChange(transportCosts.map(c =>
      c.id === id ? { ...c, [field]: value, amount: field === 'amount' ? Number(value) : c.amount } : c
    ));
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

  const removeCost = (id: string) => {
    onChange(transportCosts.filter(c => c.id !== id));
  };

  const total = groupCosts.reduce((sum, t) => sum + t.amount, 0);

  return (
    <Card title="⑤ 共通交通費（レンタカー・燃料等）">
      <p className="text-xs text-gray-500 mb-3">
        レンタカー・高速代・燃料代・タクシー・駐車場等の共通費用。新幹線・電車等の個別交通は④マトリクスへ。
      </p>
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
            {groupCosts.map(cost => (
              <tr key={cost.id} className="border-b border-gray-100">
                <td className="py-2 pr-2">
                  <input
                    type="text"
                    value={cost.label}
                    onChange={(e) => updateCost(cost.id, 'label', e.target.value)}
                    className="w-full border rounded px-2 py-1"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={cost.amount}
                    onChange={(e) => updateCost(cost.id, 'amount', parseInteger(e.target.value))}
                    className="input-currency w-28"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="text"
                    value={cost.notes || ''}
                    onChange={(e) => updateCost(cost.id, 'notes', e.target.value)}
                    className="w-full border rounded px-2 py-1"
                  />
                </td>
                <td className="py-2">
                  <button onClick={() => removeCost(cost.id)} className="text-danger p-1">
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
        共通交通費合計: {formatCurrency(total)}
      </div>
    </Card>
  );
}

export function createDefaultTransportCosts(expeditionId: string): TransportCost[] {
  return GROUP_TRANSPORT_TYPES.map((type, i) => ({
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
