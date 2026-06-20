/**
 * Canonical SchoolOS Nepal date/time policy.
 *
 * Storage: UTC Gregorian instants. Display: English Bikram Sambat in Asia/Kathmandu.
 * Date-only business values remain Nepal local school dates and must be transported as YYYY-MM-DD.
 *
 * The BS month-length dataset is the MIT-licensed `nepali-date-converter` v3.4.0 dataset,
 * vendored here so backend and web share one deterministic implementation without relying on
 * browser or server local timezone behaviour. The Flutter implementation is generated from the
 * same dataset and is covered by parity fixtures.
 */

export const NEPAL_TIME_ZONE = 'Asia/Kathmandu' as const;
export const BS_CALENDAR_MIN_YEAR = 2000;
export const BS_CALENDAR_MAX_YEAR = 2090;

const DAY_MS = 86_400_000;
const GREGORIAN_EPOCH = { year: 1943, month: 4, day: 14 } as const;

export const BS_MONTH_NAMES_EN = [
  'Baisakh',
  'Jestha',
  'Asar',
  'Shrawan',
  'Bhadra',
  'Ashwin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
] as const;

export const BS_WEEKDAY_NAMES_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export interface BsDate {
  year: number;
  /** 1-12; Baisakh is 1. */
  month: number;
  day: number;
}

export interface GregorianDate {
  year: number;
  /** 1-12. */
  month: number;
  day: number;
}

export interface NepalLocalDateTime extends GregorianDate {
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
  timeZone: typeof NEPAL_TIME_ZONE;
}

export interface NepalSchoolDay {
  gregorianDate: string;
  bsDate: BsDate;
  startUtc: Date;
  endExclusiveUtc: Date;
}

export type BsDateFormatPreset = 'short' | 'standard' | 'long';

export interface BsDateFormatOptions {
  preset?: BsDateFormatPreset;
}

const BS_MONTH_LENGTHS: Readonly<Record<number, readonly number[]>> = {
  2000: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2001: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2002: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2003: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2004: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2005: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2006: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2007: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2008: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  2009: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2010: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2011: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2012: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2013: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2014: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2015: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2016: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2017: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2018: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2019: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2020: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2021: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2022: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2023: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2024: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2025: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2026: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2027: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2028: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2029: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2030: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2031: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2032: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2033: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2034: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2035: [30, 32, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  2036: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2037: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2038: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2039: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2040: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2041: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2042: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2043: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2044: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2045: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2046: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2047: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2048: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2049: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2050: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2051: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2052: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2053: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2054: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2055: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2056: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2057: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2058: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2059: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2060: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2061: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2062: [30, 32, 31, 32, 31, 31, 29, 30, 29, 30, 29, 31],
  2063: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2064: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2065: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2066: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  2067: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2068: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2069: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2070: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2071: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2073: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2074: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2075: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2082: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2083: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2084: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2085: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2086: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2087: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
  2088: [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30],
  2089: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2090: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
};

const NEPAL_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
  timeZone: NEPAL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const NEPAL_OFFSET_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: NEPAL_TIME_ZONE,
  timeZoneName: 'longOffset',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function assertFiniteInteger(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${label} must be a finite integer.`);
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toIsoDate(parts: GregorianDate | BsDate): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function isGregorianDate(value: unknown): value is GregorianDate {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as GregorianDate).year === 'number' &&
      typeof (value as GregorianDate).month === 'number' &&
      typeof (value as GregorianDate).day === 'number',
  );
}

function utcDayNumber(parts: GregorianDate): number {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS);
}

function fromUtcDayNumber(dayNumber: number): GregorianDate {
  const date = new Date(dayNumber * DAY_MS);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function daysInGregorianMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function assertGregorianDate(parts: GregorianDate): void {
  assertFiniteInteger(parts.year, 'Gregorian year');
  assertFiniteInteger(parts.month, 'Gregorian month');
  assertFiniteInteger(parts.day, 'Gregorian day');
  if (parts.month < 1 || parts.month > 12) {
    throw new Error('Gregorian month must be between 1 and 12.');
  }
  if (parts.day < 1 || parts.day > daysInGregorianMonth(parts.year, parts.month)) {
    throw new Error('Gregorian day is not valid for this month.');
  }
}

function assertBsDate(parts: BsDate): void {
  assertFiniteInteger(parts.year, 'BS year');
  assertFiniteInteger(parts.month, 'BS month');
  assertFiniteInteger(parts.day, 'BS day');
  if (parts.year < BS_CALENDAR_MIN_YEAR || parts.year > BS_CALENDAR_MAX_YEAR) {
    throw new Error(
      `BS date is outside the supported ${BS_CALENDAR_MIN_YEAR}-${BS_CALENDAR_MAX_YEAR} conversion range.`,
    );
  }
  if (parts.month < 1 || parts.month > 12) {
    throw new Error('BS month must be between 1 and 12.');
  }
  if (parts.day < 1 || parts.day > daysInBsMonth(parts.year, parts.month)) {
    throw new Error('BS day is not valid for this month.');
  }
}

function partsFromFormatter(formatter: Intl.DateTimeFormat, date: Date): Record<string, number> {
  const parts = formatter.formatToParts(date);
  return Object.fromEntries(
    parts
      .filter((part) => ['year', 'month', 'day', 'hour', 'minute', 'second'].includes(part.type))
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
}

/** Returns canonical Nepal civil time for a UTC instant without using host local time. */
export function toNepalLocalDateTime(value: Date | string | number): NepalLocalDateTime {
  const date = toInstant(value);
  const parts = partsFromFormatter(NEPAL_DATE_TIME_FORMATTER, date);
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    millisecond: date.getUTCMilliseconds(),
    timeZone: NEPAL_TIME_ZONE,
  };
}

/** Returns canonical Nepal local time for the current instant. */
export function getNepalNow(): NepalLocalDateTime {
  return toNepalLocalDateTime(new Date());
}

/** Parses a strict English-numeral BS input value in YYYY-MM-DD format. */
export function parseBsDateInput(value: string): BsDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error('BS date must use YYYY-MM-DD with English numerals.');
  }
  const parsed = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  assertBsDate(parsed);
  return parsed;
}

/** Converts a BS date to a Gregorian Nepal-local business date. It does not create a timestamp. */
export function toGregorianDateFromBs(value: BsDate | string): GregorianDate {
  const bs = typeof value === 'string' ? parseBsDateInput(value) : value;
  assertBsDate(bs);
  let offset = bs.day - 1;
  for (let year = BS_CALENDAR_MIN_YEAR; year < bs.year; year += 1) {
    offset += totalDaysInBsYear(year);
  }
  for (let month = 1; month < bs.month; month += 1) {
    offset += daysInBsMonth(bs.year, month);
  }
  return fromUtcDayNumber(utcDayNumber(GREGORIAN_EPOCH) + offset);
}

/** Converts a Gregorian Nepal-local business date to BS. A Date/timestamp is first localized to Asia/Kathmandu. */
export function toBsDateFromGregorian(value: GregorianDate | Date | string | number): BsDate {
  const gregorian = isGregorianDate(value)
    ? value
    : toNepalLocalDateTime(value as Date | string | number);
  assertGregorianDate(gregorian);
  let remaining = utcDayNumber(gregorian) - utcDayNumber(GREGORIAN_EPOCH);
  if (remaining < 0) {
    throw new Error('Gregorian date is before the supported BS conversion range.');
  }

  let year = BS_CALENDAR_MIN_YEAR;
  while (year <= BS_CALENDAR_MAX_YEAR) {
    const yearDays = totalDaysInBsYear(year);
    if (remaining < yearDays) break;
    remaining -= yearDays;
    year += 1;
  }
  if (year > BS_CALENDAR_MAX_YEAR) {
    throw new Error('Gregorian date is after the supported BS conversion range.');
  }

  let month = 1;
  while (month <= 12) {
    const monthDays = daysInBsMonth(year, month);
    if (remaining < monthDays) break;
    remaining -= monthDays;
    month += 1;
  }
  return { year, month, day: remaining + 1 };
}

/** Formats a UTC instant as a BS date in Nepal, using English month names and numerals. */
export function formatBsDate(value: Date | string | number, options: BsDateFormatOptions = {}): string {
  const local = toNepalLocalDateTime(value);
  return formatBsDateOnly(toBsDateFromGregorian(local), {
    preset: options.preset,
    weekday: new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay(),
  });
}

/** Formats an already-local BS date. */
export function formatBsDateOnly(
  value: BsDate | string,
  options: BsDateFormatOptions & { weekday?: number } = {},
): string {
  const date = typeof value === 'string' ? parseBsDateInput(value) : value;
  assertBsDate(date);
  const preset = options.preset ?? 'standard';
  if (preset === 'short') return toIsoDate(date);
  const standard = `${BS_MONTH_NAMES_EN[date.month - 1]} ${date.day}, ${date.year}`;
  if (preset === 'standard') return standard;
  const gregorian = toGregorianDateFromBs(date);
  const weekday = options.weekday ?? new Date(Date.UTC(gregorian.year, gregorian.month - 1, gregorian.day)).getUTCDay();
  return `${BS_WEEKDAY_NAMES_EN[weekday]}, ${standard}`;
}

/** Formats a UTC instant as BS date + NPT time. */
export function formatBsDateTime(value: Date | string | number): string {
  return `${formatBsDate(value)}, ${formatNepalTime(value)}`;
}

/** Formats a UTC instant as a 12-hour English-numeral Nepal time. */
export function formatNepalTime(value: Date | string | number): string {
  const local = toNepalLocalDateTime(value);
  const suffix = local.hour >= 12 ? 'PM' : 'AM';
  const hour = local.hour % 12 || 12;
  return `${pad2(hour)}:${pad2(local.minute)} ${suffix} NPT`;
}

/** Produces a strict BS YYYY-MM-DD value for a Gregorian date-only business value or UTC instant. */
export function formatBsDateForInput(value: GregorianDate | Date | string | number): string {
  const bs = isGregorianDate(value)
    ? toBsDateFromGregorian(value)
    : toBsDateFromGregorian(value as Date | string | number);
  return toIsoDate(bs);
}

/** Formats a BS academic-year label, for example 2083/84. */
export function formatBsAcademicYear(value: number | BsDate): string {
  const year = typeof value === 'number' ? value : value.year;
  assertFiniteInteger(year, 'BS academic year');
  return `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
}

/** Formats a BS date range using compact Nepal school notation. */
export function formatBsDateRange(start: BsDate | string, end: BsDate | string): string {
  const left = typeof start === 'string' ? parseBsDateInput(start) : start;
  const right = typeof end === 'string' ? parseBsDateInput(end) : end;
  assertBsDate(left);
  assertBsDate(right);
  if (left.year === right.year && left.month === right.month) {
    return `${BS_MONTH_NAMES_EN[left.month - 1]} ${left.day}–${right.day}, ${left.year}`;
  }
  const leftText = `${BS_MONTH_NAMES_EN[left.month - 1]} ${left.day}, ${left.year}`;
  const rightText = `${BS_MONTH_NAMES_EN[right.month - 1]} ${right.day}, ${right.year}`;
  return `${leftText} – ${rightText}`;
}

/** Number of days in a supported BS month. */
export function daysInBsMonth(year: number, month: number): number {
  const lengths = BS_MONTH_LENGTHS[year];
  if (!lengths || month < 1 || month > 12) {
    throw new Error(`BS month is outside the supported ${BS_CALENDAR_MIN_YEAR}-${BS_CALENDAR_MAX_YEAR} conversion range.`);
  }
  return lengths[month - 1];
}

/** True when two instants fall within the same Nepal local school day. */
export function isSameNepalSchoolDay(left: Date | string | number, right: Date | string | number): boolean {
  const a = toNepalLocalDateTime(left);
  const b = toNepalLocalDateTime(right);
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Returns the Nepal-local school day, its BS representation, and safe UTC query bounds. */
export function getNepalSchoolDay(value: Date | string | number = new Date()): NepalSchoolDay {
  const local = toNepalLocalDateTime(value);
  const gregorianDate = { year: local.year, month: local.month, day: local.day };
  const next = addGregorianDays(gregorianDate, 1);
  return {
    gregorianDate: toIsoDate(gregorianDate),
    bsDate: toBsDateFromGregorian(gregorianDate),
    startUtc: zonedNepalDateTimeToUtc({ ...gregorianDate, hour: 0, minute: 0, second: 0 }),
    endExclusiveUtc: zonedNepalDateTimeToUtc({ ...next, hour: 0, minute: 0, second: 0 }),
  };
}

/** Returns the UTC instant for a Nepal civil date/time via the IANA timezone database. */
export function zonedNepalDateTimeToUtc(
  value: GregorianDate & { hour?: number; minute?: number; second?: number; millisecond?: number },
): Date {
  assertGregorianDate(value);
  const hour = value.hour ?? 0;
  const minute = value.minute ?? 0;
  const second = value.second ?? 0;
  const millisecond = value.millisecond ?? 0;
  [hour, minute, second, millisecond].forEach((part, index) => assertFiniteInteger(part, ['hour', 'minute', 'second', 'millisecond'][index]));
  const nominalUtc = Date.UTC(value.year, value.month - 1, value.day, hour, minute, second, millisecond);
  let candidate = nominalUtc;
  for (let i = 0; i < 3; i += 1) {
    const next = nominalUtc - getNepalOffsetMilliseconds(new Date(candidate));
    if (next === candidate) break;
    candidate = next;
  }
  return new Date(candidate);
}

function totalDaysInBsYear(year: number): number {
  const lengths = BS_MONTH_LENGTHS[year];
  if (!lengths) {
    throw new Error(`BS year is outside the supported ${BS_CALENDAR_MIN_YEAR}-${BS_CALENDAR_MAX_YEAR} conversion range.`);
  }
  return lengths.reduce((total, days) => total + days, 0);
}

function addGregorianDays(value: GregorianDate, days: number): GregorianDate {
  const next = new Date(Date.UTC(value.year, value.month - 1, value.day + days));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function toInstant(value: Date | string | number): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Date value must be a valid ISO-8601 UTC timestamp or Date instance.');
  }
  return date;
}

function getNepalOffsetMilliseconds(value: Date): number {
  const part = NEPAL_OFFSET_FORMATTER.formatToParts(value).find((item) => item.type === 'timeZoneName')?.value;
  const match = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(part ?? '');
  if (!match) {
    throw new Error(`Unable to resolve ${NEPAL_TIME_ZONE} from the runtime IANA timezone database.`);
  }
  const sign = match[1] === '+' ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? '0')) * 60_000;
}
