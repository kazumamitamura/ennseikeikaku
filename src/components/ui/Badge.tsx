import clsx from 'clsx';
import type { ExpeditionStatus } from '@/types/expedition';
import { STATUS_LABELS } from '@/types/expedition';

interface BadgeProps {
  status: ExpeditionStatus;
  className?: string;
}

const statusColors: Record<ExpeditionStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  settled: 'bg-green-100 text-green-700',
};

export default function Badge({ status, className }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      statusColors[status],
      className
    )}>
      {STATUS_LABELS[status]}
    </span>
  );
}
