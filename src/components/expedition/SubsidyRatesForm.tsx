'use client';

import { useState, useEffect } from 'react';
import type { SubsidyRates } from '@/types/expedition';
import { getSubsidyRates, saveSubsidyRates } from '@/lib/personalCostApi';

interface Props {
  expeditionId: string;
  onRatesChange: (rates: SubsidyRates) => void;
}

const FIELDS: { key: keyof SubsidyRates; label: string; hint: string }[] = [
  { key: 'accommodation_rate', label: '宿泊補助単価', hint: '1人1泊あたり' },
  { key: 'breakfast_rate', label: '朝食補助単価', hint: '1人1食あたり' },
  { key: 'lunch_rate', label: '昼食補助単価', hint: '1人1食あたり' },
  { key: 'dinner_rate', label: '夕食補助単価', hint: '1人1食あたり' },
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
      if (r) {
        setRates(r);
        onRatesChange(r);
      }
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
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <span className="text-base">🏦</span>
          ② 選手・監督 補助対象費（補助単価マスター）
        </h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-800 text-white hover:bg-blue-900 disabled:opacity-50"
        >
          {saving ? '保存中...' : saved ? '✓ 保存済み' : '💾 保存'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        補助単価を登録します。個人への適用は下の③で行います。
      </p>

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
                value={(rates[f.key] as number) || ''}
                onChange={e => handleChange(f.key, parseInt(e.target.value) || 0)}
                onFocus={e => e.target.select()}
                placeholder="0"
                className="input-num w-full"
              />
            </div>
          </div>
        ))}
      </div>

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
