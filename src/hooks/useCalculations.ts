'use client';

import { useMemo } from 'react';
import { calculateSummary } from '@/lib/calculations';
import type {
  Member, IncomeItem, AccommodationCost,
  MealCost, TransportCost, OtherCost, ExpeditionSummary
} from '@/types/expedition';

export function useCalculations(
  members: Member[],
  incomeItems: IncomeItem[],
  accommodation: AccommodationCost | null,
  mealCosts: MealCost[],
  transportCosts: TransportCost[],
  otherCosts: OtherCost[]
): ExpeditionSummary {
  return useMemo(
    () => calculateSummary(members, incomeItems, accommodation, mealCosts, transportCosts, otherCosts),
    [members, incomeItems, accommodation, mealCosts, transportCosts, otherCosts]
  );
}
