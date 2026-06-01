'use client';

import Card from '@/components/ui/Card';
import { formatCurrency, parseInteger } from '@/lib/calculations';
import { getLodgingStudentCount } from '@/lib/memberRoles';
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

  const studentCount = getLodgingStudentCount(members);
  const studentUnit = acc.unit_price + acc.breakfast_price;
  const studentGross = studentUnit * studentCount * acc.nights;
  const studentSubsidy = acc.subsidy_per_person * studentCount * acc.nights;
  const studentNet = studentGross - studentSubsidy;

  const update = (field: keyof AccommodationCost, value: string | number) => {
    onChange({ ...acc, [field]: value });
  };

  return (
    <Card title="③ 宿泊費（生徒一括）">
      <p className="text-xs text-gray-500 mb-3">
        生徒（選手+セコンド）の宿泊費を一括計算します。教員・外部指導者は④マトリクスで個別入力。
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">宿泊プラン</label>
          <select
            value={acc.plan_type}
            onChange={(e) => update('plan_type', e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="1泊2食">1泊2食</option>
            <option value="1泊1食">1泊1食</option>
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
            対象: 選手+セコンド = <span className="font-semibold">{studentCount}名</span>
          </p>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t">
        <p className="font-semibold">宿泊費合計（補助後）: {formatCurrency(studentNet)}</p>
        <p className="text-sm text-gray-500">（内 補助額: {formatCurrency(studentSubsidy)}）</p>
      </div>
    </Card>
  );
}
