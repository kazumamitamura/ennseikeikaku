# 🏋️ 遠征収支管理システム - Cursor完全命令書 v2.0
## 対象: `ennseikeikaku` / Next.js + Supabase + Vercel
## 作成日: 2026年5月

---

## ⚡ このタスクの概要

現在稼働中の `https://ennseikeikaku.vercel.app` を大幅リニューアルする。
核心は「**補助対象費セクション**」の新設：
- 宿泊・朝食・昼食・夕食の**実支出 vs 補助額 → 実質負担額の自動計算**
- 移動日ルール（初日朝食・昼食 / 最終日夕食は補助対象外）の**自動フラグ制御**
- 補助額は**収入として自動計上**、実質支出は支出として集計

---

## 📋 作業前の確認事項（必ず実行すること）

```bash
# 1. 現状コードの確認
cat src/app/expedition/[id]/page.tsx
cat src/components/expedition/CostCalculator.tsx
cat src/lib/calculations.ts
cat src/types/expedition.ts

# 2. Supabaseテーブルの現状確認（存在するテーブル一覧）
# Supabaseダッシュボード → Table Editor で確認

# 3. 依存パッケージ確認
cat package.json
```

---

## 🗄️ Step 1: Supabaseマイグレーション

以下のSQLを**Supabase SQL Editor**で実行すること。
既存テーブルへの追加カラムと新テーブルの作成。

```sql
-- ============================================================
-- 補助対象費テーブル（新規作成）
-- 宿泊・食事の補助額と実支出を一元管理
-- ============================================================
CREATE TABLE IF NOT EXISTS subsidy_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE NOT NULL,

  -- 日付・区分
  date DATE NOT NULL,                    -- 対象日
  item_type TEXT NOT NULL,              -- 'accommodation' | 'breakfast' | 'lunch' | 'dinner'
  
  -- 補助対象フラグ（移動日ルールで自動制御、手動オーバーライド可）
  is_subsidy_target BOOLEAN DEFAULT true,  -- 補助対象か否か
  subsidy_rule_reason TEXT,               -- 対象外理由（例: '移動初日朝食'）

  -- 人数
  subsidy_target_count INTEGER DEFAULT 0,   -- 補助対象人数（選手＋監督）
  non_subsidy_count INTEGER DEFAULT 0,      -- 対象外人数（応援等）
  skip_count INTEGER DEFAULT 0,            -- 欠席・不食人数（朝食とらない等）

  -- 金額（円）
  subsidy_amount_per_person INTEGER DEFAULT 0,  -- 1人当たり補助額
  actual_amount_per_person INTEGER DEFAULT 0,   -- 1人当たり実際支出額
  -- 差額 = actual - subsidy → 実質負担（自動計算列 or アプリ側で計算）

  notes TEXT,
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
-- expeditions テーブルへの追加カラム（なければ追加）
-- ============================================================
ALTER TABLE expeditions
  ADD COLUMN IF NOT EXISTS move_in_date DATE,   -- 移動初日（遠征前日移動の場合）
  ADD COLUMN IF NOT EXISTS move_out_date DATE,  -- 移動最終日
  ADD COLUMN IF NOT EXISTS subsidy_target_roles TEXT[] DEFAULT ARRAY['athlete', 'advisor'];
  -- 補助対象の役職（デフォルト: 選手・顧問）

-- ============================================================
-- 既存の accommodation_costs / meal_costs は残す（後方互換）
-- 新機能は subsidy_items に集約
-- ============================================================
```

---

## 📁 Step 2: 型定義の更新

**ファイル: `src/types/expedition.ts`**

既存の型定義に以下を**追加**すること（既存は削除しない）：

```typescript
// ---- 補助対象費 ----

export type SubsidyItemType = 
  | 'accommodation'  // 宿泊
  | 'breakfast'      // 朝食
  | 'lunch'          // 昼食
  | 'dinner';        // 夕食

export interface SubsidyItem {
  id: string;
  expedition_id: string;
  date: string;                    // YYYY-MM-DD
  item_type: SubsidyItemType;
  is_subsidy_target: boolean;      // 補助対象フラグ
  subsidy_rule_reason?: string;    // 対象外理由（自動設定）
  subsidy_target_count: number;    // 補助対象人数
  non_subsidy_count: number;       // 対象外人数
  skip_count: number;              // 欠席・不食人数
  subsidy_amount_per_person: number;  // 補助単価
  actual_amount_per_person: number;   // 実支出単価
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// 計算結果
export interface SubsidyItemCalculated extends SubsidyItem {
  // 補助対象分
  total_subsidy_amount: number;    // subsidy_amount_per_person × subsidy_target_count
  total_actual_subsidy: number;    // actual_amount_per_person × subsidy_target_count
  net_burden_subsidy: number;      // total_actual_subsidy - total_subsidy_amount（差額負担）
  
  // 非対象分
  total_actual_non_subsidy: number; // actual_amount_per_person × non_subsidy_count
  
  // 合計
  grand_total_actual: number;      // 実支出総額
  grand_total_subsidy: number;     // 補助総額（→収入計上）
  grand_net_expense: number;       // 実質支出（学校負担）
}

export interface SubsidyDaySummary {
  date: string;
  items: SubsidyItemCalculated[];
  day_total_actual: number;
  day_total_subsidy: number;
  day_net_expense: number;
  is_first_travel_day: boolean;    // 移動初日フラグ
  is_last_travel_day: boolean;     // 最終日フラグ
}

// ExpeditionSummaryに追加するフィールド
export interface SubsidySummary {
  accommodation_actual: number;    // 宿泊 実支出総額
  accommodation_subsidy: number;   // 宿泊 補助総額
  accommodation_net: number;       // 宿泊 実質支出
  meal_actual: number;             // 食事 実支出総額
  meal_subsidy: number;            // 食事 補助総額
  meal_net: number;                // 食事 実質支出
  total_subsidy_income: number;    // 補助額合計（収入として計上）
  total_actual_expense: number;    // 実支出合計
  total_net_expense: number;       // 実質支出合計
}
```

---

## 🧮 Step 3: 計算ロジック

**ファイル: `src/lib/subsidyCalculations.ts`（新規作成）**

```typescript
import type {
  SubsidyItem, SubsidyItemCalculated, SubsidyDaySummary,
  SubsidySummary, SubsidyItemType
} from '@/types/expedition';

// ============================================================
// 移動日ルール判定
// ルール: 1泊2食 = 移動初日は朝食・昼食が補助対象外
//          最終日は夕食が補助対象外
// ============================================================
export function isSubsidyTarget(
  itemType: SubsidyItemType,
  date: string,
  expeditionStartDate: string,  // 遠征開始日
  expeditionEndDate: string,    // 遠征終了日
  moveInDate?: string,          // 移動初日（前日移動の場合はstart_dateの前日）
  moveOutDate?: string          // 移動最終日
): { isTarget: boolean; reason?: string } {
  const firstDay = moveInDate || expeditionStartDate;
  const lastDay = moveOutDate || expeditionEndDate;

  if (date === firstDay) {
    if (itemType === 'breakfast') {
      return { isTarget: false, reason: '移動初日・朝食（補助対象外）' };
    }
    if (itemType === 'lunch') {
      return { isTarget: false, reason: '移動初日・昼食（補助対象外）' };
    }
  }

  if (date === lastDay) {
    if (itemType === 'dinner') {
      return { isTarget: false, reason: '最終日・夕食（補助対象外）' };
    }
  }

  if (itemType === 'accommodation') {
    // 宿泊は選手・監督は全日補助対象
    return { isTarget: true };
  }

  return { isTarget: true };
}

// ============================================================
// 1アイテムの計算
// ============================================================
export function calcSubsidyItem(item: SubsidyItem): SubsidyItemCalculated {
  const subsidyTargetCount = item.is_subsidy_target ? item.subsidy_target_count : 0;
  const nonSubsidyCount = item.non_subsidy_count;

  // 補助対象分
  const total_subsidy_amount = item.subsidy_amount_per_person * subsidyTargetCount;
  const total_actual_subsidy = item.actual_amount_per_person * subsidyTargetCount;
  const net_burden_subsidy = Math.max(0, total_actual_subsidy - total_subsidy_amount);

  // 非対象分（全額自己負担 or 実費）
  const total_actual_non_subsidy = item.actual_amount_per_person * nonSubsidyCount;

  // 合計
  const grand_total_actual = total_actual_subsidy + total_actual_non_subsidy;
  const grand_total_subsidy = total_subsidy_amount;
  const grand_net_expense = net_burden_subsidy + total_actual_non_subsidy;

  return {
    ...item,
    total_subsidy_amount,
    total_actual_subsidy,
    net_burden_subsidy,
    total_actual_non_subsidy,
    grand_total_actual,
    grand_total_subsidy,
    grand_net_expense,
  };
}

// ============================================================
// 日別サマリー計算
// ============================================================
export function calcDaySummary(
  date: string,
  items: SubsidyItem[],
  firstTravelDay: string,
  lastTravelDay: string
): SubsidyDaySummary {
  const calculated = items
    .filter(i => i.date === date)
    .map(calcSubsidyItem);

  return {
    date,
    items: calculated,
    day_total_actual: calculated.reduce((s, i) => s + i.grand_total_actual, 0),
    day_total_subsidy: calculated.reduce((s, i) => s + i.grand_total_subsidy, 0),
    day_net_expense: calculated.reduce((s, i) => s + i.grand_net_expense, 0),
    is_first_travel_day: date === firstTravelDay,
    is_last_travel_day: date === lastTravelDay,
  };
}

// ============================================================
// 全体サマリー計算
// ============================================================
export function calcSubsidySummary(items: SubsidyItem[]): SubsidySummary {
  const calculated = items.map(calcSubsidyItem);

  const accItems = calculated.filter(i => i.item_type === 'accommodation');
  const mealItems = calculated.filter(i => i.item_type !== 'accommodation');

  const sum = (arr: SubsidyItemCalculated[], key: keyof SubsidyItemCalculated) =>
    arr.reduce((s, i) => s + (Number(i[key]) || 0), 0);

  const accommodation_actual = sum(accItems, 'grand_total_actual');
  const accommodation_subsidy = sum(accItems, 'grand_total_subsidy');
  const accommodation_net = sum(accItems, 'grand_net_expense');

  const meal_actual = sum(mealItems, 'grand_total_actual');
  const meal_subsidy = sum(mealItems, 'grand_total_subsidy');
  const meal_net = sum(mealItems, 'grand_net_expense');

  return {
    accommodation_actual,
    accommodation_subsidy,
    accommodation_net,
    meal_actual,
    meal_subsidy,
    meal_net,
    total_subsidy_income: accommodation_subsidy + meal_subsidy,
    total_actual_expense: accommodation_actual + meal_actual,
    total_net_expense: accommodation_net + meal_net,
  };
}

// ============================================================
// 日付リスト生成
// ============================================================
export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// 日付フォーマット（日本語）
export function formatJpDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

// 金額フォーマット
export function formatYen(n: number): string {
  return `¥${Math.round(n || 0).toLocaleString('ja-JP')}`;
}
```

---

## 🗃️ Step 4: Supabaseクライアント関数

**ファイル: `src/lib/subsidyApi.ts`（新規作成）**

```typescript
import { supabase } from './supabase';
import type { SubsidyItem, SubsidyItemType } from '@/types/expedition';
import { isSubsidyTarget } from './subsidyCalculations';

// 遠征の全補助対象費取得
export async function getSubsidyItems(expeditionId: string): Promise<SubsidyItem[]> {
  const { data, error } = await supabase
    .from('subsidy_items')
    .select('*')
    .eq('expedition_id', expeditionId)
    .order('date', { ascending: true })
    .order('item_type', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Upsert（作成 or 更新）
export async function upsertSubsidyItem(
  item: Omit<SubsidyItem, 'id' | 'created_at' | 'updated_at'>
): Promise<SubsidyItem> {
  const { data, error } = await supabase
    .from('subsidy_items')
    .upsert(
      { ...item, updated_at: new Date().toISOString() },
      { onConflict: 'expedition_id,date,item_type' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 日付範囲で自動初期化（遠征作成時・日程変更時に呼ぶ）
export async function initializeSubsidyItems(
  expeditionId: string,
  startDate: string,
  endDate: string,
  subsidyTargetCount: number,
  moveInDate?: string,
  moveOutDate?: string
): Promise<void> {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }

  const firstDay = moveInDate || startDate;
  const lastDay = moveOutDate || endDate;

  const itemTypes: SubsidyItemType[] = ['accommodation', 'breakfast', 'lunch', 'dinner'];
  const items: Omit<SubsidyItem, 'id' | 'created_at' | 'updated_at'>[] = [];

  for (const date of dates) {
    for (const itemType of itemTypes) {
      // 最終日は宿泊なし
      if (itemType === 'accommodation' && date === lastDay) continue;

      const { isTarget, reason } = isSubsidyTarget(
        itemType, date, startDate, endDate, firstDay, lastDay
      );

      items.push({
        expedition_id: expeditionId,
        date,
        item_type: itemType,
        is_subsidy_target: isTarget,
        subsidy_rule_reason: reason,
        subsidy_target_count: isTarget ? subsidyTargetCount : 0,
        non_subsidy_count: 0,
        skip_count: 0,
        subsidy_amount_per_person: 0,
        actual_amount_per_person: 0,
        notes: reason || undefined,
      });
    }
  }

  // バッチupsert
  const { error } = await supabase
    .from('subsidy_items')
    .upsert(items, { onConflict: 'expedition_id,date,item_type', ignoreDuplicates: true });

  if (error) throw error;
}

// 削除（遠征削除時）
export async function deleteSubsidyItems(expeditionId: string): Promise<void> {
  const { error } = await supabase
    .from('subsidy_items')
    .delete()
    .eq('expedition_id', expeditionId);
  if (error) throw error;
}
```

---

## 🎨 Step 5: UIコンポーネント作成

### 5-1. メイン補助費セクション

**ファイル: `src/components/expedition/SubsidySection.tsx`（新規作成）**

以下の仕様で完全実装すること：

```
【UI構造】

┌─────────────────────────────────────────────────────────┐
│ 🏨 選手・監督 補助対象費                                  │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ 【日付タブ】                                             │
│ [6/19(木)移動日] [6/20(金)] [6/21(土)最終日]             │
│                                                         │
│ 6月19日(木) - 移動初日                                   │
│ ⚠️ 朝食・昼食は補助対象外（移動日ルール）                 │
│                                                         │
│ ┌──────┬──────────┬──────┬──────┬──────┬──────┬──────┐  │
│ │ 区分 │補助対象  │対象外│欠席  │補助  │実支出│差額  │  │
│ │      │人数      │人数  │人数  │単価  │単価  │(負担)│  │
│ ├──────┼──────────┼──────┼──────┼──────┼──────┼──────┤  │
│ │🏨宿泊│ [10]     │ [0]  │  -   │[12000│[14000│ 2000 │  │
│ │🍳朝食│ ×対象外  │ [10] │ [2]  │  -   │[ 900]│  900 │  │
│ │🥗昼食│ ×対象外  │ [10] │ [0]  │  -   │[ 864]│  864 │  │
│ │🍱夕食│ [10]     │ [0]  │ [1]  │[ 435]│[ 900]│  465 │  │
│ ├──────┼──────────┼──────┼──────┼──────┼──────┼──────┤  │
│ │日計  │          │      │      │¥120,000│¥138,000│¥18,000│
│ └──────┴──────────┴──────┴──────┴──────┴──────┴──────┘  │
│                                                         │
│ 【サマリーパネル】                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │         宿泊費    食事費    合計                      │ │
│ │ 実支出  ¥XX万   ¥XX万   ¥XX万                        │ │
│ │ 補助額  ¥XX万   ¥XX万   ¥XX万  ← 収入計上           │ │
│ │ 差額    ¥XX万   ¥XX万   ¥XX万  ← 実質学校負担        │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**実装要件:**

```typescript
// props
interface SubsidySectionProps {
  expeditionId: string;
  startDate: string;
  endDate: string;
  memberCounts: {
    athletes: number;
    advisors: number;
    others: number;
    total: number;
  };
  onSummaryChange: (summary: SubsidySummary) => void;
}
```

**詳細実装仕様:**

1. **日付タブ**: 遠征期間の全日付を横並びタブで表示
   - 移動初日には「⚠️移動日」バッジを表示
   - 最終日には「🏁最終日」バッジを表示

2. **テーブル行（宿泊）**:
   - 選手・監督は全日補助対象（`is_subsidy_target = true`）
   - 最終日には宿泊行なし
   - 列: 区分 | 補助対象人数 | 対象外人数 | 補助単価 | 実支出単価 | 差額

3. **テーブル行（食事3種）**:
   - 補助対象外の場合はセルを灰色表示し「補助対象外」と表示
   - 欠席・不食列（`skip_count`）: 朝食のみに表示（「朝食をとらない人数」）
   - 列: 区分 | 補助対象人数 | 対象外人数 | 欠席人数 | 補助単価 | 実支出単価 | 差額

4. **差額計算ロジック（セル内リアルタイム表示）**:
   ```
   差額(1人分) = 実支出単価 - 補助単価
   ※補助対象外の行は差額 = 実支出単価（補助なし）
   ```

5. **入力後の自動保存**: 各セルのonBlurで自動upsert（デバウンス500ms）

6. **サマリーパネル**: 全日付の合計を常に表示

### 5-2. 収支サマリーパネルの更新

**ファイル: `src/components/expedition/SummaryPanel.tsx`（既存を更新）**

サイドバーの収支サマリーに以下を追加：

```
【補助対象費 内訳（新セクション）】
─────────────────────────
🏨 宿泊費（補助対象分）
  実支出    ¥XXX,XXX
  補助額    ¥XXX,XXX ↑収入
  差額負担  ¥XXX,XXX

🍱 食事費（補助対象分）
  実支出    ¥XXX,XXX
  補助額    ¥XXX,XXX ↑収入
  差額負担  ¥XXX,XXX
─────────────────────────
補助合計（収入）  ¥XXX,XXX
実質支出合計      ¥XXX,XXX
─────────────────────────
【調整シミュレーター】
個人負担額を変えると…
  現在の個人負担: ¥7,000
  [▼] [▲] ← スライダーor入力
  → 予算過不足: ▲¥XX,XXX
```

---

## 🔧 Step 6: 遠征詳細ページの更新

**ファイル: `src/app/expedition/[id]/page.tsx`（既存を更新）**

### タブ構成の変更

```
現状:
[基本情報] [名簿] [収入] [宿泊費] [食事費] [交通費] [その他]

変更後:
[📊 収支サマリー] [👥 名簿] [🏨 補助対象費 ★NEW★] [💴 収入] [🚌 交通費] [📎 その他]
```

**「補助対象費」タブ（新規）:**
- `SubsidySection` コンポーネントを表示
- 補助額合計は自動で「収入」テーブルに `category: 'subsidy_auto'` として upsert される

**補助額の自動収入計上ロジック:**

```typescript
// SubsidySectionのonSummaryChangeで呼ぶ
async function syncSubsidyToIncome(summary: SubsidySummary, expeditionId: string) {
  // 補助額合計を収入として自動upsert
  await supabase
    .from('income_items')
    .upsert({
      expedition_id: expeditionId,
      category: 'subsidy_auto',
      label: '補助金（宿泊・食事）自動計上',
      amount: summary.total_subsidy_income,
      notes: `宿泊補助: ¥${summary.accommodation_subsidy.toLocaleString()} / 食事補助: ¥${summary.meal_subsidy.toLocaleString()}`
    }, { onConflict: 'expedition_id,category' }); // ← categoryにunique制約が必要
}
```

※ `income_items` テーブルに `UNIQUE(expedition_id, category)` を追加:
```sql
ALTER TABLE income_items ADD CONSTRAINT income_items_exp_cat_unique
  UNIQUE (expedition_id, category);
```

---

## 📊 Step 7: 収支サマリーページの全面更新

**ファイル: `src/components/expedition/CostCalculator.tsx`（既存を更新）**

### 表示構造

```
【収支全体サマリー】

┌─────────────────────────────────────────────────┐
│                   収 入                          │
├──────────────────────┬──────────────────────────┤
│ クラブ費・個人負担    │ ¥70,000                  │
│ 補助金（宿泊・食事）  │ ¥XXX,XXX ← 自動計上     │
│ その他収入           │ ¥0                       │
├──────────────────────┼──────────────────────────┤
│ 収入合計             │ ¥XXX,XXX                 │
└──────────────────────┴──────────────────────────┘

┌─────────────────────────────────────────────────┐
│                   支 出                          │
├─────────────────────────────┬───────────────────┤
│ 【補助対象費】               │                   │
│   宿泊費（実支出）           │ ¥XXX,XXX          │
│   食事費（実支出）           │ ¥XXX,XXX          │
│   小計                      │ ¥XXX,XXX          │
├─────────────────────────────┼───────────────────┤
│ 【交通費】                   │ ¥XXX,XXX          │
│ 【その他】                   │ ¥XXX,XXX          │
├─────────────────────────────┼───────────────────┤
│ 支出合計                    │ ¥XXX,XXX          │
└─────────────────────────────┴───────────────────┘

┌─────────────────────────────────────────────────┐
│ 収支差額（収入 - 支出）   ▲¥XX,XXX（黒字）      │
└─────────────────────────────────────────────────┘

【参考情報】
個人負担総額: ¥70,000（¥7,000 × 10名）
補助総額:    ¥XXX,XXX（収入として計上済み）
実質学校支出: ¥XXX,XXX
```

---

## 🎨 Step 8: UIデザイン要件

### カラーコード統一

```typescript
// src/lib/designTokens.ts（新規）
export const colors = {
  subsidy: '#1b6b3a',    // 補助 = 緑（収入）
  subsidyBg: '#dcfce7',
  actual: '#1d4ed8',     // 実支出 = 青
  actualBg: '#dbeafe',
  net: '#92400e',        // 実質負担 = 茶（差額）
  netBg: '#fef3c7',
  noSubsidy: '#6b7280',  // 補助対象外 = グレー
  noSubsidyBg: '#f3f4f6',
  danger: '#b91c1c',     // 赤字
  dangerBg: '#fee2e2',
  navy: '#1a3a5c',
  gold: '#c8962a',
};
```

### 入力ミス防止UI

1. **数値入力**: `type="number"` `min="0"` `step="1"` + フォーカスで全選択
2. **補助対象外セル**: 背景グレー、カーソル `not-allowed`、入力不可
3. **差額表示**: 
   - 正（差額あり）= 黄色背景
   - 0（補助が実支出をカバー） = 緑背景
   - 負（補助が実支出より多い） = 赤テキスト「要確認」
4. **人数整合チェック**: 
   - `補助対象人数 + 対象外人数 + 欠席人数 > 総参加人数` → オレンジ警告
5. **保存状態表示**: 各行右端に `💾 保存中...` / `✓` / `✗` インジケーター

---

## 🔄 Step 9: 既存コードとの整合性

### 修正が必要なファイル一覧

```
修正:
src/types/expedition.ts           ← 型追加
src/lib/calculations.ts           ← SubsidySummaryを統合
src/app/expedition/[id]/page.tsx  ← タブ追加・SubsidySection組み込み
src/components/expedition/SummaryPanel.tsx  ← 補助費サマリー追加

新規作成:
src/types/expedition.ts           ← SubsidyItem等の型（既存に追記）
src/lib/subsidyCalculations.ts    ← 計算ロジック
src/lib/subsidyApi.ts             ← Supabase API
src/components/expedition/SubsidySection.tsx  ← メインUI

削除しないもの（後方互換）:
src/components/expedition/AccommodationSection.tsx
src/components/expedition/MealSection.tsx
※ 既存データがあるため、新UIに置き換えるが古いテーブルは残す
```

---

## ✅ Step 10: 動作確認チェックリスト

```
Supabase:
□ subsidy_items テーブルが作成されている
□ expeditions テーブルに move_in_date, move_out_date カラムがある
□ income_items に UNIQUE(expedition_id, category) 制約がある

計算ロジック:
□ 移動初日の朝食・昼食が is_subsidy_target = false になっている
□ 最終日の夕食が is_subsidy_target = false になっている
□ 宿泊は移動初日〜最終日の前日まで（最終日なし）
□ 差額 = 実支出 - 補助単価 が正しく計算される
□ 補助総額が収入テーブルに自動反映される

UI:
□ 日付タブで日付切替できる
□ 移動日・最終日にバッジが表示される
□ 補助対象外セルは灰色で入力不可
□ 人数 × 単価 の小計がリアルタイム更新される
□ 保存後にサイドバーのサマリーが更新される
□ 「朝食をとらない人数」(skip_count)が計算に反映される

統合:
□ 補助額が収入として自動計上される
□ 収支サマリーで宿泊・食事の実支出と補助が分離表示される
□ 個人負担額スライダーで予算過不足がシミュレートできる
```

---

## 🚀 Step 11: デプロイ

```bash
# 1. ローカル動作確認
npm run dev
# http://localhost:3000 で確認

# 2. ビルドエラーチェック
npm run build

# 3. GitHubにプッシュ
git add .
git commit -m "feat: 補助対象費セクション追加・収支計算リニューアル

- SubsidyItemテーブル追加（Supabase）
- 移動日ルール自動判定（初日朝食・昼食、最終日夕食は対象外）
- 実支出・補助額・差額のリアルタイム計算
- 補助額の収入自動計上
- 朝食欠席人数の管理機能
- 収支サマリーパネルの全面更新"
git push origin main

# 4. Vercelが自動デプロイ（GitHubと連携済みの場合）
# デプロイ完了後: https://ennseikeikaku.vercel.app で確認
```

---

## 💡 補足情報・ビジネスロジック整理

### 補助ルールまとめ（現場ルール）

| 日程 | 区分 | 補助対象 | 理由 |
|------|------|----------|------|
| 移動初日 | 宿泊 | ✅ 対象 | 宿泊は全日補助 |
| 移動初日 | 朝食 | ❌ 対象外 | 移動前＝学校で食べる |
| 移動初日 | 昼食 | ❌ 対象外 | 移動中 |
| 移動初日 | 夕食 | ✅ 対象 | 宿で食べる（1泊2食） |
| 中間日 | 宿泊 | ✅ 対象 | |
| 中間日 | 朝食 | ✅ 対象 | |
| 中間日 | 昼食 | ✅ 対象 | |
| 中間日 | 夕食 | ✅ 対象 | |
| 最終日 | 宿泊 | ❌ なし | 帰宅日 |
| 最終日 | 朝食 | ✅ 対象 | 宿で食べる（1泊2食） |
| 最終日 | 昼食 | ✅ 対象 | |
| 最終日 | 夕食 | ❌ 対象外 | 帰宅後 |

### 計算例（スプレッドシートの値を参考）

```
宿泊: 14,000円/人 - 補助12,000円 = 差額2,000円
朝食(補助対象): 900円/人 - 補助864円 = 差額36円
昼食(補助対象): 900円/人 - 補助900円 = 差額0円
夕食(補助対象): 900円/人 - 補助435円 = 差額465円
```

---

*命令書バージョン: v2.0*
*対象アプリ: https://ennseikeikaku.vercel.app*
*作成: 2026年5月29日*