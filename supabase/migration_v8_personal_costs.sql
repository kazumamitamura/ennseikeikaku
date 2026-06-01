-- ============================================================
-- migration_v8_personal_costs.sql
-- ②補助単価マスター + ③個人別宿泊・食事マトリクス
-- Supabase SQL Editor で実行すること
-- ============================================================

-- A. 補助単価マスター
CREATE TABLE IF NOT EXISTS subsidy_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  accommodation_rate INTEGER DEFAULT 0,
  breakfast_rate     INTEGER DEFAULT 0,
  lunch_rate         INTEGER DEFAULT 0,
  dinner_rate        INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subsidy_rates ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_subsidy_rates'
  ) THEN
    CREATE POLICY "allow_all_subsidy_rates"
      ON subsidy_rates FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- B. 個人別 宿泊・食事費
CREATE TABLE IF NOT EXISTS personal_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE NOT NULL,
  member_id     UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,

  item_type TEXT NOT NULL CHECK (item_type IN (
    'accommodation', 'breakfast', 'lunch', 'dinner'
  )),
  date DATE NOT NULL,

  actual_amount  INTEGER DEFAULT 0,
  subsidy_amount INTEGER DEFAULT 0,

  is_subsidy_target BOOLEAN DEFAULT true,
  is_skipped        BOOLEAN DEFAULT false,
  skip_reason       TEXT,

  auto_excluded       BOOLEAN DEFAULT false,
  auto_exclude_reason TEXT,

  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(expedition_id, member_id, date, item_type)
);

ALTER TABLE personal_costs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_personal_costs'
  ) THEN
    CREATE POLICY "allow_all_personal_costs"
      ON personal_costs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pc_expedition ON personal_costs(expedition_id);
CREATE INDEX IF NOT EXISTS idx_pc_member     ON personal_costs(member_id);
CREATE INDEX IF NOT EXISTS idx_pc_date_type  ON personal_costs(expedition_id, date, item_type);

CREATE OR REPLACE FUNCTION update_updated_at_col()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'pc_updated_at'
  ) THEN
    CREATE TRIGGER pc_updated_at
      BEFORE UPDATE ON personal_costs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_col();
  END IF;
END $$;

-- C. income_items subsidy_auto 重複防止
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'income_items_exp_cat_unique'
  ) THEN
    ALTER TABLE income_items
      ADD CONSTRAINT income_items_exp_cat_unique
      UNIQUE (expedition_id, category);
  END IF;
END $$;
