-- 遠征マスター
CREATE TABLE expeditions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  competition_name TEXT NOT NULL,
  year INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  destination TEXT NOT NULL,
  school_name TEXT DEFAULT '羽黒高校',
  club_name TEXT DEFAULT 'ウェイトリフティング部',
  vehicle_type TEXT DEFAULT 'microbus',
  notes TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 参加者名簿
CREATE TABLE members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  weight_class TEXT,
  participation_ih BOOLEAN DEFAULT false,
  participation_tohoku BOOLEAN DEFAULT false,
  self_payment INTEGER DEFAULT 0,
  subsidy_amount INTEGER DEFAULT 0,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 収入
CREATE TABLE income_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 支出：宿泊費
CREATE TABLE accommodation_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE,
  plan_type TEXT DEFAULT 'two_meals',
  unit_price INTEGER DEFAULT 0,
  breakfast_price INTEGER DEFAULT 0,
  nights INTEGER DEFAULT 1,
  subsidy_per_person INTEGER DEFAULT 0,
  staff_unit_price INTEGER DEFAULT 0,
  staff_breakfast_price INTEGER DEFAULT 0,
  staff_subsidy_per_person INTEGER DEFAULT 0,
  notes TEXT
);

-- 支出：食事費
CREATE TABLE meal_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL,
  target_count INTEGER DEFAULT 0,
  non_target_count INTEGER DEFAULT 0,
  subsidy_count INTEGER DEFAULT 0,
  unit_price INTEGER DEFAULT 0,
  student_count INTEGER DEFAULT 0,
  staff_count INTEGER DEFAULT 0,
  staff_unit_price INTEGER DEFAULT 0,
  subsidy_student_count INTEGER DEFAULT 0,
  notes TEXT
);

-- 支出：交通費
CREATE TABLE transport_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE,
  transport_type TEXT NOT NULL,
  label TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  student_amount INTEGER DEFAULT 0,
  staff_amount INTEGER DEFAULT 0,
  per_person BOOLEAN DEFAULT false,
  person_count INTEGER DEFAULT 1,
  notes TEXT,
  sort_order INTEGER DEFAULT 0
);

-- 支出：その他費用
CREATE TABLE other_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  notes TEXT,
  sort_order INTEGER DEFAULT 0
);

-- RLS
ALTER TABLE expeditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE accommodation_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE other_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON expeditions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON income_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON accommodation_costs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON meal_costs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON transport_costs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON other_costs FOR ALL USING (true) WITH CHECK (true);

-- 個別経費管理（教員・外部指導者の食事/宿泊/公共交通）
CREATE TABLE IF NOT EXISTS member_meal_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  breakfast_status TEXT DEFAULT 'eat',
  lunch_status TEXT DEFAULT 'eat',
  dinner_status TEXT DEFAULT 'eat',
  UNIQUE(member_id, date)
);

CREATE TABLE IF NOT EXISTS member_transport_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  transport_type TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  amount INTEGER DEFAULT 0,
  travel_date DATE,
  notes TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS member_accommodation_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT '1泊2食',
  unit_price INTEGER DEFAULT 0,
  breakfast_price INTEGER DEFAULT 0,
  nights INTEGER DEFAULT 1,
  start_date DATE,
  end_date DATE,
  subsidy_amount INTEGER DEFAULT 0,
  notes TEXT,
  UNIQUE(member_id)
);

ALTER TABLE member_meal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_transport_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_accommodation_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON member_meal_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON member_transport_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON member_accommodation_records FOR ALL USING (true) WITH CHECK (true);
