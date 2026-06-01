'use client';

import Card from '@/components/ui/Card';
import { formatCurrency, parseInteger } from '@/lib/calculations';
import { getLodgingStudentCount, getStaffCount } from '@/lib/memberRoles';
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
    staff_unit_price: 0,
    staff_breakfast_price: 0,
    staff_subsidy_per_person: 0,
  };

  const studentCount = getLodgingStudentCount(members);
  const staffCount = getStaffCount(members);
  const nights = acc.nights;

  const studentUnit = acc.unit_price + acc.breakfast_price;
  const staffUnit =
    (acc.staff_unit_price ?? acc.unit_price) +
    (acc.staff_breakfast_price ?? acc.breakfast_price);

  const studentGross = studentUnit * studentCount * nights;
  const staffGross = staffUnit * staffCount * nights;
  const studentSubsidy = acc.subsidy_per_person * studentCount * nights;
  const staffSubsidy = (acc.staff_subsidy_per_person ?? 0) * staffCount * nights;
  const studentNet = studentGross - studentSubsidy;
  const staffNet = staffGross - staffSubsidy;

  const update = (field: keyof AccommodationCost, value: string | number) => {
    onChange({ ...acc, [field]: value });
  };

  return (
    <Card title="③ 宿泊費（生徒/教員別）">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 生徒 */}
        <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/30">
          <h4 className="font-semibold text-primary mb-3">
            生徒（選手+セコンド）<span className="text-sm font-normal text-gray-500 ml-2">{studentCount}名</span>
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">1人1泊料金</label>
              <input
                type="number"
                inputMode="numeric"
                value={acc.unit_price}
                onChange={(e) => update('unit_price', parseInteger(e.target.value))}
                className="input-currency w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">朝食代（別途）</label>
              <input
                type="number"
                inputMode="numeric"
                value={acc.breakfast_price}
                onChange={(e) => update('breakfast_price', parseInteger(e.target.value))}
                className="input-currency w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">補助額（1人1泊）</label>
              <input
                type="number"
                inputMode="numeric"
                value={acc.subsidy_per_person}
                onChange={(e) => update('subsidy_per_person', parseInteger(e.target.value))}
                className="input-currency w-full"
              />
            </div>
            <p className="text-sm font-medium pt-2 border-t">
              小計: {formatCurrency(studentNet)}
              <span className="text-xs text-gray-500 font-normal ml-1">（補助 {formatCurrency(studentSubsidy)}）</span>
            </p>
          </div>
        </div>

        {/* 教員 */}
        <div className="border border-orange-100 rounded-xl p-4 bg-orange-50/30">
          <h4 className="font-semibold text-accent mb-3">
            教員（引率+顧問）<span className="text-sm font-normal text-gray-500 ml-2">{staffCount}名</span>
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">1人1泊料金</label>
              <input
                type="number"
                inputMode="numeric"
                value={acc.staff_unit_price ?? acc.unit_price}
                onChange={(e) => update('staff_unit_price', parseInteger(e.target.value))}
                className="input-currency w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">朝食代（別途）</label>
              <input
                type="number"
                inputMode="numeric"
                value={acc.staff_breakfast_price ?? acc.breakfast_price}
                onChange={(e) => update('staff_breakfast_price', parseInteger(e.target.value))}
                className="input-currency w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">補助額（1人1泊）</label>
              <input
                type="number"
                inputMode="numeric"
                value={acc.staff_subsidy_per_person ?? 0}
                onChange={(e) => update('staff_subsidy_per_person', parseInteger(e.target.value))}
                className="input-currency w-full"
              />
            </div>
            <p className="text-sm font-medium pt-2 border-t">
              小計: {formatCurrency(staffNet)}
              <span className="text-xs text-gray-500 font-normal ml-1">（補助 {formatCurrency(staffSubsidy)}）</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t">
        <p className="font-semibold">宿泊費合計（補助後）: {formatCurrency(studentNet + staffNet)}</p>
      </div>
    </Card>
  );
}
