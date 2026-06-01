'use client';

import { useState, useCallback } from 'react';
import { Plus, Trash2, ClipboardPaste, Users } from 'lucide-react';
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
    onChange(members.filter((_, i) => i !== index));
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

  return (
    <Card title="② 参加者・個人負担">
      {!readOnly && (
        <p className="text-xs text-gray-500 mb-3">
          Excel等の縦列をコピーして表内に貼り付けると、1行ずつ自動で追加されます。
          形式: 氏名 / 氏名+Tab+役職 / 氏名+Tab+役職+Tab+体重+Tab+自己負担
        </p>
      )}

      <div className="overflow-x-auto" onPaste={handleTablePaste}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-600">
              <th className="pb-2 pr-2">氏名</th>
              <th className="pb-2 pr-2">役職</th>
              <th className="pb-2 pr-2 text-right">自己負担額</th>
              <th className="pb-2 pr-2 text-right">補助額</th>
              <th className="pb-2 pr-2">備考</th>
              {!readOnly && <th className="pb-2 w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => (
              <tr key={member.id} className="border-b border-gray-100">
                <td className="py-2 pr-2">
                  {readOnly ? member.name : (
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => updateMember(index, 'name', e.target.value)}
                      className="w-full border rounded px-2 py-1"
                      placeholder="氏名"
                    />
                  )}
                </td>
                <td className="py-2 pr-2">
                  {readOnly ? MEMBER_ROLE_LABELS[member.role] : (
                    <select
                      value={member.role}
                      onChange={(e) => updateMember(index, 'role', e.target.value)}
                      className="border rounded px-2 py-1"
                    >
                      {Object.entries(MEMBER_ROLE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="py-2 pr-2">
                  {readOnly ? formatCurrency(member.self_payment) : (
                    <input
                      type="number"
                      inputMode="numeric"
                      value={member.self_payment}
                      onChange={(e) => updateMember(index, 'self_payment', parseInteger(e.target.value))}
                      className="input-currency w-24"
                    />
                  )}
                </td>
                <td className="py-2 pr-2">
                  {readOnly ? formatCurrency(member.subsidy_amount) : (
                    <input
                      type="number"
                      inputMode="numeric"
                      value={member.subsidy_amount}
                      onChange={(e) => updateMember(index, 'subsidy_amount', parseInteger(e.target.value))}
                      className="input-currency w-24"
                    />
                  )}
                </td>
                <td className="py-2 pr-2">
                  {readOnly ? (member.notes || '') : (
                    <input
                      type="text"
                      value={member.notes || ''}
                      onChange={(e) => updateMember(index, 'notes', e.target.value)}
                      className="w-full border rounded px-2 py-1"
                    />
                  )}
                </td>
                {!readOnly && (
                  <td className="py-2">
                    <button
                      onClick={() => removeMember(index)}
                      className="text-danger hover:bg-red-50 p-1 rounded"
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
        </div>
      )}

      <div className="mt-4 pt-3 border-t flex justify-between text-sm font-medium">
        <span>自己負担合計: {formatCurrency(selfPaymentTotal)}</span>
        <span>人数: {members.length}名</span>
      </div>

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
    </Card>
  );
}
