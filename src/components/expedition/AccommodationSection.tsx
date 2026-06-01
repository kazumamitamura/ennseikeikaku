'use client';

import Card from '@/components/ui/Card';
import { formatCurrency, parseInteger } from '@/lib/calculations';
import { getLodgingStudentCount } from '@/lib/memberRoles';
import type { AccommodationCost, Member } from '@/types/expedition';

interface AccommodationSectionProps {
  accommodation: AccommodationCost | null;
  onChange: (acc: AccommodationCost) => void;
  members: Member[];
  expeditionId: string;
}

export default function AccommodationSection({
  accommodation,
  onChange,
  members,
  expeditionId,
}: AccommodationSectionProps) {
  const acc = accommodation || {
    id: `temp-acc-${expeditionId}`,
    expedition_id: expeditionId,
    plan_type: '1泊2食',
    unit_price: 0,
    breakfast_price: 0,
    nights: 1,
    subsidy_per_person: 0,
  };

  const studentCount = getLodgingStudentCount(members);
  const lodgingGross = acc.unit_price * studentCount * acc.nights;
  const breakfastGross = acc.breakfast_price * studentCount * acc.nights;
  const subsidyTotal = acc.subsidy_per_person * studentCount * acc.nights;
  const netCost = lodgingGross + breakfastGross - subsidyTotal;

  const unitDiff = acc.unit_price - acc.subsidy_per_person;
  const totalGross = lodgingGross + breakfastGross;

  const update = (field: keyof AccommodationCost, value: string | number) => {
    onChange({ ...acc, [field]: value });
  };

  const tdInput = 'border border-gray-200 text-center p-0';
  const tdVal = 'border border-gray-200 text-right px-3 py-2 font-mono text-sm';
  const thCell = 'border border-gray-200 bg-yellow-50 text-center py-2 px-3 text-sm font-semibold text-gray-700';
  const thLeft = 'border border-gray-200 bg-yellow-50 text-left py-2 px-3 text-sm font-semibold text-gray-700';

  return (
    <Card title="③ 宿泊費（生徒一括）">
      <p className="text-xs text-gray-500 mb-4">
        生徒（選手+セコンド）の宿泊費を一括計算します。教員・外部指導者は④マトリクスで個別入力。
      </p>

      {/* 基本設定 */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs text-gray-500 mb-1">宿泊プラン</label>
          <select
            value={acc.plan_type}
            onChange={(e) => update('plan_type', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="1泊2食">1泊2食</option>
            <option value="1泊1食">1泊1食</option>
            <option value="素泊まり">素泊まり</option>
            <option value="朝食付き">朝食付き</option>
          </select>
        </div>
        <div className="w-24">
          <label className="block text-xs text-gray-500 mb-1">泊数</label>
          <input
            type="number"
            inputMode="numeric"
            value={acc.nights}
            onChange={(e) => update('nights', parseInteger(e.target.value) || 1)}
            className="input-currency w-full"
            min={1}
          />
        </div>
        <div className="flex items-end">
          <p className="text-sm text-gray-600 pb-2">
            対象 選手+セコンド:
            <span className="font-bold text-primary ml-1">{studentCount}名</span>
          </p>
        </div>
      </div>

      {/* 単価表 */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 mb-1">■ 単価設定</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[400px]">
            <thead>
              <tr>
                <th className={thLeft}>費目</th>
                <th className={thCell}>{acc.plan_type}</th>
                <th className={thCell}>補助（/人/泊）</th>
                <th className={thCell}>差額（/人/泊）</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-3 py-1.5 text-sm bg-blue-50 font-medium">宿泊料</td>
                <td className={tdInput}>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={acc.unit_price}
                    onChange={(e) => update('unit_price', parseInteger(e.target.value))}
                    className="w-full text-right font-mono px-3 py-2 text-sm focus:outline-none focus:bg-blue-50"
                  />
                </td>
                <td className={tdInput}>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={acc.subsidy_per_person}
                    onChange={(e) => update('subsidy_per_person', parseInteger(e.target.value))}
                    className="w-full text-right font-mono px-3 py-2 text-sm focus:outline-none focus:bg-yellow-50"
                  />
                </td>
                <td className={`${tdVal} ${unitDiff > 0 ? 'text-red-600' : unitDiff < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                  {formatCurrency(unitDiff)}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-1.5 text-sm bg-orange-50 font-medium">朝食代（別途）</td>
                <td className={tdInput}>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={acc.breakfast_price}
                    onChange={(e) => update('breakfast_price', parseInteger(e.target.value))}
                    className="w-full text-right font-mono px-3 py-2 text-sm focus:outline-none focus:bg-orange-50"
                  />
                </td>
                <td className="border border-gray-200 px-3 py-2 text-center text-gray-400 text-xs">—</td>
                <td className={`${tdVal} text-gray-700`}>{formatCurrency(acc.breakfast_price)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 合計表 */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1">
          ■ 合計（{studentCount}名 × {acc.nights}泊）
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[400px]">
            <thead>
              <tr>
                <th className={thLeft}>費目</th>
                <th className={thCell}>支払額（総額）</th>
                <th className={thCell}>補助計</th>
                <th className={thCell}>差額実費</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-3 py-2 text-sm bg-blue-50 font-medium">宿泊</td>
                <td className={tdVal}>{formatCurrency(lodgingGross)}</td>
                <td className={`${tdVal} text-green-700`}>{formatCurrency(subsidyTotal)}</td>
                <td className={`${tdVal} font-bold ${lodgingGross - subsidyTotal > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-50'}`}>
                  {formatCurrency(lodgingGross - subsidyTotal)}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2 text-sm bg-orange-50 font-medium">朝食</td>
                <td className={tdVal}>{formatCurrency(breakfastGross)}</td>
                <td className="border border-gray-200 px-3 py-2 text-center text-gray-400 text-xs">—</td>
                <td className={`${tdVal} font-bold bg-cyan-50 text-cyan-800`}>{formatCurrency(breakfastGross)}</td>
              </tr>
              <tr className="bg-gray-50 font-semibold">
                <td className="border border-gray-300 px-3 py-2 text-sm">合計</td>
                <td className={`${tdVal} font-bold`}>{formatCurrency(totalGross)}</td>
                <td className={`${tdVal} text-green-700 font-bold`}>{formatCurrency(subsidyTotal)}</td>
                <td className={`${tdVal} font-bold text-lg ${netCost > 0 ? 'bg-green-100 text-green-800' : ''}`}>
                  {formatCurrency(netCost)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          ※ 差額実費 = 支払額 − 補助計。教員分は④マトリクスに含まれます。
        </p>
      </div>
    </Card>
  );
}
