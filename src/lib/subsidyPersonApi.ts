import { supabase } from './supabase';
import type { SubsidyPersonItem, BulkInputForm } from '@/types/expedition';
import { getAutoExcludeInfo, dateRange } from './subsidyPersonCalc';

// ---- 取得 ----
export async function getSubsidyPersonItems(
  expeditionId: string
): Promise<SubsidyPersonItem[]> {
  const { data, error } = await supabase
    .from('subsidy_person_items')
    .select('*')
    .eq('expedition_id', expeditionId)
    .order('date')
    .order('item_type')
    .order('member_id');
  if (error) throw error;
  return (data ?? []) as SubsidyPersonItem[];
}

// ---- 1件upsert ----
export async function upsertSubsidyPersonItem(
  item: Omit<SubsidyPersonItem, 'id' | 'created_at' | 'updated_at'>
): Promise<SubsidyPersonItem> {
  const { data, error } = await supabase
    .from('subsidy_person_items')
    .upsert(item, { onConflict: 'expedition_id,member_id,date,item_type' })
    .select()
    .single();
  if (error) throw error;
  return data as SubsidyPersonItem;
}

// ---- 一括upsert（核心機能）----
export async function bulkUpsertSubsidyItems(
  form: BulkInputForm,
  expeditionId: string,
  firstDay: string,
  lastDay: string
): Promise<void> {
  const { excluded, reason } = getAutoExcludeInfo(
    form.item_type, form.date, firstDay, lastDay
  );

  const rows = form.target_member_ids.map(memberId => ({
    expedition_id: expeditionId,
    member_id: memberId,
    item_type: form.item_type,
    date: form.date,
    actual_amount: form.actual_amount,
    subsidy_amount: (excluded || !form.is_subsidy_target) ? 0 : form.subsidy_amount,
    is_subsidy_target: excluded ? false : form.is_subsidy_target,
    is_skipped: false,
    auto_excluded: excluded,
    auto_exclude_reason: reason,
  }));

  const { error } = await supabase
    .from('subsidy_person_items')
    .upsert(rows, { onConflict: 'expedition_id,member_id,date,item_type' });
  if (error) throw error;
}

// ---- スキップ切替 ----
export async function toggleSkip(
  id: string,
  isSkipped: boolean,
  reason?: string
): Promise<void> {
  const { error } = await supabase
    .from('subsidy_person_items')
    .update({ is_skipped: isSkipped, skip_reason: reason ?? null })
    .eq('id', id);
  if (error) throw error;
}

// ---- 補助対象フラグ切替 ----
export async function toggleSubsidyTarget(
  id: string,
  isTarget: boolean
): Promise<void> {
  const { error } = await supabase
    .from('subsidy_person_items')
    .update({
      is_subsidy_target: isTarget,
      subsidy_amount: isTarget ? undefined : 0,
    })
    .eq('id', id);
  if (error) throw error;
}

// ---- 削除 ----
export async function deleteSubsidyPersonItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('subsidy_person_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---- 初期化 ----
export async function initSubsidyPersonItems(
  expeditionId: string,
  memberIds: string[],
  memberRoles: Record<string, string>,
  startDate: string,
  endDate: string
): Promise<void> {
  const dates = dateRange(startDate, endDate);
  const types: SubsidyPersonItem['item_type'][] = [
    'accommodation', 'breakfast', 'lunch', 'dinner',
  ];
  const rows: Omit<SubsidyPersonItem, 'id' | 'created_at' | 'updated_at'>[] = [];

  for (const memberId of memberIds) {
    const role = memberRoles[memberId] || 'other';
    const isSubsidyEligible = ['athlete', 'second', 'advisor'].includes(role);

    for (const date of dates) {
      for (const itemType of types) {
        const { excluded, reason } = getAutoExcludeInfo(
          itemType, date, startDate, endDate
        );
        if (excluded) continue;

        rows.push({
          expedition_id: expeditionId,
          member_id: memberId,
          item_type: itemType,
          date,
          actual_amount: 0,
          subsidy_amount: 0,
          is_subsidy_target: isSubsidyEligible,
          is_skipped: false,
          auto_excluded: false,
        });
      }
    }
  }

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('subsidy_person_items')
    .upsert(rows, {
      onConflict: 'expedition_id,member_id,date,item_type',
      ignoreDuplicates: true,
    });
  if (error) throw error;
}

// ---- 補助総額を収入テーブルに自動同期 ----
export async function syncSubsidyPersonToIncome(
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
