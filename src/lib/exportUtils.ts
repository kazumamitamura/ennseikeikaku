import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type {
  Expedition, Member, IncomeItem, AccommodationCost,
  MealCost, TransportCost, OtherCost, ExpeditionSummary
} from '@/types/expedition';
import {
  formatCurrency, formatDate, toReiwaYear
} from '@/lib/calculations';
import {
  MEMBER_ROLE_LABELS, INCOME_CATEGORY_LABELS, MEAL_TYPE_LABELS
} from '@/types/expedition';

interface ExportData {
  expedition: Expedition;
  members: Member[];
  incomeItems: IncomeItem[];
  accommodation: AccommodationCost | null;
  mealCosts: MealCost[];
  transportCosts: TransportCost[];
  otherCosts: OtherCost[];
  summary: ExpeditionSummary;
}

export function exportToPDF(data: ExportData): void {
  const { expedition, members, incomeItems, accommodation, mealCosts, transportCosts, otherCosts, summary } = data;
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

  const expenseRows: string[][] = [];
  if (accommodation) {
    expenseRows.push(['宿泊費', formatCurrency(summary.accommodationTotal)]);
  }
  expenseRows.push(['食事費', formatCurrency(summary.mealTotal)]);
  expenseRows.push(['交通費', formatCurrency(summary.transportTotal)]);
  otherCosts.forEach(o => expenseRows.push([o.label, formatCurrency(o.amount)]));

  const expenseY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.text('支出一覧', 14, expenseY);

  autoTable(doc, {
    startY: expenseY + 4,
    head: [['項目', '金額']],
    body: expenseRows,
    foot: [['合計', formatCurrency(summary.totalExpense)]],
    theme: 'grid',
    headStyles: { fillColor: [26, 58, 92] },
  });

  const balanceY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  const balanceLabel = summary.balance >= 0 ? '黒字' : '赤字';
  doc.text(`収支差額: ${formatCurrency(summary.balance)}（${balanceLabel}）`, 14, balanceY);

  const memberY = balanceY + 10;
  doc.text('参加者名簿', 14, memberY);

  autoTable(doc, {
    startY: memberY + 4,
    head: [['氏名', '役職', '自己負担', '補助額', '備考']],
    body: members.map(m => [
      m.name,
      MEMBER_ROLE_LABELS[m.role],
      formatCurrency(m.self_payment),
      formatCurrency(m.subsidy_amount),
      m.notes || '',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [26, 58, 92] },
  });

  doc.save(`${expedition.name}_報告書.pdf`);
}

export function exportToExcel(data: ExportData): void {
  const { expedition, members, incomeItems, accommodation, mealCosts, transportCosts, otherCosts, summary } = data;
  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['遠征収支サマリー'],
    ['遠征名', expedition.name],
    ['大会名', expedition.competition_name],
    ['期間', `${expedition.start_date} 〜 ${expedition.end_date}`],
    ['行先', expedition.destination],
    [],
    ['収入合計', summary.totalIncome],
    ['支出合計', summary.totalExpense],
    ['収支差額', summary.balance],
    [],
    ['内訳'],
    ['宿泊費', summary.accommodationTotal],
    ['食事費', summary.mealTotal],
    ['交通費', summary.transportTotal],
    ['その他', summary.otherTotal],
  ]);
  XLSX.utils.book_append_sheet(wb, summarySheet, '収支サマリー');

  const incomeSheet = XLSX.utils.aoa_to_sheet([
    ['カテゴリ', '項目', '金額', '備考'],
    ...incomeItems.map(i => [
      INCOME_CATEGORY_LABELS[i.category],
      i.label,
      i.amount,
      i.notes || '',
    ]),
  ]);
  XLSX.utils.book_append_sheet(wb, incomeSheet, '収入明細');

  const expenseRows: (string | number)[][] = [['区分', '項目', '金額', '備考']];
  if (accommodation) {
    expenseRows.push(['宿泊', '宿泊費', summary.accommodationTotal, accommodation.notes || '']);
  }
  mealCosts.forEach(m => {
    expenseRows.push([
      '食事',
      `${m.date} ${MEAL_TYPE_LABELS[m.meal_type]}`,
      m.unit_price * (m.target_count + m.non_target_count),
      m.notes || '',
    ]);
  });
  transportCosts.forEach(t => {
    expenseRows.push([
      '交通',
      t.label,
      t.per_person ? t.amount * t.person_count : t.amount,
      t.notes || '',
    ]);
  });
  otherCosts.forEach(o => {
    expenseRows.push(['その他', o.label, o.amount, o.notes || '']);
  });
  const expenseSheet = XLSX.utils.aoa_to_sheet(expenseRows);
  XLSX.utils.book_append_sheet(wb, expenseSheet, '支出明細');

  const memberSheet = XLSX.utils.aoa_to_sheet([
    ['氏名', '役職', '体重階級', '自己負担', '補助額', '備考'],
    ...members.map(m => [
      m.name,
      MEMBER_ROLE_LABELS[m.role],
      m.weight_class || '',
      m.self_payment,
      m.subsidy_amount,
      m.notes || '',
    ]),
  ]);
  XLSX.utils.book_append_sheet(wb, memberSheet, '名簿');

  XLSX.writeFile(wb, `${expedition.name}_収支.xlsx`);
}
