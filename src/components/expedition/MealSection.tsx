'use client';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency, parseInteger, formatDateWithDay, getDateRange, syncMealLegacyFields } from '@/lib/calculations';
import { getMealStudentCount, getStaffCount } from '@/lib/memberRoles';
import type { MealCost, MealType, Member } from '@/types/expedition';
import { MEAL_TYPE_LABELS } from '@/types/expedition';

interface MealSectionProps {
  mealCosts: MealCost[];
  onChange: (meals: MealCost[]) => void;
  expeditionId: string;
  startDate: string;
  endDate: string;
  members: Member[];
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

export default function MealSection({
  mealCosts,
  onChange,
  expeditionId,
  startDate,
  endDate,
  members,
}: MealSectionProps) {
  const dates = getDateRange(startDate, endDate);
  const rosterStudentCount = getMealStudentCount(members);
  const rosterStaffCount = getStaffCount(members);

  const getMeal = (date: string, mealType: MealType): MealCost => {
    const existing = mealCosts.find(m => m.date === date && m.meal_type === mealType);
    if (existing) return existing;
    return {
      id: `temp-${date}-${mealType}`,
      expedition_id: expeditionId,
      date,
      meal_type: mealType,
      target_count: 0,
      non_target_count: 0,
      subsidy_count: 0,
      unit_price: 0,
      student_count: 0,
      staff_count: 0,
      staff_unit_price: 0,
      subsidy_student_count: 0,
    };
  };

  const updateMeal = (date: string, mealType: MealType, field: keyof MealCost, value: number | boolean) => {
    const existing = mealCosts.find(m => m.date === date && m.meal_type === mealType);
    const base = existing || getMeal(date, mealType);
    let updated: MealCost = { ...base, [field]: value };

    if (typeof value === 'number') {
      updated = syncMealLegacyFields(updated, field as string, value);
    }

    if (existing) {
      onChange(mealCosts.map(m =>
        m.date === date && m.meal_type === mealType ? updated : m
      ));
    } else {
      onChange([...mealCosts, updated]);
    }
  };

  const applyRosterToAll = () => {
    const updated = [...mealCosts];
    for (const date of dates) {
      for (const mealType of MEAL_TYPES) {
        const idx = updated.findIndex(m => m.date === date && m.meal_type === mealType);
        const base = idx >= 0 ? updated[idx] : getMeal(date, mealType);
        const next: MealCost = {
          ...base,
          student_count: rosterStudentCount,
          staff_count: rosterStaffCount,
          subsidy_student_count: rosterStudentCount,
          target_count: rosterStudentCount,
          non_target_count: rosterStaffCount,
          subsidy_count: rosterStudentCount,
        };
        if (idx >= 0) updated[idx] = next;
        else updated.push(next);
      }
    }
    onChange(updated);
  };

  const mealTotal = mealCosts.reduce((sum, m) => {
    const sc = m.student_count ?? m.target_count ?? 0;
    const st = m.staff_count ?? m.non_target_count ?? 0;
    const staffPrice = m.staff_unit_price ?? m.unit_price ?? 0;
    return sum + sc * (m.unit_price ?? 0) + st * staffPrice;
  }, 0);

  const studentMealTotal = mealCosts.reduce((sum, m) => {
    const sc = m.student_count ?? m.target_count ?? 0;
    return sum + sc * (m.unit_price ?? 0);
  }, 0);

  const staffMealTotal = mealTotal - studentMealTotal;

  return (
    <Card title="④ 食事費（日別・生徒/教員別）">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-xs text-gray-500">
          日付ごとに朝・昼・夕を分けて入力。生徒と教員の人数・単価を別枠で管理します。
        </p>
        <Button variant="secondary" size="sm" onClick={applyRosterToAll}>
          名簿人数を全日・全食事に反映
        </Button>
      </div>

      <div className="space-y-6">
        {dates.map(date => (
          <div key={date} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-primary/5 px-4 py-2 font-semibold text-primary text-sm">
              {formatDateWithDay(date)}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-600 text-xs">
                    <th className="py-2 px-3 text-left w-16">区分</th>
                    <th className="py-2 px-2 text-center" colSpan={2}>生徒</th>
                    <th className="py-2 px-2 text-center" colSpan={2}>教員</th>
                    <th className="py-2 px-2 text-center">補助</th>
                  </tr>
                  <tr className="border-b bg-gray-50 text-gray-500 text-xs">
                    <th></th>
                    <th className="py-1 px-2 text-center">人数</th>
                    <th className="py-1 px-2 text-center">単価</th>
                    <th className="py-1 px-2 text-center">人数</th>
                    <th className="py-1 px-2 text-center">単価</th>
                    <th className="py-1 px-2 text-center">対象生徒数</th>
                  </tr>
                </thead>
                <tbody>
                  {MEAL_TYPES.map(mealType => {
                    const meal = getMeal(date, mealType);
                    const studentCount = meal.student_count ?? meal.target_count ?? 0;
                    const staffCount = meal.staff_count ?? meal.non_target_count ?? 0;
                    const staffPrice = meal.staff_unit_price ?? meal.unit_price ?? 0;
                    const subsidyCount = meal.subsidy_student_count ?? meal.subsidy_count ?? 0;
                    const rowTotal =
                      studentCount * (meal.unit_price ?? 0) + staffCount * staffPrice;

                    return (
                      <tr key={mealType} className="border-b border-gray-100">
                        <td className="py-2 px-3 font-medium">{MEAL_TYPE_LABELS[mealType]}</td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={studentCount}
                            onChange={(e) => updateMeal(date, mealType, 'student_count', parseInteger(e.target.value))}
                            className="input-currency w-14 mx-auto text-sm"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={meal.unit_price}
                            onChange={(e) => updateMeal(date, mealType, 'unit_price', parseInteger(e.target.value))}
                            className="input-currency w-16 mx-auto text-sm"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={staffCount}
                            onChange={(e) => updateMeal(date, mealType, 'staff_count', parseInteger(e.target.value))}
                            className="input-currency w-14 mx-auto text-sm"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={staffPrice}
                            onChange={(e) => updateMeal(date, mealType, 'staff_unit_price', parseInteger(e.target.value))}
                            className="input-currency w-16 mx-auto text-sm"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={subsidyCount}
                            onChange={(e) => updateMeal(date, mealType, 'subsidy_student_count', parseInteger(e.target.value))}
                            className="input-currency w-14 mx-auto text-sm"
                            title="補助対象の生徒人数"
                          />
                        </td>
                        <td className="py-2 px-2 text-right text-xs text-gray-500 whitespace-nowrap hidden sm:table-cell">
                          {formatCurrency(rowTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">生徒 食事費小計</span>
          <span className="font-mono">{formatCurrency(studentMealTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">教員 食事費小計</span>
          <span className="font-mono">{formatCurrency(staffMealTotal)}</span>
        </div>
        <div className="flex justify-between font-semibold pt-1 border-t">
          <span>食事費合計</span>
          <span className="font-mono">{formatCurrency(mealTotal)}</span>
        </div>
      </div>
    </Card>
  );
}
