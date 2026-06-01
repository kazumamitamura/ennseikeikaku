import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import type {
  Expedition, Member, IncomeItem, AccommodationCost,
  MealCost, TransportCost, OtherCost, ExpeditionSummary,
  MemberMealRecord, MemberTransportRecord, MemberAccommodationRecord,
} from '@/types/expedition';
import {
  formatCurrency, formatDate, toReiwaYear, getDateRange,
  calcPersonExpenseDetails, MEAL_TYPES,
} from '@/lib/calculations';
import {
  MEMBER_ROLE_LABELS, INCOME_CATEGORY_LABELS, MEAL_TYPE_LABELS,
  MEAL_STATUS_LABELS, INDIVIDUAL_TRANSPORT_LABELS, GROUP_TRANSPORT_TYPES,
  TRANSPORT_TYPE_LABELS,
} from '@/types/expedition';
import { needsIndividualTracking, getLodgingStudentCount, getIndividualMembers, getStudentMembers, getMealStatus, getMealUnitPrice } from '@/lib/memberRoles';

interface ExportData {
  expedition: Expedition;
  members: Member[];
  incomeItems: IncomeItem[];
  accommodation: AccommodationCost | null;
  mealCosts: MealCost[];
  transportCosts: TransportCost[];
  otherCosts: OtherCost[];
  summary: ExpeditionSummary;
  mealRecords?: MemberMealRecord[];
  memberTransport?: MemberTransportRecord[];
  memberAccommodation?: MemberAccommodationRecord[];
}

const COLORS = {
  header: 'FF1A3A5C',
  headerFont: 'FFFFFFFF',
  student: 'FFE8F4FD',
  staff: 'FFFFF3E8',
  eat: 'FFD1FAE5',
  skip: 'FFFDE68A',
  none: 'FFF3F4F6',
  subtotal: 'FFE5E7EB',
  accent: 'FFE85D04',
};

function styleHeader(row: ExcelJS.Row) {
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header } };
    cell.font = { bold: true, color: { argb: COLORS.headerFont }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
  });
  row.height = 22;
}

function styleDataCell(cell: ExcelJS.Cell, bg?: string) {
  if (bg) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  }
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  };
  cell.alignment = { vertical: 'middle' };
}

export function exportToPDF(data: ExportData): void {
  const { expedition, members, incomeItems, summary } = data;
  const doc = new jsPDF();
  const reiwa = toReiwaYear(expedition.year);

  doc.setFontSize(16);
  doc.text(`令和${reiwa}年度 ${expedition.competition_name} 遠征費用報告書`, 14, 20);

  autoTable(doc, {
    startY: 30,
    head: [['項目', '内容']],
    body: [
      ['学校名', expedition.school_name],
      ['部活動名', expedition.club_name],
      ['大会名', expedition.competition_name],
      ['期間', `${formatDate(expedition.start_date)} 〜 ${formatDate(expedition.end_date)}`],
      ['行先', expedition.destination],
      ['参加人数', `${summary.memberCount.total}名`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [26, 58, 92] },
  });

  const incomeY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.text('収入一覧', 14, incomeY);

  autoTable(doc, {
    startY: incomeY + 4,
    head: [['項目', '金額']],
    body: incomeItems.map(item => [item.label, formatCurrency(item.amount)]),
    foot: [['合計', formatCurrency(summary.totalIncome)]],
    theme: 'grid',
    headStyles: { fillColor: [26, 58, 92] },
  });

  doc.save(`${expedition.name}_報告書.pdf`);
}

export async function exportToExcel(data: ExportData): Promise<void> {
  const {
    expedition, members, incomeItems, accommodation, mealCosts,
    transportCosts, otherCosts, summary,
    mealRecords = [], memberTransport = [], memberAccommodation = [],
  } = data;

  const dates = getDateRange(expedition.start_date, expedition.end_date);
  const personDetails = calcPersonExpenseDetails(
    members, mealRecords, mealCosts, memberAccommodation, memberTransport, dates
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = 'ennseikeikaku';
  wb.created = new Date();

  // --- Sheet 1: 収支サマリー ---
  const ws1 = wb.addWorksheet('収支サマリー');
  ws1.columns = [{ width: 24 }, { width: 18 }, { width: 18 }, { width: 18 }];
  const summaryRows: (string | number)[][] = [
    ['遠征収支サマリー', '', '', ''],
    ['遠征名', expedition.name, '', ''],
    ['大会名', expedition.competition_name, '', ''],
    ['期間', `${expedition.start_date} 〜 ${expedition.end_date}`, '', ''],
    ['行先', expedition.destination, '', ''],
    [],
    ['項目', '合計', '生徒', '教員'],
    ['収入合計', summary.totalIncome, '', ''],
    ['支出合計', summary.totalExpense, '', ''],
    ['収支差額', summary.balance, '', ''],
    [],
    ['宿泊費', summary.accommodationTotal, summary.accommodationSplit.student, summary.accommodationSplit.staff],
    ['食事費', summary.mealTotal, summary.mealSplit.student, summary.mealSplit.staff],
    ['交通費', summary.transportTotal, summary.transportSplit.student, summary.transportSplit.staff],
    ['その他', summary.otherTotal, '', ''],
  ];
  summaryRows.forEach((row, i) => {
    const r = ws1.addRow(row);
    if (i === 0) { r.font = { bold: true, size: 14 }; return; }
    if (i === 6) styleHeader(r);
    if (i >= 11 && i <= 14) r.getCell(1).font = { bold: true };
  });

  // --- Sheet 2: 生徒宿泊内訳 ---
  const ws2 = wb.addWorksheet('生徒宿泊内訳');
  ws2.columns = [{ width: 16 }, { width: 12 }, { width: 14 }, { width: 10 }, { width: 10 }, { width: 14 }, { width: 14 }];
  const accHeader = ws2.addRow(['プラン', '単価', '朝食', '人数', '泊数', '補助/人', '小計']);
  styleHeader(accHeader);
  if (accommodation) {
    const sc = getLodgingStudentCount(members);
    const unit = accommodation.unit_price + accommodation.breakfast_price;
    const gross = unit * sc * accommodation.nights;
    const subsidy = accommodation.subsidy_per_person * sc * accommodation.nights;
    const row = ws2.addRow([
      accommodation.plan_type, accommodation.unit_price, accommodation.breakfast_price,
      sc, accommodation.nights, accommodation.subsidy_per_person, gross - subsidy,
    ]);
    row.eachCell(c => styleDataCell(c, COLORS.student));
  }

  // --- Sheet 3: 教員宿泊内訳 ---
  const ws3 = wb.addWorksheet('教員宿泊内訳');
  ws3.columns = [{ width: 14 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 8 }, { width: 8 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 }];
  const staffAccH = ws3.addRow(['氏名', '区分', 'プラン', '1泊料金', '朝食', '泊数', '開始日', '終了日', '補助', '小計']);
  styleHeader(staffAccH);
  getIndividualMembers(members).forEach(m => {
    const acc = memberAccommodation.find(r => r.member_id === m.id);
    if (!acc) return;
    const sub = (acc.unit_price + acc.breakfast_price) * acc.nights - acc.subsidy_amount;
    const row = ws3.addRow([
      m.name, MEMBER_ROLE_LABELS[m.role], acc.plan_type, acc.unit_price, acc.breakfast_price,
      acc.nights, acc.start_date || '', acc.end_date || '', acc.subsidy_amount, sub,
    ]);
    row.eachCell(c => styleDataCell(c, COLORS.staff));
  });

  // --- Sheet 4: 食事マトリクス ---
  const ws4 = wb.addWorksheet('食事マトリクス');
  const mealHeaders = ['氏名', '区分', ...dates.flatMap(d => MEAL_TYPES.map(mt => `${d.slice(5)} ${MEAL_TYPE_LABELS[mt]}`)), '食事費小計'];
  ws4.addRow(mealHeaders);
  styleHeader(ws4.getRow(1));
  ws4.getRow(1).eachCell((cell, col) => { if (col > 2) cell.font = { bold: true, size: 9, color: { argb: COLORS.headerFont } }; });

  const allForMeals = [...getStudentMembers(members), ...getIndividualMembers(members)];
  allForMeals.forEach(m => {
    let mealTotal = 0;
    const rowData: (string | number)[] = [m.name, MEMBER_ROLE_LABELS[m.role]];
    const bg = getIndividualMembers(members).some(x => x.id === m.id) ? COLORS.staff : COLORS.student;
    dates.forEach(date => {
      MEAL_TYPES.forEach(mt => {
        const status = getMealStatus(mealRecords, m.id, date, mt);
        rowData.push(MEAL_STATUS_LABELS[status]);
        if (status === 'eat') {
          mealTotal += getMealUnitPrice(mealCosts, date, mt, needsIndividualTracking(m.role));
        }
      });
    });
    rowData.push(mealTotal);
    const row = ws4.addRow(rowData);
    row.eachCell((cell, col) => {
      if (col <= 2) { styleDataCell(cell, bg); return; }
      if (col === rowData.length) { styleDataCell(cell, COLORS.subtotal); cell.numFmt = '¥#,##0'; return; }
      const val = String(cell.value);
      const mealBg = val === '欠食' ? COLORS.skip : val === '対象外' ? COLORS.none : COLORS.eat;
      styleDataCell(cell, mealBg);
      cell.alignment = { horizontal: 'center' };
    });
  });

  // --- Sheet 5: 交通費内訳 ---
  const ws5 = wb.addWorksheet('交通費内訳');
  ws5.columns = [{ width: 14 }, { width: 14 }, { width: 20 }, { width: 12 }, { width: 12 }, { width: 14 }];
  const transH = ws5.addRow(['区分', '氏名/項目', '内容', '日付', '備考', '金額']);
  styleHeader(transH);

  transportCosts.filter(t => GROUP_TRANSPORT_TYPES.includes(t.transport_type)).forEach(t => {
    const row = ws5.addRow(['共通', t.label, TRANSPORT_TYPE_LABELS[t.transport_type] || t.label, '', t.notes || '', t.amount]);
    row.eachCell(c => { styleDataCell(c); if (Number(c.col) === 6) c.numFmt = '¥#,##0'; });
  });
  memberTransport.forEach(t => {
    const m = members.find(x => x.id === t.member_id);
    const row = ws5.addRow([
      '個別', m?.name || '', `${INDIVIDUAL_TRANSPORT_LABELS[t.transport_type]} ${t.label}`,
      t.travel_date || '', t.notes || '', t.amount,
    ]);
    row.eachCell(c => { styleDataCell(c, COLORS.staff); if (Number(c.col) === 6) c.numFmt = '¥#,##0'; });
  });

  // --- Sheet 6: 個人経費合計 ---
  const ws6 = wb.addWorksheet('教員個人合計');
  ws6.columns = [{ width: 14 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
  const personH = ws6.addRow(['氏名', '区分', '食事費', '宿泊費', '交通費', '合計']);
  styleHeader(personH);
  personDetails.forEach(d => {
    const row = ws6.addRow([d.memberName, MEMBER_ROLE_LABELS[d.role], d.mealTotal, d.accommodationTotal, d.transportTotal, d.total]);
    row.eachCell((c, col) => {
      styleDataCell(c, COLORS.staff);
      if (col >= 3) c.numFmt = '¥#,##0';
    });
  });

  // --- Sheet 7: 収入明細 ---
  const ws7 = wb.addWorksheet('収入明細');
  ws7.addRow(['カテゴリ', '項目', '金額', '備考']);
  styleHeader(ws7.getRow(1));
  incomeItems.forEach(i => {
    const row = ws7.addRow([INCOME_CATEGORY_LABELS[i.category], i.label, i.amount, i.notes || '']);
    row.eachCell(c => styleDataCell(c));
    row.getCell(3).numFmt = '¥#,##0';
  });

  // --- Sheet 8: 名簿 ---
  const ws8 = wb.addWorksheet('名簿');
  ws8.addRow(['氏名', '役職', '体重階級', '自己負担', '補助額', '備考']);
  styleHeader(ws8.getRow(1));
  members.forEach(m => {
    const row = ws8.addRow([m.name, MEMBER_ROLE_LABELS[m.role], m.weight_class || '', m.self_payment, m.subsidy_amount, m.notes || '']);
    row.eachCell(c => styleDataCell(c));
    row.getCell(4).numFmt = '¥#,##0';
    row.getCell(5).numFmt = '¥#,##0';
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${expedition.name}_収支詳細.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
