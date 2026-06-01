import { supabase } from './supabase';
import type { SubsidyItem, SubsidyItemType, SubsidySummary } from '@/types/expedition';
import { isSubsidyTarget } from './subsidyCalculations';

// 遠征の全補助対象費取得
export async function getSubsidyItems(expeditionId: string): Promise<SubsidyItem[]> {
  const { data, error } = await supabase
    .from('subsidy_items')
    .select('*')
    .eq('expedition_id', expeditionId)
    .order('date', { ascending: true })
    .order('item_type', { ascending: true });

  if (error) throw error;
  return (data || []) as SubsidyItem[];
}

// Upsert（作成 or 更新）
export async function upsertSubsidyItem(
  item: Omit<SubsidyItem, 'id' | 'created_at' | 'updated_at'>
): Promise<SubsidyItem> {
  const { data, error } = await supabase
    .from('subsidy_items')
    .upsert(
      { ...item, updated_at: new Date().toISOString() },
      { onConflict: 'expedition_id,date,item_type' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as SubsidyItem;
}

// 日付範囲で自動初期化（遠征作成時・日程変更時に呼ぶ）
export async function initializeSubsidyItems(
  expeditionId: string,
  startDate: string,
  endDate: string,
  subsidyTargetCount: number,
  moveInDate?: string,
  moveOutDate?: string
): Promise<void> {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }

  const firstDay = moveInDate || startDate;
  const lastDay = moveOutDate || endDate;

  const itemTypes: SubsidyItemType[] = ['accommodation', 'breakfast', 'lunch', 'dinner'];
  const items: Omit<SubsidyItem, 'id' | 'created_at' | 'updated_at'>[] = [];

  for (const date of dates) {
    for (const itemType of itemTypes) {
      // 最終日は宿泊なし
      if (itemType === 'accommodation' && date === lastDay) continue;

      const { isTarget, reason } = isSubsidyTarget(
        itemType, date, startDate, endDate, firstDay, lastDay
      );

      items.push({
        expedition_id: expeditionId,
        date,
        item_type: itemType,
        is_subsidy_target: isTarget,
        subsidy_rule_reason: reason,
        subsidy_target_count: isTarget ? subsidyTargetCount : 0,
        non_subsidy_count: 0,
        skip_count: 0,
        subsidy_amount_per_person: 0,
        actual_amount_per_person: 0,
        notes: reason || undefined,
      });
    }
  }

  const { error } = await supabase
    .from('subsidy_items')
    .upsert(items, { onConflict: 'expedition_id,date,item_type', ignoreDuplicates: true });

  if (error) throw error;
}

// 補助額を収入として自動計上
export async function syncSubsidyToIncome(
  summary: SubsidySummary,
  expeditionId: string
): Promise<void> {
  if (summary.total_subsidy_income === 0) return;

  const { error } = await supabase
    .from('income_items')
    .upsert(
      {
        expedition_id: expeditionId,
        category: 'subsidy_auto',
        label: '補助金（宿泊・食事）自動計上',
        amount: summary.total_subsidy_income,
        notes: `宿泊補助: ¥${summary.accommodation_subsidy.toLocaleString()} / 食事補助: ¥${summary.meal_subsidy.toLocaleString()}`,
      },
      { onConflict: 'expedition_id' } // 部分インデックス where category='subsidy_auto'
    );

  if (error) console.error('補助収入の同期に失敗:', error);
}

// 削除
export async function deleteSubsidyItems(expeditionId: string): Promise<void> {
  const { error } = await supabase
    .from('subsidy_items')
    .delete()
    .eq('expedition_id', expeditionId);
  if (error) throw error;
}
