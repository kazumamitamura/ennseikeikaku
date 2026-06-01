'use client';

import { useState, useMemo, useRef } from 'react';
import { MoreVertical, Edit2, Check, X } from 'lucide-react';
import type { Member, SubsidyPersonItem, MemberRole } from '@/types/expedition';
import { SUBSIDY_ITEM_LABELS, MEMBER_ROLE_LABELS } from '@/types/expedition';
import { calcPersonItem, calcGroupSummary, toJpDate, yen } from '@/lib/subsidyPersonCalc';
import {
  upsertSubsidyPersonItem,
  toggleSkip, toggleSubsidyTarget, deleteSubsidyPersonItem,
} from '@/lib/subsidyPersonApi';

interface Props {
  items: SubsidyPersonItem[];
  members: Member[];
  loading: boolean;
  onUpdate: () => void;
  onOpenBulkForMember?: (memberId: string) => void;
}

type FilterDate = 'all' | string;
type FilterType = 'all' | SubsidyPersonItem['item_type'];
type FilterRole = 'all' | MemberRole;

export default function SubsidyPersonTable({
  items, members, loading, onUpdate, onOpenBulkForMember,
}: Props) {
  const [filterDate, setFilterDate] = useState<FilterDate>('all');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterRole, setFilterRole] = useState<FilterRole>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editActual, setEditActual] = useState(0);
  const [editSubsidy, setEditSubsidy] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // メンバーIDからメンバー情報へのマップ
  const memberMap = useMemo(
    () => new Map(members.map(m => [m.id, m])),
    [members]
  );

  // 日付・種別の選択肢
  const dates = useMemo(
    () => Array.from(new Set(items.map(i => i.date))).sort(),
    [items]
  );

  // フィルタリング
  const filtered = useMemo(() => {
    return items.filter(i => {
      if (filterDate !== 'all' && i.date !== filterDate) return false;
      if (filterType !== 'all' && i.item_type !== filterType) return false;
      if (filterRole !== 'all') {
        const m = memberMap.get(i.member_id);
        if (!m || m.role !== filterRole) return false;
      }
      return true;
    });
  }, [items, filterDate, filterType, filterRole, memberMap]);

  // メンバーごとにグループ化
  const groupedByMember = useMemo(() => {
    const map = new Map<string, SubsidyPersonItem[]>();
    for (const item of filtered) {
      const arr = map.get(item.member_id) ?? [];
      arr.push(item);
      map.set(item.member_id, arr);
    }
    return map;
  }, [filtered]);

  const totalSummary = useMemo(() => calcGroupSummary(items), [items]);

  const handleToggleSkip = async (item: SubsidyPersonItem) => {
    setSavingId(item.id);
    try {
      await toggleSkip(item.id, !item.is_skipped, item.is_skipped ? undefined : '欠席');
      onUpdate();
    } finally {
      setSavingId(null);
      setMenuOpenId(null);
    }
  };

  const handleToggleTarget = async (item: SubsidyPersonItem) => {
    setSavingId(item.id);
    try {
      await toggleSubsidyTarget(item.id, !item.is_subsidy_target);
      onUpdate();
    } finally {
      setSavingId(null);
      setMenuOpenId(null);
    }
  };

  const handleDelete = async (item: SubsidyPersonItem) => {
    if (!confirm('このレコードを削除しますか？')) return;
    setSavingId(item.id);
    try {
      await deleteSubsidyPersonItem(item.id);
      onUpdate();
    } finally {
      setSavingId(null);
      setMenuOpenId(null);
    }
  };

  const startEdit = (item: SubsidyPersonItem) => {
    setEditingId(item.id);
    setEditActual(item.actual_amount);
    setEditSubsidy(item.subsidy_amount);
    setMenuOpenId(null);
  };

  const saveEdit = async (item: SubsidyPersonItem) => {
    setSavingId(item.id);
    try {
      const { id, created_at, updated_at, ...rest } = item;
      await upsertSubsidyPersonItem({
        ...rest,
        actual_amount: editActual,
        subsidy_amount: editSubsidy,
      });
      setEditingId(null);
      onUpdate();
    } finally {
      setSavingId(null);
    }
  };

  const uniqueRoles = useMemo(
    () => Array.from(new Set(members.map(m => m.role))),
    [members]
  );

  if (loading) {
    return <div className="text-center text-gray-400 py-8">読み込み中...</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* フィルターバー */}
      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border-b border-gray-100">
        <select
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
        >
          <option value="all">全日程</option>
          {dates.map(d => (
            <option key={d} value={d}>{toJpDate(d)}</option>
          ))}
        </select>
        <select
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
          value={filterType}
          onChange={e => setFilterType(e.target.value as FilterType)}
        >
          <option value="all">全費用区分</option>
          <option value="accommodation">🏨 宿泊</option>
          <option value="breakfast">🍳 朝食</option>
          <option value="lunch">🥗 昼食</option>
          <option value="dinner">🍱 夕食</option>
        </select>
        <select
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
          value={filterRole}
          onChange={e => setFilterRole(e.target.value as FilterRole)}
        >
          <option value="all">全役職</option>
          {uniqueRoles.map(r => (
            <option key={r} value={r}>{MEMBER_ROLE_LABELS[r]}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500 self-center ml-auto">
          {filtered.length}件
        </span>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 w-28">氏名</th>
              <th className="text-left py-2 px-2 text-xs font-semibold text-gray-600 w-16">役職</th>
              <th className="text-left py-2 px-2 text-xs font-semibold text-gray-600 w-20">区分</th>
              <th className="text-left py-2 px-2 text-xs font-semibold text-gray-600 w-20">日付</th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-blue-700 w-24">実支出</th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-green-700 w-24">補助額</th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-amber-700 w-24">差額負担</th>
              <th className="text-center py-2 px-2 text-xs font-semibold text-gray-600 w-12">対象</th>
              <th className="py-2 px-1 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {Array.from(groupedByMember.entries()).map(([memberId, memberItems]) => {
              const member = memberMap.get(memberId);
              return memberItems.map((item, idx) => {
                const calc = calcPersonItem(item);
                const isEditing = editingId === item.id;
                const isSaving = savingId === item.id;
                const rowClass = item.is_skipped
                  ? 'bg-gray-100 opacity-70'
                  : !item.is_subsidy_target
                  ? 'bg-gray-50'
                  : '';

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-gray-50 hover:bg-blue-50/10 ${rowClass} ${
                      idx === 0 && memberId !== Array.from(groupedByMember.keys())[0]
                        ? 'border-t-2 border-gray-200'
                        : ''
                    }`}
                  >
                    {/* 氏名 */}
                    <td className="py-1.5 px-3 text-sm font-medium">
                      {idx === 0 ? member?.name ?? '不明' : ''}
                    </td>
                    {/* 役職 */}
                    <td className="py-1.5 px-2 text-xs text-gray-500">
                      {idx === 0 && member ? MEMBER_ROLE_LABELS[member.role] : ''}
                    </td>
                    {/* 区分 */}
                    <td className="py-1.5 px-2 text-xs">
                      {SUBSIDY_ITEM_LABELS[item.item_type]}
                    </td>
                    {/* 日付 */}
                    <td className="py-1.5 px-2 text-xs text-gray-500">
                      {toJpDate(item.date)}
                    </td>

                    {/* 実支出 */}
                    <td className="py-1.5 px-2 text-right">
                      {isEditing ? (
                        <input
                          type="number" min="0"
                          className="w-20 border border-blue-300 rounded px-1 text-right text-sm focus:outline-none"
                          value={editActual}
                          onChange={e => setEditActual(parseInt(e.target.value) || 0)}
                          onFocus={e => e.target.select()}
                          autoFocus
                        />
                      ) : item.is_skipped ? (
                        <span className="text-gray-400 line-through text-xs">欠席</span>
                      ) : (
                        <span
                          className="font-mono text-blue-800 cursor-pointer hover:bg-blue-50 px-1 rounded"
                          onClick={() => startEdit(item)}
                        >
                          {yen(calc.effective_expense)}
                        </span>
                      )}
                    </td>

                    {/* 補助額 */}
                    <td className="py-1.5 px-2 text-right">
                      {isEditing ? (
                        <input
                          type="number" min="0"
                          className="w-20 border border-green-300 rounded px-1 text-right text-sm focus:outline-none"
                          value={editSubsidy}
                          onChange={e => setEditSubsidy(parseInt(e.target.value) || 0)}
                          onFocus={e => e.target.select()}
                        />
                      ) : item.is_skipped ? (
                        <span className="text-gray-400">—</span>
                      ) : !item.is_subsidy_target ? (
                        <span className="text-gray-400 text-xs">対象外</span>
                      ) : (
                        <span className="font-mono text-green-700">
                          {yen(calc.effective_subsidy)}
                        </span>
                      )}
                    </td>

                    {/* 差額 */}
                    <td className="py-1.5 px-2 text-right">
                      {item.is_skipped ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span className={`font-mono font-medium ${
                          calc.net_amount >= 3000 ? 'text-amber-700 bg-amber-50 px-1 rounded' :
                          calc.net_amount > 0 ? 'text-amber-600' : 'text-green-700'
                        }`}>
                          {yen(calc.net_amount)}
                        </span>
                      )}
                    </td>

                    {/* 補助対象フラグ */}
                    <td className="py-1.5 px-2 text-center">
                      {item.is_skipped ? (
                        <span className="text-xs bg-gray-200 text-gray-600 px-1 rounded">skip</span>
                      ) : item.auto_excluded ? (
                        <span className="text-xs text-orange-500" title={item.auto_exclude_reason ?? ''}>
                          自動除外
                        </span>
                      ) : (
                        <span className={`text-xs font-bold ${item.is_subsidy_target ? 'text-green-600' : 'text-gray-400'}`}>
                          {item.is_subsidy_target ? '✓' : '✗'}
                        </span>
                      )}
                    </td>

                    {/* コンテキストメニュー */}
                    <td className="py-1.5 px-1 text-center relative">
                      {isEditing ? (
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => saveEdit(item)}
                            disabled={isSaving}
                            className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                            title="保存"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-0.5 text-gray-400 hover:bg-gray-50 rounded"
                            title="キャンセル"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
                            className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {menuOpenId === item.id && (
                            <div
                              ref={menuRef}
                              className="absolute right-0 top-6 z-50 bg-white border border-gray-200 rounded-lg shadow-lg text-xs w-44 overflow-hidden"
                            >
                              <button
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                                onClick={() => startEdit(item)}
                              >
                                <Edit2 className="w-3 h-3" /> 金額を編集
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 hover:bg-gray-50"
                                onClick={() => handleToggleTarget(item)}
                              >
                                {item.is_subsidy_target ? '❌ 補助対象外に変更' : '✅ 補助対象に戻す'}
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 hover:bg-gray-50"
                                onClick={() => handleToggleSkip(item)}
                              >
                                {item.is_skipped ? '↩️ 欠席を解除' : '🚫 欠席にする'}
                              </button>
                              {onOpenBulkForMember && (
                                <button
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                                  onClick={() => {
                                    onOpenBulkForMember(memberId);
                                    setMenuOpenId(null);
                                  }}
                                >
                                  👥 同内容を他の人にも
                                </button>
                              )}
                              <button
                                className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600"
                                onClick={() => handleDelete(item)}
                              >
                                🗑️ この行を削除
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold">
              <td colSpan={4} className="py-2 px-3 text-sm">合計</td>
              <td className="py-2 px-2 text-right font-mono text-blue-800">
                {yen(totalSummary.total_actual)}
              </td>
              <td className="py-2 px-2 text-right font-mono text-green-700">
                {yen(totalSummary.total_subsidy)}
                <div className="text-xs font-normal text-gray-500">↑収入計上</div>
              </td>
              <td className="py-2 px-2 text-right font-mono text-amber-700">
                {yen(totalSummary.total_net)}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-gray-400 py-8 text-sm">
          データがありません。「一括入力」ボタンから登録してください。
        </div>
      )}
    </div>
  );
}
