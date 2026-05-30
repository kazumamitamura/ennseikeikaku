'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import ExpeditionCard from '@/components/expedition/ExpeditionCard';
import Modal from '@/components/ui/Modal';
import { useExpeditions } from '@/hooks/useExpedition';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { calculateSummary } from '@/lib/calculations';
import { getEffectiveIncomeItems } from '@/components/expedition/IncomeSection';
import type { Expedition, Member, IncomeItem } from '@/types/expedition';
import toast from 'react-hot-toast';

interface ExpeditionWithSummary extends Expedition {
  balance?: number;
  memberCount?: number;
}

export default function HomePageClient() {
  const { expeditions, loading, refetch } = useExpeditions();
  const [expeditionsWithSummary, setExpeditionsWithSummary] = useState<ExpeditionWithSummary[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loadingSummaries, setLoadingSummaries] = useState(false);

  const loadSummaries = useCallback(async (expList: Expedition[]) => {
    setLoadingSummaries(true);
    const results: ExpeditionWithSummary[] = [];

    for (const exp of expList) {
      const [memRes, incRes, accRes, mealRes, transRes, otherRes] = await Promise.all([
        supabase.from('members').select('*').eq('expedition_id', exp.id),
        supabase.from('income_items').select('*').eq('expedition_id', exp.id),
        supabase.from('accommodation_costs').select('*').eq('expedition_id', exp.id).maybeSingle(),
        supabase.from('meal_costs').select('*').eq('expedition_id', exp.id),
        supabase.from('transport_costs').select('*').eq('expedition_id', exp.id),
        supabase.from('other_costs').select('*').eq('expedition_id', exp.id),
      ]);

      const members = (memRes.data || []) as Member[];
      const incomeItems = (incRes.data || []) as IncomeItem[];
      const selfPaymentTotal = members.reduce((s, m) => s + m.self_payment, 0);
      const effectiveIncome = getEffectiveIncomeItems(incomeItems, selfPaymentTotal);

      const summary = calculateSummary(
        members,
        effectiveIncome,
        accRes.data,
        mealRes.data || [],
        transRes.data || [],
        otherRes.data || []
      );

      results.push({
        ...exp,
        balance: summary.balance,
        memberCount: members.length,
      });
    }

    setExpeditionsWithSummary(results);
    setLoadingSummaries(false);
  }, []);

  useEffect(() => {
    if (expeditions.length > 0) {
      loadSummaries(expeditions);
    } else {
      setExpeditionsWithSummary([]);
    }
  }, [expeditions, loadSummaries]);

  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch('/api/expedition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', expeditionId: id }),
      });
      if (!res.ok) throw new Error('複製に失敗しました');
      const { id: newId } = await res.json();
      toast.success('遠征を複製しました');
      refetch();
      window.location.href = `/expedition/${newId}`;
    } catch {
      toast.error('複製に失敗しました');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('expeditions').delete().eq('id', deleteId);
    if (error) {
      toast.error('削除に失敗しました');
    } else {
      toast.success('削除しました');
      refetch();
    }
    setDeleteId(null);
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-primary mb-4">Supabase未設定</h2>
        <p className="text-gray-600 mb-4">
          .env.local に Supabase の接続情報を設定してください。
        </p>
        <p className="text-sm text-gray-500">
          .env.local.example を参考に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">遠征一覧</h2>
        <Link href="/expedition/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            新規遠征を作成
          </Button>
        </Link>
      </div>

      {loading || loadingSummaries ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : expeditionsWithSummary.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-500 mb-4">まだ遠征が登録されていません</p>
          <Link href="/expedition/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              最初の遠征を作成
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {expeditionsWithSummary.map(exp => (
            <ExpeditionCard
              key={exp.id}
              expedition={exp}
              balance={exp.balance}
              memberCount={exp.memberCount}
              onDuplicate={handleDuplicate}
              onDelete={setDeleteId}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="遠征の削除"
        size="sm"
      >
        <p className="text-gray-600 mb-4">この遠征を削除しますか？この操作は取り消せません。</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>キャンセル</Button>
          <Button variant="danger" onClick={handleDelete}>削除</Button>
        </div>
      </Modal>
    </div>
  );
}
