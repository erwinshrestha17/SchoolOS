import {
  formatBsDate as coreFormatBsDate,
  toBsDateFromGregorian,
  toNepalLocalDateTime,
} from '@schoolos/core';

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

/**
 * Explicitly calendar-labelled date, for surfaces where an unlabelled date is
 * genuinely ambiguous (P2.3).
 *
 * SchoolOS school-facing output is Bikram Sambat by default -- that is the
 * canonical product decision this module encodes and `formatSchoolDate`
 * keeps. The problem this solves is narrower: an unlabelled "Shrawan 7, 2083"
 * next to an unlabelled "27/07/2026" leaves the reader guessing which
 * calendar each belongs to. Labelling removes the guess without changing
 * which calendar is primary.
 *
 * `withGregorian` adds the AD equivalent as a secondary, for teacher-facing
 * records that are also read by AD-native systems (payslips, contracts,
 * official letters).
 *
 *   formatLabelledSchoolDate(d)                     -> "Shrawan 11, 2083 BS"
 *   formatLabelledSchoolDate(d, {withGregorian:true})
 *      -> "Shrawan 11, 2083 BS (27 July 2026 AD)"
 */
export function formatLabelledSchoolDate(
  date: string | Date | null | undefined,
  options: { withGregorian?: boolean } = {},
): string {
  const bs = formatBsDate(date);
  if (bs === 'Unknown date') return bs;

  const labelled = `${bs} BS`;
  if (!options.withGregorian || !date) return labelled;

  try {
    const local = toNepalLocalDateTime(date);
    const gregorian = `${local.day} ${AD_MONTH_NAMES[local.month - 1]} ${local.year} AD`;
    return `${labelled} (${gregorian})`;
  } catch {
    return labelled;
  }
}

const AD_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
