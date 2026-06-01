import type {
  Member, IncomeItem, AccommodationCost, MealCost,
  TransportCost, OtherCost, ExpeditionSummary, IncomeCategory, ExpenseSplit
} from '@/types/expedition';
import { getLodgingStudentCount, getStaffCount } from '@/lib/memberRoles';

function getMealStudentCount(meal: MealCost): number {
  return meal.student_count ?? meal.target_count ?? 0;
}

function getMealStaffCount(meal: MealCost): number {
  return meal.staff_count ?? meal.non_target_count ?? 0;
}

function getMealStaffUnitPrice(meal: MealCost): number {
  return meal.staff_unit_price ?? meal.unit_price ?? 0;
}

function calcMealRowTotal(meal: MealCost): { student: number; staff: number } {
  const student = getMealStudentCount(meal) * (meal.unit_price ?? 0);
  const staff = getMealStaffCount(meal) * getMealStaffUnitPrice(meal);
  return { student, staff };
}

function calcTransportRow(cost: TransportCost): ExpenseSplit {
  const student = cost.student_amount ?? 0;
  const staff = cost.staff_amount ?? 0;
  if (student === 0 && staff === 0) {
    const legacy = cost.per_person ? cost.amount * cost.person_count : cost.amount;
    return { student: legacy, staff: 0, total: legacy };
  }
  return { student, staff, total: student + staff };
}

function calcAccommodationSplit(
  accommodation: AccommodationCost,
  members: Member[]
): ExpenseSplit {
  const studentCount = getLodgingStudentCount(members);
  const staffCount = getStaffCount(members);
  const nights = accommodation.nights;

  const studentUnit = accommodation.unit_price + accommodation.breakfast_price;
  const staffUnit =
    (accommodation.staff_unit_price ?? accommodation.unit_price) +
    (accommodation.staff_breakfast_price ?? accommodation.breakfast_price);

  const studentGross = studentUnit * studentCount * nights;
  const staffGross = staffUnit * staffCount * nights;
  const studentSubsidy = accommodation.subsidy_per_person * studentCount * nights;
  const staffSubsidy =
    (accommodation.staff_subsidy_per_person ?? 0) * staffCount * nights;

  const student = studentGross - studentSubsidy;
  const staff = staffGross - staffSubsidy;
  return { student, staff, total: student + staff };
}

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

  const accommodationSplit: ExpenseSplit = accommodation
    ? calcAccommodationSplit(accommodation, members)
    : { student: 0, staff: 0, total: 0 };

  const mealSplit = mealCosts.reduce(
    (acc, meal) => {
      const row = calcMealRowTotal(meal);
      return {
        student: acc.student + row.student,
        staff: acc.staff + row.staff,
        total: acc.total + row.student + row.staff,
      };
    },
    { student: 0, staff: 0, total: 0 }
  );

  const transportSplit = transportCosts.reduce(
    (acc, t) => {
      const row = calcTransportRow(t);
      return {
        student: acc.student + row.student,
        staff: acc.staff + row.staff,
        total: acc.total + row.total,
      };
    },
    { student: 0, staff: 0, total: 0 }
  );

  const otherTotal = otherCosts.reduce((sum, o) => sum + o.amount, 0);
  const memberSelfPaymentTotal = members.reduce((sum, m) => sum + m.self_payment, 0);
  const totalExpense =
    accommodationSplit.total + mealSplit.total + transportSplit.total + otherTotal;
  const balance = totalIncome - totalExpense;

  return {
    totalIncome,
    totalExpense,
    balance,
    accommodationTotal: accommodationSplit.total,
    mealTotal: mealSplit.total,
    transportTotal: transportSplit.total,
    otherTotal,
    memberSelfPaymentTotal,
    accommodationSplit,
    mealSplit,
    transportSplit,
    incomeByCategory: incomeByCategory as Record<IncomeCategory, number>,
    memberCount: {
      athletes: members.filter(m => m.role === 'athlete').length,
      seconds: members.filter(m => m.role === 'second').length,
      supporters: members.filter(m => m.role === 'supporter').length,
      staff: members.filter(m => m.role === 'staff').length,
      advisors: members.filter(m => m.role === 'advisor').length,
      total: members.length,
    },
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
  const num = typeof value === 'string' ? parseInt(value.replace(/[,¥]/g, ''), 10) : value;
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

export function normalizeMealCost(meal: MealCost): MealCost {
  return {
    ...meal,
    student_count: getMealStudentCount(meal),
    staff_count: getMealStaffCount(meal),
    subsidy_student_count: meal.subsidy_student_count ?? meal.subsidy_count ?? 0,
    staff_unit_price: meal.staff_unit_price ?? meal.unit_price ?? 0,
    target_count: getMealStudentCount(meal),
    non_target_count: getMealStaffCount(meal),
    subsidy_count: meal.subsidy_student_count ?? meal.subsidy_count ?? 0,
  };
}

export function syncMealLegacyFields(meal: MealCost, field: string, value: number): MealCost {
  const updated = { ...meal, [field]: value };
  if (field === 'student_count') updated.target_count = value;
  if (field === 'staff_count') updated.non_target_count = value;
  if (field === 'subsidy_student_count') updated.subsidy_count = value;
  return updated;
}
