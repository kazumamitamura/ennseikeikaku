-- 生徒/教員の支出分離用マイグレーション（既存DBに実行）

ALTER TABLE accommodation_costs
  ADD COLUMN IF NOT EXISTS staff_unit_price INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS staff_breakfast_price INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS staff_subsidy_per_person INTEGER DEFAULT 0;

ALTER TABLE meal_costs
  ADD COLUMN IF NOT EXISTS student_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS staff_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS staff_unit_price INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subsidy_student_count INTEGER DEFAULT 0;

UPDATE meal_costs SET
  student_count = COALESCE(NULLIF(student_count, 0), target_count),
  staff_count = COALESCE(NULLIF(staff_count, 0), non_target_count),
  subsidy_student_count = COALESCE(NULLIF(subsidy_student_count, 0), subsidy_count)
WHERE student_count = 0 AND staff_count = 0;

ALTER TABLE transport_costs
  ADD COLUMN IF NOT EXISTS student_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS staff_amount INTEGER DEFAULT 0;

UPDATE transport_costs SET
  student_amount = CASE WHEN student_amount = 0 AND staff_amount = 0 THEN amount ELSE student_amount END
WHERE student_amount = 0 AND staff_amount = 0;
