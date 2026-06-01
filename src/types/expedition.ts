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
  | 'club' | 'student_council' | 'subsidy' | 'self_burden' | 'other' | 'subsidy_auto';

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
  move_in_date?: string;   // 移動初日（前日移動の場合）
  move_out_date?: string;  // 移動最終日
  subsidy_target_roles?: string[];
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
  breakfast_subsidy: number;
  nights: number;
  subsidy_per_person: number;
  lunch_price: number;
  lunch_subsidy: number;
  dinner_price: number;
  dinner_subsidy: number;
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
  breakfast_price: number;
  lunch_price: number;
  dinner_price: number;
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
  date: string;        // チェックイン日（宿泊する夜の日付）
  stays: boolean;      // その夜に宿泊するか
  unit_price: number;  // その夜の宿泊料
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

/** 役職グループ別集計 */
export interface RoleGroupSummary {
  role: MemberRole;
  label: string;
  memberCount: number;
  accommodationTotal: number;
  mealTotal: number;
  transportTotal: number;
  total: number;
  isSubsidized: boolean; // 学校補助対象か
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
  roleGroupSummaries: RoleGroupSummary[];
  subsidizedTotal: number;    // 補助対象合計（顧問・選手・セコンド・引率）
  nonSubsidizedTotal: number; // 補助対象外合計（外部指導・応援）
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
  subsidy_auto: '補助金（宿泊・食事）自動計上',
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

// ============================================================
// 補助対象費（Step 2）
// ============================================================

export type SubsidyItemType =
  | 'accommodation'
  | 'breakfast'
  | 'lunch'
  | 'dinner';

export interface SubsidyItem {
  id: string;
  expedition_id: string;
  date: string;
  item_type: SubsidyItemType;
  is_subsidy_target: boolean;
  subsidy_rule_reason?: string;
  subsidy_target_count: number;
  non_subsidy_count: number;
  skip_count: number;
  subsidy_amount_per_person: number;
  actual_amount_per_person: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SubsidyItemCalculated extends SubsidyItem {
  total_subsidy_amount: number;
  total_actual_subsidy: number;
  net_burden_subsidy: number;
  total_actual_non_subsidy: number;
  grand_total_actual: number;
  grand_total_subsidy: number;
  grand_net_expense: number;
}

export interface SubsidyDaySummary {
  date: string;
  items: SubsidyItemCalculated[];
  day_total_actual: number;
  day_total_subsidy: number;
  day_net_expense: number;
  is_first_travel_day: boolean;
  is_last_travel_day: boolean;
}

export interface SubsidySummary {
  accommodation_actual: number;
  accommodation_subsidy: number;
  accommodation_net: number;
  meal_actual: number;
  meal_subsidy: number;
  meal_net: number;
  total_subsidy_income: number;
  total_actual_expense: number;
  total_net_expense: number;
}

export const SUBSIDY_ITEM_TYPE_LABELS: Record<SubsidyItemType, string> = {
  accommodation: '🏨 宿泊',
  breakfast: '🍳 朝食',
  lunch: '🥗 昼食',
  dinner: '🍱 夕食',
};

// エイリアス（v3命令書との互換）
export const SUBSIDY_ITEM_LABELS = SUBSIDY_ITEM_TYPE_LABELS;

export const ITEM_TYPE_ORDER: SubsidyItemType[] = [
  'accommodation', 'breakfast', 'lunch', 'dinner',
];

// 役職ごとの補助対象デフォルト（既存 MemberRole に準拠）
export const ROLE_SUBSIDY_DEFAULT: Record<MemberRole, boolean> = {
  athlete:        true,   // 選手 → 補助対象
  second:         true,   // セコンド → 補助対象
  advisor:        true,   // 顧問 → 補助対象
  external_coach: false,  // 外部指導者 → デフォルト対象外
  supporter:      false,  // 応援 → 対象外
  staff:          false,  // 引率 → 対象外
};

// ============================================================
// 補助対象費（個人紐付け）v3
// ============================================================

export interface SubsidyPersonItem {
  id: string;
  expedition_id: string;
  member_id: string;
  item_type: SubsidyItemType;
  date: string;
  actual_amount: number;
  subsidy_amount: number;
  is_subsidy_target: boolean;
  is_skipped: boolean;
  skip_reason?: string;
  auto_excluded: boolean;
  auto_exclude_reason?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SubsidyPersonItemCalc extends SubsidyPersonItem {
  net_amount: number;
  effective_subsidy: number;
  effective_expense: number;
}

export interface SubsidyPersonItemWithMember extends SubsidyPersonItemCalc {
  member_name: string;
  member_role: MemberRole;
}

export interface BulkInputForm {
  item_type: SubsidyItemType;
  date: string;
  actual_amount: number;
  subsidy_amount: number;
  is_subsidy_target: boolean;
  target_member_ids: string[];
}

export interface SubsidyGroupSummary {
  total_actual: number;
  total_subsidy: number;
  total_net: number;
  person_count: number;
  skipped_count: number;
}
