import {
  formatBsAcademicYear,
  formatBsDate,
  formatBsDateForInput,
  formatBsDateRange,
  formatBsDateTime,
  formatNepalTime,
  getNepalSchoolDay,
  isSameNepalSchoolDay,
  parseBsDateInput,
  toBsDateFromGregorian,
  toGregorianDateFromBs,
} from '@schoolos/core';

describe('SchoolOS Nepal BS date-time policy', () => {
  it('converts an authoritative New Year fixture in both directions', () => {
    expect(toBsDateFromGregorian({ year: 2024, month: 4, day: 13 })).toEqual({
      year: 2081,
      month: 1,
      day: 1,
    });
    expect(toGregorianDateFromBs('2081-01-01')).toEqual({
      year: 2024,
      month: 4,
      day: 13,
    });
  });

  it('formats SchoolOS presets in English BS and Nepal time', () => {
    const instant = '2026-06-20T05:00:00.000Z';

    expect(formatBsDate(instant, { preset: 'short' })).toBe('2083-03-06');
    expect(formatBsDate(instant)).toBe('Asar 6, 2083');
    expect(formatBsDate(instant, { preset: 'long' })).toBe(
      'Saturday, Asar 6, 2083',
    );
    expect(formatNepalTime(instant)).toBe('10:45 AM NPT');
    expect(formatBsDateTime(instant)).toBe('Asar 6, 2083, 10:45 AM NPT');
    expect(formatBsDateForInput(instant)).toBe('2083-03-06');
    expect(formatBsAcademicYear(2083)).toBe('2083/84');
    expect(formatBsDateRange('2083-03-01', '2083-03-06')).toBe(
      'Asar 1–6, 2083',
    );
    expect(formatBsDateRange('2082-12-29', '2083-01-02')).toBe(
      'Chaitra 29, 2082 – Baisakh 2, 2083',
    );
  });

  it('uses Asia/Kathmandu day boundaries around Nepal midnight', () => {
    const beforeMidnight = '2026-06-19T18:14:59.999Z';
    const atMidnight = '2026-06-19T18:15:00.000Z';

    expect(formatBsDate(beforeMidnight, { preset: 'short' })).toBe('2083-03-05');
    expect(formatBsDate(atMidnight, { preset: 'short' })).toBe('2083-03-06');
    expect(isSameNepalSchoolDay(beforeMidnight, atMidnight)).toBe(false);

    const schoolDay = getNepalSchoolDay(atMidnight);
    expect(schoolDay.gregorianDate).toBe('2026-06-20');
    expect(schoolDay.startUtc.toISOString()).toBe('2026-06-19T18:15:00.000Z');
    expect(schoolDay.endExclusiveUtc.toISOString()).toBe(
      '2026-06-20T18:15:00.000Z',
    );
  });

  it('validates malformed and impossible BS dates', () => {
    expect(() => parseBsDateInput('2083-3-06')).toThrow();
    // Asar 2083 has 32 days in the canonical BS dataset; day 33 is impossible.
    expect(() => parseBsDateInput('2083-03-33')).toThrow();
    expect(() => parseBsDateInput('2084-13-01')).toThrow();
  });
});
