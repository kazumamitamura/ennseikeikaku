'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useCalculations } from '@/hooks/useCalculations';
import { useAutoSave } from '@/hooks/useAutoSave';
import { getDateRange } from '@/lib/calculations';
import IncomeSection, { getEffectiveIncomeItems } from './IncomeSection';
import MemberTable from './MemberTable';
import AccommodationSection from './AccommodationSection';
import ExpenseMatrix from './ExpenseMatrix';
import TransportSection from './TransportSection';
import ExpenseSection from './ExpenseSection';
import SummaryPanel from './SummaryPanel';
import type {
  Expedition, Member, IncomeItem, AccommodationCost,
  MealCost, TransportCost, OtherCost, ExpeditionFullData,
  MemberMealRecord, MemberTransportRecord, MemberAccommodationRecord,
} from '@/types/expedition';

interface CostCalculatorProps {
  initialData: ExpeditionFullData;
  onDataChange?: (data: ExpeditionFullData) => void;
}

async function upsertRows<T extends { id: string; expedition_id: string }>(
  table: string,
  rows: T[]
) {
  for (const row of rows) {
    const data = { ...row, expedition_id: row.expedition_id };
    if (row.id.startsWith('temp-')) {
      const { id, ...insertData } = data;
      await supabase.from(table).insert(insertData);
    } else {
      await supabase.from(table).update(data).eq('id', row.id);
    }
  }
}

export default function CostCalculator({ initialData, onDataChange }: CostCalculatorProps) {
  const [members, setMembers] = useState<Member[]>(initialData.members);
  const [incomeItems, setIncomeItems] = useState<IncomeItem[]>(initialData.incomeItems);
  const [accommodation, setAccommodation] = useState<AccommodationCost | null>(initialData.accommodation);
  const [mealCosts, setMealCosts] = useState<MealCost[]>(initialData.mealCosts);
  const [transportCosts, setTransportCosts] = useState<TransportCost[]>(initialData.transportCosts);
  const [otherCosts, setOtherCosts] = useState<OtherCost[]>(initialData.otherCosts);
  const [mealRecords, setMealRecords] = useState<MemberMealRecord[]>(initialData.memberMealRecords || []);
  const [memberTransport, setMemberTransport] = useState<MemberTransportRecord[]>(
    initialData.memberTransportRecords || []
  );
  const [memberAccommodation, setMemberAccommodation] = useState<MemberAccommodationRecord[]>(
    initialData.memberAccommodationRecords || []
  );

  const expedition = initialData.expedition;
  const expeditionId = expedition.id;
  const dates = useMemo(
    () => getDateRange(expedition.start_date, expedition.end_date),
    [expedition.start_date, expedition.end_date]
  );

  useEffect(() => {
    setMembers(initialData.members);
    setIncomeItems(initialData.incomeItems);
    setAccommodation(initialData.accommodation);
    setMealCosts(initialData.mealCosts);
    setTransportCosts(initialData.transportCosts);
    setOtherCosts(initialData.otherCosts);
    setMealRecords(initialData.memberMealRecords || []);
    setMemberTransport(initialData.memberTransportRecords || []);
    setMemberAccommodation(initialData.memberAccommodationRecords || []);
  }, [initialData]);

  // 名簿に合わせて食事レコードを自動生成
  useEffect(() => {
    if (members.length === 0 || dates.length === 0) return;
    setMealRecords(prev => {
      const merged = [...prev];
      let changed = false;
      for (const member of members) {
        for (const date of dates) {
          if (!merged.find(r => r.member_id === member.id && r.date === date)) {
            merged.push({
              id: `temp-meal-${member.id}-${date}`,
              expedition_id: expeditionId,
              member_id: member.id,
              date,
              breakfast_status: 'eat',
              lunch_status: 'eat',
              dinner_status: 'eat',
            });
            changed = true;
          }
        }
      }
      return changed ? merged : prev;
    });
  }, [members, dates, expeditionId]);

  const selfPaymentTotal = members.reduce((sum, m) => sum + m.self_payment, 0);
  const effectiveIncome = getEffectiveIncomeItems(incomeItems, selfPaymentTotal);

  const summary = useCalculations(
    members, effectiveIncome, accommodation, mealCosts, transportCosts, otherCosts,
    mealRecords, memberTransport, memberAccommodation,
    expedition.start_date, expedition.end_date
  );

  const saveAll = useCallback(async () => {
    await upsertRows('members', members.map(m => ({ ...m, expedition_id: expeditionId })));

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

    await upsertRows('meal_costs', mealCosts.map(m => ({ ...m, expedition_id: expeditionId })));
    await upsertRows('transport_costs', transportCosts.map(t => ({ ...t, expedition_id: expeditionId })));
    await upsertRows('other_costs', otherCosts.map(o => ({ ...o, expedition_id: expeditionId })));
    await upsertRows('member_meal_records', mealRecords.map(r => ({ ...r, expedition_id: expeditionId })));
    await upsertRows('member_transport_records', memberTransport.map(r => ({ ...r, expedition_id: expeditionId })));
    await upsertRows('member_accommodation_records', memberAccommodation.map(r => ({ ...r, expedition_id: expeditionId })));

    await supabase.from('expeditions').update({ updated_at: new Date().toISOString() }).eq('id', expeditionId);
  }, [
    members, incomeItems, accommodation, mealCosts, transportCosts, otherCosts,
    mealRecords, memberTransport, memberAccommodation, expeditionId, selfPaymentTotal,
  ]);

  useAutoSave(saveAll, [
    members, incomeItems, accommodation, mealCosts, transportCosts, otherCosts,
    mealRecords, memberTransport, memberAccommodation,
  ]);

  useEffect(() => {
    onDataChange?.({
      expedition,
      members,
      incomeItems: effectiveIncome,
      accommodation,
      mealCosts,
      transportCosts,
      otherCosts,
      memberMealRecords: mealRecords,
      memberTransportRecords: memberTransport,
      memberAccommodationRecords: memberAccommodation,
    });
  }, [
    members, incomeItems, accommodation, mealCosts, transportCosts, otherCosts,
    mealRecords, memberTransport, memberAccommodation, expedition, effectiveIncome, onDataChange,
  ]);

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
        <ExpenseMatrix
          members={members}
          mealCosts={mealCosts}
          onChangeMealCosts={setMealCosts}
          mealRecords={mealRecords}
          onChangeMealRecords={setMealRecords}
          accommodationRecords={memberAccommodation}
          onChangeAccommodationRecords={setMemberAccommodation}
          transportRecords={memberTransport}
          onChangeTransportRecords={setMemberTransport}
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
          mealRecords={mealRecords}
          memberTransport={memberTransport}
          memberAccommodation={memberAccommodation}
        />
      </div>
    </div>
  );
}
