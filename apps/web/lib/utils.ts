import {
  formatBsAcademicYear,
  formatBsDate,
  formatBsDateForInput,
  formatBsDateRange,
  formatBsDateTime,
  formatNepalTime,
} from '@schoolos/core';

export function cn(...inputs: any[]) {
  return inputs
    .flat()
    .filter((x) => typeof x === 'string' && x.length > 0)
    .join(' ');
}

/**
 * School-facing instant formatter. API timestamps must be ISO-8601 UTC values;
 * this renders their Asia/Kathmandu civil date in English Bikram Sambat.
 */
export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '';
  return formatBsDate(value);
}

/** School-facing timestamp formatter with explicit NPT time context. */
export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '';
  return formatBsDateTime(value);
}

/** Use for API date-only business values that use Gregorian YYYY-MM-DD transport semantics. */
export function formatDateForInput(value: string | Date | null | undefined) {
  if (!value) return '';
  return formatBsDateForInput(value);
}

export { formatBsAcademicYear, formatBsDateRange, formatNepalTime };
