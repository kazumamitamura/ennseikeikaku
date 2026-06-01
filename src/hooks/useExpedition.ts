'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  Expedition, Member, IncomeItem, AccommodationCost,
  MealCost, TransportCost, OtherCost, ExpeditionFullData,
  MemberMealRecord, MemberTransportRecord, MemberAccommodationRecord,
} from '@/types/expedition';

export function useExpedition(id: string) {
  const [data, setData] = useState<ExpeditionFullData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpedition = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const [
        expRes, memRes, incRes, accRes, mealRes, transRes, otherRes,
        mealRecRes, transRecRes, accRecRes,
      ] = await Promise.all([
        supabase.from('expeditions').select('*').eq('id', id).single(),
        supabase.from('members').select('*').eq('expedition_id', id).order('sort_order'),
        supabase.from('income_items').select('*').eq('expedition_id', id),
        supabase.from('accommodation_costs').select('*').eq('expedition_id', id).maybeSingle(),
        supabase.from('meal_costs').select('*').eq('expedition_id', id).order('date'),
        supabase.from('transport_costs').select('*').eq('expedition_id', id).order('sort_order'),
        supabase.from('other_costs').select('*').eq('expedition_id', id).order('sort_order'),
        supabase.from('member_meal_records').select('*').eq('expedition_id', id),
        supabase.from('member_transport_records').select('*').eq('expedition_id', id).order('sort_order'),
        supabase.from('member_accommodation_records').select('*').eq('expedition_id', id),
      ]);

      if (expRes.error) throw expRes.error;

      setData({
        expedition: expRes.data as Expedition,
        members: (memRes.data || []) as Member[],
        incomeItems: (incRes.data || []) as IncomeItem[],
        accommodation: accRes.data as AccommodationCost | null,
        mealCosts: (mealRes.data || []) as MealCost[],
        transportCosts: (transRes.data || []) as TransportCost[],
        otherCosts: (otherRes.data || []) as OtherCost[],
        memberMealRecords: (mealRecRes.data || []) as MemberMealRecord[],
        memberTransportRecords: (transRecRes.data || []) as MemberTransportRecord[],
        memberAccommodationRecords: (accRecRes.data || []) as MemberAccommodationRecord[],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchExpedition();
  }, [fetchExpedition]);

  return { data, loading, error, refetch: fetchExpedition, setData };
}

export function useExpeditions() {
  const [expeditions, setExpeditions] = useState<Expedition[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpeditions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('expeditions')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setExpeditions(data as Expedition[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchExpeditions();
  }, [fetchExpeditions]);

  return { expeditions, loading, refetch: fetchExpeditions };
}
