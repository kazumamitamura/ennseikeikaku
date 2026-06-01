import type { TransportType } from '@/types/expedition';

export const SAMPLE_EXPEDITION = {
  name: 'R8 東北選手権 6月',
  competition_name: '東北高等学校ウェイトリフティング選手権大会',
  year: 2026,
  start_date: '2026-06-19',
  end_date: '2026-06-21',
  destination: '仙台市',
  school_name: '羽黒高校',
  club_name: 'ウェイトリフティング部',
  vehicle_type: 'microbus' as const,
  status: 'draft' as const,
};

export const SAMPLE_MEMBERS = [
  { name: '田中太郎', role: 'athlete' as const, weight_class: '73kg', self_payment: 7000, sort_order: 0 },
  { name: '佐藤花子', role: 'athlete' as const, weight_class: '59kg', self_payment: 7000, sort_order: 1 },
  { name: '鈴木一郎', role: 'athlete' as const, weight_class: '89kg', self_payment: 7000, sort_order: 2 },
  { name: '高橋次郎', role: 'athlete' as const, weight_class: '67kg', self_payment: 7000, sort_order: 3 },
  { name: '伊藤三郎', role: 'athlete' as const, weight_class: '81kg', self_payment: 7000, sort_order: 4 },
  { name: '渡辺四郎', role: 'athlete' as const, weight_class: '55kg', self_payment: 7000, sort_order: 5 },
  { name: '山本五郎', role: 'athlete' as const, weight_class: '96kg', self_payment: 7000, sort_order: 6 },
  { name: '中村六郎', role: 'athlete' as const, weight_class: '77kg', self_payment: 7000, sort_order: 7 },
  { name: '石川七郎', role: 'second' as const, self_payment: 7000, sort_order: 8 },
  { name: '小林八郎', role: 'second' as const, self_payment: 7000, sort_order: 9 },
];

export const SAMPLE_INCOME = [
  { category: 'club' as const, label: 'クラブ費収入', amount: 150000 },
  { category: 'student_council' as const, label: '生徒会補助', amount: 50000 },
  { category: 'subsidy' as const, label: '学校補助金', amount: 100000 },
  { category: 'self_burden' as const, label: '自己負担徴収合計', amount: 70000 },
];

export const SAMPLE_ACCOMMODATION = {
  plan_type: '1泊2食',
  unit_price: 14000,
  breakfast_price: 600,
  nights: 2,
  subsidy_per_person: 12000,
  staff_unit_price: 14000,
  staff_breakfast_price: 600,
  staff_subsidy_per_person: 0,
};

export const SAMPLE_MEAL_DATES = ['2026-06-19', '2026-06-20', '2026-06-21'];
export const SAMPLE_MEAL_PRICES = { breakfast: 864, lunch: 900, dinner: 435 };

export const DEFAULT_TRANSPORT_TYPES: { type: TransportType; label: string; student_amount: number; staff_amount: number }[] = [
  { type: 'rental_car', label: 'レンタカー', student_amount: 0, staff_amount: 0 },
  { type: 'travel_agency', label: '旅行代', student_amount: 0, staff_amount: 0 },
  { type: 'fuel', label: '燃料代', student_amount: 40000, staff_amount: 5000 },
  { type: 'shinkansen', label: '新幹線代', student_amount: 0, staff_amount: 0 },
  { type: 'train', label: '電車代', student_amount: 0, staff_amount: 0 },
  { type: 'taxi', label: 'タクシー代', student_amount: 0, staff_amount: 0 },
  { type: 'charter', label: 'チャーター代', student_amount: 0, staff_amount: 0 },
  { type: 'highway', label: '高速道路代', student_amount: 22000, staff_amount: 3000 },
  { type: 'parking', label: '駐車代', student_amount: 2500, staff_amount: 500 },
  { type: 'other', label: 'その他', student_amount: 0, staff_amount: 0 },
];
