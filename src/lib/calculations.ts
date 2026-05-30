import type {
  Member, IncomeItem, AccommodationCost, MealCost,
  TransportCost, OtherCost, ExpeditionSummary, IncomeCategory
} from '@/types/expedition';

export function calculateSummary(
  members: Member[],
  incomeItems: IncomeItem[],
  accommodation: AccommodationCost | null,
  mealCosts: MealCost[],
  transportCosts: TransportCost[],
  otherCosts: OtherCost[]
): ExpeditionSummary {
  const totalIncome = incomeItems.reduce((sum, item) => sum + item.amount, 0);
  const incomeByCategory = incomeItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  let accommodationTotal = 0;
  if (accommodation) {
    const athletes = members.filter(m => m.role === 'athlete').length;
    const seconds = members.filter(m => m.role === 'second').length;
    const targetCount = athletes + seconds;
    const unitCost = accommodation.unit_price + accommodation.breakfast_price;
    const totalCost = unitCost * targetCount * accommodation.nights;
    const totalSubsidy = accommodation.subsidy_per_person * targetCount * accommodation.nights;
    accommodationTotal = totalCost - totalSubsidy;
  }

  const mealTotal = mealCosts.reduce((sum, meal) => {
    return sum + (meal.unit_price * (meal.target_count + meal.non_target_count));
  }, 0);

  const transportTotal = transportCosts.reduce((sum, t) => {
    return sum + (t.per_person ? t.amount * t.person_count : t.amount);
  }, 0);

  const otherTotal = otherCosts.reduce((sum, o) => sum + o.amount, 0);
  const memberSelfPaymentTotal = members.reduce((sum, m) => sum + m.self_payment, 0);
  const totalExpense = accommodationTotal + mealTotal + transportTotal + otherTotal;
  const balance = totalIncome - totalExpense;

  return {
    totalIncome,
    totalExpense,
    balance,
    accommodationTotal,
    mealTotal,
    transportTotal,
    otherTotal,
    memberSelfPaymentTotal,
    incomeByCategory: incomeByCategory as Record<IncomeCategory, number>,
    memberCount: {
      athletes: members.filter(m => m.role === 'athlete').length,
      seconds: members.filter(m => m.role === 'second').length,
      supporters: members.filter(m => m.role === 'supporter').length,
      staff: members.filter(m => m.role === 'staff').length,
      total: members.length,
    }
  };
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount);
};

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

export const formatDateWithDay = (dateStr: string): string => {
  const date = new Date(dateStr);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${date.getMonth() + 1}月${date.getDate()}日(${days[date.getDay()]})`;
};

export const toReiwaYear = (year: number): number => year - 2018;

export const parseInteger = (value: string | number): number => {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (isNaN(num) || num < 0) return 0;
  return Math.floor(num);
};

export function getDateRange(startDate: string, endDate: string): string[] {
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
