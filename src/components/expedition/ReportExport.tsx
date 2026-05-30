'use client';

import { FileText, Sheet } from 'lucide-react';
import Button from '@/components/ui/Button';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';
import type {
  Expedition, Member, IncomeItem, AccommodationCost,
  MealCost, TransportCost, OtherCost, ExpeditionSummary
} from '@/types/expedition';
import { getEffectiveIncomeItems } from './IncomeSection';

interface ReportExportProps {
  expedition: Expedition;
  members: Member[];
  incomeItems: IncomeItem[];
  accommodation: AccommodationCost | null;
  mealCosts: MealCost[];
  transportCosts: TransportCost[];
  otherCosts: OtherCost[];
  summary: ExpeditionSummary;
}

export default function ReportExport(props: ReportExportProps) {
  const { members, incomeItems, summary, ...rest } = props;
  const selfPaymentTotal = summary.memberSelfPaymentTotal;
  const effectiveIncome = getEffectiveIncomeItems(incomeItems, selfPaymentTotal);

  const exportData = {
    ...rest,
    members,
    incomeItems: effectiveIncome,
    summary,
  };

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => exportToPDF(exportData)} className="w-full">
        <FileText className="w-4 h-4 mr-2" />
        報告書を出力（PDF）
      </Button>
      <Button variant="secondary" onClick={() => exportToExcel(exportData)} className="w-full">
        <Sheet className="w-4 h-4 mr-2" />
        Excelで出力
      </Button>
    </div>
  );
}
