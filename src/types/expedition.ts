export type VehicleType = 'microbus' | 'two_cars';
export type MemberRole = 'athlete' | 'second' | 'supporter' | 'staff' | 'advisor' | 'external_coach';
export type MealStatus = 'eat' | 'skip' | 'none';
export type IndividualTransportType = 'flight' | 'shinkansen' | 'train' | 'bus';
export type ExpeditionStatus = 'draft' | 'confirmed' | 'settled';
export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type TransportType =
  | 'rental_car' | 'travel_agency' | 'fuel' | 'shinkansen'
  | 'train' | 'taxi' | 'charter' | 'highway' | 'parking' | 'other';
export type IncomeCategory =
  | 'club' | 'student_council' | 'subsidy' | 'self_burden' | 'other';

export interface Expedition {
  id: string;
  name: string;
  competition_name: string;
  year: number;
  start_date: string;
  end_date: string;
  destination: string;
  school_name: string;
  club_name: string;
  vehicle_type: VehicleType;
  notes?: string;
  status: ExpeditionStatus;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  expedition_id: string;
  name: string;
  role: MemberRole;
  weight_class?: string;
  participation_ih: boolean;
  participation_tohoku: boolean;
  self_payment: number;
  subsidy_amount: number;
  notes?: string;
  sort_order: number;
}

export interface IncomeItem {
  id: string;
  expedition_id: string;
  category: IncomeCategory;
  label: string;
  amount: number;
  notes?: string;
}

export interface AccommodationCost {
  id: string;
  expedition_id: string;
  plan_type: string;
  unit_price: number;
  breakfast_price: number;
  nights: number;
  subsidy_per_person: number;
  staff_unit_price?: number;
  staff_breakfast_price?: number;
  staff_subsidy_per_person?: number;
  notes?: string;
}

export interface MealCost {
  id: string;
  expedition_id: string;
  date: string;
  meal_type: MealType;
  /** @deprecated student_count を使用 */
  target_count: number;
  /** @deprecated staff_count を使用 */
  non_target_count: number;
  /** @deprecated subsidy_student_count を使用 */
  subsidy_count: number;
  unit_price: number;
  student_count?: number;
  staff_count?: number;
  staff_unit_price?: number;
  subsidy_student_count?: number;
  notes?: string;
}

export interface TransportCost {
  id: string;
  expedition_id: string;
  transport_type: TransportType;
  label: string;
  amount: number;
  student_amount?: number;
  staff_amount?: number;
  per_person: boolean;
  person_count: number;
  notes?: string;
  sort_order: number;
}

export interface OtherCost {
  id: string;
  expedition_id: string;
  label: string;
  amount: number;
  notes?: string;
  sort_order: number;
}

export interface MemberMealRecord {
  id: string;
  expedition_id: string;
  member_id: string;
  date: string;
  breakfast_status: MealStatus;
  lunch_status: MealStatus;
  dinner_status: MealStatus;
}

export interface MemberTransportRecord {
  id: string;
  expedition_id: string;
  member_id: string;
  transport_type: IndividualTransportType;
  label: string;
  amount: number;
  travel_date?: string;
  notes?: string;
  sort_order: number;
}

export interface MemberAccommodationRecord {
  id: string;
  expedition_id: string;
  member_id: string;
  plan_type: string;
  unit_price: number;
  breakfast_price: number;
  nights: number;
  start_date?: string;
  end_date?: string;
  subsidy_amount: number;
  notes?: string;
}

export interface PersonExpenseDetail {
  memberId: string;
  memberName: string;
  role: MemberRole;
  mealTotal: number;
  accommodationTotal: number;
  transportTotal: number;
  total: number;
}

export interface ExpenseSplit {
  student: number;
  staff: number;
  total: number;
}

export interface ExpeditionSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  accommodationTotal: number;
  mealTotal: number;
  transportTotal: number;
  otherTotal: number;
  memberSelfPaymentTotal: number;
  accommodationSplit: ExpenseSplit;
  mealSplit: ExpenseSplit;
  transportSplit: ExpenseSplit;
  incomeByCategory: Record<IncomeCategory, number>;
  memberCount: {
    athletes: number;
    seconds: number;
    supporters: number;
    staff: number;
    advisors: number;
    total: number;
  };
}

export interface ExpeditionFullData {
  expedition: Expedition;
  members: Member[];
  incomeItems: IncomeItem[];
  accommodation: AccommodationCost | null;
  mealCosts: MealCost[];
  transportCosts: TransportCost[];
  otherCosts: OtherCost[];
  memberMealRecords: MemberMealRecord[];
  memberTransportRecords: MemberTransportRecord[];
  memberAccommodationRecords: MemberAccommodationRecord[];
}

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  athlete: '選手',
  second: 'セコンド',
  supporter: '応援',
  staff: '引率',
  advisor: '顧問',
  external_coach: '外部指導',
};

export const MEAL_STATUS_LABELS: Record<MealStatus, string> = {
  eat: '食事',
  skip: '欠食',
  none: '対象外',
};

export const INDIVIDUAL_TRANSPORT_LABELS: Record<IndividualTransportType, string> = {
  flight: '飛行機',
  shinkansen: '新幹線',
  train: '電車',
  bus: 'バス',
};

/** 共通費用（個別計算不要） */
export const GROUP_TRANSPORT_TYPES: TransportType[] = [
  'rental_car', 'travel_agency', 'fuel', 'taxi', 'charter', 'highway', 'parking', 'other',
];

export const ACCOMMODATION_PLAN_OPTIONS = ['1泊1食', '1泊2食', '素泊まり', '朝食付き'] as const;

export const STATUS_LABELS: Record<ExpeditionStatus, string> = {
  draft: '作成中',
  confirmed: '確定',
  settled: '精算済',
};

export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  club: 'クラブ費収入',
  student_council: '生徒会補助',
  subsidy: '学校補助金',
  self_burden: '自己負担徴収合計',
  other: 'その他収入',
};

export const TRANSPORT_TYPE_LABELS: Record<TransportType, string> = {
  rental_car: 'レンタカー',
  travel_agency: '旅行代',
  fuel: '燃料代',
  shinkansen: '新幹線代',
  train: '電車代',
  taxi: 'タクシー代',
  charter: 'チャーター代',
  highway: '高速道路代',
  parking: '駐車代',
  other: 'その他',
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '朝',
  lunch: '昼',
  dinner: '夕',
};
