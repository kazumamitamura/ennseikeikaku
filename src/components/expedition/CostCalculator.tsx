'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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

  // temp-ID が重複 INSERT されないよう保存済み temp-ID を追跡
  const savedTempIds = useRef<Map<string, string>>(new Map()); // tempId -> realId

  const expedition = initialData.expedition;
  const expeditionId = expedition.id;
  const dates = useMemo(
    () => getDateRange(expedition.start_date, expedition.end_date),
    [expedition.start_date, expedition.end_date]
  );

  // 初期データが変わったときだけリセット（ID が変わった場合のみ）
  const prevExpeditionId = useRef(expeditionId);
  useEffect(() => {
    if (prevExpeditionId.current !== expeditionId) {
      prevExpeditionId.current = expeditionId;
      savedTempIds.current.clear();
      setMembers(initialData.members);
      setIncomeItems(initialData.incomeItems);
      setAccommodation(initialData.accommodation);
      setMealCosts(initialData.mealCosts);
      setTransportCosts(initialData.transportCosts);
      setOtherCosts(initialData.otherCosts);
      setMealRecords(initialData.memberMealRecords || []);
      setMemberTransport(initialData.memberTransportRecords || []);
      setMemberAccommodation(initialData.memberAccommodationRecords || []);
    }
  }, [initialData, expeditionId]);

  // 名簿変更時に食事レコードを自動生成（重複を防ぐ）
  useEffect(() => {
    if (members.length === 0 || dates.length === 0) return;
    setMealRecords(prev => {
      let changed = false;
      const merged = [...prev];
      for (const member of members) {
        for (const date of dates) {
          const exists = merged.some(r => r.member_id === member.id && r.date === date);
          if (!exists) {
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
      // 削除されたメンバーのレコードを除去
      const memberIds = new Set(members.map(m => m.id));
      const filtered = merged.filter(r => memberIds.has(r.member_id));
      if (filtered.length !== merged.length) changed = true;
      return changed ? filtered : prev;
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
    // ── Step 1: メンバーを保存し、temp-ID → 実 UUID のマッピングを取得 ──
    const idMap = new Map<string, string>(savedTempIds.current);
    const mapId = (id: string) => idMap.get(id) ?? id;

    for (const member of members) {
      const realId = idMap.get(member.id);
      if (realId) {
        // すでに保存済み → UPDATE
        await supabase.from('members')
          .update({ ...member, id: realId, expedition_id: expeditionId })
          .eq('id', realId);
        continue;
      }
      if (member.id.startsWith('temp-')) {
        const { id: _ignore, ...insertData } = { ...member, expedition_id: expeditionId };
        const { data } = await supabase.from('members').insert(insertData).select('id').single();
        if (data?.id) {
          idMap.set(member.id, data.id);
          savedTempIds.current.set(member.id, data.id);
        }
      } else {
        await supabase.from('members')
          .update({ ...member, expedition_id: expeditionId })
          .eq('id', member.id);
      }
    }

    // ── Step 2: メンバーの実 ID をローカルステートに反映 ──
    if (idMap.size > 0) {
      setMembers(prev => prev.map(m => ({ ...m, id: mapId(m.id) })));
      setMealRecords(prev => prev.map(r => ({ ...r, member_id: mapId(r.member_id) })));
      setMemberAccommodation(prev => prev.map(r => ({ ...r, member_id: mapId(r.member_id) })));
      setMemberTransport(prev => prev.map(r => ({ ...r, member_id: mapId(r.member_id) })));
    }

    // ── Step 3: 収入を保存 ──
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

    // ── Step 4: 宿泊費を保存 ──
    if (accommodation) {
      const data = { ...accommodation, expedition_id: expeditionId };
      if (accommodation.id.startsWith('temp-')) {
        const { id, ...insertData } = data;
        await supabase.from('accommodation_costs').insert(insertData);
      } else {
        await supabase.from('accommodation_costs').update(data).eq('id', accommodation.id);
      }
    }

    // ── Step 5: 食事費（legacy/教員用）・交通費・その他 ──
    for (const m of mealCosts) {
      const data = { ...m, expedition_id: expeditionId };
      if (m.id.startsWith('temp-')) {
        const { id, ...insertData } = data;
        await supabase.from('meal_costs').insert(insertData).select('id').single();
      } else {
        await supabase.from('meal_costs').update(data).eq('id', m.id);
      }
    }
    for (const t of transportCosts) {
      const data = { ...t, expedition_id: expeditionId };
      if (t.id.startsWith('temp-')) {
        const { id, ...insertData } = data;
        await supabase.from('transport_costs').insert(insertData);
      } else {
        await supabase.from('transport_costs').update(data).eq('id', t.id);
      }
    }
    for (const o of otherCosts) {
      const data = { ...o, expedition_id: expeditionId };
      if (o.id.startsWith('temp-')) {
        const { id, ...insertData } = data;
        await supabase.from('other_costs').insert(insertData);
      } else {
        await supabase.from('other_costs').update(data).eq('id', o.id);
      }
    }

    // ── Step 6: 食事レコード（実 member_id が確定してから保存）──
    const mealRecordsToSave = mealRecords
      .map(r => ({ ...r, member_id: mapId(r.member_id), expedition_id: expeditionId }))
      .filter(r => !r.member_id.startsWith('temp-')); // 実 ID のみ保存

    for (const record of mealRecordsToSave) {
      if (record.id.startsWith('temp-')) {
        const { id, ...insertData } = record;
        await supabase.from('member_meal_records')
          .upsert(insertData, { onConflict: 'member_id,date', ignoreDuplicates: false });
      } else {
        await supabase.from('member_meal_records').update(record).eq('id', record.id);
      }
    }

    // ── Step 7: 教員交通・宿泊レコード ──
    for (const r of memberTransport) {
      const data = { ...r, member_id: mapId(r.member_id), expedition_id: expeditionId };
      if (data.member_id.startsWith('temp-')) continue;
      if (r.id.startsWith('temp-')) {
        const { id, ...insertData } = data;
        await supabase.from('member_transport_records').insert(insertData);
      } else {
        await supabase.from('member_transport_records').update(data).eq('id', r.id);
      }
    }
    for (const r of memberAccommodation) {
      const data = { ...r, member_id: mapId(r.member_id), expedition_id: expeditionId };
      if (data.member_id.startsWith('temp-')) continue;
      if (r.id.startsWith('temp-')) {
        const { id, ...insertData } = data;
        await supabase.from('member_accommodation_records')
          .upsert(insertData, { onConflict: 'member_id', ignoreDuplicates: false });
      } else {
        await supabase.from('member_accommodation_records').update(data).eq('id', r.id);
      }
    }

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
          mealRecords={mealRecords}
          onChangeMealRecords={setMealRecords}
          startDate={expedition.start_date}
          endDate={expedition.end_date}
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
          groupAccommodation={accommodation}
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
