'use client';

import { Plus, Trash2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency, parseInteger } from '@/lib/calculations';
import type { Member, MemberRole } from '@/types/expedition';
import { MEMBER_ROLE_LABELS } from '@/types/expedition';

interface MemberTableProps {
  members: Member[];
  onChange: (members: Member[]) => void;
  expeditionId: string;
  readOnly?: boolean;
}

export default function MemberTable({ members, onChange, expeditionId, readOnly }: MemberTableProps) {
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

  const selfPaymentTotal = members.reduce((sum, m) => sum + m.self_payment, 0);

  return (
    <Card title="② 参加者・個人負担">
      <div className="overflow-x-auto">
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
        <Button variant="secondary" size="sm" onClick={addMember} className="mt-3">
          <Plus className="w-4 h-4 mr-1" />
          参加者を追加
        </Button>
      )}
      <div className="mt-4 pt-3 border-t flex justify-between text-sm font-medium">
        <span>自己負担合計: {formatCurrency(selfPaymentTotal)}</span>
        <span>人数: {members.length}名</span>
      </div>
    </Card>
  );
}
