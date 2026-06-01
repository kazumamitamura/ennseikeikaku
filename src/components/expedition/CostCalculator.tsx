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

  // 並行 saveAll を防ぐミューテックス
  const isSavingRef = useRef(false);
  // INSERT済みの temp メンバーID を追跡（同一セッション内で二重INSERTを防ぐ）
  const savedTempIds = useRef<Set<string>>(new Set());
  // 削除されたメンバーの実ID（次の saveAll でDB削除する）
  const deletedMemberIds = useRef<string[]>([]);

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
      savedTempIds.current = new Set();
      deletedMemberIds.current = [];
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
    // ── 並行実行防止 ──
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    try {
      // ── Step 0: 削除されたメンバーをDBから削除 ──
      const toDelete = [...deletedMemberIds.current];
      deletedMemberIds.current = [];
      for (const id of toDelete) {
        await supabase.from('members').delete().eq('id', id);
      }

      // ── Step 1: メンバーを保存（空白名はスキップ、二重INSERTを防ぐ）──
      let hadNewMembers = false;
      for (const member of members) {
        if (!member.name.trim()) continue; // 空白名のメンバーは保存しない
        if (member.id.startsWith('temp-')) {
          if (savedTempIds.current.has(member.id)) continue; // 既にINSERT済み
          const { id: _id, ...insertData } = { ...member, expedition_id: expeditionId };
          const { data, error } = await supabase.from('members').insert(insertData).select('id').single();
          if (!error && data?.id) {
            savedTempIds.current.add(member.id);
            hadNewMembers = true;
          }
        } else {
          await supabase.from('members')
            .update({ ...member, expedition_id: expeditionId })
            .eq('id', member.id);
        }
      }

      // ── Step 2: 新規メンバーが追加された場合、DBから再取得してローカル状態をリセット ──
      // これにより temp-ID が実 UUID に置き換わり、重複・空白行が消える
      if (hadNewMembers) {
        const { data: freshMembers } = await supabase
          .from('members')
          .select('*')
          .eq('expedition_id', expeditionId)
          .order('sort_order');
        if (freshMembers) {
          setMembers(freshMembers as Member[]);
          savedTempIds.current = new Set(); // 全メンバーが実IDになったのでリセット
        }
        // meal records は useEffect で自動生成されるので明示的な更新不要
        return; // 今回のサイクルはここで終了、次のauto-saveで残りを保存
      }

      // ── Step 3: 収入を保存 ──
      let needsIncomeRefetch = false;
      for (const item of incomeItems) {
        const amount = item.category === 'self_burden' ? selfPaymentTotal : item.amount;
        const data = { ...item, amount, expedition_id: expeditionId };
        if (item.id.startsWith('temp-')) {
          const { id, ...insertData } = data;
          const { error } = await supabase.from('income_items').insert(insertData);
          if (!error) needsIncomeRefetch = true;
        } else {
          await supabase.from('income_items').update(data).eq('id', item.id);
        }
      }
      if (needsIncomeRefetch) {
        const { data: fresh } = await supabase.from('income_items').select('*').eq('expedition_id', expeditionId);
        if (fresh) setIncomeItems(fresh as IncomeItem[]);
        return;
      }

      // ── Step 4: 宿泊費を保存 ──
      if (accommodation) {
        const data = { ...accommodation, expedition_id: expeditionId };
        if (accommodation.id.startsWith('temp-')) {
          const { id, ...insertData } = data;
          const { data: saved } = await supabase.from('accommodation_costs').insert(insertData).select('id').single();
          if (saved?.id) {
            setAccommodation(prev => prev ? { ...prev, id: saved.id } : prev);
            return;
          }
        } else {
          await supabase.from('accommodation_costs').update(data).eq('id', accommodation.id);
        }
      }

      // ── Step 5: 交通費・その他費用 ──
      let needsTransportRefetch = false;
      for (const t of transportCosts) {
        const data = { ...t, expedition_id: expeditionId };
        if (t.id.startsWith('temp-')) {
          const { id, ...insertData } = data;
          const { error } = await supabase.from('transport_costs').insert(insertData);
          if (!error) needsTransportRefetch = true;
        } else {
          await supabase.from('transport_costs').update(data).eq('id', t.id);
        }
      }
      if (needsTransportRefetch) {
        const { data: fresh } = await supabase.from('transport_costs').select('*').eq('expedition_id', expeditionId).order('sort_order');
        if (fresh) setTransportCosts(fresh as TransportCost[]);
        return;
      }

      let needsOtherRefetch = false;
      for (const o of otherCosts) {
        const data = { ...o, expedition_id: expeditionId };
        if (o.id.startsWith('temp-')) {
          const { id, ...insertData } = data;
          const { error } = await supabase.from('other_costs').insert(insertData);
          if (!error) needsOtherRefetch = true;
        } else {
          await supabase.from('other_costs').update(data).eq('id', o.id);
        }
      }
      if (needsOtherRefetch) {
        const { data: fresh } = await supabase.from('other_costs').select('*').eq('expedition_id', expeditionId).order('sort_order');
        if (fresh) setOtherCosts(fresh as OtherCost[]);
        return;
      }

      // ── Step 6: 食事レコード（実 member_id のみ保存）──
      const realMemberIds = new Set(members.filter(m => !m.id.startsWith('temp-')).map(m => m.id));
      const mealRecordsToSave = mealRecords.filter(r => realMemberIds.has(r.member_id));

      for (const record of mealRecordsToSave) {
        const data = { ...record, expedition_id: expeditionId };
        if (record.id.startsWith('temp-')) {
          const { id, ...insertData } = data;
          await supabase.from('member_meal_records')
            .upsert(insertData, { onConflict: 'member_id,date', ignoreDuplicates: false });
        } else {
          await supabase.from('member_meal_records').update(data).eq('id', record.id);
        }
      }

      // ── Step 7: 教員・個別交通・宿泊レコード ──
      for (const r of memberTransport) {
        if (r.member_id.startsWith('temp-')) continue;
        const data = { ...r, expedition_id: expeditionId };
        if (r.id.startsWith('temp-')) {
          const { id, ...insertData } = data;
          await supabase.from('member_transport_records').insert(insertData);
        } else {
          await supabase.from('member_transport_records').update(data).eq('id', r.id);
        }
      }
      for (const r of memberAccommodation) {
        if (r.member_id.startsWith('temp-')) continue;
        const data = { ...r, expedition_id: expeditionId };
        if (r.id.startsWith('temp-')) {
          const { id, ...insertData } = data;
          await supabase.from('member_accommodation_records')
            .upsert(insertData, { onConflict: 'member_id', ignoreDuplicates: false });
        } else {
          await supabase.from('member_accommodation_records').update(data).eq('id', r.id);
        }
      }

      await supabase.from('expeditions').update({ updated_at: new Date().toISOString() }).eq('id', expeditionId);
    } finally {
      isSavingRef.current = false;
    }
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
          onDelete={(id) => { deletedMemberIds.current.push(id); }}
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
