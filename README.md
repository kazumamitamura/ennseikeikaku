# 遠征収支管理システム (ennseikeikaku)

羽黒高校 ウェイトリフティング部向けの部活動遠征収支計算アプリです。

## 機能

- 遠征の作成・一覧・複製・削除
- 収入・支出（宿泊・食事・交通・その他）のリアルタイム計算
- 参加者名簿と自己負担管理
- PDF / Excel 報告書出力
- Supabase による自動保存

## セットアップ

1. 依存関係をインストール

```bash
npm install
```

2. `.env.local.example` を `.env.local` にコピーし、Supabase の接続情報を設定

3. Supabase SQL Editor で `supabase/schema.sql` を実行

4. 開発サーバーを起動

```bash
npm run dev
```

## デプロイ

Vercel に GitHub リポジトリを連携し、環境変数 `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定してください。
