-- ============================================================
-- migration_v7_subsidy_person_items.sql
-- 「人 × 費用区分 × 日付」で補助対象費を個人管理
-- Supabase SQL Editor で実行すること
-- ============================================================

-- ============================================================
-- 1. subsidy_person_items テーブル（新規作成）
-- ============================================================
CREATE TABLE IF NOT EXISTS subsidy_person_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,

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

-- RLS
ALTER TABLE subsidy_person_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_subsidy_person_items"
  ON subsidy_person_items FOR ALL USING (true) WITH CHECK (true);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_spi_expedition
  ON subsidy_person_items(expedition_id);
CREATE INDEX IF NOT EXISTS idx_spi_member
  ON subsidy_person_items(member_id);
CREATE INDEX IF NOT EXISTS idx_spi_date_type
  ON subsidy_person_items(expedition_id, date, item_type);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'spi_updated_at'
  ) THEN
    CREATE TRIGGER spi_updated_at
      BEFORE UPDATE ON subsidy_person_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================================
-- 2. members テーブルへの追加カラム
-- ============================================================
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS is_subsidy_eligible BOOLEAN DEFAULT true;

-- ============================================================
-- 3. income_items の UNIQUE 制約（subsidy_auto の重複防止）
-- ============================================================
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
