/**
 * SchoolOS Shared Date Utilities
 * Handles AD (ISO) and BS (Bikram Sambat) date formatting and display.
 * Source of truth is always AD/ISO. BS is used for display purposes only.
 */

export type DateDisplayMode = 'AD' | 'BS' | 'BOTH';

/**
 * BS Calendar Data (2070 - 2090)
 * Format: [Year, MonthDays[12]]
 * Month index: 0=Baishakh, 1=Jestha, ..., 11=Chaitra
 */
const BS_CALENDAR_DATA: Record<number, number[]> = {
  2070: [31, 31, 31, 32, 31, 31, 30, 30, 30, 30, 29, 30],
  2071: [31, 31, 32, 31, 31, 31, 30, 30, 30, 30, 29, 30],
  2072: [31, 32, 31, 32, 31, 31, 30, 30, 30, 30, 29, 30],
  2073: [31, 32, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30],
  2074: [31, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30],
  2075: [31, 31, 32, 31, 31, 31, 30, 30, 30, 30, 29, 30],
  2076: [31, 32, 31, 32, 31, 31, 30, 30, 30, 30, 29, 30],
  2077: [31, 32, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30],
  2078: [31, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30],
  2079: [31, 31, 32, 31, 31, 31, 31, 30, 29, 30, 29, 30],
  2080: [31, 32, 31, 32, 31, 31, 30, 30, 30, 30, 29, 30],
  2081: [31, 32, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30],
  2082: [31, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30],
  2083: [31, 31, 32, 31, 31, 31, 31, 30, 29, 30, 29, 30],
  2084: [31, 32, 31, 32, 31, 31, 30, 30, 30, 30, 29, 30],
  2085: [31, 32, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30],
  2086: [31, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30],
  2087: [31, 31, 32, 31, 31, 31, 31, 30, 29, 30, 29, 30],
  2088: [31, 32, 31, 32, 31, 31, 30, 30, 30, 30, 29, 30],
  2089: [31, 32, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30],
  2090: [31, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30],
};

const BS_MONTH_LABELS = [
  'Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

// Reference date: 2000-01-01 BS = 1943-04-14 AD
const REF_BS_YEAR = 2000;
const REF_AD_DATE = new Date('1943-04-14T00:00:00Z');

/**
 * Normalizes an activity item to extract a date string.
 */
export function normalizeActivityDate(item: any): string {
  if (!item) return '';
  return (
    item.publishedAt ||
    item.createdAt ||
    item.timestamp ||
    item.occurredAt ||
    item.created_at ||
    item.issuedAt ||
    ''
  );
}

/**
 * Safe AD date formatter using Asia/Kathmandu timezone.
 */
export function formatAdDate(date: string | Date | null | undefined): string {
  if (!date) return 'Unknown date';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-NP', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kathmandu',
  }).format(d);
}

/**
 * Converts AD date to BS date object.
 */
export function getBsDate(date: string | Date | null | undefined) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  // Calculate difference in days from reference AD date
  // Using UTC to avoid DST issues for calendar conversion
  const utcDate = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const utcRef = Date.UTC(REF_AD_DATE.getUTCFullYear(), REF_AD_DATE.getUTCMonth(), REF_AD_DATE.getUTCDate());
  
  let diffDays = Math.floor((utcDate - utcRef) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return null; // Before our reference

  let bsYear = REF_BS_YEAR;
  let bsMonth = 0;
  let bsDay = 1;

  // Iterate through years
  while (true) {
    const daysInYear = getDaysInBsYear(bsYear);
    if (diffDays >= daysInYear) {
      diffDays -= daysInYear;
      bsYear++;
    } else {
      break;
    }
  }

  // Iterate through months
  const monthDays = getBsMonthDays(bsYear);
  while (diffDays > 0) {
    if (diffDays >= monthDays[bsMonth]) {
      diffDays -= monthDays[bsMonth];
      bsMonth++;
    } else {
      break;
    }
  }

  bsDay += diffDays;

  return {
    year: bsYear,
    month: bsMonth + 1,
    day: bsDay,
    monthLabel: BS_MONTH_LABELS[bsMonth],
  };
}

function getBsMonthDays(year: number): number[] {
  // Use data table if available, else fallback to a standard pattern
  return BS_CALENDAR_DATA[year] || [31, 31, 31, 32, 31, 31, 30, 30, 30, 30, 29, 30];
}

function getDaysInBsYear(year: number): number {
  return getBsMonthDays(year).reduce((a, b) => a + b, 0);
}

/**
 * Safe BS date formatter.
 */
export function formatBsDate(date: string | Date | null | undefined): string {
  const bs = getBsDate(date);
  if (!bs) return 'Unknown date';

  return `${bs.monthLabel} ${bs.day}, ${bs.year}`;
}

/**
 * Formats date based on school configuration or display mode.
 */
export function formatSchoolDate(
  date: string | Date | null | undefined,
  mode: DateDisplayMode = 'BOTH'
): string {
  if (!date) return 'Unknown date';

  const ad = formatAdDate(date);
  if (ad === 'Unknown date') return ad;

  const bs = formatBsDate(date);

  if (mode === 'AD') return ad;
  if (mode === 'BS') return bs;
  
  // BOTH
  return `${bs} (${ad})`;
}
