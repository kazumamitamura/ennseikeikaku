import type {
  PersonalCost, PersonalCostCalc, PersonalCostItemType,
  SubsidyRates, MemberRole,
} from '@/types/expedition';
import { SUBSIDY_TARGET_ROLES, RATE_KEY } from '@/types/expedition';

export function calcRow(item: PersonalCost): PersonalCostCalc {
  if (item.is_skipped) {
    return { ...item, net_amount: 0, effective_subsidy: 0 };
  }
  const effective_subsidy = item.is_subsidy_target ? item.subsidy_amount : 0;
  const net_amount = Math.max(0, item.actual_amount - effective_subsidy);
  return { ...item, net_amount, effective_subsidy };
}

export function calcSummary(items: PersonalCost[]) {
  const rows = items.filter(i => !i.is_skipped).map(calcRow);
  const accRows = rows.filter(r => r.item_type === 'accommodation');
  const mealRows = rows.filter(r => r.item_type !== 'accommodation');

  const sum = (arr: PersonalCostCalc[], key: keyof PersonalCostCalc) =>
    arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);

  return {
    accommodation_actual: sum(accRows, 'actual_amount'),
    accommodation_subsidy: sum(accRows, 'effective_subsidy'),
    accommodation_net: sum(accRows, 'net_amount'),
    meal_actual: sum(mealRows, 'actual_amount'),
    meal_subsidy: sum(mealRows, 'effective_subsidy'),
    meal_net: sum(mealRows, 'net_amount'),
    total_actual: sum(rows, 'actual_amount'),
    total_subsidy: sum(rows, 'effective_subsidy'),
    total_net: sum(rows, 'net_amount'),
  };
}

export function autoExcludeCheck(
  itemType: PersonalCostItemType,
  date: string,
  startDate: string,
  endDate: string
): { excluded: boolean; reason?: string } {
  if (date === startDate) {
    if (itemType === 'breakfast') return { excluded: true, reason: '移動初日・朝食は対象外' };
    if (itemType === 'lunch') return { excluded: true, reason: '移動初日・昼食は対象外' };
  }
  if (date === endDate) {
    if (itemType === 'dinner') return { excluded: true, reason: '最終日・夕食は対象外' };
    if (itemType === 'accommodation') return { excluded: true, reason: '最終日・宿泊なし' };
  }
  return { excluded: false };
}

export function makeDateRange(start: string, end: string): string[] {
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

export function jpDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  const w = ['日', '月', '火', '水', '木', '金', '土'];
  return `${dt.getMonth() + 1}/${dt.getDate()}(${w[dt.getDay()]})`;
}

export function isSubsidyEligible(role: MemberRole): boolean {
  return SUBSIDY_TARGET_ROLES.includes(role);
}

export function rateForItem(
  itemType: PersonalCostItemType,
  rates: SubsidyRates
): number {
  const key = RATE_KEY[itemType];
  return (rates[key] as number) ?? 0;
}

export function yen(n: number): string {
  return `¥${Math.round(n || 0).toLocaleString('ja-JP')}`;
}
