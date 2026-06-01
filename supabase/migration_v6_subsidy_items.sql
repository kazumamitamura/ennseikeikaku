-- ============================================================
-- migration_v6_subsidy_items.sql
-- 補助対象費テーブル（新規作成）+ expeditions カラム追加
-- Supabase SQL Editor で実行すること
-- ============================================================

-- ============================================================
-- 1. 補助対象費テーブル（新規作成）
-- 宿泊・食事の補助額と実支出を一元管理
-- ============================================================
CREATE TABLE IF NOT EXISTS subsidy_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE NOT NULL,

  -- 日付・区分
  date DATE NOT NULL,
  item_type TEXT NOT NULL,
  -- 'accommodation' | 'breakfast' | 'lunch' | 'dinner'

  -- 補助対象フラグ（移動日ルールで自動制御、手動オーバーライド可）
  is_subsidy_target BOOLEAN DEFAULT true,
  subsidy_rule_reason TEXT,

  -- 人数
  subsidy_target_count INTEGER DEFAULT 0,
  non_subsidy_count    INTEGER DEFAULT 0,
  skip_count           INTEGER DEFAULT 0,

  -- 金額（円）
  subsidy_amount_per_person INTEGER DEFAULT 0,
  actual_amount_per_person  INTEGER DEFAULT 0,

  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 同日・同区分は1レコードのみ
  UNIQUE(expedition_id, date, item_type)
);

-- RLSポリシー
ALTER TABLE subsidy_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_subsidy_items"
  ON subsidy_items FOR ALL USING (true) WITH CHECK (true);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_subsidy_items_expedition
  ON subsidy_items(expedition_id, date, item_type);

-- ============================================================
-- 2. expeditions テーブルへの追加カラム
-- ============================================================
ALTER TABLE expeditions
  ADD COLUMN IF NOT EXISTS move_in_date  DATE,
  ADD COLUMN IF NOT EXISTS move_out_date DATE,
  ADD COLUMN IF NOT EXISTS subsidy_target_roles TEXT[] DEFAULT ARRAY['athlete', 'advisor'];

-- ============================================================
-- 3. income_items に subsidy_auto 用の部分ユニークインデックス
-- （1遠征につき補助自動計上レコードは1件のみ）
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS income_items_subsidy_auto_idx
  ON income_items(expedition_id)
  WHERE category = 'subsidy_auto';
