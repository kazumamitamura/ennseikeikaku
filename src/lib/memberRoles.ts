import type { Member, MemberRole } from '@/types/expedition';

/** 宿泊対象の生徒（選手+セコンド） */
export const LODGING_STUDENT_ROLES: MemberRole[] = ['athlete', 'second'];

/** 食事カウント用の生徒（選手+セコンド+応援） */
export const MEAL_STUDENT_ROLES: MemberRole[] = ['athlete', 'second', 'supporter'];

/** 教員側（引率+顧問） */
export const STAFF_ROLES: MemberRole[] = ['staff', 'advisor'];

export function countMembersByRoles(members: Member[], roles: MemberRole[]): number {
  return members.filter(m => roles.includes(m.role)).length;
}

export function getLodgingStudentCount(members: Member[]): number {
  return countMembersByRoles(members, LODGING_STUDENT_ROLES);
}

export function getMealStudentCount(members: Member[]): number {
  return countMembersByRoles(members, MEAL_STUDENT_ROLES);
}

export function getStaffCount(members: Member[]): number {
  return countMembersByRoles(members, STAFF_ROLES);
}
