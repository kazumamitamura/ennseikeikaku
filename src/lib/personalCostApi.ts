import { supabase } from './supabase';
import type { SubsidyRates, PersonalCost } from '@/types/expedition';

export async function getSubsidyRates(expeditionId: string): Promise<SubsidyRates | null> {
  const { data } = await supabase
    .from('subsidy_rates')
    .select('*')
    .eq('expedition_id', expeditionId)
    .maybeSingle();
  return data as SubsidyRates | null;
}

export async function saveSubsidyRates(rates: SubsidyRates): Promise<void> {
  const { error } = await supabase
    .from('subsidy_rates')
    .upsert(
      { ...rates, updated_at: new Date().toISOString() },
      { onConflict: 'expedition_id' }
    );
  if (error) throw error;
}

export async function getPersonalCosts(expeditionId: string): Promise<PersonalCost[]> {
  const { data, error } = await supabase
    .from('personal_costs')
    .select('*')
    .eq('expedition_id', expeditionId)
    .order('member_id')
    .order('date')
    .order('item_type');
  if (error) throw error;
  return (data ?? []) as PersonalCost[];
}

export async function upsertPersonalCost(
  row: Omit<PersonalCost, 'id' | 'created_at' | 'updated_at'>
): Promise<PersonalCost> {
  const { data, error } = await supabase
    .from('personal_costs')
    .upsert(row, { onConflict: 'expedition_id,member_id,date,item_type' })
    .select()
    .single();
  if (error) throw error;
  return data as PersonalCost;
}

export async function bulkUpsertPersonalCosts(
  rows: Omit<PersonalCost, 'id' | 'created_at' | 'updated_at'>[]
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from('personal_costs')
    .upsert(rows, { onConflict: 'expedition_id,member_id,date,item_type' });
  if (error) throw error;
}

export async function updatePersonalCostFlag(
  id: string,
  patch: Partial<Pick<PersonalCost, 'is_subsidy_target' | 'is_skipped' | 'skip_reason' | 'subsidy_amount' | 'actual_amount'>>
): Promise<void> {
  const { error } = await supabase
    .from('personal_costs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deletePersonalCost(id: string): Promise<void> {
  const { error } = await supabase.from('personal_costs').delete().eq('id', id);
  if (error) throw error;
}

export async function syncPersonalCostToIncome(
  expeditionId: string,
  totalSubsidy: number,
  breakdown: { accommodation: number; meal: number }
): Promise<void> {
  if (totalSubsidy === 0) return;
  const { error } = await supabase
    .from('income_items')
    .upsert({
      expedition_id: expeditionId,
      category: 'subsidy_auto',
      label: '補助金（宿泊・食事）自動計上',
      amount: totalSubsidy,
      notes: `宿泊補助: ¥${breakdown.accommodation.toLocaleString()} / 食事補助: ¥${breakdown.meal.toLocaleString()}`,
    }, { onConflict: 'expedition_id,category' });
  if (error) console.error('補助収入同期失敗:', error);
}
