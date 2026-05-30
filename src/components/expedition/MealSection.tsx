'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import { formatCurrency, formatDateWithDay, parseInteger, getDateRange } from '@/lib/calculations';
import type { MealCost, MealType } from '@/types/expedition';
import { MEAL_TYPE_LABELS } from '@/types/expedition';
import clsx from 'clsx';

interface MealSectionProps {
  mealCosts: MealCost[];
  onChange: (meals: MealCost[]) => void;
  expeditionId: string;
  startDate: string;
  endDate: string;
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

export default function MealSection({
  mealCosts,
  onChange,
  expeditionId,
  startDate,
  endDate,
}: MealSectionProps) {
  const dates = getDateRange(startDate, endDate);
  const [activeDate, setActiveDate] = useState(dates[0] || startDate);

  const getMeal = (date: string, mealType: MealType): MealCost => {
    const existing = mealCosts.find(m => m.date === date && m.meal_type === mealType);
    return existing || {
      id: `temp-${date}-${mealType}`,
      expedition_id: expeditionId,
      date,
      meal_type: mealType,
      target_count: 0,
      non_target_count: 0,
      subsidy_count: 0,
      unit_price: 0,
    };
  };

  const updateMeal = (date: string, mealType: MealType, field: keyof MealCost, value: number) => {
    const existing = mealCosts.find(m => m.date === date && m.meal_type === mealType);
    if (existing) {
      onChange(mealCosts.map(m =>
        m.date === date && m.meal_type === mealType
          ? { ...m, [field]: value }
          : m
      ));
    } else {
      onChange([
        ...mealCosts,
        { ...getMeal(date, mealType), [field]: value },
      ]);
    }
  };

  const mealTotal = mealCosts.reduce(
    (sum, m) => sum + m.unit_price * (m.target_count + m.non_target_count),
    0
  );

  const getUnitPriceForDate = (date: string, mealType: MealType): number => {
    return getMeal(date, mealType).unit_price;
  };

  const updateUnitPrice = (date: string, mealType: MealType, price: number) => {
    updateMeal(date, mealType, 'unit_price', price);
  };

  return (
    <Card title="④ 食事費（日別）">
      <div className="flex gap-2 overflow-x-auto mb-4 pb-2">
        {dates.map(date => (
          <button
            key={date}
            onClick={() => setActiveDate(date)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              activeDate === date
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {formatDateWithDay(date)}
          </button>
        ))}
      </div>

      <h4 className="font-medium mb-3">{formatDateWithDay(activeDate)}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="pb-2 text-left">区分</th>
              <th className="pb-2 text-center">補助対象</th>
              <th className="pb-2 text-center">対象外</th>
              <th className="pb-2 text-center">補助人数</th>
            </tr>
          </thead>
          <tbody>
            {MEAL_TYPES.map(mealType => {
              const meal = getMeal(activeDate, mealType);
              return (
                <tr key={mealType} className="border-b border-gray-100">
                  <td className="py-2 font-medium">{MEAL_TYPE_LABELS[mealType]}</td>
                  <td className="py-2 text-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={meal.target_count}
                      onChange={(e) => updateMeal(activeDate, mealType, 'target_count', parseInteger(e.target.value))}
                      className="input-currency w-16 mx-auto"
                    />
                  </td>
                  <td className="py-2 text-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={meal.non_target_count}
                      onChange={(e) => updateMeal(activeDate, mealType, 'non_target_count', parseInteger(e.target.value))}
                      className="input-currency w-16 mx-auto"
                    />
                  </td>
                  <td className="py-2 text-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={meal.subsidy_count}
                      onChange={(e) => updateMeal(activeDate, mealType, 'subsidy_count', parseInteger(e.target.value))}
                      className="input-currency w-16 mx-auto"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        {MEAL_TYPES.map(mealType => (
          <div key={mealType} className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{MEAL_TYPE_LABELS[mealType]}</span>
            <input
              type="number"
              inputMode="numeric"
              value={getUnitPriceForDate(activeDate, mealType)}
              onChange={(e) => updateUnitPrice(activeDate, mealType, parseInteger(e.target.value))}
              className="input-currency w-24"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t font-semibold">
        食事費合計: {formatCurrency(mealTotal)}
      </div>
    </Card>
  );
}
