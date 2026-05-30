'use client';

import { Plus, Trash2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency, parseInteger } from '@/lib/calculations';
import type { OtherCost } from '@/types/expedition';

interface ExpenseSectionProps {
  otherCosts: OtherCost[];
  onChange: (costs: OtherCost[]) => void;
  expeditionId: string;
}

export default function ExpenseSection({
  otherCosts,
  onChange,
  expeditionId,
}: ExpenseSectionProps) {
  const updateCost = (index: number, field: keyof OtherCost, value: string | number) => {
    const updated = [...otherCosts];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addCost = () => {
    onChange([
      ...otherCosts,
      {
        id: `temp-${Date.now()}`,
        expedition_id: expeditionId,
        label: 'その他費用',
        amount: 0,
        sort_order: otherCosts.length,
      },
    ]);
  };

  const removeCost = (index: number) => {
    onChange(otherCosts.filter((_, i) => i !== index));
  };

  const total = otherCosts.reduce((sum, o) => sum + o.amount, 0);

  return (
    <Card title="⑥ その他費用">
      <div className="space-y-2">
        {otherCosts.map((cost, index) => (
          <div key={cost.id} className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 rounded-lg">
            <input
              type="text"
              value={cost.label}
              onChange={(e) => updateCost(index, 'label', e.target.value)}
              className="flex-1 min-w-[120px] border rounded px-2 py-1"
              placeholder="項目名"
            />
            <input
              type="number"
              inputMode="numeric"
              value={cost.amount}
              onChange={(e) => updateCost(index, 'amount', parseInteger(e.target.value))}
              className="input-currency w-32"
            />
            <input
              type="text"
              value={cost.notes || ''}
              onChange={(e) => updateCost(index, 'notes', e.target.value)}
              className="flex-1 min-w-[100px] border rounded px-2 py-1"
              placeholder="備考"
            />
            <button onClick={() => removeCost(index)} className="text-danger p-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <Button variant="secondary" size="sm" onClick={addCost} className="mt-3">
        <Plus className="w-4 h-4 mr-1" />
        項目を追加
      </Button>
      <div className="mt-4 pt-3 border-t font-semibold">
        その他合計: {formatCurrency(total)}
      </div>
    </Card>
  );
}
