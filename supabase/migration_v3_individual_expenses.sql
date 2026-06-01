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
