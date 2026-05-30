'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';

interface FormData {
  name: string;
  competition_name: string;
  year: number;
  start_date: string;
  end_date: string;
  destination: string;
  vehicle_type: 'microbus' | 'two_cars';
  useSample: boolean;
}

export default function NewExpeditionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      name: '',
      competition_name: '',
      year: new Date().getFullYear(),
      start_date: '',
      end_date: '',
      destination: '',
      vehicle_type: 'microbus',
      useSample: true,
    },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch('/api/expedition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...data,
        }),
      });
      if (!res.ok) throw new Error('作成に失敗しました');
      const { id } = await res.json();
      toast.success('遠征を作成しました');
      router.push(`/expedition/${id}`);
    } catch {
      toast.error('遠征の作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-primary mb-6">新規遠征を作成</h2>
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="遠征名"
            placeholder="例: R8 東北選手権 6月"
            {...register('name', { required: '遠征名は必須です' })}
            error={errors.name?.message}
          />
          <Input
            label="大会名"
            placeholder="例: 東北高等学校ウェイトリフティング選手権大会"
            {...register('competition_name', { required: '大会名は必須です' })}
            error={errors.competition_name?.message}
          />
          <Input
            label="年度"
            type="number"
            {...register('year', { required: true, valueAsNumber: true })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="開始日"
              type="date"
              {...register('start_date', { required: '開始日は必須です' })}
              error={errors.start_date?.message}
            />
            <Input
              label="終了日"
              type="date"
              {...register('end_date', { required: '終了日は必須です' })}
              error={errors.end_date?.message}
            />
          </div>
          <Input
            label="目的地"
            placeholder="例: 仙台市"
            {...register('destination', { required: '目的地は必須です' })}
            error={errors.destination?.message}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">移動手段</label>
            <select
              {...register('vehicle_type')}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2"
            >
              <option value="microbus">マイクロバス</option>
              <option value="two_cars">2台車</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('useSample')} className="rounded" />
            <span className="text-sm text-gray-700">サンプルデータ（東北選手権）を投入する</span>
          </label>
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? '作成中...' : '作成する'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              キャンセル
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
