'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCalculations } from '@/hooks/useCalculations';
import { useAutoSave } from '@/hooks/useAutoSave';
import IncomeSection, { getEffectiveIncomeItems } from './IncomeSection';
import MemberTable from './MemberTable';
import AccommodationSection from './AccommodationSection';
import MealSection from './MealSection';
import TransportSection from './TransportSection';
import ExpenseSection from './ExpenseSection';
import SummaryPanel from './SummaryPanel';
import type {
  Expedition, Member, IncomeItem, AccommodationCost,
  MealCost, TransportCost, OtherCost, ExpeditionFullData
} from '@/types/expedition';
interface CostCalculatorProps {
  initialData: ExpeditionFullData;
  onDataChange?: (data: ExpeditionFullData) => void;
}

export default function CostCalculator({ initialData, onDataChange }: CostCalculatorProps) {
  const [members, setMembers] = useState<Member[]>(initialData.members);
  const [incomeItems, setIncomeItems] = useState<IncomeItem[]>(initialData.incomeItems);
  const [accommodation, setAccommodation] = useState<AccommodationCost | null>(initialData.accommodation);
  const [mealCosts, setMealCosts] = useState<MealCost[]>(initialData.mealCosts);
  const [transportCosts, setTransportCosts] = useState<TransportCost[]>(initialData.transportCosts);
  const [otherCosts, setOtherCosts] = useState<OtherCost[]>(initialData.otherCosts);

  const expedition = initialData.expedition;
  const expeditionId = expedition.id;

  useEffect(() => {
    setMembers(initialData.members);
    setIncomeItems(initialData.incomeItems);
    setAccommodation(initialData.accommodation);
    setMealCosts(initialData.mealCosts);
    setTransportCosts(initialData.transportCosts);
    setOtherCosts(initialData.otherCosts);
  }, [initialData]);

  const selfPaymentTotal = members.reduce((sum, m) => sum + m.self_payment, 0);
  const effectiveIncome = getEffectiveIncomeItems(incomeItems, selfPaymentTotal);

  const summary = useCalculations(
    members, effectiveIncome, accommodation, mealCosts, transportCosts, otherCosts
  );

  const saveAll = useCallback(async () => {
    for (const member of members) {
      const data = { ...member, expedition_id: expeditionId };
      if (member.id.startsWith('temp-')) {
        const { id, ...insertData } = data;
        await supabase.from('members').insert(insertData);
      } else {
        await supabase.from('members').update(data).eq('id', member.id);
      }
    }

    for (const item of incomeItems) {
      const amount = item.category === 'self_burden' ? selfPaymentTotal : item.amount;
      const data = { ...item, amount, expedition_id: expeditionId };
      if (item.id.startsWith('temp-')) {
        const { id, ...insertData } = data;
        await supabase.from('income_items').insert(insertData);
      } else {
        await supabase.from('income_items').update(data).eq('id', item.id);
      }
    }

    if (accommodation) {
      const data = { ...accommodation, expedition_id: expeditionId };
      if (accommodation.id.startsWith('temp-')) {
        const { id, ...insertData } = data;
        await supabase.from('accommodation_costs').insert(insertData);
      } else {
        await supabase.from('accommodation_costs').update(data).eq('id', accommodation.id);
      }
    }

    for (const meal of mealCosts) {
      const data = { ...meal, expedition_id: expeditionId };
      if (meal.id.startsWith('temp-')) {
        const { id, ...insertData } = data;
        await supabase.from('meal_costs').insert(insertData);
      } else {
        await supabase.from('meal_costs').update(data).eq('id', meal.id);
      }
    }

    for (const transport of transportCosts) {
      const data = { ...transport, expedition_id: expeditionId };
      if (transport.id.startsWith('temp-')) {
        const { id, ...insertData } = data;
        await supabase.from('transport_costs').insert(insertData);
      } else {
        await supabase.from('transport_costs').update(data).eq('id', transport.id);
      }
    }

    for (const other of otherCosts) {
      const data = { ...other, expedition_id: expeditionId };
      if (other.id.startsWith('temp-')) {
        const { id, ...insertData } = data;
        await supabase.from('other_costs').insert(insertData);
      } else {
        await supabase.from('other_costs').update(data).eq('id', other.id);
      }
    }

    await supabase.from('expeditions').update({ updated_at: new Date().toISOString() }).eq('id', expeditionId);
  }, [members, incomeItems, accommodation, mealCosts, transportCosts, otherCosts, expeditionId, selfPaymentTotal]);

  useAutoSave(saveAll, [members, incomeItems, accommodation, mealCosts, transportCosts, otherCosts]);

  useEffect(() => {
    onDataChange?.({
      expedition,
      members,
      incomeItems: effectiveIncome,
      accommodation,
      mealCosts,
      transportCosts,
      otherCosts,
    });
  }, [members, incomeItems, accommodation, mealCosts, transportCosts, otherCosts, expedition, effectiveIncome, onDataChange]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <IncomeSection
          incomeItems={incomeItems}
          onChange={setIncomeItems}
          expeditionId={expeditionId}
          selfPaymentTotal={selfPaymentTotal}
        />
        <MemberTable
          members={members}
          onChange={setMembers}
          expeditionId={expeditionId}
        />
        <AccommodationSection
          accommodation={accommodation}
          onChange={setAccommodation}
          members={members}
          expeditionId={expeditionId}
        />
        <MealSection
          mealCosts={mealCosts}
          onChange={setMealCosts}
          expeditionId={expeditionId}
          startDate={expedition.start_date}
          endDate={expedition.end_date}
        />
        <TransportSection
          transportCosts={transportCosts}
          onChange={setTransportCosts}
          expeditionId={expeditionId}
        />
        <ExpenseSection
          otherCosts={otherCosts}
          onChange={setOtherCosts}
          expeditionId={expeditionId}
        />
      </div>
      <div className="lg:col-span-1">
        <SummaryPanel
          summary={summary}
          expedition={expedition}
          members={members}
          incomeItems={incomeItems}
          accommodation={accommodation}
          mealCosts={mealCosts}
          transportCosts={transportCosts}
          otherCosts={otherCosts}
        />
      </div>
    </div>
  );
}
