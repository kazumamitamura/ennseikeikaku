'use client';

import Card from '@/components/ui/Card';
import { formatCurrency, parseInteger } from '@/lib/calculations';
import type { AccommodationCost, Member } from '@/types/expedition';

interface AccommodationSectionProps {
  accommodation: AccommodationCost | null;
  onChange: (acc: AccommodationCost) => void;
  members: Member[];
  expeditionId: string;
}

export default function AccommodationSection({
  accommodation,
  onChange,
  members,
  expeditionId,
}: AccommodationSectionProps) {
  const acc = accommodation || {
    id: `temp-acc-${expeditionId}`,
    expedition_id: expeditionId,
    plan_type: '1泊2食',
    unit_price: 0,
    breakfast_price: 0,
    nights: 1,
    subsidy_per_person: 0,
  };

  const athletes = members.filter(m => m.role === 'athlete').length;
  const seconds = members.filter(m => m.role === 'second').length;
  const targetCount = athletes + seconds;

  const unitCost = acc.unit_price + acc.breakfast_price;
  const totalCost = unitCost * targetCount * acc.nights;
  const totalSubsidy = acc.subsidy_per_person * targetCount * acc.nights;
  const netTotal = totalCost - totalSubsidy;

  const update = (field: keyof AccommodationCost, value: string | number) => {
    onChange({ ...acc, [field]: value });
  };

  return (
    <Card title="③ 宿泊費">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">宿泊プラン</label>
          <select
            value={acc.plan_type}
            onChange={(e) => update('plan_type', e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="1泊2食">1泊2食</option>
            <option value="素泊まり">素泊まり</option>
            <option value="朝食付き">朝食付き</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">泊数</label>
          <input
            type="number"
            inputMode="numeric"
            value={acc.nights}
            onChange={(e) => update('nights', parseInteger(e.target.value) || 1)}
            className="input-currency w-full"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">1人1泊料金</label>
          <input
            type="number"
            inputMode="numeric"
            value={acc.unit_price}
            onChange={(e) => update('unit_price', parseInteger(e.target.value))}
            className="input-currency w-full"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">朝食代（別途）</label>
          <input
            type="number"
            inputMode="numeric"
            value={acc.breakfast_price}
            onChange={(e) => update('breakfast_price', parseInteger(e.target.value))}
            className="input-currency w-full"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">補助額（1人1泊）</label>
          <input
            type="number"
            inputMode="numeric"
            value={acc.subsidy_per_person}
            onChange={(e) => update('subsidy_per_person', parseInteger(e.target.value))}
            className="input-currency w-full"
          />
        </div>
        <div className="flex items-end">
          <p className="text-sm text-gray-600">
            対象人数: 選手+セコンド = <span className="font-semibold">{targetCount}名</span>（自動計算）
          </p>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t">
        <p className="font-semibold">宿泊費合計（補助後）: {formatCurrency(netTotal)}</p>
        <p className="text-sm text-gray-500">（内 補助額: {formatCurrency(totalSubsidy)}）</p>
      </div>
    </Card>
  );
}
