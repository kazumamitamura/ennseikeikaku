export type VehicleType = 'microbus' | 'two_cars';
export type MemberRole = 'athlete' | 'second' | 'supporter' | 'staff' | 'advisor';
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
  notes?: string;
}

export interface MealCost {
  id: string;
  expedition_id: string;
  date: string;
  meal_type: MealType;
  target_count: number;
  non_target_count: number;
  subsidy_count: number;
  unit_price: number;
  notes?: string;
}

export interface TransportCost {
  id: string;
  expedition_id: string;
  transport_type: TransportType;
  label: string;
  amount: number;
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

export interface ExpeditionSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  accommodationTotal: number;
  mealTotal: number;
  transportTotal: number;
  otherTotal: number;
  memberSelfPaymentTotal: number;
  incomeByCategory: Record<IncomeCategory, number>;
  memberCount: {
    athletes: number;
    seconds: number;
    supporters: number;
    staff: number;
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
}

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  athlete: '選手',
  second: 'セコンド',
  supporter: '応援',
  staff: '引率',
  advisor: '顧問',
};

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
