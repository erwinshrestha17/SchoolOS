'use client';

import { cn } from '../../lib/utils';

type MoneyDisplayProps = {
  amount: number | string | null | undefined;
  className?: string;
  mutedZero?: boolean;
};

export function MoneyDisplay({ amount, className, mutedZero }: MoneyDisplayProps) {
  const numericAmount = Number(amount ?? 0);
  const formatted = new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numericAmount) ? numericAmount : 0);

  return (
    <span className={cn(mutedZero && numericAmount === 0 && 'text-slate-400', className)}>
      {formatted}
    </span>
  );
}
