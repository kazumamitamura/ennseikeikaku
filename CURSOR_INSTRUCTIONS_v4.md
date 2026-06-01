# 🏋️ 遠征収支管理システム - Cursor命令書 v4.0
## 機能: ②補助単価マスター + ③個人別宿泊・食事マトリクス
## 対象: ennseikeikaku / Next.js + Supabase + Vercel
## 作成: 2026年6月

---

## ⚡ このタスクで実装する内容

現在の「選手・監督 補助対象費」セクションを以下の2層構造に完全置き換えする。

### ② 選手・監督 補助対象費（補助単価マスター）
- 宿泊・朝食・昼食・夕食の **補助単価を登録するだけ** のシンプルな4項目フォーム
- 移動日ルールの説明のみ表示（計算はここでしない）

### ③ 個人別 宿泊・食事マトリクス（新設）
- **人 × 費用区分** の表形式で実支出を入力
- ②の補助単価が自動引かれ、差額（実質学校負担）をリアルタイム表示
- **個人ごとに宿泊代が異なる場合も対応**（セル個別編集）
- 欠席・不食は「skip」で除外（その日その人の費用ゼロ）
- 応援生徒など補助対象外は個別に切り替え可能
- 役職別グループ選択 → 一括入力パネルで同金額を複数人に一括登録

### サマリー自動計算
- 補助合計 → 収入として自動計上
- 実支出合計・差額合計 → 収支に反映

---

## 📋 Step 0: 作業前に必ず確認すること

```bash
# 現状のファイル構成確認
ls src/app/expedition/
ls src/components/expedition/
ls src/types/
cat src/types/expedition.ts
cat src/lib/calculations.ts

# 現在のSubsidyセクション関連ファイルを確認
# （存在するものは削除せず、新仕様に置き換える）
cat src/components/expedition/SubsidySection.tsx 2>/dev/null || echo "not found"
cat src/lib/subsidyApi.ts 2>/dev/null || echo "not found"
cat src/lib/subsidyCalculations.ts 2>/dev/null || echo "not found"
```

---

## 🗄️ Step 1: Supabaseマイグレーション

**Supabase SQL Editor** で実行すること。

```sql
-- ============================================================
-- A. 補助単価マスター（遠征ごとの補助単価設定）
-- ============================================================
CREATE TABLE IF NOT EXISTS subsidy_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  accommodation_rate INTEGER DEFAULT 0,  -- 宿泊補助単価（/人/泊）
  breakfast_rate     INTEGER DEFAULT 0,  -- 朝食補助単価（/人）
  lunch_rate         INTEGER DEFAULT 0,  -- 昼食補助単価（/人）
  dinner_rate        INTEGER DEFAULT 0,  -- 夕食補助単価（/人）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subsidy_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_subsidy_rates"
  ON subsidy_rates FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- B. 個人別 宿泊・食事費（人 × 費用区分 × 日付）
-- ============================================================
CREATE TABLE IF NOT EXISTS personal_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE NOT NULL,
  member_id     UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,

  -- 費用区分
  item_type TEXT NOT NULL CHECK (item_type IN (
    'accommodation', 'breakfast', 'lunch', 'dinner'
  )),
  date DATE NOT NULL,

  -- 金額
  actual_amount  INTEGER DEFAULT 0,   -- 実際の支出額（個人ごとに異なる場合あり）
  subsidy_amount INTEGER DEFAULT 0,   -- 適用された補助額（マスターから自動セット、手動上書き可）
  -- net_amount = actual_amount - subsidy_amount → アプリ側で計算

  -- 状態フラグ
  is_subsidy_target BOOLEAN DEFAULT true,  -- 補助対象か否か（応援など対象外は false）
  is_skipped        BOOLEAN DEFAULT false, -- 欠席・不食（朝食なし等）→ 費用ゼロ扱い
  skip_reason       TEXT,                  -- スキップ理由（'朝食なし', '欠席' など）

  -- 移動日ルール自動判定結果（参照用）
  auto_excluded        BOOLEAN DEFAULT false,
  auto_exclude_reason  TEXT,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(expedition_id, member_id, date, item_type)
);

ALTER TABLE personal_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_personal_costs"
  ON personal_costs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pc_expedition ON personal_costs(expedition_id);
CREATE INDEX IF NOT EXISTS idx_pc_member     ON personal_costs(member_id);
CREATE INDEX IF NOT EXISTS idx_pc_date_type  ON personal_costs(expedition_id, date, item_type);

-- updated_at トリガー
CREATE OR REPLACE FUNCTION update_updated_at_col()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pc_updated_at
  BEFORE UPDATE ON personal_costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_col();

-- ============================================================
-- C. income_items に subsidy_auto の重複防止制約
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
```

---

## 📦 Step 2: 型定義

**`src/types/expedition.ts`** に追記（既存は削除しない）

```typescript
// ============================================================
// 補助単価マスター
// ============================================================
export interface SubsidyRates {
  id?: string;
  expedition_id: string;
  accommodation_rate: number; // 宿泊補助単価（/人/泊）
  breakfast_rate:     number; // 朝食補助単価（/人）
  lunch_rate:         number; // 昼食補助単価（/人）
  dinner_rate:        number; // 夕食補助単価（/人）
}

// item_type → 補助単価のキー名マッピング
export const RATE_KEY: Record<PersonalCostItemType, keyof SubsidyRates> = {
  accommodation: 'accommodation_rate',
  breakfast:     'breakfast_rate',
  lunch:         'lunch_rate',
  dinner:        'dinner_rate',
};

// ============================================================
// 個人別費用
// ============================================================
export type PersonalCostItemType =
  | 'accommodation'
  | 'breakfast'
  | 'lunch'
  | 'dinner';

export const ITEM_LABELS: Record<PersonalCostItemType, string> = {
  accommodation: '🏨 宿泊',
  breakfast:     '🍳 朝食',
  lunch:         '🥗 昼食',
  dinner:        '🍱 夕食',
};

export const ITEM_ORDER: PersonalCostItemType[] = [
  'accommodation', 'breakfast', 'lunch', 'dinner'
];

export interface PersonalCost {
  id: string;
  expedition_id: string;
  member_id: string;
  item_type: PersonalCostItemType;
  date: string;            // YYYY-MM-DD
  actual_amount: number;   // 実支出額（個人ごとに異なる場合あり）
  subsidy_amount: number;  // 適用補助額
  is_subsidy_target: boolean;
  is_skipped: boolean;
  skip_reason?: string;
  auto_excluded: boolean;
  auto_exclude_reason?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// 計算済み行
export interface PersonalCostCalc extends PersonalCost {
  net_amount: number;         // 差額 = actual - subsidy（is_subsidy_target=falseなら actual のまま）
  effective_subsidy: number;  // 実効補助額（skipped or 対象外なら 0）
}

// 役職ラベル・グループ
export type MemberRoleType =
  | 'athlete' | 'advisor' | 'second'
  | 'external' | 'supporter' | 'staff' | 'other';

export const ROLE_LABELS: Record<MemberRoleType, string> = {
  athlete:   '選手',
  advisor:   '顧問',
  second:    'セコンド',
  external:  '外部指導者',
  supporter: '応援',
  staff:     '引率',
  other:     'その他',
};

// デフォルト補助対象ロール
export const SUBSIDY_TARGET_ROLES: MemberRoleType[] = ['athlete', 'advisor', 'second'];

// 役職グループ（表示用）
export const ROLE_GROUPS = [
  { label: '選手・セコンド・顧問',    roles: ['athlete', 'second', 'advisor'] as MemberRoleType[] },
  { label: '外部指導者・引率',        roles: ['external', 'staff']           as MemberRoleType[] },
  { label: '応援・その他',            roles: ['supporter', 'other']          as MemberRoleType[] },
];
```

---

## 🧮 Step 3: 計算ロジック

**`src/lib/personalCostCalc.ts`**（新規作成）

```typescript
import type {
  PersonalCost, PersonalCostCalc, PersonalCostItemType,
  SubsidyRates, MemberRoleType
} from '@/types/expedition';
import { SUBSIDY_TARGET_ROLES, RATE_KEY } from '@/types/expedition';

// 1行計算
export function calcRow(item: PersonalCost): PersonalCostCalc {
  if (item.is_skipped) {
    return { ...item, net_amount: 0, effective_subsidy: 0 };
  }
  const effective_subsidy = item.is_subsidy_target ? item.subsidy_amount : 0;
  const net_amount = Math.max(0, item.actual_amount - effective_subsidy);
  return { ...item, net_amount, effective_subsidy };
}

// 全行サマリー
export function calcSummary(items: PersonalCost[]) {
  const rows = items.map(calcRow);
  const accRows  = rows.filter(r => r.item_type === 'accommodation');
  const mealRows = rows.filter(r => r.item_type !== 'accommodation');

  const sum = (arr: PersonalCostCalc[], key: keyof PersonalCostCalc) =>
    arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);

  return {
    accommodation_actual:  sum(accRows,  'actual_amount'),
    accommodation_subsidy: sum(accRows,  'effective_subsidy'),
    accommodation_net:     sum(accRows,  'net_amount'),
    meal_actual:           sum(mealRows, 'actual_amount'),
    meal_subsidy:          sum(mealRows, 'effective_subsidy'),
    meal_net:              sum(mealRows, 'net_amount'),
    total_actual:          sum(rows,     'actual_amount'),
    total_subsidy:         sum(rows,     'effective_subsidy'),
    total_net:             sum(rows,     'net_amount'),
  };
}

// 移動日ルール判定
export function autoExcludeCheck(
  itemType: PersonalCostItemType,
  date: string,
  startDate: string,
  endDate: string
): { excluded: boolean; reason?: string } {
  if (date === startDate) {
    if (itemType === 'breakfast') return { excluded: true, reason: '移動初日・朝食は対象外' };
    if (itemType === 'lunch')     return { excluded: true, reason: '移動初日・昼食は対象外' };
    if (itemType === 'accommodation') return { excluded: false }; // 初日宿泊はOK
  }
  if (date === endDate) {
    if (itemType === 'dinner')        return { excluded: true,  reason: '最終日・夕食は対象外' };
    if (itemType === 'accommodation') return { excluded: true,  reason: '最終日・宿泊なし' };
  }
  return { excluded: false };
}

// 日付リスト生成
export function makeDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end   + 'T00:00:00');
  for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1))
    dates.push(d.toISOString().split('T')[0]);
  return dates;
}

// 日本語日付
export function jpDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  const w = ['日','月','火','水','木','金','土'];
  return `${dt.getMonth()+1}/${dt.getDate()}(${w[dt.getDay()]})`;
}

// 役職が補助対象かどうか
export function isSubsidyEligible(role: MemberRoleType): boolean {
  return SUBSIDY_TARGET_ROLES.includes(role);
}

// マスター単価からこの行の補助額を決める
export function rateForItem(
  itemType: PersonalCostItemType,
  rates: SubsidyRates
): number {
  return rates[RATE_KEY[itemType]] as number ?? 0;
}

// 金額表示
export function yen(n: number): string {
  return `¥${Math.round(n || 0).toLocaleString('ja-JP')}`;
}
```

---

## 🌐 Step 4: Supabase APIレイヤー

**`src/lib/personalCostApi.ts`**（新規作成）

```typescript
import { supabase } from './supabase';
import type {
  SubsidyRates, PersonalCost, PersonalCostItemType
} from '@/types/expedition';
import { autoExcludeCheck, isSubsidyEligible, rateForItem, makeDateRange } from './personalCostCalc';

// ---- 補助単価マスター ----

export async function getSubsidyRates(expeditionId: string): Promise<SubsidyRates | null> {
  const { data } = await supabase
    .from('subsidy_rates')
    .select('*')
    .eq('expedition_id', expeditionId)
    .maybeSingle();
  return data;
}

export async function saveSubsidyRates(rates: SubsidyRates): Promise<void> {
  const { error } = await supabase
    .from('subsidy_rates')
    .upsert({ ...rates, updated_at: new Date().toISOString() },
      { onConflict: 'expedition_id' });
  if (error) throw error;
}

// ---- 個人費用 ----

export async function getPersonalCosts(expeditionId: string): Promise<PersonalCost[]> {
  const { data, error } = await supabase
    .from('personal_costs')
    .select('*')
    .eq('expedition_id', expeditionId)
    .order('member_id').order('date').order('item_type');
  if (error) throw error;
  return data ?? [];
}

// 1行 upsert（セル編集・個別保存）
export async function upsertPersonalCost(
  row: Omit<PersonalCost, 'id' | 'created_at' | 'updated_at'>
): Promise<PersonalCost> {
  const { data, error } = await supabase
    .from('personal_costs')
    .upsert(row, { onConflict: 'expedition_id,member_id,date,item_type' })
    .select().single();
  if (error) throw error;
  return data;
}

// 一括 upsert（一括入力パネルから）
export async function bulkUpsertPersonalCosts(rows: Omit<PersonalCost, 'id'|'created_at'|'updated_at'>[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from('personal_costs')
    .upsert(rows, { onConflict: 'expedition_id,member_id,date,item_type' });
  if (error) throw error;
}

// フラグ更新（補助対象切替・skip切替）
export async function updatePersonalCostFlag(
  id: string,
  patch: Partial<Pick<PersonalCost, 'is_subsidy_target' | 'is_skipped' | 'skip_reason' | 'subsidy_amount'>>
): Promise<void> {
  const { error } = await supabase
    .from('personal_costs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// 削除（1行）
export async function deletePersonalCost(id: string): Promise<void> {
  const { error } = await supabase.from('personal_costs').delete().eq('id', id);
  if (error) throw error;
}

// 補助総額を income_items に自動同期
export async function syncSubsidyToIncome(
  expeditionId: string,
  totalSubsidy: number,
  breakdown: { accommodation: number; meal: number }
): Promise<void> {
  const { error } = await supabase
    .from('income_items')
    .upsert({
      expedition_id: expeditionId,
      category: 'subsidy_auto',
      label: '補助金（宿泊・食事）自動計上',
      amount: totalSubsidy,
      notes: `宿泊補助: ¥${breakdown.accommodation.toLocaleString()} / 食事補助: ¥${breakdown.meal.toLocaleString()}`,
    }, { onConflict: 'expedition_id,category' });
  if (error) throw error;
}
```

---

## 🎨 Step 5: UIコンポーネント実装

---

### 5-A. 補助単価マスター（② セクション）

**`src/components/expedition/SubsidyRatesForm.tsx`**（新規作成）

```tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { SubsidyRates } from '@/types/expedition';
import { getSubsidyRates, saveSubsidyRates } from '@/lib/personalCostApi';
import { yen } from '@/lib/personalCostCalc';

interface Props {
  expeditionId: string;
  onRatesChange: (rates: SubsidyRates) => void;
}

const FIELDS: { key: keyof SubsidyRates; label: string; hint: string }[] = [
  { key: 'accommodation_rate', label: '宿泊補助単価',  hint: '1人1泊あたり' },
  { key: 'breakfast_rate',     label: '朝食補助単価',  hint: '1人1食あたり' },
  { key: 'lunch_rate',         label: '昼食補助単価',  hint: '1人1食あたり' },
  { key: 'dinner_rate',        label: '夕食補助単価',  hint: '1人1食あたり' },
];

export default function SubsidyRatesForm({ expeditionId, onRatesChange }: Props) {
  const [rates, setRates] = useState<SubsidyRates>({
    expedition_id: expeditionId,
    accommodation_rate: 0,
    breakfast_rate: 0,
    lunch_rate: 0,
    dinner_rate: 0,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSubsidyRates(expeditionId).then(r => {
      if (r) { setRates(r); onRatesChange(r); }
    });
  }, [expeditionId, onRatesChange]);

  const handleChange = (key: keyof SubsidyRates, value: number) => {
    const next = { ...rates, [key]: value };
    setRates(next);
    onRatesChange(next);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSubsidyRates(rates);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <span className="text-base">🏦</span>
          選手・監督 補助対象費
        </h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-800 text-white hover:bg-blue-900 disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving ? '保存中...' : saved ? '✓ 保存済み' : '💾 保存'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        補助単価を登録します。個人への適用は下の③で行います。
      </p>

      {/* 4項目入力 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {FIELDS.map(f => (
          <div key={f.key}>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              {f.label}
            </label>
            <div className="text-xs text-gray-400 mb-1">{f.hint}</div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">¥</span>
              <input
                type="number"
                min="0"
                step="1"
                value={rates[f.key] as number || ''}
                onChange={e => handleChange(f.key, parseInt(e.target.value) || 0)}
                onFocus={e => e.target.select()}
                placeholder="0"
                className="w-full border-2 border-gray-200 rounded-lg px-2 py-1.5 text-right text-sm font-bold focus:border-blue-600 outline-none"
              />
            </div>
          </div>
        ))}
      </div>

      {/* 移動日ルール説明 */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
        <span className="mt-0.5 flex-shrink-0">⚠️</span>
        <span>
          移動日ルール：<strong>初日の朝食・昼食</strong>、<strong>最終日の夕食・宿泊</strong>は補助対象外として自動処理されます。
          個別に変更したい場合は③のマトリクスで切り替えてください。
        </span>
      </div>
    </div>
  );
}
```

---

### 5-B. 個人別マトリクス（③ セクション）

**`src/components/expedition/PersonalCostMatrix.tsx`**（新規作成）

#### UIの完全仕様

```
【一括入力パネル展開時】

╔══════════════════════════════════════════════════════════╗
║ 一括入力                                          [×閉じる] ║
║──────────────────────────────────────────────────────────║
║ 費用区分 [🏨 宿泊 ▼]   日付 [6/19(木) ▼]               ║
║                                                          ║
║ 対象者を選択                           [全選択] [全解除] ║
║ ┌────────────────────────────────────────────────────┐   ║
║ │ 選手・セコンド・顧問（10名）        [グループ全選択] │   ║
║ │ ☑田中〇〇  ☑佐藤〇〇  ☑遠藤〇〇  ☑石川〇〇      │   ║
║ ├────────────────────────────────────────────────────┤   ║
║ │ 応援・その他（3名）                 [グループ全選択] │   ║
║ │ □加藤〇〇  □〇〇  □〇〇                           │   ║
║ └────────────────────────────────────────────────────┘   ║
║                                                          ║
║ 実支出額（/人） ¥[14,000]   補助対象 [✓補助あり ▼]      ║
║ 補助額（/人）   ¥[12,000]   差額:  ¥2,000/人            ║
║                                                          ║
║ ※選択者によって金額が違う場合は後でセルを個別編集できます ║
║ ⚠️ 初日(6/19)の朝食・昼食は補助対象外（自動除外）        ║
║                                                          ║
║ 選択中: 10名          [キャンセル]  [10名に一括登録]      ║
╚══════════════════════════════════════════════════════════╝

【マトリクス本体】

フィルター: [日付：全日 ▼] [区分：全て ▼] [役職：全て ▼]  [＋一括入力]

──────────────────────────────────────────────────────────────────
氏名        役職   区分     日付      実支出    補助額    差額     補助
──────────────────────────────────────────────────────────────────
田中〇〇    選手   🏨宿泊   6/19(木)  [14,000]  12,000  ¥2,000   ✓ [⋮]
            選手   🍱夕食   6/19(木)  [  900]     435   ¥465     ✓ [⋮]
            選手   🍳朝食   6/20(金)  [  864]     864   ¥0       ✓ [⋮]
────────────────────────────────────────────────────────────────
佐藤〇〇    選手   🏨宿泊   6/19(木)  [14,000]  12,000  ¥2,000   ✓ [⋮]
            選手   🍳朝食   6/20(金)   欠席      —       —       skip[⋮]
────────────────────────────────────────────────────────────────
加藤〇〇    応援   🍳朝食   6/19(木)  [  900]     —     ¥900     ✗ [⋮]
（グレー行 = 補助対象外または応援）
──────────────────────────────────────────────────────────────────
合計                                  ¥XXX,XXX  ¥XXX,XXX ¥XXX,XXX
                                                 ↑収入計上

⋮メニュー展開時:
  ┌─────────────────────┐
  │ ✏️ 金額を編集         │
  │ 🔄 補助対象外に変更   │← is_subsidy_target = false
  │ ⏭️ 欠席にする         │← is_skipped = true
  │ 📋 他の人にも同内容   │← BulkInputを開き、この行の金額をプリセット
  │ 🗑️ この行を削除       │
  └─────────────────────┘
```

**実装コード:**

```tsx
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  PersonalCost, PersonalCostItemType, SubsidyRates,
  MemberRoleType
} from '@/types/expedition';
import {
  ITEM_LABELS, ITEM_ORDER, ROLE_LABELS, ROLE_GROUPS, SUBSIDY_TARGET_ROLES
} from '@/types/expedition';
import {
  calcRow, calcSummary, autoExcludeCheck,
  makeDateRange, jpDate, isSubsidyEligible, rateForItem, yen
} from '@/lib/personalCostCalc';
import {
  getPersonalCosts, upsertPersonalCost, bulkUpsertPersonalCosts,
  updatePersonalCostFlag, deletePersonalCost, syncSubsidyToIncome
} from '@/lib/personalCostApi';

interface Member {
  id: string;
  name: string;
  role: MemberRoleType;
}

interface Props {
  expeditionId: string;
  members: Member[];
  startDate: string;
  endDate: string;
  rates: SubsidyRates;
  onSummaryChange?: (s: ReturnType<typeof calcSummary>) => void;
}

export default function PersonalCostMatrix({
  expeditionId, members, startDate, endDate, rates, onSummaryChange
}: Props) {

  const [rows, setRows] = useState<PersonalCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBulk, setShowBulk] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [filterDate, setFilterDate] = useState('all');
  const [filterType, setFilterType] = useState<PersonalCostItemType | 'all'>('all');
  const [filterRole, setFilterRole] = useState<MemberRoleType | 'all'>('all');
  const dates = makeDateRange(startDate, endDate);

  // データ読み込み
  const load = useCallback(async () => {
    setLoading(true);
    const data = await getPersonalCosts(expeditionId);
    setRows(data);
    const summary = calcSummary(data);
    onSummaryChange?.(summary);
    // 補助総額を収入に自動同期
    await syncSubsidyToIncome(expeditionId, summary.total_subsidy, {
      accommodation: summary.accommodation_subsidy,
      meal: summary.meal_subsidy,
    });
    setLoading(false);
  }, [expeditionId, onSummaryChange]);

  useEffect(() => { load(); }, [load]);

  // フィルタリング後の行（メンバー順 → 日付順 → item_type順）
  const filteredRows = rows
    .filter(r => {
      const m = members.find(m => m.id === r.member_id);
      if (filterDate !== 'all' && r.date !== filterDate) return false;
      if (filterType !== 'all' && r.item_type !== filterType) return false;
      if (filterRole !== 'all' && m?.role !== filterRole) return false;
      return true;
    })
    .sort((a, b) => {
      // メンバー順（名簿順）→日付→item_type順
      const ai = members.findIndex(m => m.id === a.member_id);
      const bi = members.findIndex(m => m.id === b.member_id);
      if (ai !== bi) return ai - bi;
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return ITEM_ORDER.indexOf(a.item_type) - ITEM_ORDER.indexOf(b.item_type);
    });

  // インライン金額編集
  const startEdit = (row: PersonalCost) => {
    setEditingId(row.id);
    setEditVal(row.actual_amount.toString());
  };
  const commitEdit = async (row: PersonalCost) => {
    const newVal = parseInt(editVal) || 0;
    if (newVal === row.actual_amount) { setEditingId(null); return; }
    const next = { ...row, actual_amount: newVal };
    await upsertPersonalCost(next);
    setEditingId(null);
    load();
  };

  // コンテキストメニューアクション
  const ctxRow = rows.find(r => r.id === contextMenu?.id);
  const handleCtxAction = async (action: string) => {
    if (!ctxRow) return;
    setContextMenu(null);
    switch (action) {
      case 'toggle_subsidy':
        await updatePersonalCostFlag(ctxRow.id, {
          is_subsidy_target: !ctxRow.is_subsidy_target,
          subsidy_amount: !ctxRow.is_subsidy_target ? rateForItem(ctxRow.item_type, rates) : 0,
        });
        break;
      case 'skip':
        await updatePersonalCostFlag(ctxRow.id, { is_skipped: !ctxRow.is_skipped });
        break;
      case 'delete':
        if (confirm('この行を削除しますか？')) await deletePersonalCost(ctxRow.id);
        break;
    }
    load();
  };

  // サマリー計算
  const summary = calcSummary(rows);

  return (
    <div className="space-y-3">
      {/* セクションヘッダー */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="text-base">📋</span>
            個人別 宿泊・食事マトリクス
          </h3>
          <button
            onClick={() => setShowBulk(true)}
            className="text-xs font-bold px-3 py-2 rounded-lg bg-blue-800 text-white hover:bg-blue-900 flex items-center gap-1.5"
          >
            ＋ 一括入力
          </button>
        </div>
        <p className="text-xs text-gray-500">
          実支出を入力すると②の補助単価が自動適用されます。金額セルをクリックで個別編集できます。
        </p>
      </div>

      {/* 一括入力パネル */}
      {showBulk && (
        <BulkInputPanel
          expeditionId={expeditionId}
          members={members}
          startDate={startDate}
          endDate={endDate}
          rates={rates}
          onComplete={() => { setShowBulk(false); load(); }}
          onCancel={() => setShowBulk(false)}
        />
      )}

      {/* フィルター */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex flex-wrap gap-2 items-center text-xs">
        <select
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
        >
          <option value="all">日付：全日</option>
          {dates.map(d => <option key={d} value={d}>{jpDate(d)}</option>)}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as PersonalCostItemType | 'all')}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
        >
          <option value="all">区分：全て</option>
          {ITEM_ORDER.map(t => <option key={t} value={t}>{ITEM_LABELS[t]}</option>)}
        </select>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value as MemberRoleType | 'all')}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
        >
          <option value="all">役職：全て</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) =>
            <option key={k} value={k}>{v}</option>
          )}
        </select>
        <span className="text-gray-400 text-xs ml-auto">{filteredRows.length}件表示</span>
      </div>

      {/* メインテーブル */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">読み込み中...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            データがありません。「＋ 一括入力」から登録してください。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" style={{ minWidth: '620px' }}>
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left">
                  <th className="px-3 py-2 font-bold uppercase text-xs" style={{ width: '110px' }}>氏名</th>
                  <th className="px-2 py-2 font-bold uppercase text-xs" style={{ width: '70px' }}>役職</th>
                  <th className="px-2 py-2 font-bold uppercase text-xs" style={{ width: '75px' }}>区分</th>
                  <th className="px-2 py-2 font-bold uppercase text-xs" style={{ width: '75px' }}>日付</th>
                  <th className="px-2 py-2 font-bold uppercase text-xs text-right">実支出</th>
                  <th className="px-2 py-2 font-bold uppercase text-xs text-right">補助額</th>
                  <th className="px-2 py-2 font-bold uppercase text-xs text-right">差額負担</th>
                  <th className="px-2 py-2 font-bold uppercase text-xs text-center" style={{ width: '56px' }}>補助</th>
                  <th style={{ width: '32px' }}></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let prevMemberId = '';
                  return filteredRows.map(row => {
                    const calc = calcRow(row);
                    const member = members.find(m => m.id === row.member_id);
                    const isNewMember = row.member_id !== prevMemberId;
                    prevMemberId = row.member_id;

                    const rowBg = row.is_skipped
                      ? 'bg-gray-100'
                      : !row.is_subsidy_target
                      ? 'bg-orange-50'
                      : '';
                    const textMuted = row.is_skipped
                      ? 'text-gray-400 italic line-through'
                      : '';

                    return (
                      <tr
                        key={row.id}
                        className={`${rowBg} ${isNewMember ? 'border-t-2 border-gray-200' : 'border-t border-gray-50'} hover:bg-blue-50/30 transition-colors`}
                      >
                        {/* 氏名（メンバーが変わった時のみ表示） */}
                        <td className="px-3 py-2 font-bold text-gray-800">
                          {isNewMember ? member?.name : ''}
                        </td>

                        {/* 役職バッジ */}
                        <td className="px-2 py-2">
                          {isNewMember && member && (
                            <RoleBadge role={member.role} />
                          )}
                        </td>

                        {/* 区分 */}
                        <td className={`px-2 py-2 ${textMuted}`}>
                          {ITEM_LABELS[row.item_type]}
                        </td>

                        {/* 日付 */}
                        <td className="px-2 py-2 text-gray-500">
                          {jpDate(row.date)}
                        </td>

                        {/* 実支出（クリックで編集） */}
                        <td className="px-2 py-2 text-right">
                          {row.is_skipped ? (
                            <span className="text-gray-400 italic text-xs">欠席</span>
                          ) : editingId === row.id ? (
                            <input
                              type="number" min="0" step="1"
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              onBlur={() => commitEdit(row)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') commitEdit(row);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="w-20 border-2 border-blue-400 rounded px-1 py-0.5 text-right text-xs font-bold outline-none"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => startEdit(row)}
                              className="font-bold text-gray-800 hover:bg-blue-100 rounded px-1 py-0.5 cursor-text text-right w-full"
                              title="クリックして編集"
                            >
                              {yen(row.actual_amount)}
                            </button>
                          )}
                        </td>

                        {/* 補助額 */}
                        <td className="px-2 py-2 text-right">
                          {row.is_skipped || !row.is_subsidy_target ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span className="text-green-700 font-bold">
                              {yen(row.subsidy_amount)}
                            </span>
                          )}
                        </td>

                        {/* 差額負担 */}
                        <td className="px-2 py-2 text-right">
                          {row.is_skipped ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span className={calc.net_amount > 0 ? 'text-amber-700 font-bold' : 'text-green-700 font-bold'}>
                              {calc.net_amount === 0 ? '¥0' : yen(calc.net_amount)}
                            </span>
                          )}
                        </td>

                        {/* 補助フラグ */}
                        <td className="px-2 py-2 text-center">
                          {row.is_skipped ? (
                            <span className="text-gray-400 text-xs">skip</span>
                          ) : row.auto_excluded ? (
                            <span className="text-xs text-gray-400" title={row.auto_exclude_reason || ''}>除外</span>
                          ) : row.is_subsidy_target ? (
                            <span className="text-green-600 font-bold text-sm">✓</span>
                          ) : (
                            <span className="text-red-500 font-bold text-sm">✗</span>
                          )}
                        </td>

                        {/* ⋮メニュー */}
                        <td className="px-1 py-2 text-center">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setContextMenu({ id: row.id, x: e.clientX, y: e.clientY });
                            }}
                            className="text-gray-400 hover:text-gray-700 px-1 text-base font-bold"
                          >⋮</button>
                        </td>
                      </tr>
                    );
                  });
                })()}

                {/* 合計行 */}
                <tr className="bg-gray-800 text-white">
                  <td colSpan={4} className="px-3 py-2 font-bold text-sm">合計</td>
                  <td className="px-2 py-2 text-right font-bold text-sm">
                    {yen(summary.total_actual)}
                  </td>
                  <td className="px-2 py-2 text-right font-bold text-sm text-green-300">
                    {yen(summary.total_subsidy)}
                    <span className="text-xs ml-1 opacity-70">↑収入</span>
                  </td>
                  <td className="px-2 py-2 text-right font-bold text-sm text-amber-300">
                    {yen(summary.total_net)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 補助対象費サマリー */}
      <PersonalCostSummary summary={summary} />

      {/* コンテキストメニュー */}
      {contextMenu && ctxRow && (
        <ContextMenu
          row={ctxRow}
          onAction={handleCtxAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

// ---- 補助対象費サマリー ----
function PersonalCostSummary({ summary }: { summary: ReturnType<typeof calcSummary> }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <span>📊</span> 補助対象費サマリー（全日程合計）
      </h4>
      <div className="grid grid-cols-3 gap-4 text-xs">
        {[
          { label: '宿泊費',  actual: summary.accommodation_actual,  subsidy: summary.accommodation_subsidy,  net: summary.accommodation_net },
          { label: '食事費',  actual: summary.meal_actual,           subsidy: summary.meal_subsidy,           net: summary.meal_net },
          { label: '合計',    actual: summary.total_actual,          subsidy: summary.total_subsidy,         net: summary.total_net },
        ].map(row => (
          <div key={row.label} className={`rounded-lg p-3 ${row.label === '合計' ? 'bg-gray-50 border border-gray-200' : ''}`}>
            <div className="font-bold text-gray-700 mb-2">
              {row.label === '宿泊費' ? '🏨' : row.label === '食事費' ? '🍱' : '📊'} {row.label}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">実支出</span>
                <span className="font-bold text-gray-800">{yen(row.actual)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">補助額</span>
                <span className="font-bold text-green-700">
                  {yen(row.subsidy)}
                  <span className="text-xs bg-green-100 text-green-700 px-1 rounded ml-1">収入</span>
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                <span className="text-gray-600 font-bold">差額負担</span>
                <span className="font-bold text-amber-700">{yen(row.net)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- 役職バッジ ----
function RoleBadge({ role }: { role: MemberRoleType }) {
  const styles: Record<string, string> = {
    athlete:   'bg-blue-50 text-blue-800',
    advisor:   'bg-purple-50 text-purple-800',
    second:    'bg-cyan-50 text-cyan-800',
    external:  'bg-orange-50 text-orange-800',
    supporter: 'bg-yellow-50 text-yellow-800',
    staff:     'bg-gray-100 text-gray-600',
    other:     'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${styles[role] || styles.other}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

// ---- コンテキストメニュー ----
function ContextMenu({
  row, onAction, onClose
}: {
  row: PersonalCost;
  onAction: (a: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-44"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
        <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2"
          onClick={() => onAction('toggle_subsidy')}>
          <span>🔄</span>
          {row.is_subsidy_target ? '補助対象外に変更' : '補助対象に戻す'}
        </button>
        <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2"
          onClick={() => onAction('skip')}>
          <span>⏭️</span>
          {row.is_skipped ? '欠席を解除' : '欠席にする（朝食なし等）'}
        </button>
        <div className="border-t border-gray-100 my-1" />
        <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
          onClick={() => onAction('delete')}>
          <span>🗑️</span> この行を削除
        </button>
        <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2"
          onClick={onClose}>
          <span>✕</span> 閉じる
        </button>
      </div>
    </>
  );
}
```

---

### 5-C. 一括入力パネル

**`src/components/expedition/BulkInputPanel.tsx`**（新規作成）

```tsx
'use client';
import { useState, useMemo } from 'react';
import type {
  SubsidyRates, PersonalCostItemType, MemberRoleType
} from '@/types/expedition';
import {
  ITEM_LABELS, ITEM_ORDER, ROLE_GROUPS, SUBSIDY_TARGET_ROLES
} from '@/types/expedition';
import {
  autoExcludeCheck, makeDateRange, jpDate, rateForItem, yen
} from '@/lib/personalCostCalc';
import { bulkUpsertPersonalCosts } from '@/lib/personalCostApi';

interface Member { id: string; name: string; role: MemberRoleType; }

interface Props {
  expeditionId: string;
  members: Member[];
  startDate: string;
  endDate: string;
  rates: SubsidyRates;
  presetItemType?: PersonalCostItemType;
  presetDate?: string;
  presetActual?: number;
  onComplete: () => void;
  onCancel: () => void;
}

export default function BulkInputPanel({
  expeditionId, members, startDate, endDate, rates,
  presetItemType, presetDate, presetActual,
  onComplete, onCancel
}: Props) {
  const dates = makeDateRange(startDate, endDate);
  const [itemType, setItemType] = useState<PersonalCostItemType>(presetItemType || 'accommodation');
  const [date, setDate] = useState(presetDate || dates[0] || startDate);
  const [actualAmount, setActualAmount] = useState(presetActual ?? 0);
  const [subsidyAmount, setSubsidyAmount] = useState(() =>
    rateForItem(presetItemType || 'accommodation', rates)
  );
  const [isSubsidyTarget, setIsSubsidyTarget] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // item_type か date が変わったら補助単価をマスターから再セット
  const autoEx = useMemo(
    () => autoExcludeCheck(itemType, date, startDate, endDate),
    [itemType, date, startDate, endDate]
  );

  const handleItemTypeChange = (t: PersonalCostItemType) => {
    setItemType(t);
    setSubsidyAmount(rateForItem(t, rates));
  };

  const netPerPerson = isSubsidyTarget && !autoEx.excluded
    ? Math.max(0, actualAmount - subsidyAmount)
    : actualAmount;

  const toggleMember = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGroup = (groupMembers: Member[]) => {
    const allOn = groupMembers.every(m => selectedIds.has(m.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      groupMembers.forEach(m => allOn ? next.delete(m.id) : next.add(m.id));
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      const effectiveSubsidy = (isSubsidyTarget && !autoEx.excluded) ? subsidyAmount : 0;
      const rows = Array.from(selectedIds).map(memberId => ({
        expedition_id: expeditionId,
        member_id: memberId,
        item_type: itemType,
        date,
        actual_amount: actualAmount,
        subsidy_amount: effectiveSubsidy,
        is_subsidy_target: isSubsidyTarget && !autoEx.excluded,
        is_skipped: false,
        auto_excluded: autoEx.excluded,
        auto_exclude_reason: autoEx.reason,
      }));
      await bulkUpsertPersonalCosts(rows);
      onComplete();
    } catch (e) {
      alert('登録に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border-2 border-blue-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-gray-800">一括入力</h4>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
      </div>

      {/* 費用区分 + 日付 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">費用区分</label>
          <select
            value={itemType}
            onChange={e => handleItemTypeChange(e.target.value as PersonalCostItemType)}
            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            {ITEM_ORDER.map(t => <option key={t} value={t}>{ITEM_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">日付</label>
          <select
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            {dates.map(d => <option key={d} value={d}>{jpDate(d)}</option>)}
          </select>
        </div>
      </div>

      {/* 移動日ルール警告 */}
      {autoEx.excluded && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 mb-3 flex items-start gap-2">
          <span className="flex-shrink-0">⚠️</span>
          <span>{autoEx.reason} — 補助額は自動的に¥0になります</span>
        </div>
      )}

      {/* 対象者選択 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-gray-500 uppercase">対象者を選択</label>
          <div className="flex gap-3 text-xs">
            <button onClick={() => setSelectedIds(new Set(members.map(m => m.id)))}
              className="text-blue-600 hover:underline">全選択</button>
            <button onClick={() => setSelectedIds(new Set())}
              className="text-gray-500 hover:underline">全解除</button>
          </div>
        </div>
        <div className="border-2 border-gray-100 rounded-xl overflow-hidden">
          {ROLE_GROUPS.map((group, gi) => {
            const gMembers = members.filter(m => group.roles.includes(m.role));
            if (gMembers.length === 0) return null;
            const allOn = gMembers.every(m => selectedIds.has(m.id));
            return (
              <div key={gi} className={gi > 0 ? 'border-t border-gray-100' : ''}>
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                  <span className="text-xs font-bold text-gray-600">
                    {group.label}（{gMembers.length}名）
                  </span>
                  <button
                    onClick={() => toggleGroup(gMembers)}
                    className="text-xs text-blue-600 hover:underline"
                  >{allOn ? '解除' : '全員選択'}</button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 p-2">
                  {gMembers.map(m => (
                    <label
                      key={m.id}
                      className={`
                        flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-xs
                        border transition-colors
                        ${selectedIds.has(m.id)
                          ? 'bg-blue-50 border-blue-300 text-blue-800'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}
                      `}
                    >
                      <input
                        type="checkbox"
                        className="w-3 h-3 flex-shrink-0"
                        checked={selectedIds.has(m.id)}
                        onChange={() => toggleMember(m.id)}
                      />
                      <span className="truncate">{m.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 金額入力 */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">実支出額（/人）</label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">¥</span>
            <input
              type="number" min="0" step="1"
              value={actualAmount || ''}
              onChange={e => setActualAmount(parseInt(e.target.value) || 0)}
              onFocus={e => e.target.select()}
              placeholder="0"
              className="w-full border-2 border-gray-200 rounded-lg px-2 py-2 text-right text-sm font-bold focus:border-blue-600 outline-none"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            ※金額が人によって異なる場合は後でセルを個別編集
          </p>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-2">
            補助額（/人）
            <select
              value={isSubsidyTarget ? 'yes' : 'no'}
              onChange={e => setIsSubsidyTarget(e.target.value === 'yes')}
              disabled={autoEx.excluded}
              className="border border-gray-200 rounded px-1.5 py-0.5 text-xs font-normal"
            >
              <option value="yes">補助あり</option>
              <option value="no">補助なし</option>
            </select>
          </label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">¥</span>
            <input
              type="number" min="0" step="1"
              value={subsidyAmount || ''}
              onChange={e => setSubsidyAmount(parseInt(e.target.value) || 0)}
              onFocus={e => e.target.select()}
              disabled={!isSubsidyTarget || autoEx.excluded}
              placeholder="0"
              className={`w-full border-2 rounded-lg px-2 py-2 text-right text-sm font-bold outline-none
                ${(!isSubsidyTarget || autoEx.excluded)
                  ? 'bg-gray-100 border-gray-100 text-gray-400 cursor-not-allowed'
                  : 'border-gray-200 focus:border-blue-600'}`}
            />
          </div>
        </div>
      </div>

      {/* 差額プレビュー */}
      <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between mb-4">
        <span className="text-xs text-gray-600">1人当たり差額負担（学校実質支出）</span>
        <div className="text-right">
          <span className={`text-lg font-bold ${netPerPerson > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            {yen(netPerPerson)}
          </span>
          {selectedIds.size > 0 && (
            <span className="text-xs text-gray-500 ml-2">
              合計 {yen(netPerPerson * selectedIds.size)}（{selectedIds.size}名分）
            </span>
          )}
        </div>
      </div>

      {/* フッター */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">
          選択中: <strong>{selectedIds.size}名</strong>
        </span>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedIds.size === 0 || saving}
            className={`px-5 py-2 rounded-lg text-sm font-bold text-white
              ${(selectedIds.size === 0 || saving) ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-800 hover:bg-blue-900'}`}
          >
            {saving ? '登録中...' : `${selectedIds.size}名に一括登録`}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 🔄 Step 6: 遠征詳細ページへの組み込み

**`src/app/expedition/[id]/page.tsx`** を以下のように更新：

```tsx
// 1. 必要なstateを追加
const [subsidyRates, setSubsidyRates] = useState<SubsidyRates>({
  expedition_id: id,
  accommodation_rate: 0,
  breakfast_rate: 0,
  lunch_rate: 0,
  dinner_rate: 0,
});

// 2. セクション②③のコンポーネントを追加
// セクション② - 補助単価マスター
<SubsidyRatesForm
  expeditionId={id}
  onRatesChange={setSubsidyRates}
/>

// セクション③ - 個人別マトリクス（②の直後に配置）
<PersonalCostMatrix
  expeditionId={id}
  members={members}
  startDate={expedition.start_date}
  endDate={expedition.end_date}
  rates={subsidyRates}
  onSummaryChange={handleSubsidySummaryChange}
/>
```

---

## ✅ Step 7: 動作確認チェックリスト

```
Supabase:
□ subsidy_rates テーブルが作成されている
□ personal_costs テーブルが作成されている
□ UNIQUE(expedition_id, member_id, date, item_type) が効いている
□ income_items に UNIQUE(expedition_id, category) 制約がある

② 補助単価マスター:
□ 4項目（宿泊・朝食・昼食・夕食）が入力・保存できる
□ 保存ボタンで「✓ 保存済み」になる

③ 一括入力:
□ 役職グループ別に選手/顧問/応援が分かれて表示される
□ 費用区分を変えると補助単価が②から自動セットされる
□ 移動初日の朝食・昼食を選んだとき警告が出て補助¥0になる
□ 最終日の夕食を選んだとき警告が出る
□ 差額プレビューが「選択人数 × 差額」で正しく表示される
□ 登録後にマトリクスが更新される

③ マトリクス:
□ 実支出セルをクリックすると直接編集できる
□ Enter/Tabで次のセルへ移動してクイック入力できる
□ ⋮メニューから「補助対象外に変更」が機能する
□ ⋮メニューから「欠席にする」で行がグレー表示になる
□ 補助対象外行がオレンジ背景になる
□ 欠席行がグレー斜体になる
□ テーブル合計行が正しく計算されている

自動計上:
□ 補助総額が income_items の 'subsidy_auto' に反映されている
□ 収支サイドバーの収入合計に補助金が含まれている
□ サマリーパネルの「補助合計（収入計上）」と「差額負担合計」が正しい

既存機能の確認:
□ 他のタブ（収入・交通費・その他）が壊れていない
□ PDF報告書出力が動く
```

---

## 🚀 Step 8: デプロイ

```bash
npm run build   # エラーがないことを確認

git add .
git commit -m "feat: ②補助単価マスター + ③個人別マトリクス 完全実装

変更内容:
- subsidy_rates テーブル（補助単価マスター）追加
- personal_costs テーブル（人×費用区分×日付）追加
- SubsidyRatesForm: 宿泊・朝食・昼食・夕食の単価を4項目登録
- PersonalCostMatrix: 個人別実支出×補助 差額計算テーブル
- BulkInputPanel: 役職グループ選択→一括登録パネル
- 移動日ルール自動判定（初日朝昼・最終日夕食は対象外）
- 個人ごとに金額が異なる場合もセル個別編集で対応
- 欠席・不食は skip 処理（費用ゼロ除外）
- 補助合計を income_items に自動計上"

git push origin main
```

---

## 💡 重要なビジネスルール（実装時の確認事項）

| ルール | 実装内容 |
|-------|---------|
| 応援生徒の費用は部・個人負担 | `is_subsidy_target = false` → 補助額¥0、差額 = 実支出全額 |
| 宿泊代は個人により異なる場合あり | セル個別編集で金額を上書き可能 |
| 朝食をとらない生徒 | `is_skipped = true` → 費用ゼロ、人数カウントから除外 |
| 移動初日は朝食・昼食が対象外 | `auto_excluded = true` + 警告表示、補助¥0自動設定 |
| 最終日は夕食・宿泊が対象外 | 同上 |
| 補助額 → 収入として計上 | `income_items.category = 'subsidy_auto'` に自動upsert |

---

*命令書バージョン: v4.0*
*作成: 2026年6月1日*