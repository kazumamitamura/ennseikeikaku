import type { Member, MemberRole, MealType, MealCost, MealStatus, MemberMealRecord } from '@/types/expedition';

/** 食事一括計上対象（生徒側） */
export const MEAL_STUDENT_ROLES: MemberRole[] = ['athlete', 'second', 'supporter'];
export const INDIVIDUAL_EXPENSE_ROLES: MemberRole[] = ['staff', 'advisor', 'external_coach'];

export const STAFF_ROLES: MemberRole[] = INDIVIDUAL_EXPENSE_ROLES;

export function isStudentRole(role: MemberRole): boolean {
  return MEAL_STUDENT_ROLES.includes(role);
}

export function needsIndividualTracking(role: MemberRole): boolean {
  return INDIVIDUAL_EXPENSE_ROLES.includes(role);
}

export function getStudentMembers(members: Member[]): Member[] {
  return members.filter(m => isStudentRole(m.role));
}

export function getIndividualMembers(members: Member[]): Member[] {
  return members.filter(m => needsIndividualTracking(m.role));
}

export function countMembersByRoles(members: Member[], roles: MemberRole[]): number {
  return members.filter(m => roles.includes(m.role)).length;
}

/** @deprecated use getLodgingStudentCount from calculations context */
export const LODGING_STUDENT_ROLES: MemberRole[] = ['athlete', 'second'];

export function getLodgingStudentCount(members: Member[]): number {
  return countMembersByRoles(members, LODGING_STUDENT_ROLES);
}

export function getMealStudentCount(members: Member[]): number {
  return countMembersByRoles(members, MEAL_STUDENT_ROLES);
}

export function getStaffCount(members: Member[]): number {
  return countMembersByRoles(members, INDIVIDUAL_EXPENSE_ROLES);
}

export function getMealUnitPrice(
  mealCosts: MealCost[],
  date: string,
  mealType: MealType,
  forStaff: boolean
): number {
  const row = mealCosts.find(m => m.date === date && m.meal_type === mealType);
  if (!row) return 0;
  if (forStaff) return row.staff_unit_price ?? row.unit_price ?? 0;
  return row.unit_price ?? 0;
}

export function getMealStatus(
  records: MemberMealRecord[],
  memberId: string,
  date: string,
  mealType: MealType
): MealStatus {
  const record = records.find(r => r.member_id === memberId && r.date === date);
  if (!record) return 'eat';
  if (mealType === 'breakfast') return record.breakfast_status;
  if (mealType === 'lunch') return record.lunch_status;
  return record.dinner_status;
}

export function buildDefaultMealRecords(
  expeditionId: string,
  members: Member[],
  dates: string[]
): MemberMealRecord[] {
  const records: MemberMealRecord[] = [];
  for (const member of members) {
    for (const date of dates) {
      records.push({
        id: `temp-meal-${member.id}-${date}`,
        expedition_id: expeditionId,
        member_id: member.id,
        date,
        breakfast_status: 'eat',
        lunch_status: 'eat',
        dinner_status: 'eat',
        breakfast_price: 0,
        lunch_price: 0,
        dinner_price: 0,
      });
    }
  }
  return records;
}

export function countMealsByStatus(
  members: Member[],
  records: MemberMealRecord[],
  date: string,
  mealType: MealType,
  status: MealStatus,
  studentOnly: boolean
): number {
  const targetMembers = studentOnly
    ? members.filter(m => isStudentRole(m.role))
    : members.filter(m => needsIndividualTracking(m.role));

  return targetMembers.filter(m => {
    return getMealStatus(records, m.id, date, mealType) === status;
  }).length;
}
