-- accommodation_costs に食事単価・補助フィールドを追加
ALTER TABLE accommodation_costs
  ADD COLUMN IF NOT EXISTS breakfast_subsidy INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lunch_price       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lunch_subsidy     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dinner_price      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dinner_subsidy    INTEGER DEFAULT 0;
