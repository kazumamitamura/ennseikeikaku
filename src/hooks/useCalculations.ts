'use client';

import { useMemo } from 'react';
import { calculateSummary, getDateRange } from '@/lib/calculations';
import type {
  Member, IncomeItem, AccommodationCost,
  MealCost, TransportCost, OtherCost, ExpeditionSummary,
  MemberMealRecord, MemberTransportRecord, MemberAccommodationRecord,
} from '@/types/expedition';

export function useCalculations(
  members: Member[],
  incomeItems: IncomeItem[],
  accommodation: AccommodationCost | null,
  mealCosts: MealCost[],
  transportCosts: TransportCost[],
  otherCosts: OtherCost[],
  memberMealRecords: MemberMealRecord[] = [],
  memberTransportRecords: MemberTransportRecord[] = [],
  memberAccommodationRecords: MemberAccommodationRecord[] = [],
  startDate?: string,
  endDate?: string
): ExpeditionSummary {
  const dates = useMemo(
    () => (startDate && endDate ? getDateRange(startDate, endDate) : []),
    [startDate, endDate]
  );

  return useMemo(
    () => calculateSummary(
      members, incomeItems, accommodation, mealCosts, transportCosts, otherCosts,
      memberMealRecords, memberTransportRecords, memberAccommodationRecords, dates
    ),
    [members, incomeItems, accommodation, mealCosts, transportCosts, otherCosts,
      memberMealRecords, memberTransportRecords, memberAccommodationRecords, dates]
  );
}
