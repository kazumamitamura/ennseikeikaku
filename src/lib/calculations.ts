import type {
  Member, IncomeItem, AccommodationCost, MealCost,
  TransportCost, OtherCost, ExpeditionSummary, IncomeCategory, ExpenseSplit,
  MemberMealRecord, MemberTransportRecord, MemberAccommodationRecord,
  PersonExpenseDetail, MealType, MealStatus
} from '@/types/expedition';
import {
  getLodgingStudentCount, getMealUnitPrice, getMealStatus,
  isStudentRole, needsIndividualTracking, getStudentMembers, getIndividualMembers,
  INDIVIDUAL_EXPENSE_ROLES
} from '@/lib/memberRoles';
import { GROUP_TRANSPORT_TYPES } from '@/types/expedition';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

function calcStudentGroupAccommodation(
  accommodation: AccommodationCost,
  members: Member[]
): number {
  const studentCount = getLodgingStudentCount(members);
  const unitCost = accommodation.unit_price + accommodation.breakfast_price;
  const gross = unitCost * studentCount * accommodation.nights;
  const subsidy = accommodation.subsidy_per_person * studentCount * accommodation.nights;
  return gross - subsidy;
}

function calcStaffAccommodationRecords(records: MemberAccommodationRecord[]): number {
  return records.reduce((sum, r) => {
    const gross = (r.unit_price + r.breakfast_price) * r.nights;
    return sum + gross - r.subsidy_amount;
  }, 0);
}

function calcMealsFromMatrix(
  members: Member[],
  mealRecords: MemberMealRecord[],
  mealCosts: MealCost[],
  dates: string[]
): ExpenseSplit {
  let student = 0;
  let staff = 0;

  for (const date of dates) {
    for (const mealType of MEAL_TYPES) {
      const studentPrice = getMealUnitPrice(mealCosts, date, mealType, false);
      const staffPrice = getMealUnitPrice(mealCosts, date, mealType, true);

      for (const m of getStudentMembers(members)) {
        const status = getMealStatus(mealRecords, m.id, date, mealType);
        if (status === 'eat') student += studentPrice;
      }
      for (const m of getIndividualMembers(members)) {
        const status = getMealStatus(mealRecords, m.id, date, mealType);
        if (status === 'eat') staff += staffPrice;
      }
    }
  }
  return { student, staff, total: student + staff };
}

function calcLegacyMeals(mealCosts: MealCost[]): ExpenseSplit {
  const student = mealCosts.reduce((sum, m) => {
    const sc = m.student_count ?? m.target_count ?? 0;
    return sum + sc * (m.unit_price ?? 0);
  }, 0);
  const staff = mealCosts.reduce((sum, m) => {
    const st = m.staff_count ?? m.non_target_count ?? 0;
    const price = m.staff_unit_price ?? m.unit_price ?? 0;
    return sum + st * price;
  }, 0);
  return { student, staff, total: student + staff };
}

function calcGroupTransport(transportCosts: TransportCost[]): number {
  return transportCosts
    .filter(t => GROUP_TRANSPORT_TYPES.includes(t.transport_type))
    .reduce((sum, t) => {
      const student = t.student_amount ?? 0;
      const staff = t.staff_amount ?? 0;
      if (student === 0 && staff === 0) {
        return sum + (t.per_person ? t.amount * t.person_count : t.amount);
      }
      return sum + student + staff;
    }, 0);
}

function calcIndividualTransport(records: MemberTransportRecord[]): number {
  return records.reduce((sum, r) => sum + r.amount, 0);
}

export function calcPersonExpenseDetails(
  members: Member[],
  mealRecords: MemberMealRecord[],
  mealCosts: MealCost[],
  accommodationRecords: MemberAccommodationRecord[],
  transportRecords: MemberTransportRecord[],
  dates: string[]
): PersonExpenseDetail[] {
  return getIndividualMembers(members).map(m => {
    let mealTotal = 0;
    for (const date of dates) {
      for (const mealType of MEAL_TYPES) {
        if (getMealStatus(mealRecords, m.id, date, mealType) === 'eat') {
          mealTotal += getMealUnitPrice(mealCosts, date, mealType, true);
        }
      }
    }
    const acc = accommodationRecords.find(r => r.member_id === m.id);
    const accommodationTotal = acc
      ? (acc.unit_price + acc.breakfast_price) * acc.nights - acc.subsidy_amount
      : 0;
    const transportTotal = transportRecords
      .filter(r => r.member_id === m.id)
      .reduce((s, r) => s + r.amount, 0);

    return {
      memberId: m.id,
      memberName: m.name,
      role: m.role,
      mealTotal,
      accommodationTotal,
      transportTotal,
      total: mealTotal + accommodationTotal + transportTotal,
    };
  });
}

export function calculateSummary(
  members: Member[],
  incomeItems: IncomeItem[],
  accommodation: AccommodationCost | null,
  mealCosts: MealCost[],
  transportCosts: TransportCost[],
  otherCosts: OtherCost[],
  memberMealRecords: MemberMealRecord[] = [],
  memberTransportRecords: MemberTransportRecord[] = [],
  memberAccommodationRecords: MemberAccommodationRecord[] = [],
  dates: string[] = []
): ExpeditionSummary {
  const totalIncome = incomeItems.reduce((sum, item) => sum + item.amount, 0);
  const incomeByCategory = incomeItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  const studentAcc = accommodation ? calcStudentGroupAccommodation(accommodation, members) : 0;
  const staffAcc = calcStaffAccommodationRecords(memberAccommodationRecords);
  const accommodationSplit: ExpenseSplit = {
    student: studentAcc,
    staff: staffAcc,
    total: studentAcc + staffAcc,
  };

  const mealSplit = memberMealRecords.length > 0 && dates.length > 0
    ? calcMealsFromMatrix(members, memberMealRecords, mealCosts, dates)
    : calcLegacyMeals(mealCosts);

  const groupTransport = calcGroupTransport(transportCosts);
  const individualTransport = calcIndividualTransport(memberTransportRecords);
  const transportSplit: ExpenseSplit = {
    student: groupTransport,
    staff: individualTransport,
    total: groupTransport + individualTransport,
  };

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
  return `${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]})`;
};

export const formatDateShort = (dateStr: string): string => {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
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

export function syncMealLegacyFields(meal: MealCost, field: string, value: number): MealCost {
  const updated = { ...meal, [field]: value };
  if (field === 'student_count') updated.target_count = value;
  if (field === 'staff_count') updated.non_target_count = value;
  if (field === 'subsidy_student_count') updated.subsidy_count = value;
  return updated;
}

export function cycleMealStatus(current: MealStatus): MealStatus {
  if (current === 'eat') return 'skip';
  if (current === 'skip') return 'none';
  return 'eat';
}

export { MEAL_TYPES, INDIVIDUAL_EXPENSE_ROLES, isStudentRole, needsIndividualTracking };
