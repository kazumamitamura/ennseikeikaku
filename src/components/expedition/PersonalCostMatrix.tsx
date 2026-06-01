'use client';

import { useState, useEffect, useCallback } from 'react';
import BulkInputPanel from './BulkInputPanel';
import type {
  PersonalCost, PersonalCostItemType, SubsidyRates, Member, MemberRole,
} from '@/types/expedition';
import {
  ITEM_LABELS, ITEM_ORDER, MEMBER_ROLE_LABELS,
} from '@/types/expedition';
import {
  calcRow, calcSummary, makeDateRange, jpDate, rateForItem, yen,
} from '@/lib/personalCostCalc';
import {
  getPersonalCosts, upsertPersonalCost, updatePersonalCostFlag,
  deletePersonalCost, syncPersonalCostToIncome,
} from '@/lib/personalCostApi';

interface Props {
  expeditionId: string;
  members: Member[];
  startDate: string;
  endDate: string;
  rates: SubsidyRates;
  onSummaryChange?: (s: ReturnType<typeof calcSummary>) => void;
}

function RoleBadge({ role }: { role: MemberRole }) {
  const styles: Record<MemberRole, string> = {
    athlete: 'bg-blue-50 text-blue-800',
    advisor: 'bg-purple-50 text-purple-800',
    second: 'bg-cyan-50 text-cyan-800',
    external_coach: 'bg-orange-50 text-orange-800',
    supporter: 'bg-yellow-50 text-yellow-800',
    staff: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${styles[role]}`}>
      {MEMBER_ROLE_LABELS[role]}
    </span>
  );
}

function PersonalCostSummary({ summary }: { summary: ReturnType<typeof calcSummary> }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <span>📊</span> 補助対象費サマリー（全日程合計）
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        {[
          { label: '宿泊費', icon: '🏨', actual: summary.accommodation_actual, subsidy: summary.accommodation_subsidy, net: summary.accommodation_net },
          { label: '食事費', icon: '🍱', actual: summary.meal_actual, subsidy: summary.meal_subsidy, net: summary.meal_net },
          { label: '合計', icon: '📊', actual: summary.total_actual, subsidy: summary.total_subsidy, net: summary.total_net, total: true },
        ].map(row => (
          <div key={row.label} className={`rounded-lg p-3 ${row.total ? 'bg-gray-50 border border-gray-200' : ''}`}>
            <div className="font-bold text-gray-700 mb-2">{row.icon} {row.label}</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">実支出</span>
                <span className="font-bold text-blue-800 font-mono">{yen(row.actual)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">補助額</span>
                <span className="font-bold text-green-700 font-mono">
                  {yen(row.subsidy)}
                  <span className="text-xs bg-green-100 text-green-700 px-1 rounded ml-1">収入</span>
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                <span className="text-gray-600 font-bold">差額負担</span>
                <span className="font-bold text-amber-700 font-mono">{yen(row.net)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PersonalCostMatrix({
  expeditionId, members, startDate, endDate, rates, onSummaryChange,
}: Props) {
  const [rows, setRows] = useState<PersonalCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBulk, setShowBulk] = useState(false);
  const [menuRowId, setMenuRowId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [filterDate, setFilterDate] = useState('all');
  const [filterType, setFilterType] = useState<PersonalCostItemType | 'all'>('all');
  const [filterRole, setFilterRole] = useState<MemberRole | 'all'>('all');
  const dates = makeDateRange(startDate, endDate);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPersonalCosts(expeditionId);
      setRows(data);
      const summary = calcSummary(data);
      onSummaryChange?.(summary);
      await syncPersonalCostToIncome(expeditionId, summary.total_subsidy, {
        accommodation: summary.accommodation_subsidy,
        meal: summary.meal_subsidy,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [expeditionId, onSummaryChange]);

  useEffect(() => { load(); }, [load]);

  const filteredRows = rows
    .filter(r => {
      const m = members.find(mem => mem.id === r.member_id);
      if (filterDate !== 'all' && r.date !== filterDate) return false;
      if (filterType !== 'all' && r.item_type !== filterType) return false;
      if (filterRole !== 'all' && m?.role !== filterRole) return false;
      return true;
    })
    .sort((a, b) => {
      const ai = members.findIndex(m => m.id === a.member_id);
      const bi = members.findIndex(m => m.id === b.member_id);
      if (ai !== bi) return ai - bi;
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return ITEM_ORDER.indexOf(a.item_type) - ITEM_ORDER.indexOf(b.item_type);
    });

  const summary = calcSummary(rows);
  const menuRow = rows.find(r => r.id === menuRowId);

  const startEdit = (row: PersonalCost) => {
    setEditingId(row.id);
    setEditVal(row.actual_amount.toString());
    setMenuRowId(null);
  };

  const commitEdit = async (row: PersonalCost) => {
    const newVal = parseInt(editVal) || 0;
    setEditingId(null);
    if (newVal === row.actual_amount) return;
    const { id, created_at, updated_at, ...rest } = row;
    await upsertPersonalCost({ ...rest, actual_amount: newVal });
    load();
  };

  const handleMenuAction = async (action: string) => {
    if (!menuRow) return;
    setMenuRowId(null);
    switch (action) {
      case 'edit':
        startEdit(menuRow);
        return;
      case 'toggle_subsidy':
        await updatePersonalCostFlag(menuRow.id, {
          is_subsidy_target: !menuRow.is_subsidy_target,
          subsidy_amount: !menuRow.is_subsidy_target
            ? rateForItem(menuRow.item_type, rates)
            : 0,
        });
        break;
      case 'skip':
        await updatePersonalCostFlag(menuRow.id, {
          is_skipped: !menuRow.is_skipped,
          skip_reason: !menuRow.is_skipped ? '欠席' : undefined,
        });
        break;
      case 'delete':
        if (confirm('この行を削除しますか？')) {
          await deletePersonalCost(menuRow.id);
        }
        break;
    }
    load();
  };

  let prevMemberId = '';

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="text-base">📋</span>
            ③ 個人別 宿泊・食事マトリクス
          </h3>
          <button
            onClick={() => setShowBulk(true)}
            className="text-xs font-bold px-3 py-2 rounded-lg bg-blue-800 text-white hover:bg-blue-900"
          >
            ＋ 一括入力
          </button>
        </div>
        <p className="text-xs text-gray-500">
          実支出を入力すると②の補助単価が自動適用されます。金額セルをクリックで個別編集できます。
        </p>
      </div>

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

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex flex-wrap gap-2 items-center text-xs">
        <select
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="input-select"
        >
          <option value="all">日付：全日</option>
          {dates.map(d => (
            <option key={d} value={d}>{jpDate(d)}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as PersonalCostItemType | 'all')}
          className="input-select"
        >
          <option value="all">区分：全て</option>
          {ITEM_ORDER.map(t => (
            <option key={t} value={t}>{ITEM_LABELS[t]}</option>
          ))}
        </select>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value as MemberRole | 'all')}
          className="input-select"
        >
          <option value="all">役職：全て</option>
          {(Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]).map(r => (
            <option key={r} value={r}>{MEMBER_ROLE_LABELS[r]}</option>
          ))}
        </select>
        <span className="text-gray-400 ml-auto">{filteredRows.length}件表示</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">読み込み中...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            データがありません。「＋ 一括入力」から登録してください。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left">
                  <th className="px-3 py-2 font-bold w-28">氏名</th>
                  <th className="px-2 py-2 font-bold w-20">役職</th>
                  <th className="px-2 py-2 font-bold w-20">区分</th>
                  <th className="px-2 py-2 font-bold w-20">日付</th>
                  <th className="px-2 py-2 font-bold text-right">実支出</th>
                  <th className="px-2 py-2 font-bold text-right text-green-700">補助額</th>
                  <th className="px-2 py-2 font-bold text-right text-amber-700">差額負担</th>
                  <th className="px-2 py-2 font-bold text-center w-14">補助</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => {
                  const calc = calcRow(row);
                  const member = members.find(m => m.id === row.member_id);
                  const isNewMember = row.member_id !== prevMemberId;
                  prevMemberId = row.member_id;

                  const rowBg = row.is_skipped
                    ? 'bg-gray-100'
                    : !row.is_subsidy_target
                    ? 'bg-orange-50'
                    : '';

                  return (
                    <tr
                      key={row.id}
                      className={`${rowBg} ${isNewMember ? 'border-t-2 border-gray-200' : 'border-t border-gray-50'} hover:bg-blue-50/30`}
                    >
                      <td className="px-3 py-2 font-bold text-gray-800">
                        {isNewMember ? member?.name : ''}
                      </td>
                      <td className="px-2 py-2">
                        {isNewMember && member && <RoleBadge role={member.role} />}
                      </td>
                      <td className={`px-2 py-2 ${row.is_skipped ? 'text-gray-400 italic line-through' : ''}`}>
                        {ITEM_LABELS[row.item_type]}
                      </td>
                      <td className="px-2 py-2 text-gray-500">{jpDate(row.date)}</td>
                      <td className="px-2 py-2 text-right">
                        {row.is_skipped ? (
                          <span className="text-gray-400 italic">欠席</span>
                        ) : editingId === row.id ? (
                          <input
                            type="number" min="0"
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onBlur={() => commitEdit(row)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitEdit(row);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="w-24 input-num-blue"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => startEdit(row)}
                            className="font-bold text-gray-900 hover:bg-blue-100 rounded px-1 py-0.5 font-mono"
                            title="クリックして編集"
                          >
                            {yen(row.actual_amount)}
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {row.is_skipped || !row.is_subsidy_target ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <span className="text-green-700 font-bold font-mono">{yen(row.subsidy_amount)}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {row.is_skipped ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <span className={`font-bold font-mono ${calc.net_amount > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                            {yen(calc.net_amount)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {row.is_skipped ? (
                          <span className="text-gray-400 text-xs">skip</span>
                        ) : row.auto_excluded ? (
                          <span className="text-xs text-gray-400" title={row.auto_exclude_reason || ''}>除外</span>
                        ) : row.is_subsidy_target ? (
                          <span className="text-green-600 font-bold">✓</span>
                        ) : (
                          <span className="text-red-500 font-bold">✗</span>
                        )}
                      </td>
                      <td className="px-1 py-2 text-center relative">
                        <button
                          onClick={() => setMenuRowId(menuRowId === row.id ? null : row.id)}
                          className="text-gray-400 hover:text-gray-700 px-1 font-bold"
                        >⋮</button>
                        {menuRowId === row.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setMenuRowId(null)} />
                            <div className="absolute right-0 top-6 z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-44 text-left">
                              <button className="w-full px-4 py-2 text-sm hover:bg-gray-50" onClick={() => handleMenuAction('edit')}>
                                ✏️ 金額を編集
                              </button>
                              <button className="w-full px-4 py-2 text-sm hover:bg-gray-50" onClick={() => handleMenuAction('toggle_subsidy')}>
                                🔄 {row.is_subsidy_target ? '補助対象外に変更' : '補助対象に戻す'}
                              </button>
                              <button className="w-full px-4 py-2 text-sm hover:bg-gray-50" onClick={() => handleMenuAction('skip')}>
                                ⏭️ {row.is_skipped ? '欠席を解除' : '欠席にする'}
                              </button>
                              <div className="border-t border-gray-100 my-1" />
                              <button className="w-full px-4 py-2 text-sm hover:bg-red-50 text-red-600" onClick={() => handleMenuAction('delete')}>
                                🗑️ この行を削除
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-800 text-white">
                  <td colSpan={4} className="px-3 py-2 font-bold">合計</td>
                  <td className="px-2 py-2 text-right font-bold font-mono">{yen(summary.total_actual)}</td>
                  <td className="px-2 py-2 text-right font-bold font-mono text-green-300">
                    {yen(summary.total_subsidy)}
                    <span className="text-xs ml-1 opacity-70">↑収入</span>
                  </td>
                  <td className="px-2 py-2 text-right font-bold font-mono text-amber-300">{yen(summary.total_net)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PersonalCostSummary summary={summary} />
    </div>
  );
}
