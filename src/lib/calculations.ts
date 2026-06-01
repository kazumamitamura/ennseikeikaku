import type {
  Member, IncomeItem, AccommodationCost, MealCost,
  TransportCost, OtherCost, ExpeditionSummary, IncomeCategory, ExpenseSplit,
  MemberMealRecord, MemberTransportRecord, MemberAccommodationRecord,
  PersonExpenseDetail, MealType, MealStatus, MemberRole, RoleGroupSummary,
} from '@/types/expedition';
import { MEMBER_ROLE_LABELS, GROUP_TRANSPORT_TYPES } from '@/types/expedition';
import {
  isStudentRole, needsIndividualTracking,
  INDIVIDUAL_EXPENSE_ROLES
} from '@/lib/memberRoles';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

/** 補助対象外の役職 */
const NON_SUBSIDIZED_ROLES: MemberRole[] = ['external_coach', 'supporter'];

/** 役職の表示順 */
const ROLE_ORDER: MemberRole[] = ['advisor', 'external_coach', 'staff', 'athlete', 'second', 'supporter'];

// ── 個人別宿泊費計算 ────────────────────────────────────────────
function calcMemberAccommodationTotal(
  records: MemberAccommodationRecord[],
  memberId: string
): number {
  return records
    .filter(r => r.member_id === memberId && r.stays !== false)
    .reduce((sum, r) => sum + (r.unit_price || 0), 0);
}

// ── 個人別食事費計算 ─────────────────────────────────────────────
function calcMemberMealTotal(
  records: MemberMealRecord[],
  memberId: string
): number {
  return records
    .filter(r => r.member_id === memberId)
    .reduce((sum, r) => {
      let t = 0;
      if (r.breakfast_status === 'eat') t += r.breakfast_price || 0;
      if (r.lunch_status === 'eat') t += r.lunch_price || 0;
      if (r.dinner_status === 'eat') t += r.dinner_price || 0;
      return sum + t;
    }, 0);
}

// ── 役職グループ別集計 ────────────────────────────────────────────
function calcRoleGroupSummaries(
  members: Member[],
  accommodationRecords: MemberAccommodationRecord[],
  mealRecords: MemberMealRecord[],
  transportRecords: MemberTransportRecord[]
): RoleGroupSummary[] {
  return ROLE_ORDER
    .filter(role => members.some(m => m.role === role))
    .map(role => {
      const roleMembers = members.filter(m => m.role === role);
      const roleMemberIds = new Set(roleMembers.map(m => m.id));

      const accommodationTotal = accommodationRecords
        .filter(r => roleMemberIds.has(r.member_id) && r.stays !== false)
        .reduce((sum, r) => sum + (r.unit_price || 0), 0);

      const mealTotal = mealRecords
        .filter(r => roleMemberIds.has(r.member_id))
        .reduce((sum, r) => {
          let t = 0;
          if (r.breakfast_status === 'eat') t += r.breakfast_price || 0;
          if (r.lunch_status === 'eat') t += r.lunch_price || 0;
          if (r.dinner_status === 'eat') t += r.dinner_price || 0;
          return sum + t;
        }, 0);

      const transportTotal = transportRecords
        .filter(r => roleMemberIds.has(r.member_id))
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      return {
        role,
        label: MEMBER_ROLE_LABELS[role],
        memberCount: roleMembers.length,
        accommodationTotal,
        mealTotal,
        transportTotal,
        total: accommodationTotal + mealTotal + transportTotal,
        isSubsidized: !NON_SUBSIDIZED_ROLES.includes(role),
      };
    });
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
  dates: string[],
  groupAccommodation?: AccommodationCost | null
): PersonExpenseDetail[] {
  return members.map(m => {
    const mealTotal = calcMemberMealTotal(mealRecords, m.id);
    const accommodationTotal = calcMemberAccommodationTotal(accommodationRecords, m.id);
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
  accommodation: AccommodationCost | null, // レガシー互換（現在は未使用）
  mealCosts: MealCost[],                   // レガシー互換（現在は未使用）
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

  // ── 個人別レコードから宿泊・食事合計を計算 ──────────────────────
  const accommodationTotal = memberAccommodationRecords
    .filter(r => r.stays !== false)
    .reduce((sum, r) => sum + (r.unit_price || 0), 0);

  const mealTotal = memberMealRecords.reduce((sum, r) => {
    let t = 0;
    if (r.breakfast_status === 'eat') t += r.breakfast_price || 0;
    if (r.lunch_status === 'eat') t += r.lunch_price || 0;
    if (r.dinner_status === 'eat') t += r.dinner_price || 0;
    return sum + t;
  }, 0);

  const groupTransport = calcGroupTransport(transportCosts);
  const individualTransport = calcIndividualTransport(memberTransportRecords);
  const transportTotal = groupTransport + individualTransport;

  const otherTotal = otherCosts.reduce((sum, o) => sum + o.amount, 0);
  const totalExpense = accommodationTotal + mealTotal + transportTotal + otherTotal;
  const balance = totalIncome - totalExpense;

  const memberSelfPaymentTotal = members.reduce((sum, m) => sum + m.self_payment, 0);

  // ── 役職グループ別集計 ────────────────────────────────────────────
  const roleGroupSummaries = calcRoleGroupSummaries(
    members, memberAccommodationRecords, memberMealRecords, memberTransportRecords
  );
  const subsidizedTotal = roleGroupSummaries
    .filter(g => g.isSubsidized)
    .reduce((sum, g) => sum + g.total, 0);
  const nonSubsidizedTotal = roleGroupSummaries
    .filter(g => !g.isSubsidized)
    .reduce((sum, g) => sum + g.total, 0);

  return {
    totalIncome,
    totalExpense,
    balance,
    accommodationTotal,
    mealTotal,
    transportTotal,
    otherTotal,
    memberSelfPaymentTotal,
    accommodationSplit: { student: accommodationTotal, staff: 0, total: accommodationTotal },
    mealSplit: { student: mealTotal, staff: 0, total: mealTotal },
    transportSplit: { student: groupTransport, staff: individualTransport, total: transportTotal },
    roleGroupSummaries,
    subsidizedTotal,
    nonSubsidizedTotal,
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
