import type {
  SubsidyItem, SubsidyItemCalculated, SubsidyDaySummary,
  SubsidySummary, SubsidyItemType,
} from '@/types/expedition';

// ============================================================
// 移動日ルール判定
// ルール: 移動初日は朝食・昼食が補助対象外
//         最終日は夕食が補助対象外 / 宿泊なし
// ============================================================
export function isSubsidyTarget(
  itemType: SubsidyItemType,
  date: string,
  expeditionStartDate: string,
  expeditionEndDate: string,
  moveInDate?: string,
  moveOutDate?: string
): { isTarget: boolean; reason?: string } {
  const firstDay = moveInDate || expeditionStartDate;
  const lastDay = moveOutDate || expeditionEndDate;

  if (date === firstDay) {
    if (itemType === 'breakfast') {
      return { isTarget: false, reason: '移動初日・朝食（補助対象外）' };
    }
    if (itemType === 'lunch') {
      return { isTarget: false, reason: '移動初日・昼食（補助対象外）' };
    }
  }

  if (date === lastDay) {
    if (itemType === 'dinner') {
      return { isTarget: false, reason: '最終日・夕食（補助対象外）' };
    }
  }

  return { isTarget: true };
}

// ============================================================
// 1アイテムの計算
// ============================================================
export function calcSubsidyItem(item: SubsidyItem): SubsidyItemCalculated {
  const subsidyTargetCount = item.is_subsidy_target ? item.subsidy_target_count : 0;
  const nonSubsidyCount = item.non_subsidy_count;

  const total_subsidy_amount = item.subsidy_amount_per_person * subsidyTargetCount;
  const total_actual_subsidy = item.actual_amount_per_person * subsidyTargetCount;
  const net_burden_subsidy = Math.max(0, total_actual_subsidy - total_subsidy_amount);

  const total_actual_non_subsidy = item.actual_amount_per_person * nonSubsidyCount;

  const grand_total_actual = total_actual_subsidy + total_actual_non_subsidy;
  const grand_total_subsidy = total_subsidy_amount;
  const grand_net_expense = net_burden_subsidy + total_actual_non_subsidy;

  return {
    ...item,
    total_subsidy_amount,
    total_actual_subsidy,
    net_burden_subsidy,
    total_actual_non_subsidy,
    grand_total_actual,
    grand_total_subsidy,
    grand_net_expense,
  };
}

// ============================================================
// 日別サマリー計算
// ============================================================
export function calcDaySummary(
  date: string,
  items: SubsidyItem[],
  firstTravelDay: string,
  lastTravelDay: string
): SubsidyDaySummary {
  const calculated = items
    .filter(i => i.date === date)
    .map(calcSubsidyItem);

  return {
    date,
    items: calculated,
    day_total_actual: calculated.reduce((s, i) => s + i.grand_total_actual, 0),
    day_total_subsidy: calculated.reduce((s, i) => s + i.grand_total_subsidy, 0),
    day_net_expense: calculated.reduce((s, i) => s + i.grand_net_expense, 0),
    is_first_travel_day: date === firstTravelDay,
    is_last_travel_day: date === lastTravelDay,
  };
}

// ============================================================
// 全体サマリー計算
// ============================================================
export function calcSubsidySummary(items: SubsidyItem[]): SubsidySummary {
  const calculated = items.map(calcSubsidyItem);

  const accItems = calculated.filter(i => i.item_type === 'accommodation');
  const mealItems = calculated.filter(i => i.item_type !== 'accommodation');

  const sum = (arr: SubsidyItemCalculated[], key: keyof SubsidyItemCalculated) =>
    arr.reduce((s, i) => s + (Number(i[key]) || 0), 0);

  const accommodation_actual = sum(accItems, 'grand_total_actual');
  const accommodation_subsidy = sum(accItems, 'grand_total_subsidy');
  const accommodation_net = sum(accItems, 'grand_net_expense');

  const meal_actual = sum(mealItems, 'grand_total_actual');
  const meal_subsidy = sum(mealItems, 'grand_total_subsidy');
  const meal_net = sum(mealItems, 'grand_net_expense');

  return {
    accommodation_actual,
    accommodation_subsidy,
    accommodation_net,
    meal_actual,
    meal_subsidy,
    meal_net,
    total_subsidy_income: accommodation_subsidy + meal_subsidy,
    total_actual_expense: accommodation_actual + meal_actual,
    total_net_expense: accommodation_net + meal_net,
  };
}

// ============================================================
// 日付リスト生成
// ============================================================
export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// 日付フォーマット（日本語）
export function formatJpDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

// 金額フォーマット
export function formatYen(n: number): string {
  return `¥${Math.round(n || 0).toLocaleString('ja-JP')}`;
}
