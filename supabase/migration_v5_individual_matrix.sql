-- migration_v5_individual_matrix.sql
-- 宿泊を個人×日付形式に変更し、食事レコードに価格列を追加

-- 1. 既存の宿泊レコードをクリア（スキーマ変更のため古いデータは使用不可）
TRUNCATE TABLE member_accommodation_records;

-- 2. 古い UNIQUE(member_id) 制約を削除
ALTER TABLE member_accommodation_records
  DROP CONSTRAINT IF EXISTS member_accommodation_records_member_id_key;

-- 3. date 列を追加（宿泊する夜の日付 = チェックイン日）
ALTER TABLE member_accommodation_records
  ADD COLUMN IF NOT EXISTS date DATE;

-- 4. stays 列を追加（その夜に宿泊するか）
ALTER TABLE member_accommodation_records
  ADD COLUMN IF NOT EXISTS stays BOOLEAN NOT NULL DEFAULT true;

-- 5. 既存レコードがある場合に備えてデフォルト日付を設定してから NOT NULL 化
UPDATE member_accommodation_records SET date = CURRENT_DATE WHERE date IS NULL;

ALTER TABLE member_accommodation_records
  ALTER COLUMN date SET NOT NULL;

-- 6. 新しい UNIQUE 制約（member_id + date）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'member_accommodation_records_member_date_key'
  ) THEN
    ALTER TABLE member_accommodation_records
      ADD CONSTRAINT member_accommodation_records_member_date_key
      UNIQUE(member_id, date);
  END IF;
END $$;

-- 7. 食事レコードに価格列を追加（1食あたりの金額）
ALTER TABLE member_meal_records
  ADD COLUMN IF NOT EXISTS breakfast_price INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lunch_price INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dinner_price INTEGER NOT NULL DEFAULT 0;
