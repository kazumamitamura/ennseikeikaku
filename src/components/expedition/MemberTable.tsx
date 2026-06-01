'use client';

import { useState, useCallback } from 'react';
import { Plus, Trash2, ClipboardPaste, Users, CheckSquare } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { formatCurrency, parseInteger } from '@/lib/calculations';
import { parseMemberPaste } from '@/lib/memberImport';
import type { Member, MemberRole } from '@/types/expedition';
import { MEMBER_ROLE_LABELS } from '@/types/expedition';

interface MemberTableProps {
  members: Member[];
  onChange: (members: Member[]) => void;
  expeditionId: string;
  readOnly?: boolean;
}

export default function MemberTable({ members, onChange, expeditionId, readOnly }: MemberTableProps) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pastePreview, setPastePreview] = useState<ReturnType<typeof parseMemberPaste>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const updateMember = (index: number, field: keyof Member, value: string | number | boolean) => {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addMember = () => {
    onChange([
      ...members,
      {
        id: `temp-${Date.now()}`,
        expedition_id: expeditionId,
        name: '',
        role: 'athlete' as MemberRole,
        participation_ih: false,
        participation_tohoku: false,
        self_payment: 7000,
        subsidy_amount: 0,
        sort_order: members.length,
      },
    ]);
  };

  const removeMember = (index: number) => {
    const removed = members[index];
    setSelectedIds(prev => { const s = new Set(prev); s.delete(removed.id); return s; });
    onChange(members.filter((_, i) => i !== index));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.map(m => m.id)));
    }
  };

  const bulkDelete = () => {
    onChange(members.filter(m => !selectedIds.has(m.id)));
    setSelectedIds(new Set());
    setConfirmDeleteOpen(false);
  };

  const handlePasteTextChange = (text: string) => {
    setPasteText(text);
    setPastePreview(parseMemberPaste(text));
  };

  const handleBulkPaste = useCallback((text: string) => {
    const parsed = parseMemberPaste(text);
    if (parsed.length === 0) return;
    const newMembers: Member[] = parsed.map((row, i) => ({
      id: `temp-${Date.now()}-${i}`,
      expedition_id: expeditionId,
      name: row.name,
      role: row.role,
      weight_class: row.weight_class,
      participation_ih: false,
      participation_tohoku: false,
      self_payment: row.self_payment,
      subsidy_amount: row.subsidy_amount,
      notes: row.notes,
      sort_order: members.length + i,
    }));
    onChange([...members, ...newMembers]);
    setPasteOpen(false);
    setPasteText('');
    setPastePreview([]);
  }, [members, expeditionId, onChange]);

  const handleTablePaste = (e: React.ClipboardEvent) => {
    if (readOnly) return;
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n') && !text.includes('\t')) return;
    const parsed = parseMemberPaste(text);
    if (parsed.length <= 1 && !text.includes('\n')) return;
    e.preventDefault();
    handleBulkPaste(text);
  };

  const confirmBulkAdd = () => {
    if (pastePreview.length === 0) return;
    handleBulkPaste(pasteText);
  };

  const selfPaymentTotal = members.reduce((sum, m) => sum + m.self_payment, 0);
  const allSelected = members.length > 0 && selectedIds.size === members.length;
  const someSelected = selectedIds.size > 0;

  const roleGroups: Record<MemberRole, Member[]> = {
    athlete: [], second: [], supporter: [], staff: [], advisor: [], external_coach: [],
  };
  members.forEach(m => roleGroups[m.role].push(m));

  return (
    <Card title="② 参加者・個人負担">
      {!readOnly && (
        <p className="text-xs text-gray-500 mb-3">
          Excel等の縦列をコピーして表内に貼り付けると自動追加されます。
          形式: 氏名 / 氏名+Tab+役職 / 氏名+Tab+役職+Tab+体重+Tab+自己負担
        </p>
      )}

      {/* 一括操作バー */}
      {!readOnly && someSelected && (
        <div className="flex items-center gap-3 mb-2 p-2 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-sm font-medium text-red-700">{selectedIds.size}名を選択中</span>
          <Button variant="danger" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
            <Trash2 className="w-3 h-3 mr-1" />
            選択した{selectedIds.size}名を削除
          </Button>
          <button
            className="text-xs text-gray-500 underline ml-auto"
            onClick={() => setSelectedIds(new Set())}
          >
            選択を解除
          </button>
        </div>
      )}

      <div className="overflow-x-auto" onPaste={handleTablePaste}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-300 bg-gray-50 text-gray-700">
              {!readOnly && (
                <th className="pb-2 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 cursor-pointer accent-primary"
                    title="全選択/全解除"
                  />
                </th>
              )}
              <th className="pb-2 pr-2 text-left w-6 text-gray-400">#</th>
              <th className="pb-2 pr-2 text-left">氏名</th>
              <th className="pb-2 pr-2 text-left">役職</th>
              <th className="pb-2 pr-2 text-right">自己負担</th>
              <th className="pb-2 pr-2 text-right">補助額</th>
              <th className="pb-2 pr-2 text-left hidden sm:table-cell">備考</th>
              {!readOnly && <th className="pb-2 w-8"></th>}
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => (
              <tr
                key={member.id}
                className={`border-b border-gray-100 ${selectedIds.has(member.id) ? 'bg-red-50' : 'hover:bg-gray-50'}`}
              >
                {!readOnly && (
                  <td className="py-1.5 pr-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(member.id)}
                      onChange={() => toggleSelect(member.id)}
                      className="w-4 h-4 cursor-pointer accent-primary"
                    />
                  </td>
                )}
                <td className="py-1.5 pr-2 text-gray-400 text-xs">{index + 1}</td>
                <td className="py-1.5 pr-2">
                  {readOnly ? member.name : (
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => updateMember(index, 'name', e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm focus:border-primary focus:outline-none"
                      placeholder="氏名"
                    />
                  )}
                </td>
                <td className="py-1.5 pr-2">
                  {readOnly ? (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      member.role === 'athlete' ? 'bg-blue-100 text-blue-800' :
                      member.role === 'second' ? 'bg-cyan-100 text-cyan-800' :
                      member.role === 'supporter' ? 'bg-green-100 text-green-800' :
                      member.role === 'staff' ? 'bg-orange-100 text-orange-800' :
                      member.role === 'advisor' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {MEMBER_ROLE_LABELS[member.role]}
                    </span>
                  ) : (
                    <select
                      value={member.role}
                      onChange={(e) => updateMember(index, 'role', e.target.value)}
                      className="border rounded px-2 py-1 text-sm focus:border-primary focus:outline-none"
                    >
                      {Object.entries(MEMBER_ROLE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="py-1.5 pr-2 text-right">
                  {readOnly ? (
                    <span className="font-mono">{formatCurrency(member.self_payment)}</span>
                  ) : (
                    <input
                      type="number"
                      inputMode="numeric"
                      value={member.self_payment}
                      onChange={(e) => updateMember(index, 'self_payment', parseInteger(e.target.value))}
                      className="input-currency w-24"
                    />
                  )}
                </td>
                <td className="py-1.5 pr-2 text-right">
                  {readOnly ? (
                    <span className="font-mono">{formatCurrency(member.subsidy_amount)}</span>
                  ) : (
                    <input
                      type="number"
                      inputMode="numeric"
                      value={member.subsidy_amount}
                      onChange={(e) => updateMember(index, 'subsidy_amount', parseInteger(e.target.value))}
                      className="input-currency w-24"
                    />
                  )}
                </td>
                <td className="py-1.5 pr-2 hidden sm:table-cell">
                  {readOnly ? (member.notes || '') : (
                    <input
                      type="text"
                      value={member.notes || ''}
                      onChange={(e) => updateMember(index, 'notes', e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm focus:border-primary focus:outline-none"
                    />
                  )}
                </td>
                {!readOnly && (
                  <td className="py-1.5">
                    <button
                      onClick={() => removeMember(index)}
                      className="text-gray-400 hover:text-danger hover:bg-red-50 p-1 rounded transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="secondary" size="sm" onClick={addMember}>
            <Plus className="w-4 h-4 mr-1" />
            1名追加
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setPasteOpen(true)}>
            <ClipboardPaste className="w-4 h-4 mr-1" />
            一括追加（貼り付け）
          </Button>
          {someSelected && (
            <Button variant="danger" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
              <Trash2 className="w-4 h-4 mr-1" />
              選択{selectedIds.size}名を削除
            </Button>
          )}
        </div>
      )}

      {/* 役職別集計 */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
        {(Object.entries(roleGroups) as [MemberRole, Member[]][])
          .filter(([, ms]) => ms.length > 0)
          .map(([role, ms]) => (
            <span key={role} className="bg-gray-100 px-2 py-0.5 rounded">
              {MEMBER_ROLE_LABELS[role]}: {ms.length}名
            </span>
          ))}
      </div>

      <div className="mt-3 pt-3 border-t flex justify-between items-center text-sm font-medium">
        <span className="text-gray-700">自己負担合計: <span className="font-mono text-primary">{formatCurrency(selfPaymentTotal)}</span></span>
        <span className="text-gray-500">計 {members.length}名</span>
      </div>

      {/* 一括追加モーダル */}
      <Modal isOpen={pasteOpen} onClose={() => setPasteOpen(false)} title="名簿一括追加" size="lg">
        <p className="text-sm text-gray-600 mb-3">
          Excelやスプレッドシートからコピーした内容を貼り付けてください。改行ごとに1名として追加されます。
        </p>
        <textarea
          value={pasteText}
          onChange={(e) => handlePasteTextChange(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            setTimeout(() => handlePasteTextChange(text), 0);
          }}
          placeholder={'田中太郎\n佐藤花子\n鈴木一郎\n\nまたは\n田中太郎\t選手\t73kg\t7000'}
          className="w-full h-40 border-2 border-gray-200 rounded-lg p-3 text-sm font-mono"
        />
        {pastePreview.length > 0 && (
          <div className="mt-4 bg-gray-50 rounded-lg p-3">
            <p className="text-sm font-medium mb-2 flex items-center gap-1">
              <Users className="w-4 h-4" />
              プレビュー: {pastePreview.length}名
            </p>
            <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
              {pastePreview.map((row, i) => (
                <li key={i} className="text-gray-700">
                  {row.name}（{MEMBER_ROLE_LABELS[row.role]}）
                  {row.weight_class ? ` / ${row.weight_class}` : ''}
                  / {formatCurrency(row.self_payment)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={() => setPasteOpen(false)}>キャンセル</Button>
          <Button onClick={confirmBulkAdd} disabled={pastePreview.length === 0}>
            {pastePreview.length}名を追加
          </Button>
        </div>
      </Modal>

      {/* 一括削除確認モーダル */}
      <Modal isOpen={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} title="一括削除の確認" size="sm">
        <p className="text-gray-700 mb-2">
          選択した <span className="font-bold text-danger">{selectedIds.size}名</span> を削除しますか？
        </p>
        <ul className="text-sm text-gray-600 mb-4 max-h-40 overflow-y-auto bg-gray-50 rounded p-2">
          {members.filter(m => selectedIds.has(m.id)).map(m => (
            <li key={m.id}>・{m.name}（{MEMBER_ROLE_LABELS[m.role]}）</li>
          ))}
        </ul>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setConfirmDeleteOpen(false)}>キャンセル</Button>
          <Button variant="danger" onClick={bulkDelete}>
            <CheckSquare className="w-4 h-4 mr-1" />
            {selectedIds.size}名を削除
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
