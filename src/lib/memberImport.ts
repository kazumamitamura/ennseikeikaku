import type { MemberRole } from '@/types/expedition';
import { parseInteger } from '@/lib/calculations';

export interface ParsedMemberRow {
  name: string;
  role: MemberRole;
  weight_class?: string;
  self_payment: number;
  subsidy_amount: number;
  notes?: string;
}

const ROLE_ALIASES: Record<string, MemberRole> = {
  athlete: 'athlete',
  second: 'second',
  supporter: 'supporter',
  staff: 'staff',
  advisor: 'advisor',
  選手: 'athlete',
  セコンド: 'second',
  応援: 'supporter',
  引率: 'staff',
  顧問: 'advisor',
  外部: 'external_coach',
  外部指導: 'external_coach',
  external_coach: 'external_coach',
};

function parseRole(value?: string): MemberRole {
  if (!value) return 'athlete';
  const trimmed = value.trim();
  return ROLE_ALIASES[trimmed] ?? ROLE_ALIASES[trimmed.toLowerCase()] ?? 'athlete';
}

function isNumeric(value: string): boolean {
  return /^\d[\d,¥]*$/.test(value.replace(/\s/g, ''));
}

/** Excel等からコピーしたテキストを名簿行に分解 */
export function parseMemberPaste(text: string, defaultSelfPayment = 7000): ParsedMemberRow[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const results: ParsedMemberRow[] = [];

  for (const line of lines) {
    const cols = line.includes('\t')
      ? line.split('\t').map(c => c.trim())
      : line.includes(',')
        ? line.split(',').map(c => c.trim())
        : [line.trim()];

    const name = cols[0]?.trim();
    if (!name) continue;
    if (/^(氏名|名前|name|No\.?)$/i.test(name)) continue;

    let role: MemberRole = 'athlete';
    let weight_class: string | undefined;
    let self_payment = defaultSelfPayment;
    let subsidy_amount = 0;
    let notes: string | undefined;

    if (cols.length === 1) {
      // 縦1列（氏名のみ）の貼り付け
    } else if (cols.length === 2) {
      if (isNumeric(cols[1])) {
        self_payment = parseInteger(cols[1]);
      } else {
        role = parseRole(cols[1]);
      }
    } else {
      role = parseRole(cols[1]);
      if (cols.length >= 4 && (isNumeric(cols[3]) || cols[3] === '')) {
        weight_class = cols[2] || undefined;
        self_payment = parseInteger(cols[3] || defaultSelfPayment);
        subsidy_amount = parseInteger(cols[4] || 0);
        notes = cols[5];
      } else if (isNumeric(cols[2])) {
        self_payment = parseInteger(cols[2]);
        subsidy_amount = parseInteger(cols[3] || 0);
        notes = cols[4];
      } else {
        weight_class = cols[2] || undefined;
        if (cols[3]) self_payment = parseInteger(cols[3]);
      }
    }

    results.push({ name, role, weight_class, self_payment, subsidy_amount, notes });
  }

  return results;
}
