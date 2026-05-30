'use client';

import { Plus, Trash2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency, parseInteger } from '@/lib/calculations';
import type { IncomeItem, IncomeCategory } from '@/types/expedition';
import { INCOME_CATEGORY_LABELS } from '@/types/expedition';

interface IncomeSectionProps {
  incomeItems: IncomeItem[];
  onChange: (items: IncomeItem[]) => void;
  expeditionId: string;
  selfPaymentTotal: number;
}

export default function IncomeSection({
  incomeItems,
  onChange,
  expeditionId,
  selfPaymentTotal,
}: IncomeSectionProps) {
  const updateItem = (index: number, field: keyof IncomeItem, value: string | number) => {
    const updated = [...incomeItems];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addItem = () => {
    onChange([
      ...incomeItems,
      {
        id: `temp-${Date.now()}`,
        expedition_id: expeditionId,
        category: 'other' as IncomeCategory,
        label: 'その他収入',
        amount: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    onChange(incomeItems.filter((_, i) => i !== index));
  };

  const total = incomeItems.reduce((sum, item) => {
    if (item.category === 'self_burden') {
      return sum + selfPaymentTotal;
    }
    return sum + item.amount;
  }, 0);

  const getDisplayAmount = (item: IncomeItem) => {
    if (item.category === 'self_burden') return selfPaymentTotal;
    return item.amount;
  };

  return (
    <Card title="① 収入">
      <div className="space-y-3">
        {incomeItems.map((item, index) => (
          <div key={item.id} className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 rounded-lg">
            <select
              value={item.category}
              onChange={(e) => {
                const cat = e.target.value as IncomeCategory;
                updateItem(index, 'category', cat);
                updateItem(index, 'label', INCOME_CATEGORY_LABELS[cat]);
              }}
              className="border rounded px-2 py-1 text-sm flex-shrink-0"
            >
              {Object.entries(INCOME_CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <input
              type="text"
              value={item.label}
              onChange={(e) => updateItem(index, 'label', e.target.value)}
              className="flex-1 min-w-[120px] border rounded px-2 py-1 text-sm"
            />
            {item.category === 'self_burden' ? (
              <span className="input-currency w-32 bg-gray-100 cursor-not-allowed">
                {formatCurrency(selfPaymentTotal)}
              </span>
            ) : (
              <input
                type="number"
                inputMode="numeric"
                value={item.amount}
                onChange={(e) => updateItem(index, 'amount', parseInteger(e.target.value))}
                className="input-currency w-32"
              />
            )}
            {item.category !== 'self_burden' && (
              <button onClick={() => removeItem(index)} className="text-danger p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <Button variant="secondary" size="sm" onClick={addItem} className="mt-3">
        <Plus className="w-4 h-4 mr-1" />
        項目を追加
      </Button>
      <div className="mt-4 pt-3 border-t text-right font-semibold text-lg">
        収入合計: {formatCurrency(total)}
      </div>
    </Card>
  );
}

export function getEffectiveIncomeItems(
  incomeItems: IncomeItem[],
  selfPaymentTotal: number
): IncomeItem[] {
  return incomeItems.map(item =>
    item.category === 'self_burden'
      ? { ...item, amount: selfPaymentTotal }
      : item
  );
}
