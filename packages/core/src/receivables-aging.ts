import { getNepalSchoolDay } from "./nepal-date.js";

/**
 * Phase 7.11b: the one definition of receivables aging, shared by the API
 * (Fees Home, defaulters, reports, accounting) and the web.
 *
 * - Days overdue are counted in Nepal calendar dates: the Nepal date of the
 *   due date against the Nepal school day the report is "as of". An invoice
 *   due today is not overdue; it becomes 1 day overdue tomorrow.
 * - Bucket keys keep the established API strings. "0-30" means 1 to 30 days
 *   overdue (it always did); "CURRENT" means not yet overdue.
 */
export const RECEIVABLES_AGING_BUCKETS = [
  "CURRENT",
  "0-30",
  "31-60",
  "61-90",
  "90+",
] as const;
export type ReceivablesAgingBucket = (typeof RECEIVABLES_AGING_BUCKETS)[number];
export const OVERDUE_AGING_BUCKETS = ["0-30", "31-60", "61-90", "90+"] as const;
export type OverdueAgingBucket = (typeof OVERDUE_AGING_BUCKETS)[number];

export const RECEIVABLES_AGING_BUCKET_LABELS: Record<
  ReceivablesAgingBucket,
  string
> = {
  CURRENT: "Not yet due",
  "0-30": "1–30 days overdue",
  "31-60": "31–60 days overdue",
  "61-90": "61–90 days overdue",
  "90+": "More than 90 days overdue",
};

export const AGING_BUCKET_DAY_RANGES: Record<
  ReceivablesAgingBucket,
  { min: number; max: number | null }
> = {
  CURRENT: { min: 0, max: 0 },
  "0-30": { min: 1, max: 30 },
  "31-60": { min: 31, max: 60 },
  "61-90": { min: 61, max: 90 },
  "90+": { min: 91, max: null },
};

export function agingBucketForDays(
  daysOverdue: number,
): ReceivablesAgingBucket {
  if (daysOverdue <= 0) return "CURRENT";
  if (daysOverdue <= 30) return "0-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whole days from `from` to `to`, both strict YYYY-MM-DD Gregorian dates. */
export function daysBetweenGregorianDates(from: string, to: string): number {
  const a = DATE_ONLY.exec(from);
  const b = DATE_ONLY.exec(to);
  if (!a || !b) throw new Error("Expected YYYY-MM-DD dates");
  const start = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const end = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((end - start) / 86_400_000);
}

/** The Nepal calendar date (YYYY-MM-DD) of an instant. */
export function nepalDateOf(instant: Date | string | number): string {
  return getNepalSchoolDay(instant).gregorianDate;
}

/**
 * Days an invoice is overdue on the given Nepal school day (YYYY-MM-DD).
 * Never negative: an invoice that is not yet due is 0 days overdue.
 */
export function daysOverdueOn(
  dueDate: Date | string | number,
  asOfNepalDate: string,
): number {
  return Math.max(
    0,
    daysBetweenGregorianDates(nepalDateOf(dueDate), asOfNepalDate),
  );
}

export function isOverdueBucket(
  bucket: ReceivablesAgingBucket,
): bucket is OverdueAgingBucket {
  return bucket !== "CURRENT";
}
