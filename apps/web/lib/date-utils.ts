import { formatBsDate as coreFormatBsDate, toBsDateFromGregorian } from '@schoolos/core';

/** Legacy values remain accepted for callers, but all school-facing output is BS. */
export type DateDisplayMode = 'AD' | 'BS' | 'BOTH';

const monthNames = [
  'Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
] as const;

export function normalizeActivityDate(item: any): string {
  if (!item) return '';
  return item.publishedAt || item.createdAt || item.timestamp || item.occurredAt || item.created_at || item.issuedAt || '';
}

export function getBsDate(date: string | Date | null | undefined) {
  if (!date) return null;
  try {
    const bs = toBsDateFromGregorian(date);
    return { ...bs, monthLabel: monthNames[bs.month - 1] };
  } catch {
    return null;
  }
}

export function formatBsDate(date: string | Date | null | undefined): string {
  if (!date) return 'Unknown date';
  try {
    return coreFormatBsDate(date);
  } catch {
    return 'Unknown date';
  }
}

/** Legacy import compatibility. School-facing dates are always BS. */
export function formatAdDate(date: string | Date | null | undefined): string {
  return formatBsDate(date);
}

/** Legacy mode is intentionally ignored: SchoolOS now displays BS only. */
export function formatSchoolDate(
  date: string | Date | null | undefined,
  _mode: DateDisplayMode = 'BS',
): string {
  return formatBsDate(date);
}
