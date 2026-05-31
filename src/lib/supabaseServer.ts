import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseServer(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabaseの環境変数が未設定です。Vercelの Environment Variables に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定し、再デプロイしてください。'
    );
  }

  return createClient(url, key);
}

interface SupabaseLikeError {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
}

export function formatSupabaseError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return error instanceof Error ? error.message : 'サーバーエラー';
  }

  const err = error as SupabaseLikeError;
  const message = err.message || 'サーバーエラー';

  if (err.code === 'PGRST205' || message.includes('schema cache')) {
    return 'データベースのテーブルが未作成です。Supabase の SQL Editor で supabase/schema.sql を実行してください。';
  }

  if (message.includes('Invalid API key') || message.includes('JWT')) {
    return 'Supabase APIキーが正しくありません。Project Settings > API から anon key を確認してください。';
  }

  return [message, err.details, err.hint].filter(Boolean).join(' ');
}

export async function assertSupabaseOk<T>(
  result: { data: T; error: SupabaseLikeError | null }
): Promise<T> {
  if (result.error) {
    throw result.error;
  }
  return result.data;
}
