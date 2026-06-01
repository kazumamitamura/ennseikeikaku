# 🏋️ 遠征収支管理システム - Cursor命令書 v3.0
## 機能: 補助対象費 × 個人紐付け + 一括入力
## 対象: `ennseikeikaku` / Next.js + Supabase + Vercel

---

## ⚡ このタスクの目的

**「人 × 費用項目」で補助対象費を管理する**仕組みに刷新する。

### 核心ロジック
1. **個人別レコード**: 田中くんの宿泊代¥14,000 → 補助¥12,000 → 差額¥2,000 が1行で確認できる
2. **一括入力**: 選手全員・顧問など役職で絞り込み→同内容を一括登録（最多入力ケース対応）
3. **補助対象フラグ**: 個別に「対象外」へ切り替え可能（応援生徒など例外処理）
4. **欠席・不食対応**: 朝食をとらない・参加しない人は「skip」で除外
5. **自動集計**: 補助総額→収入計上、実支出→支出計上、差額→収支反映

---

## 📋 Step 0: 作業前のコード確認（必須）

```bash
# 現状のファイル構成を確認してから作業開始すること
ls src/app/expedition/
ls src/components/expedition/
ls src/types/
cat src/types/expedition.ts
cat src/lib/calculations.ts

# Supabaseテーブル確認（ダッシュボードでも可）
# 必要テーブル: expeditions, members, subsidy_person_items（新規）
```

---

## 🗄️ Step 1: Supabaseマイグレーション

**Supabase SQL Editor**で以下を実行すること。

```sql
-- ============================================================
-- subsidy_person_items テーブル（新規作成）
-- 「人 × 費用区分 × 日付」で補助対象費を管理
-- ============================================================
CREATE TABLE IF NOT EXISTS subsidy_person_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,

  -- 費用区分
  item_type TEXT NOT NULL CHECK (item_type IN (
    'accommodation', 'breakfast', 'lunch', 'dinner'
  )),
  -- accommodation = 宿泊, breakfast = 朝食, lunch = 昼食, dinner = 夕食

  date DATE NOT NULL,                          -- 対象日 (YYYY-MM-DD)

  -- 金額（円）
  actual_amount INTEGER DEFAULT 0,            -- 実際の支出額（現地で払った金額）
  subsidy_amount INTEGER DEFAULT 0,           -- 補助額（学校・行政からの補助）
  -- 差額 = actual_amount - subsidy_amount → アプリ側で計算

  -- 補助対象フラグ
  is_subsidy_target BOOLEAN DEFAULT true,      -- 補助対象か否か
  is_skipped BOOLEAN DEFAULT false,            -- 欠席・不食（費用ゼロ）
  skip_reason TEXT,                            -- スキップ理由（例: '朝食なし', '欠席'）

  -- 移動日ルール（自動設定・手動オーバーライド可）
  auto_excluded BOOLEAN DEFAULT false,        -- 移動日ルールで自動対象外にされた
  auto_exclude_reason TEXT,                   -- 自動除外理由

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 同一人・同日・同区分は1レコードのみ
  UNIQUE(expedition_id, member_id, date, item_type)
);

-- RLS
ALTER TABLE subsidy_person_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_subsidy_person_items"
  ON subsidy_person_items FOR ALL USING (true) WITH CHECK (true);

-- インデックス（絞り込みが多いため）
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

CREATE TRIGGER spi_updated_at
  BEFORE UPDATE ON subsidy_person_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- members テーブルへの追加（なければ追加）
-- ============================================================
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS is_subsidy_eligible BOOLEAN DEFAULT true;
  -- 補助対象者か否かのデフォルト値（role別に初期値を変えるのはアプリ側で）

-- ============================================================
-- 既存テーブルとの整合性
-- income_items: category='subsidy_auto' で補助額を自動計上する
-- ============================================================
-- subsidy_autoが重複しないようにUNIQUE制約（なければ追加）
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

## 📦 Step 2: 型定義の追加

**ファイル: `src/types/expedition.ts`** に以下を**追記**（既存は削除しない）

```typescript
// ============================================================
// 補助対象費（個人紐付け）
// ============================================================

export type SubsidyItemType =
  | 'accommodation'  // 宿泊
  | 'breakfast'      // 朝食
  | 'lunch'          // 昼食
  | 'dinner';        // 夕食

export const SUBSIDY_ITEM_LABELS: Record<SubsidyItemType, string> = {
  accommodation: '🏨 宿泊',
  breakfast:     '🍳 朝食',
  lunch:         '🥗 昼食',
  dinner:        '🍱 夕食',
};

export const ITEM_TYPE_ORDER: SubsidyItemType[] = [
  'accommodation', 'breakfast', 'lunch', 'dinner'
];

// 役職定義（表示名・補助対象デフォルト・グループ）
export type MemberRole =
  | 'athlete'    // 選手
  | 'advisor'    // 顧問
  | 'external'   // 外部指導者
  | 'supporter'  // 応援
  | 'staff'      // 引率スタッフ
  | 'other';     // その他

export const ROLE_LABELS: Record<MemberRole, string> = {
  athlete:   '選手',
  advisor:   '顧問',
  external:  '外部指導者',
  supporter: '応援',
  staff:     '引率',
  other:     'その他',
};

// 役職ごとの補助対象デフォルト
export const ROLE_SUBSIDY_DEFAULT: Record<MemberRole, boolean> = {
  athlete:   true,   // 選手 → 補助対象
  advisor:   true,   // 顧問 → 補助対象
  external:  false,  // 外部指導者 → デフォルト対象外（個別設定可）
  supporter: false,  // 応援 → 対象外
  staff:     false,  // 引率 → 対象外
  other:     false,
};

export interface SubsidyPersonItem {
  id: string;
  expedition_id: string;
  member_id: string;
  item_type: SubsidyItemType;
  date: string;
  actual_amount: number;
  subsidy_amount: number;
  is_subsidy_target: boolean;
  is_skipped: boolean;
  skip_reason?: string;
  auto_excluded: boolean;
  auto_exclude_reason?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// 計算済みの1行分
export interface SubsidyPersonItemCalc extends SubsidyPersonItem {
  net_amount: number;           // 差額負担 = actual - subsidy (is_subsidy_targetがtrueの場合)
  effective_subsidy: number;    // 実効補助額（対象外なら0）
  effective_expense: number;    // 実質支出（is_skippedなら0）
}

// メンバー情報を含む表示用
export interface SubsidyPersonItemWithMember extends SubsidyPersonItemCalc {
  member_name: string;
  member_role: MemberRole;
}

// 一括入力フォームの型
export interface BulkInputForm {
  item_type: SubsidyItemType;
  date: string;
  actual_amount: number;
  subsidy_amount: number;
  is_subsidy_target: boolean;
  target_member_ids: string[];  // 対象メンバーのID一覧
}

// グループ別サマリー
export interface SubsidyGroupSummary {
  total_actual: number;       // 実支出合計
  total_subsidy: number;      // 補助額合計（→収入）
  total_net: number;          // 差額合計（実質負担）
  person_count: number;       // 対象人数
  skipped_count: number;      // 欠席人数
}
```

---

## 🧮 Step 3: 計算ロジック

**ファイル: `src/lib/subsidyPersonCalc.ts`（新規作成）**

```typescript
import type {
  SubsidyPersonItem, SubsidyPersonItemCalc,
  SubsidyPersonItemWithMember, SubsidyGroupSummary,
  SubsidyItemType, MemberRole
} from '@/types/expedition';

// ============================================================
// 1アイテムの計算
// ============================================================
export function calcPersonItem(item: SubsidyPersonItem): SubsidyPersonItemCalc {
  if (item.is_skipped) {
    return {
      ...item,
      net_amount: 0,
      effective_subsidy: 0,
      effective_expense: 0,
    };
  }

  const effective_subsidy = item.is_subsidy_target ? item.subsidy_amount : 0;
  const effective_expense = item.actual_amount;
  const net_amount = Math.max(0, effective_expense - effective_subsidy);

  return {
    ...item,
    net_amount,
    effective_subsidy,
    effective_expense,
  };
}

// ============================================================
// グループ別サマリー計算
// ============================================================
export function calcGroupSummary(
  items: SubsidyPersonItem[]
): SubsidyGroupSummary {
  const calced = items.map(calcPersonItem);
  return {
    total_actual:  calced.reduce((s, i) => s + i.effective_expense, 0),
    total_subsidy: calced.reduce((s, i) => s + i.effective_subsidy, 0),
    total_net:     calced.reduce((s, i) => s + i.net_amount, 0),
    person_count:  calced.filter(i => !i.is_skipped).length,
    skipped_count: calced.filter(i => i.is_skipped).length,
  };
}

// ============================================================
// 移動日ルール: この費用区分がこの日に補助対象かどうか
// ============================================================
export function getAutoExcludeInfo(
  itemType: SubsidyItemType,
  date: string,
  firstDay: string,    // 遠征開始日（移動初日）
  lastDay: string      // 遠征終了日
): { excluded: boolean; reason?: string } {
  if (date === firstDay) {
    if (itemType === 'breakfast') return { excluded: true, reason: '移動初日・朝食（補助対象外）' };
    if (itemType === 'lunch')     return { excluded: true, reason: '移動初日・昼食（補助対象外）' };
  }
  if (date === lastDay) {
    if (itemType === 'dinner')      return { excluded: true, reason: '最終日・夕食（補助対象外）' };
    if (itemType === 'accommodation') return { excluded: true, reason: '最終日・宿泊なし' };
  }
  return { excluded: false };
}

// ============================================================
// 日付リスト生成
// ============================================================
export function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// 日本語日付
export function toJpDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  const days = ['日','月','火','水','木','金','土'];
  return `${dt.getMonth()+1}/${dt.getDate()}(${days[dt.getDay()]})`;
}

// 金額フォーマット
export function yen(n: number): string {
  return `¥${Math.round(n || 0).toLocaleString('ja-JP')}`;
}
```

---

## 🌐 Step 4: Supabase APIレイヤー

**ファイル: `src/lib/subsidyPersonApi.ts`（新規作成）**

```typescript
import { supabase } from './supabase';
import type { SubsidyPersonItem, BulkInputForm } from '@/types/expedition';
import { getAutoExcludeInfo, dateRange } from './subsidyPersonCalc';

// ---- 取得 ----
export async function getSubsidyPersonItems(
  expeditionId: string
): Promise<SubsidyPersonItem[]> {
  const { data, error } = await supabase
    .from('subsidy_person_items')
    .select('*')
    .eq('expedition_id', expeditionId)
    .order('date').order('item_type').order('member_id');
  if (error) throw error;
  return data ?? [];
}

// ---- 1件upsert ----
export async function upsertSubsidyPersonItem(
  item: Omit<SubsidyPersonItem, 'id' | 'created_at' | 'updated_at'>
): Promise<SubsidyPersonItem> {
  const { data, error } = await supabase
    .from('subsidy_person_items')
    .upsert(item, { onConflict: 'expedition_id,member_id,date,item_type' })
    .select().single();
  if (error) throw error;
  return data;
}

// ---- 一括upsert（核心機能）----
export async function bulkUpsertSubsidyItems(
  form: BulkInputForm,
  expeditionId: string,
  firstDay: string,
  lastDay: string
): Promise<void> {
  const { excluded, reason } = getAutoExcludeInfo(
    form.item_type, form.date, firstDay, lastDay
  );

  const rows = form.target_member_ids.map(memberId => ({
    expedition_id: expeditionId,
    member_id: memberId,
    item_type: form.item_type,
    date: form.date,
    actual_amount: form.actual_amount,
    // 移動日ルールで対象外なら補助0
    subsidy_amount: (excluded || !form.is_subsidy_target) ? 0 : form.subsidy_amount,
    is_subsidy_target: excluded ? false : form.is_subsidy_target,
    is_skipped: false,
    auto_excluded: excluded,
    auto_exclude_reason: reason,
  }));

  const { error } = await supabase
    .from('subsidy_person_items')
    .upsert(rows, { onConflict: 'expedition_id,member_id,date,item_type' });
  if (error) throw error;
}

// ---- スキップ切替 ----
export async function toggleSkip(
  id: string,
  isSkipped: boolean,
  reason?: string
): Promise<void> {
  const { error } = await supabase
    .from('subsidy_person_items')
    .update({ is_skipped: isSkipped, skip_reason: reason ?? null })
    .eq('id', id);
  if (error) throw error;
}

// ---- 補助対象フラグ切替 ----
export async function toggleSubsidyTarget(
  id: string,
  isTarget: boolean
): Promise<void> {
  const { error } = await supabase
    .from('subsidy_person_items')
    .update({
      is_subsidy_target: isTarget,
      // 対象外にしたら補助額を0にリセット
      subsidy_amount: isTarget ? undefined : 0
    })
    .eq('id', id);
  if (error) throw error;
}

// ---- 削除 ----
export async function deleteSubsidyPersonItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('subsidy_person_items')
    .delete().eq('id', id);
  if (error) throw error;
}

// ---- 初期化（名簿登録後、日程×費用区分の雛形を生成） ----
export async function initSubsidyPersonItems(
  expeditionId: string,
  memberIds: string[],
  memberRoles: Record<string, string>,  // memberId -> role
  startDate: string,
  endDate: string
): Promise<void> {
  const dates = dateRange(startDate, endDate);
  const types: Array<SubsidyPersonItem['item_type']> = [
    'accommodation', 'breakfast', 'lunch', 'dinner'
  ];
  const rows: Omit<SubsidyPersonItem, 'id' | 'created_at' | 'updated_at'>[] = [];

  for (const memberId of memberIds) {
    const role = memberRoles[memberId] || 'other';
    const isSubsidyEligible = ['athlete', 'advisor'].includes(role);

    for (const date of dates) {
      for (const itemType of types) {
        const { excluded, reason } = getAutoExcludeInfo(
          itemType, date, startDate, endDate
        );
        if (excluded) continue; // 除外対象は雛形も作らない

        rows.push({
          expedition_id: expeditionId,
          member_id: memberId,
          item_type: itemType,
          date,
          actual_amount: 0,
          subsidy_amount: 0,
          is_subsidy_target: isSubsidyEligible,
          is_skipped: false,
          auto_excluded: false,
        });
      }
    }
  }

  const { error } = await supabase
    .from('subsidy_person_items')
    .upsert(rows, {
      onConflict: 'expedition_id,member_id,date,item_type',
      ignoreDuplicates: true
    });
  if (error) throw error;
}

// ---- 補助総額を収入テーブルに自動同期 ----
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
      notes: `宿泊補助: ¥${breakdown.accommodation.toLocaleString()} / 食事補助: ¥${breakdown.meal.toLocaleString()}`
    }, { onConflict: 'expedition_id,category' });
  if (error) throw error;
}
```

---

## 🎨 Step 5: UIコンポーネント実装

### 5-1: 一括入力パネル

**ファイル: `src/components/expedition/BulkSubsidyInput.tsx`（新規作成）**

```
【UI仕様】

┌────────────────────────────────────────────────────────────┐
│ ➕ 一括入力                                                 │
├────────────────────────────────────────────────────────────┤
│ 費用区分  [🏨 宿泊 ▼]    日付 [6/19(木) ▼]               │
│                                                            │
│ 【対象者を選択】                         全選択 / 全解除   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 選手（8名）                            [全員選択]     │   │
│ │ ☑ 田中〇〇  ☑ 佐藤〇〇  ☑ 遠藤〇〇  ☑ 岡田〇〇  │   │
│ │ ☑ 五十嵐〇〇  ☑ 石川〇〇  ☑ 加藤〇〇  ☑ 佐藤〇〇  │   │
│ ├──────────────────────────────────────────────────────┤   │
│ │ 顧問・指導者（2名）                   [全員選択]     │   │
│ │ ☑ 田中英彦（顧問）  □ 石川良二（外部）             │   │
│ ├──────────────────────────────────────────────────────┤   │
│ │ 応援・その他（3名）                   [全員選択]     │   │
│ │ □ 加藤〇〇（応援）  □ 〇〇（応援）  □ 〇〇（引率）│   │
│ └──────────────────────────────────────────────────────┘   │
│                                                            │
│ 実際の支出額  ¥[14,000]    補助対象 [✓ 補助あり ▼]       │
│ 補助額        ¥[12,000]    差額     ¥2,000 / 人           │
│                                                            │
│ ⚠️ 移動初日(6/19)の朝食・昼食は補助対象外です（自動除外） │
│                                                            │
│ 選択中: 選手8名 + 顧問1名 = 9名                           │
│                                  [キャンセル] [9名に登録]  │
└────────────────────────────────────────────────────────────┘
```

**実装コード骨格:**

```tsx
'use client';
import { useState, useMemo } from 'react';
import type { Member, SubsidyItemType, BulkInputForm, MemberRole } from '@/types/expedition';
import { SUBSIDY_ITEM_LABELS, ROLE_LABELS, ITEM_TYPE_ORDER } from '@/types/expedition';
import { yen, toJpDate, dateRange, getAutoExcludeInfo } from '@/lib/subsidyPersonCalc';
import { bulkUpsertSubsidyItems } from '@/lib/subsidyPersonApi';

interface Props {
  expeditionId: string;
  members: Member[];
  startDate: string;
  endDate: string;
  onComplete: () => void;
  onCancel: () => void;
}

// 役職グループ定義（表示順）
const ROLE_GROUPS: { roles: MemberRole[]; label: string }[] = [
  { roles: ['athlete'],            label: '選手' },
  { roles: ['advisor', 'external'], label: '顧問・指導者' },
  { roles: ['supporter', 'staff', 'other'], label: '応援・その他' },
];

export default function BulkSubsidyInput({
  expeditionId, members, startDate, endDate, onComplete, onCancel
}: Props) {
  const dates = dateRange(startDate, endDate);
  const [itemType, setItemType] = useState<SubsidyItemType>('accommodation');
  const [date, setDate] = useState(dates[0] || startDate);
  const [actualAmount, setActualAmount] = useState(0);
  const [subsidyAmount, setSubsidyAmount] = useState(0);
  const [isSubsidyTarget, setIsSubsidyTarget] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // 移動日ルールの自動除外チェック
  const autoExclude = useMemo(
    () => getAutoExcludeInfo(itemType, date, startDate, endDate),
    [itemType, date, startDate, endDate]
  );

  // 差額計算
  const netAmount = isSubsidyTarget && !autoExclude.excluded
    ? Math.max(0, actualAmount - subsidyAmount)
    : actualAmount;

  // 役職グループ別メンバー
  const membersByGroup = ROLE_GROUPS.map(group => ({
    ...group,
    members: members.filter(m => group.roles.includes(m.role as MemberRole)),
  }));

  // グループ全選択トグル
  const toggleGroup = (groupMembers: Member[], allSelected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      groupMembers.forEach(m => allSelected ? next.delete(m.id) : next.add(m.id));
      return next;
    });
  };

  // 個人チェックボックストグル
  const toggleMember = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // 一括登録実行
  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      const form: BulkInputForm = {
        item_type: itemType,
        date,
        actual_amount: actualAmount,
        subsidy_amount: subsidyAmount,
        is_subsidy_target: isSubsidyTarget && !autoExclude.excluded,
        target_member_ids: Array.from(selectedIds),
      };
      await bulkUpsertSubsidyItems(form, expeditionId, startDate, endDate);
      onComplete();
    } catch (e) {
      console.error(e);
      alert('登録に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 max-w-2xl">
      {/* 費用区分・日付選択 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">費用区分</label>
          <select
            className="w-full border-2 border-gray-200 rounded-lg p-2 text-sm focus:border-blue-600 outline-none"
            value={itemType}
            onChange={e => setItemType(e.target.value as SubsidyItemType)}
          >
            {ITEM_TYPE_ORDER.map(t => (
              <option key={t} value={t}>{SUBSIDY_ITEM_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">日付</label>
          <select
            className="w-full border-2 border-gray-200 rounded-lg p-2 text-sm focus:border-blue-600 outline-none"
            value={date}
            onChange={e => setDate(e.target.value)}
          >
            {dates.map(d => (
              <option key={d} value={d}>{toJpDate(d)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 移動日ルール警告 */}
      {autoExclude.excluded && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800 flex items-center gap-2">
          <span>⚠️</span>
          <span>{autoExclude.reason} — 補助額は自動的に¥0になります</span>
        </div>
      )}

      {/* 対象者選択 */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-bold text-gray-500 uppercase">対象者を選択</label>
          <div className="flex gap-2">
            <button
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={() => setSelectedIds(new Set(members.map(m => m.id)))}
            >全選択</button>
            <span className="text-gray-300">|</span>
            <button
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setSelectedIds(new Set())}
            >全解除</button>
          </div>
        </div>

        <div className="border-2 border-gray-100 rounded-lg overflow-hidden">
          {membersByGroup.map((group, gi) => (
            group.members.length > 0 && (
              <div key={gi} className={gi > 0 ? 'border-t border-gray-100' : ''}>
                <div className="flex justify-between items-center px-3 py-2 bg-gray-50">
                  <span className="text-xs font-bold text-gray-600">
                    {group.label}（{group.members.length}名）
                  </span>
                  <button
                    className="text-xs text-blue-600 hover:text-blue-800"
                    onClick={() => {
                      const allSelected = group.members.every(m => selectedIds.has(m.id));
                      toggleGroup(group.members, allSelected);
                    }}
                  >
                    {group.members.every(m => selectedIds.has(m.id)) ? '全解除' : '全員選択'}
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 p-2">
                  {group.members.map(m => (
                    <label
                      key={m.id}
                      className={`
                        flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-xs
                        transition-colors
                        ${selectedIds.has(m.id)
                          ? 'bg-blue-50 border border-blue-200 text-blue-800'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}
                      `}
                    >
                      <input
                        type="checkbox"
                        className="w-3 h-3"
                        checked={selectedIds.has(m.id)}
                        onChange={() => toggleMember(m.id)}
                      />
                      <span className="truncate">{m.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* 金額入力 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">実際の支出額（円）</label>
          <input
            type="number" min="0" step="100"
            className="w-full border-2 border-gray-200 rounded-lg p-2 text-right text-base font-bold focus:border-blue-600 outline-none"
            value={actualAmount || ''}
            onChange={e => setActualAmount(parseInt(e.target.value) || 0)}
            onFocus={e => e.target.select()}
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
            補助額（円）
            <select
              className="ml-2 border border-gray-200 rounded px-1 py-0 text-xs font-normal"
              value={isSubsidyTarget ? 'target' : 'non-target'}
              onChange={e => setIsSubsidyTarget(e.target.value === 'target')}
              disabled={autoExclude.excluded}
            >
              <option value="target">補助あり</option>
              <option value="non-target">補助なし</option>
            </select>
          </label>
          <input
            type="number" min="0" step="100"
            className={`
              w-full border-2 rounded-lg p-2 text-right text-base font-bold focus:border-blue-600 outline-none
              ${(!isSubsidyTarget || autoExclude.excluded)
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                : 'border-gray-200'}
            `}
            value={subsidyAmount || ''}
            onChange={e => setSubsidyAmount(parseInt(e.target.value) || 0)}
            onFocus={e => e.target.select()}
            disabled={!isSubsidyTarget || autoExclude.excluded}
            placeholder="0"
          />
        </div>
      </div>

      {/* 差額プレビュー */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4 flex justify-between items-center">
        <span className="text-sm text-gray-600">1人当たり差額負担</span>
        <div className="text-right">
          <span className={`text-lg font-bold ${netAmount > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            {yen(netAmount)}
          </span>
          {selectedIds.size > 0 && (
            <span className="text-xs text-gray-500 ml-2">
              合計 {yen(netAmount * selectedIds.size)}（{selectedIds.size}名分）
            </span>
          )}
        </div>
      </div>

      {/* フッター */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">
          選択中: <strong>{selectedIds.size}名</strong>
        </span>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50"
            onClick={onCancel}
          >キャンセル</button>
          <button
            className={`
              px-6 py-2 rounded-lg text-sm font-bold text-white
              ${selectedIds.size === 0 || saving
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-800 hover:bg-blue-900'}
            `}
            onClick={handleSubmit}
            disabled={selectedIds.size === 0 || saving}
          >
            {saving ? '登録中...' : `${selectedIds.size}名に登録`}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### 5-2: 個人別明細テーブル

**ファイル: `src/components/expedition/SubsidyPersonTable.tsx`（新規作成）**

```
【UI仕様】

フィルター: [日付: 全日 ▼] [費用区分: 全て ▼] [役職: 全て ▼]
                                     ⊕ 一括入力  🔍 検索

─────────────────────────────────────────────────────────────
氏名       役職    区分      日付        実支出   補助額  差額   対象
─────────────────────────────────────────────────────────────
田中〇〇   選手    🏨宿泊   6/19(木)   ¥14,000  ¥12,000 ¥2,000 ✓ [⋮]
田中〇〇   選手    🍱夕食   6/19(木)   ¥900     ¥435    ¥465   ✓ [⋮]
田中〇〇   選手    🍳朝食   6/20(金)   ¥864     ¥864    ¥0     ✓ [⋮]
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
佐藤〇〇   選手    🏨宿泊   6/19(木)   ¥14,000  ¥12,000 ¥2,000 ✓ [⋮]
...（欠席）        🍳朝食   6/20(金)   欠席      -      -      skip
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
加藤〇〇   応援    🍳朝食   6/19(木)   ¥900     -       ¥900   ✗ [⋮]
（グレー背景 = 補助対象外）
─────────────────────────────────────────────────────────────
合計                                  ¥XXX,XXX ¥XXX,XXX ¥XXX,XXX
補助総額 → 収入計上: ¥XXX,XXX
```

**実装のポイント:**

1. **行のコンテキストメニュー（⋮ボタン）**:
   ```
   - 補助対象外に変更 / 補助対象に戻す
   - 欠席（朝食なし）にする
   - この行を削除
   - 金額を編集
   - 同内容で他の人にも適用 → BulkSubsidyInput を開く（member_idは今の人以外をチェック済みで）
   ```

2. **インライン編集**: 金額セルをクリック → 直接編集 → Enterで保存

3. **行の色分け**:
   - 通常（補助対象）: 白背景
   - 補助対象外: `bg-gray-50 text-gray-500`
   - 欠席（スキップ）: `bg-gray-100 italic text-gray-400 line-through`
   - 差額大（¥3,000以上）: 差額セルに `bg-amber-50 text-amber-800`

4. **メンバーごとにグループ表示**: 同じ人の行は薄い区切り線でまとめる

5. **テーブル最下部に集計行**:
   ```
   実支出合計: ¥XXX,XXX | 補助合計: ¥XXX,XXX（→収入計上） | 差額合計: ¥XXX,XXX
   ```

---

### 5-3: 補助対象費メインページ

**ファイル: `src/components/expedition/SubsidyPersonSection.tsx`（新規作成）**

```tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import BulkSubsidyInput from './BulkSubsidyInput';
import SubsidyPersonTable from './SubsidyPersonTable';
import { getSubsidyPersonItems, syncSubsidyToIncome } from '@/lib/subsidyPersonApi';
import { calcGroupSummary } from '@/lib/subsidyPersonCalc';
import { yen } from '@/lib/subsidyPersonCalc';
import type { Member, SubsidyPersonItem } from '@/types/expedition';

interface Props {
  expeditionId: string;
  members: Member[];
  startDate: string;
  endDate: string;
  onSummaryChange?: (summary: { totalSubsidy: number; totalActual: number; totalNet: number }) => void;
}

export default function SubsidyPersonSection({
  expeditionId, members, startDate, endDate, onSummaryChange
}: Props) {
  const [items, setItems] = useState<SubsidyPersonItem[]>([]);
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getSubsidyPersonItems(expeditionId);
    setItems(data);
    setLoading(false);

    // サマリー計算して親へ通知
    const summary = calcGroupSummary(data);
    onSummaryChange?.({
      totalSubsidy: summary.total_subsidy,
      totalActual: summary.total_actual,
      totalNet: summary.total_net,
    });

    // 補助総額を収入テーブルに自動同期
    const accSubsidy = calcGroupSummary(
      data.filter(i => i.item_type === 'accommodation')
    ).total_subsidy;
    const mealSubsidy = calcGroupSummary(
      data.filter(i => i.item_type !== 'accommodation')
    ).total_subsidy;
    await syncSubsidyToIncome(expeditionId, summary.total_subsidy, {
      accommodation: accSubsidy,
      meal: mealSubsidy,
    });
  }, [expeditionId, onSummaryChange]);

  useEffect(() => { load(); }, [load]);

  const summary = calcGroupSummary(items);

  return (
    <div className="space-y-4">
      {/* サマリーバー */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-6 items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
            🏨 選手・監督 補助対象費
          </h2>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-500">実支出</span>
              <span className="font-bold ml-2 text-blue-800">{yen(summary.total_actual)}</span>
            </div>
            <div>
              <span className="text-gray-500">補助額</span>
              <span className="font-bold ml-2 text-green-700">{yen(summary.total_subsidy)}</span>
              <span className="text-xs text-gray-400 ml-1">↑収入計上</span>
            </div>
            <div>
              <span className="text-gray-500">差額負担</span>
              <span className="font-bold ml-2 text-amber-700">{yen(summary.total_net)}</span>
            </div>
          </div>
          <button
            className="bg-blue-800 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-900 flex items-center gap-2"
            onClick={() => setShowBulkInput(true)}
          >
            ＋ 一括入力
          </button>
        </div>
      </div>

      {/* 一括入力パネル（モーダル or インライン展開） */}
      {showBulkInput && (
        <BulkSubsidyInput
          expeditionId={expeditionId}
          members={members}
          startDate={startDate}
          endDate={endDate}
          onComplete={() => { setShowBulkInput(false); load(); }}
          onCancel={() => setShowBulkInput(false)}
        />
      )}

      {/* 個人別明細テーブル */}
      <SubsidyPersonTable
        items={items}
        members={members}
        loading={loading}
        onUpdate={load}
      />
    </div>
  );
}
```

---

## 🔄 Step 6: 既存ページへの統合

**ファイル: `src/app/expedition/[id]/page.tsx`**

以下の変更を加えること：

```tsx
// タブに「補助対象費」を追加
const TABS = [
  { id: 'summary',  label: '📊 収支サマリー' },
  { id: 'members',  label: '👥 名簿' },
  { id: 'subsidy',  label: '🏨 補助対象費' },  // ← NEW
  { id: 'income',   label: '💴 収入' },
  { id: 'transport',label: '🚌 交通費' },
  { id: 'other',    label: '📎 その他' },
];

// タブコンテンツに追加
case 'subsidy':
  return (
    <SubsidyPersonSection
      expeditionId={expeditionId}
      members={members}
      startDate={expedition.start_date}
      endDate={expedition.end_date}
      onSummaryChange={handleSubsidySummaryChange}
    />
  );
```

---

## ✅ Step 7: 動作確認チェックリスト

### Supabase
```
□ subsidy_person_items テーブルが作成されている
□ UNIQUE(expedition_id, member_id, date, item_type)が効いている
□ members テーブルに is_subsidy_eligible カラムがある
□ income_items に UNIQUE(expedition_id, category)制約がある
```

### 一括入力
```
□ 役職別グループで選手/顧問/応援等が分かれて表示される
□ グループごとの「全員選択」ボタンが機能する
□ 移動初日の朝食・昼食を選んだ時に警告バナーが出る
□ 移動日ルールで補助額が自動0になる
□ 差額プレビューが選択人数 × 差額で表示される
□ 「9名に登録」クリック後にテーブルが更新される
```

### 個人明細テーブル
```
□ 補助対象外の行がグレー表示される
□ 欠席行がグレー + 打ち消し線で表示される
□ ⋮メニューから「補助対象外に変更」が機能する
□ ⋮メニューから「欠席にする」が機能する
□ 金額セルをクリックして直接編集できる
□ テーブル最下部に実支出・補助・差額の合計が表示される
```

### 自動計上
```
□ 補助総額が income_items の 'subsidy_auto' に自動upsertされる
□ 収支サマリーの収入合計に反映されている
□ 金額変更後にサマリーが更新される
```

---

## 🚀 Step 8: デプロイ

```bash
# ビルド確認
npm run build

# エラーがなければpush
git add .
git commit -m "feat: 補助対象費 個人紐付け・一括入力システム追加

- subsidy_person_items テーブル追加（人×費用区分×日付）
- 役職別グループ一括入力（選手/顧問/応援で絞り込み複数選択）
- 移動日ルール自動判定（初日朝食・昼食、最終日夕食は自動除外）
- 個人別明細テーブル（インライン編集・補助対象外切替・欠席対応）
- 補助総額の収入自動計上
- コンテキストメニューから他の人への同内容適用"
git push origin main
```

---

## 💡 ビジネスロジック確認メモ

### 補助対象ルール（現場ルール）

| 役職 | 宿泊 | 食事（対象日） | 備考 |
|------|------|----------|------|
| 選手 | ✅ 全日補助 | ✅ 補助対象 | デフォルト対象 |
| 顧問 | ✅ 全日補助 | ✅ 補助対象 | デフォルト対象 |
| 外部指導者 | 個別設定 | 個別設定 | デフォルト対象外 |
| 応援 | ❌ 対象外 | ❌ 対象外 | 全額自己負担 |
| 引率 | 個別設定 | 個別設定 | 要確認 |

### 計算例（スプレッドシートの値）

```
田中くん 6/19(木) 夕食:
  実支出: ¥900
  補助額: ¥435
  差額:   ¥465 ← 学校が実質負担

田中くん 6/19(木) 宿泊:
  実支出: ¥14,000
  補助額: ¥12,000
  差額:   ¥2,000 ← 学校が実質負担

加藤くん（応援）6/19(木) 朝食（補助対象外）:
  実支出: ¥900
  補助額: ¥0 （対象外）
  差額:   ¥900 ← 全額自己負担または学校実費
```

---

*命令書バージョン: v3.0*
*作成日: 2026年5月29日*
*対象: ennseikeikaku / https://ennseikeikaku.vercel.app*