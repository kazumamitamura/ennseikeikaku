import type {
  SubsidyPersonItem, SubsidyPersonItemCalc,
  SubsidyGroupSummary, SubsidyItemType,
} from '@/types/expedition';

// ============================================================
// 1アイテムの計算
// ============================================================
export function calcPersonItem(item: SubsidyPersonItem): SubsidyPersonItemCalc {
  if (item.is_skipped) {
    return {
      ...item,
      net_amount: 0,
      effective_subsidy: 0,
      effective_expense: 0,
    };
  }

  const effective_subsidy = item.is_subsidy_target ? item.subsidy_amount : 0;
  const effective_expense = item.actual_amount;
  const net_amount = Math.max(0, effective_expense - effective_subsidy);

  return {
    ...item,
    net_amount,
    effective_subsidy,
    effective_expense,
  };
}

// ============================================================
// グループ別サマリー計算
// ============================================================
export function calcGroupSummary(items: SubsidyPersonItem[]): SubsidyGroupSummary {
  const calced = items.map(calcPersonItem);
  return {
    total_actual:  calced.reduce((s, i) => s + i.effective_expense, 0),
    total_subsidy: calced.reduce((s, i) => s + i.effective_subsidy, 0),
    total_net:     calced.reduce((s, i) => s + i.net_amount, 0),
    person_count:  calced.filter(i => !i.is_skipped).length,
    skipped_count: calced.filter(i => i.is_skipped).length,
  };
}

// ============================================================
// 移動日ルール: この費用区分がこの日に補助対象かどうか
// ============================================================
export function getAutoExcludeInfo(
  itemType: SubsidyItemType,
  date: string,
  firstDay: string,
  lastDay: string
): { excluded: boolean; reason?: string } {
  if (date === firstDay) {
    if (itemType === 'breakfast')     return { excluded: true, reason: '移動初日・朝食（補助対象外）' };
    if (itemType === 'lunch')         return { excluded: true, reason: '移動初日・昼食（補助対象外）' };
  }
  if (date === lastDay) {
    if (itemType === 'dinner')        return { excluded: true, reason: '最終日・夕食（補助対象外）' };
    if (itemType === 'accommodation') return { excluded: true, reason: '最終日・宿泊なし' };
  }
  return { excluded: false };
}

// ============================================================
// 日付リスト生成
// ============================================================
export function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const d = new Date(s);
  while (d <= e) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// 日本語日付
export function toJpDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${dt.getMonth() + 1}/${dt.getDate()}(${days[dt.getDay()]})`;
}

// 金額フォーマット
export function yen(n: number): string {
  return `¥${Math.round(n || 0).toLocaleString('ja-JP')}`;
}
