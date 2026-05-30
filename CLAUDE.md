
# 🏋️ 部活動遠征収支計算アプリ - Cursor完全命令書
## プロジェクト名: `ennseikeikaku`

---

## 📁 フォルダ作成指示

デスクトップに `ennseikeikaku` フォルダを作成し、その中に以下の構成で全ファイルを作成すること。

```
ennseikeikaku/
├── README.md
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── .env.local.example
├── .gitignore
├── prisma/              ← 不使用（Supabase直接）
├── public/
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    ← トップ（遠征一覧）
│   │   ├── globals.css
│   │   ├── expedition/
│   │   │   ├── new/
│   │   │   │   └── page.tsx            ← 新規遠征作成
│   │   │   └── [id]/
│   │   │       ├── page.tsx            ← 遠征詳細・収支計算メイン
│   │   │       ├── members/
│   │   │       │   └── page.tsx        ← 名簿管理
│   │   │       ├── schedule/
│   │   │       │   └── page.tsx        ← 試合スケジュール
│   │   │       └── report/
│   │   │           └── page.tsx        ← 収支報告書出力
│   │   └── api/
│   │       └── expedition/
│   │           └── route.ts
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── Modal.tsx
│   │   ├── expedition/
│   │   │   ├── ExpeditionCard.tsx
│   │   │   ├── MemberTable.tsx
│   │   │   ├── CostCalculator.tsx      ← メイン計算コンポーネント
│   │   │   ├── IncomeSection.tsx
│   │   │   ├── ExpenseSection.tsx
│   │   │   ├── TransportSection.tsx
│   │   │   ├── AccommodationSection.tsx
│   │   │   ├── MealSection.tsx
│   │   │   ├── SummaryPanel.tsx        ← 収支サマリー（常に表示）
│   │   │   └── ReportExport.tsx        ← PDF/Excel出力
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── Footer.tsx
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── calculations.ts             ← 全計算ロジック
│   │   └── exportUtils.ts             ← PDF/Excel出力ロジック
│   ├── hooks/
│   │   ├── useExpedition.ts
│   │   └── useCalculations.ts
│   └── types/
│       └── expedition.ts               ← 全型定義
```

---

## 🗄️ Supabaseテーブル設計

以下のSQLをSupabaseのSQL Editorで実行すること。

```sql
-- 遠征マスター
CREATE TABLE expeditions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                          -- 例: "東北選手権 6月"
  competition_name TEXT NOT NULL,              -- 大会名
  year INTEGER NOT NULL,                       -- 年度（例: 2025）
  start_date DATE NOT NULL,                    -- 遠征開始日
  end_date DATE NOT NULL,                      -- 遠征終了日
  destination TEXT NOT NULL,                   -- 目的地
  school_name TEXT DEFAULT '羽黒高校',
  club_name TEXT DEFAULT 'ウェイトリフティング部',
  vehicle_type TEXT DEFAULT 'microbus',       -- 'microbus' | 'two_cars'
  notes TEXT,
  status TEXT DEFAULT 'draft',                 -- 'draft' | 'confirmed' | 'settled'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 参加者名簿
CREATE TABLE members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,                          -- 'athlete' | 'second' | 'supporter' | 'staff' | 'advisor'
  weight_class TEXT,                           -- 体重階級（選手のみ）
  participation_ih BOOLEAN DEFAULT false,      -- IH出場
  participation_tohoku BOOLEAN DEFAULT false,  -- 東北出場
  self_payment INTEGER DEFAULT 0,             -- 自己負担額（円）
  subsidy_amount INTEGER DEFAULT 0,           -- 補助額（円）
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 収入
CREATE TABLE income_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,                      -- 'club' | 'student_council' | 'subsidy' | 'self_burden' | 'other'
  label TEXT NOT NULL,                         -- 収入項目名
  amount INTEGER DEFAULT 0,                   -- 金額（円）
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 支出：宿泊費
CREATE TABLE accommodation_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE,
  plan_type TEXT DEFAULT 'two_meals',          -- '1泊2食' | '素泊まり' | '朝食付き'
  unit_price INTEGER DEFAULT 0,               -- 1人1泊料金
  breakfast_price INTEGER DEFAULT 0,          -- 朝食代
  nights INTEGER DEFAULT 1,                   -- 泊数
  subsidy_per_person INTEGER DEFAULT 0,       -- 1人当たり補助額
  notes TEXT
);

-- 支出：食事費（日別・区分別）
CREATE TABLE meal_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL,                     -- 'breakfast' | 'lunch' | 'dinner'
  target_count INTEGER DEFAULT 0,             -- 対象人数（補助あり）
  non_target_count INTEGER DEFAULT 0,         -- 対象外人数（自己負担）
  subsidy_count INTEGER DEFAULT 0,            -- 補助対象人数
  unit_price INTEGER DEFAULT 0,              -- 1食単価
  notes TEXT
);

-- 支出：交通費
CREATE TABLE transport_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE,
  transport_type TEXT NOT NULL,               -- 'rental_car' | 'travel_agency' | 'fuel' | 'shinkansen' | 'train' | 'taxi' | 'charter' | 'highway' | 'parking' | 'other'
  label TEXT NOT NULL,                        -- 表示名
  amount INTEGER DEFAULT 0,
  per_person BOOLEAN DEFAULT false,           -- 人数 × 単価か否か
  person_count INTEGER DEFAULT 1,
  notes TEXT,
  sort_order INTEGER DEFAULT 0
);

-- 支出：その他費用
CREATE TABLE other_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  notes TEXT,
  sort_order INTEGER DEFAULT 0
);

-- RLSポリシー（全ユーザーがアクセス可能 - 学校内利用前提）
ALTER TABLE expeditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE accommodation_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE other_costs ENABLE ROW LEVEL SECURITY;

-- 全操作を許可（学校内部ツールとして）
CREATE POLICY "allow_all" ON expeditions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON income_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON accommodation_costs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON meal_costs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON transport_costs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON other_costs FOR ALL USING (true) WITH CHECK (true);
```

---

## 📦 package.json

```json
{
  "name": "ennseikeikaku",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "^18",
    "react-dom": "^18",
    "@supabase/supabase-js": "^2.45.0",
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "tailwindcss": "^3.4.1",
    "autoprefixer": "^10.0.1",
    "postcss": "^8",
    "clsx": "^2.1.1",
    "react-hook-form": "^7.52.0",
    "date-fns": "^3.6.0",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.2",
    "xlsx": "^0.18.5",
    "lucide-react": "^0.400.0",
    "react-hot-toast": "^2.4.1"
  },
  "devDependencies": {
    "eslint": "^8",
    "eslint-config-next": "14.2.5"
  }
}
```

---

## 🔧 src/types/expedition.ts（全型定義）

```typescript
export type VehicleType = 'microbus' | 'two_cars';
export type MemberRole = 'athlete' | 'second' | 'supporter' | 'staff' | 'advisor';
export type ExpeditionStatus = 'draft' | 'confirmed' | 'settled';
export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type TransportType =
  | 'rental_car' | 'travel_agency' | 'fuel' | 'shinkansen'
  | 'train' | 'taxi' | 'charter' | 'highway' | 'parking' | 'other';
export type IncomeCategory =
  | 'club' | 'student_council' | 'subsidy' | 'self_burden' | 'other';

export interface Expedition {
  id: string;
  name: string;
  competition_name: string;
  year: number;
  start_date: string;
  end_date: string;
  destination: string;
  school_name: string;
  club_name: string;
  vehicle_type: VehicleType;
  notes?: string;
  status: ExpeditionStatus;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  expedition_id: string;
  name: string;
  role: MemberRole;
  weight_class?: string;
  participation_ih: boolean;
  participation_tohoku: boolean;
  self_payment: number;
  subsidy_amount: number;
  notes?: string;
  sort_order: number;
}

export interface IncomeItem {
  id: string;
  expedition_id: string;
  category: IncomeCategory;
  label: string;
  amount: number;
  notes?: string;
}

export interface AccommodationCost {
  id: string;
  expedition_id: string;
  plan_type: string;
  unit_price: number;
  breakfast_price: number;
  nights: number;
  subsidy_per_person: number;
  notes?: string;
}

export interface MealCost {
  id: string;
  expedition_id: string;
  date: string;
  meal_type: MealType;
  target_count: number;
  non_target_count: number;
  subsidy_count: number;
  unit_price: number;
  notes?: string;
}

export interface TransportCost {
  id: string;
  expedition_id: string;
  transport_type: TransportType;
  label: string;
  amount: number;
  per_person: boolean;
  person_count: number;
  notes?: string;
  sort_order: number;
}

export interface OtherCost {
  id: string;
  expedition_id: string;
  label: string;
  amount: number;
  notes?: string;
  sort_order: number;
}

// 計算結果の型
export interface ExpeditionSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;                  // totalIncome - totalExpense（正=黒字、負=赤字）
  accommodationTotal: number;
  mealTotal: number;
  transportTotal: number;
  otherTotal: number;
  memberSelfPaymentTotal: number;
  incomeByCategory: Record<IncomeCategory, number>;
  memberCount: {
    athletes: number;
    seconds: number;
    supporters: number;
    staff: number;
    total: number;
  };
}
```

---

## 🧮 src/lib/calculations.ts（計算ロジック）

```typescript
import type {
  Member, IncomeItem, AccommodationCost, MealCost,
  TransportCost, OtherCost, ExpeditionSummary
} from '@/types/expedition';

export function calculateSummary(
  members: Member[],
  incomeItems: IncomeItem[],
  accommodation: AccommodationCost | null,
  mealCosts: MealCost[],
  transportCosts: TransportCost[],
  otherCosts: OtherCost[]
): ExpeditionSummary {

  // 収入合計
  const totalIncome = incomeItems.reduce((sum, item) => sum + item.amount, 0);
  const incomeByCategory = incomeItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  // 宿泊費合計
  let accommodationTotal = 0;
  if (accommodation) {
    const athletes = members.filter(m => m.role === 'athlete').length;
    const seconds = members.filter(m => m.role === 'second').length;
    const targetCount = athletes + seconds;
    const unitCost = accommodation.unit_price + accommodation.breakfast_price;
    const totalCost = unitCost * targetCount * accommodation.nights;
    const totalSubsidy = accommodation.subsidy_per_person * targetCount * accommodation.nights;
    accommodationTotal = totalCost - totalSubsidy;
  }

  // 食事費合計
  const mealTotal = mealCosts.reduce((sum, meal) => {
    return sum + (meal.unit_price * (meal.target_count + meal.non_target_count));
  }, 0);

  // 交通費合計
  const transportTotal = transportCosts.reduce((sum, t) => {
    return sum + (t.per_person ? t.amount * t.person_count : t.amount);
  }, 0);

  // その他合計
  const otherTotal = otherCosts.reduce((sum, o) => sum + o.amount, 0);

  // 自己負担合計
  const memberSelfPaymentTotal = members.reduce((sum, m) => sum + m.self_payment, 0);

  const totalExpense = accommodationTotal + mealTotal + transportTotal + otherTotal;
  const balance = totalIncome - totalExpense;

  return {
    totalIncome,
    totalExpense,
    balance,
    accommodationTotal,
    mealTotal,
    transportTotal,
    otherTotal,
    memberSelfPaymentTotal,
    incomeByCategory: incomeByCategory as any,
    memberCount: {
      athletes: members.filter(m => m.role === 'athlete').length,
      seconds: members.filter(m => m.role === 'second').length,
      supporters: members.filter(m => m.role === 'supporter').length,
      staff: members.filter(m => m.role === 'staff').length,
      total: members.length,
    }
  };
}

// 金額フォーマット
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount);
};

// 日付フォーマット
export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

// 曜日付き日付
export const formatDateWithDay = (dateStr: string): string => {
  const date = new Date(dateStr);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${date.getMonth() + 1}月${date.getDate()}日(${days[date.getDay()]})`;
};
```

---

## 🗃️ src/lib/supabase.ts

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## 🎨 src/app/globals.css（デザインテーマ）

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary: #1a3a5c;        /* 深紺 - 学校・部活の格式 */
  --primary-light: #2d5f8a;
  --accent: #e85d04;         /* オレンジ - ウェイトリフティング */
  --accent-light: #f48c06;
  --success: #2d6a4f;        /* 緑 - 黒字 */
  --danger: #c1121f;         /* 赤 - 赤字・不足 */
  --warning: #f77f00;        /* 黄橙 - 注意 */
  --bg: #f8f9fa;
  --bg-card: #ffffff;
  --text: #212529;
  --text-muted: #6c757d;
  --border: #dee2e6;
}

body {
  background-color: var(--bg);
  color: var(--text);
  font-family: 'Noto Sans JP', 'Hiragino Sans', sans-serif;
}

/* 収支バランス表示 */
.balance-positive { color: var(--success); }
.balance-negative { color: var(--danger); }

/* 入力フィールド共通 */
.input-currency {
  @apply text-right font-mono text-lg border-2 border-gray-200 rounded-lg p-2
         focus:border-blue-500 focus:outline-none transition-colors;
}

/* カード */
.section-card {
  @apply bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4;
}
```

---

## 📄 src/app/expedition/[id]/page.tsx（メイン収支計算画面）

以下の仕様で実装すること：

### UI構成
```
┌────────────────────────────────────────────────────────┐
│ ヘッダー: 遠征名 / 大会名 / 期間 / 状態バッジ            │
├────────────────────────┬───────────────────────────────┤
│                        │  📊 収支サマリー（固定表示）    │
│  左ペイン（入力）       │  ┌─────────────────────────┐  │
│                        │  │ 収入合計    ¥XXX,XXX     │  │
│  ① 収入セクション      │  │ 支出合計    ¥XXX,XXX     │  │
│  ② 参加者・自己負担    │  │ ━━━━━━━━━━━━━━━━━━━━━   │  │
│  ③ 宿泊費             │  │ 収支差額 ±¥XX,XXX        │  │
│  ④ 食事費（日別）      │  │   ▲黒字 / ▼赤字         │  │
│  ⑤ 交通費             │  └─────────────────────────┘  │
│  ⑥ その他費用         │                               │
│                        │  📋 内訳                      │
│                        │  宿泊費   ¥XX,XXX            │
│                        │  食事費   ¥XX,XXX            │
│                        │  交通費   ¥XX,XXX            │
│                        │  その他   ¥XX,XXX            │
│                        │                               │
│                        │  [📄 報告書を出力]             │
│                        │  [📊 Excelで出力]             │
└────────────────────────┴───────────────────────────────┘
```

### 実装ポイント
- **リアルタイム計算**: 数値入力のたびに右パネルの合計が即座に更新される
- **自動保存**: 入力から1秒後に自動でSupabaseに保存（デバウンス）
- **入力検証**: 負の数値を入れた場合は0にリセット、金額は整数のみ
- **収支色分け**: 黒字=緑、赤字=赤でバランス表示
- **参加者区分**:
  - 選手（athlete）: 自己負担あり、宿泊・補助対象
  - セコンド（second）: 自己負担あり、宿泊対象
  - 応援（supporter）: 自己負担あり、補助対象外
  - 引率（staff）: 費用は別管理
  - 顧問（advisor）: 費用は別管理

---

## 📄 src/components/expedition/CostCalculator.tsx（実装仕様）

### ① 収入セクション（IncomeSection）
```
収入項目一覧（追加・削除可能）:
- クラブ費収入
- 生徒会補助
- 学校補助金
- 自己負担徴収合計（←名簿から自動計算）
- その他収入
+ [項目を追加] ボタン
━━━━━━━━━━━━━━━
収入合計: ¥XXX,XXX
```

### ② 参加者・個人負担セクション
```
氏名 | 役職 | 自己負担額 | 補助額 | 備考
-------------------------------------------
田中〇〇 | 選手 | [¥7,000] | [¥0] |
佐藤〇〇 | 選手 | [¥7,000] | [¥0] |
...
石川〇〇 | セコンド | [¥7,000] | [¥0] |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
自己負担合計: ¥70,000  人数: 10名
```

### ③ 宿泊費セクション（AccommodationSection）
```
宿泊プラン: [1泊2食 ▼]
1人1泊料金: [¥14,000]
朝食代（別途）: [¥600]
補助額（1人1泊）: [¥12,000]
泊数: [2]
対象人数: 選手+セコンド = 10名（自動計算）
━━━━━━━━━━━━━━━━━━━━━━
宿泊費合計（補助後）: ¥XX,XXX
（内 補助額: ¥XX,XXX）
```

### ④ 食事費セクション（日別・MealSection）
```
日付タブ: [6/19(木)] [6/20(土)] [6/21(日)]

6月19日(木)
  | 区分 | 補助対象 | 対象外 | 補助人数 |
  | 朝  | [10]   | [0]  | [10]   |
  | 昼  | [10]   | [0]  | [10]   |
  | 夕  | [10]   | [0]  | [10]   |
  食事単価: 朝[¥864] 昼[¥900] 夕[¥435]
━━━━━━━━━━━━━━━━
食事費合計: ¥XX,XXX
```

### ⑤ 交通費セクション（TransportSection）
```
項目          | 金額      | 備考
----------------------------------
レンタカー     | [¥0    ] |
旅行代        | [¥0    ] |
燃料代        | [¥0    ] |
新幹線代      | [¥0    ] |
電車代        | [¥0    ] |
タクシー代     | [¥0    ] |
チャーター代   | [¥0    ] |
高速道路代    | [¥0    ] |
駐車代        | [¥0    ] |
その他        | [¥0    ] |
+ [項目を追加]
━━━━━━━━━━━━━━━━
交通費合計: ¥XX,XXX
```

---

## 📄 報告書出力仕様（ReportExport.tsx）

### PDF出力（jspdf + jspdf-autotable）
出力内容:
1. タイトル: 「令和〇年度 〇〇大会 遠征費用報告書」
2. 基本情報表: 学校名・部活動名・大会名・期間・行先・参加人数
3. 収入一覧表
4. 支出一覧表（宿泊・食事・交通・その他）
5. 収支差額
6. 参加者名簿

### Excel出力（xlsx）
- Sheet1: 収支サマリー
- Sheet2: 収入明細
- Sheet3: 支出明細（宿泊・食事・交通・その他）
- Sheet4: 名簿

---

## 🌐 src/app/page.tsx（トップページ：遠征一覧）

```
┌─────────────────────────────────────────┐
│ 🏋️ 遠征収支管理システム                   │
│ 羽黒高校 ウェイトリフティング部             │
├─────────────────────────────────────────┤
│ [+ 新規遠征を作成]                         │
├─────────────────────────────────────────┤
│ 遠征カード一覧（新しい順）                  │
│                                           │
│ ┌──────────────────────────────────┐    │
│ │ R8 東北選手権 6月                  │    │
│ │ 2026/6/19〜6/21 | 仙台市          │    │
│ │ 参加: 10名 | 状態: 作成中          │    │
│ │ 収支: ▲¥73,295（黒字）            │    │
│ │ [詳細を開く] [複製] [削除]         │    │
│ └──────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## ⚙️ 環境変数（.env.local.example）

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5...
```

---

## 🚀 デプロイ手順

### 1. GitHubにプッシュ
```bash
cd ~/Desktop/ennseikeikaku
git init
git add .
git commit -m "feat: 遠征収支計算アプリ 初期実装"
git remote add origin https://github.com/[ユーザー名]/ennseikeikaku.git
git push -u origin main
```

### 2. Vercelにデプロイ
1. https://vercel.com にアクセス
2. 「Add New Project」→ GitHubリポジトリ「ennseikeikaku」を選択
3. Environment Variablesに以下を設定:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. 「Deploy」ボタンをクリック

### 3. Supabase設定
1. https://supabase.com でプロジェクト作成
2. SQL Editorで上記のCREATE TABLE文を全て実行
3. Project Settings > API からURLとAnon Keyをコピーして.env.localに設定

---

## ✅ 実装チェックリスト

- [ ] Supabaseテーブル作成（SQL実行）
- [ ] .env.local にSupabase接続情報設定
- [ ] npm install
- [ ] 全コンポーネント実装
- [ ] リアルタイム収支計算の動作確認
- [ ] 自動保存（デバウンス）の動作確認
- [ ] PDF出力の動作確認
- [ ] Excel出力の動作確認
- [ ] GitHub push
- [ ] Vercelデプロイ
- [ ] 動作確認（本番URL）

---

## 💡 Cursorへの補足指示

1. **日本語UI徹底**: ボタン・ラベル・エラーメッセージ全て日本語にすること
2. **スマホ対応**: 現場での入力を考えTailwindでレスポンシブ対応すること
3. **入力しやすさ優先**: 金額入力はテンキー対応、Tabキーで次フィールドへ移動
4. **コンポーネント分割**: 各セクションは独立したコンポーネントとし、再利用可能に
5. **エラーハンドリング**: Supabase保存失敗時はトースト通知で教える
6. **遠征の複製機能**: 毎年同様の遠征があるため、前回データをコピーして編集できるようにする
7. **初期データ投入**: 実装完了後、上記スプレッドシートの東北選手権データをサンプルとして投入すること

---

*作成日: 2026年5月*  
*対象学校: 学校法人羽黒学園 羽黒高校 ウェイトリフティング部*  
*作成ツール: Claude Sonnet 4.6*