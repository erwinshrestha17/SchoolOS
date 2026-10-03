import { priceCorrection } from './payroll-adjustments';
import {
  planStaffProration,
  prorationBreakdownJson,
  toMinor,
  type CompensationSource,
  type StaffProrationPlan,
} from './payroll-proration';

// FIXTURE numbers only. Kartik 2083 (BS) = 2026-10-18 .. 2026-11-16.
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const period = {
  startsOn: d('2026-10-18'),
  endsOn: new Date('2026-11-16T23:59:59.999Z'),
};
const days = (from: string, to: string) => {
  const out: Date[] = [];
  for (
    let at = Date.parse(`${from}T00:00:00.000Z`);
    at <= Date.parse(`${to}T00:00:00.000Z`);
    at += 86_400_000
  )
    out.push(new Date(at));
  return out;
};
const source = (id = 'a', from = '2024-01-01'): CompensationSource => ({
  kind: 'SALARY_STRUCTURE',
  id,
  from: d(from),
  to: null,
  basic: toMinor('30000'),
  allowances: toMinor('3000'),
  fixedDeductions: 0n,
  pfEnabled: false,
  tdsEnabled: false,
});

function sourceLine(presentTo = '2026-11-15', divisorDays = 30) {
  const plan = planStaffProration({
    period,
    employments: [{ effectiveFrom: d('2024-01-01'), effectiveTo: null }],
    sources: [source()],
    divisorDays,
    presentDates: days('2026-10-18', presentTo),
    leaves: [],
  }) as StaffProrationPlan;
  return {
    runId: 'run-source',
    lineId: 'line-source',
    periodLabel: 'Kartik 2083',
    breakdown: prorationBreakdownJson(plan, 'CALENDAR_DAYS_OF_PERIOD', {
      label: 'Kartik 2083',
      startsOn: '2026-10-18',
      endsOn: '2026-11-16',
    }),
  };
}

const correction = (overrides: Record<string, unknown> = {}) => ({
  id: 'correction-1',
  staffId: 'staff-1',
  attendanceDate: '2026-11-16',
  originalStatus: 'ABSENT',
  requestedStatus: 'PRESENT',
  ...overrides,
});

describe('priceCorrection (7.7 corrections consumed by payroll)', () => {
  it('prices a correction to present as arrears at the source line rate', () => {
    const result = priceCorrection(correction(), sourceLine());
    expect(result).toMatchObject({
      outcome: 'PRICED',
      kind: 'ARREARS',
      deltaCenti: 100n,
      amount: 110_000n,
      dailyRate: '1100.0000',
    });
    if (result.outcome === 'PRICED')
      expect(result.pricing).toMatchObject({
        sourceRunId: 'run-source',
        sourceLineId: 'line-source',
        paidDaysBefore: '29.00',
        paidDaysAfter: '30.00',
        segment: { monthlyGross: '33000.00' },
      });
  });

  it('prices a correction away from present as a recovery', () => {
    const result = priceCorrection(
      correction({
        attendanceDate: '2026-11-01',
        originalStatus: 'PRESENT',
        requestedStatus: 'ABSENT',
      }),
      sourceLine(),
    );
    expect(result).toMatchObject({
      outcome: 'PRICED',
      kind: 'RECOVERY',
      deltaCenti: -100n,
      amount: 110_000n,
    });
  });

  it('has no payroll effect when the paid contribution does not change', () => {
    expect(
      priceCorrection(
        correction({
          attendanceDate: '2026-11-01',
          originalStatus: 'PRESENT',
          requestedStatus: 'LATE',
        }),
        sourceLine(),
      ),
    ).toEqual({ outcome: 'NO_PAYROLL_EFFECT' });
  });

  it('has no payroll effect when the divisor cap already pays the month in full', () => {
    // 26-day divisor, 30 present days: the 27th+ present day adds nothing.
    expect(
      priceCorrection(
        correction({ attendanceDate: '2026-11-16' }),
        sourceLine('2026-11-15', 26),
      ),
    ).toEqual({ outcome: 'NO_PAYROLL_EFFECT' });
  });

  it('is unresolved, not guessed, without an approved source line', () => {
    expect(priceCorrection(correction(), null)).toMatchObject({
      outcome: 'UNRESOLVED',
      code: 'SOURCE_LINE_MISSING',
    });
  });

  it('is unresolved for a source line that predates proration lineage', () => {
    expect(
      priceCorrection(correction(), { ...sourceLine(), breakdown: null }),
    ).toMatchObject({ code: 'SOURCE_LINE_WITHOUT_LEDGER' });
  });

  it('is unresolved for a date that was not an employed day of the source line', () => {
    expect(
      priceCorrection(
        correction({ attendanceDate: '2026-12-25' }),
        sourceLine(),
      ),
    ).toMatchObject({ code: 'DATE_NOT_IN_SOURCE_LEDGER' });
  });

  it('is unresolved when the source line does not reproduce its own paid days', () => {
    const line = sourceLine();
    const tampered = {
      ...line,
      breakdown: { ...(line.breakdown as object), paidDays: '29.50' },
    };
    expect(priceCorrection(correction(), tampered)).toMatchObject({
      code: 'SOURCE_LINE_INCONSISTENT',
    });
  });
});
