import {
  countLedgerDays,
  divRoundHalfUp,
  formatCenti,
  formatMinor,
  periodDayCounts,
  planStaffProration,
  toMinor,
  type CompensationSource,
  type StaffProrationInput,
  type StaffProrationPlan,
} from './payroll-proration';

// FIXTURE numbers only: these are not Nepal salary scales or statutory rates.
// Kartik 2083 (BS) = 2026-10-18 .. 2026-11-16, 30 calendar days.
const period = {
  startsOn: new Date('2026-10-18T00:00:00.000Z'),
  endsOn: new Date('2026-11-16T23:59:59.999Z'),
};
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const datesBetween = (from: string, to: string) => {
  const out: Date[] = [];
  for (
    let at = Date.parse(`${from}T00:00:00.000Z`);
    at <= Date.parse(`${to}T00:00:00.000Z`);
    at += 86_400_000
  )
    out.push(new Date(at));
  return out;
};

function source(
  overrides: Partial<CompensationSource> & { id?: string } = {},
): CompensationSource {
  return {
    kind: 'SALARY_STRUCTURE',
    id: 'structure-a',
    from: d('2024-01-01'),
    to: null,
    basic: toMinor('30000'),
    allowances: toMinor('3000'),
    fixedDeductions: toMinor('0'),
    pfEnabled: false,
    tdsEnabled: false,
    ...overrides,
  };
}

function input(
  overrides: Partial<StaffProrationInput> = {},
): StaffProrationInput {
  return {
    period,
    employments: [{ effectiveFrom: d('2024-01-01'), effectiveTo: null }],
    sources: [source()],
    divisorDays: 30,
    presentDates: datesBetween('2026-10-18', '2026-11-16'),
    leaves: [],
    ...overrides,
  };
}

function resolved(value: ReturnType<typeof planStaffProration>) {
  if (value.status !== 'RESOLVED')
    throw new Error(`expected a resolved plan, got ${value.code}`);
  return value as StaffProrationPlan;
}

describe('rounding primitives', () => {
  it('rounds half away from zero exactly once', () => {
    expect(divRoundHalfUp(5n, 2n)).toBe(3n);
    expect(divRoundHalfUp(-5n, 2n)).toBe(-3n);
    expect(divRoundHalfUp(4n, 3n)).toBe(1n);
    expect(divRoundHalfUp(10n, 4n)).toBe(3n);
    expect(divRoundHalfUp(0n, 7n)).toBe(0n);
    expect(() => divRoundHalfUp(1n, 0n)).toThrow(RangeError);
  });

  it('parses decimals to paisa without floating point drift', () => {
    expect(toMinor('0.005')).toBe(1n);
    expect(toMinor('1.994')).toBe(199n);
    expect(toMinor('1.995')).toBe(200n);
    expect(toMinor('33000')).toBe(3_300_000n);
    expect(toMinor('-12.5')).toBe(-1250n);
    expect(toMinor(0.1 + 0.2)).toBe(30n);
    expect(() => toMinor('1e3')).toThrow(RangeError);
    expect(() => toMinor('abc')).toThrow(RangeError);
  });

  it('formats money and days to two decimals', () => {
    expect(formatMinor(3_300_000n)).toBe('33000.00');
    expect(formatMinor(-705n)).toBe('-7.05');
    expect(formatMinor(5n)).toBe('0.05');
    expect(formatCenti(1550n)).toBe('15.50');
  });
});

describe('planStaffProration', () => {
  it('pays the full month for a fully employed, fully present staff member', () => {
    const plan = resolved(planStaffProration(input()));
    expect(plan.employedDays).toBe(30);
    expect(plan.periodCalendarDays).toBe(30);
    expect(formatCenti(plan.paidCenti)).toBe('30.00');
    expect(formatMinor(plan.totals.gross)).toBe('33000.00');
    expect(formatMinor(plan.totals.basic)).toBe('30000.00');
    expect(plan.totals.gross).toBe(plan.totals.employedEntitlement);
    expect(plan.segments).toHaveLength(1);
  });

  it('pays attendance days at 1/divisor of the monthly salary', () => {
    const plan = resolved(
      planStaffProration(
        input({ presentDates: datesBetween('2026-10-18', '2026-11-01') }),
      ),
    );
    expect(plan.presentDays).toBe(15);
    expect(formatCenti(plan.paidCenti)).toBe('15.00');
    expect(formatCenti(plan.unpaidCenti)).toBe('15.00');
    expect(formatMinor(plan.totals.gross)).toBe('16500.00');
    // The shortfall against the employed entitlement is the leave deduction.
    expect(
      formatMinor(plan.totals.employedEntitlement - plan.totals.gross),
    ).toBe('16500.00');
  });

  it('prorates a mid-period joiner exactly and prorates fixed deductions by employed days', () => {
    const plan = resolved(
      planStaffProration(
        input({
          employments: [{ effectiveFrom: d('2026-11-02'), effectiveTo: null }],
          sources: [source({ fixedDeductions: toMinor('1000') })],
          presentDates: datesBetween('2026-10-18', '2026-11-16'),
        }),
      ),
    );
    expect(plan.employedDays).toBe(15);
    expect(formatCenti(plan.paidCenti)).toBe('15.00');
    expect(formatMinor(plan.totals.gross)).toBe('16500.00');
    expect(formatMinor(plan.totals.fixedDeductions)).toBe('500.00');
    // Present on days outside the employment window changes nothing.
    expect(plan.presentDays).toBe(15);
    expect(plan.totals.employedEntitlement).toBe(plan.totals.gross);
  });

  it('limits a mid-period leaver to the days before the exclusive end date', () => {
    const plan = resolved(
      planStaffProration(
        input({
          employments: [
            { effectiveFrom: d('2024-01-01'), effectiveTo: d('2026-10-28') },
          ],
          divisorDays: 31,
        }),
      ),
    );
    expect(plan.employedDays).toBe(10);
    expect(formatCenti(plan.paidCenti)).toBe('10.00');
    // 33000 * 10.00 / 31, rounded half up once.
    expect(formatMinor(plan.totals.gross)).toBe('10645.16');
  });

  it('prices each part of a salary change at its own rate and allocates paid days exactly', () => {
    const plan = resolved(
      planStaffProration(
        input({
          sources: [
            source({ id: 'a', to: d('2026-11-01') }),
            source({
              id: 'b',
              from: d('2026-11-02'),
              basic: toMinor('36000'),
              allowances: toMinor('0'),
            }),
          ],
        }),
      ),
    );
    expect(
      plan.segments.map((s) => [s.source.id, s.from, s.to, s.days]),
    ).toEqual([
      ['a', '2026-10-18', '2026-11-01', 15],
      ['b', '2026-11-02', '2026-11-16', 15],
    ]);
    expect(plan.segments.map((s) => formatMinor(s.gross))).toEqual([
      '16500.00',
      '18000.00',
    ]);
    expect(formatMinor(plan.totals.gross)).toBe('34500.00');
    expect(plan.segments.reduce((n, s) => n + s.paidCenti, 0n)).toBe(
      plan.paidCenti,
    );
    expect(plan.ledger.map((day) => day.s)).toEqual([
      ...Array<number>(15).fill(0),
      ...Array<number>(15).fill(1),
    ]);
  });

  it('gives the remainder of an odd paid-day split to the last segment so the sum is exact', () => {
    const plan = resolved(
      planStaffProration(
        input({
          divisorDays: 7,
          sources: [
            source({ id: 'a', to: d('2026-10-24') }),
            source({ id: 'b', from: d('2026-10-25'), to: d('2026-11-03') }),
            source({ id: 'c', from: d('2026-11-04') }),
          ],
        }),
      ),
    );
    expect(plan.segments).toHaveLength(3);
    expect(plan.segments.reduce((n, s) => n + s.paidCenti, 0n)).toBe(
      plan.paidCenti,
    );
    expect(plan.paidCenti).toBe(700n);
  });

  it('refuses to guess a rate for employed days no source covers', () => {
    const result = planStaffProration(
      input({ sources: [source({ from: d('2026-11-02') })] }),
    );
    expect(result).toMatchObject({
      status: 'UNRESOLVED',
      code: 'PRORATION_EMPLOYED_DAYS_WITHOUT_COMPENSATION',
    });
    if (result.status === 'UNRESOLVED')
      expect(result.uncoveredDays).toHaveLength(15);
  });

  it('refuses a period with no employed day or an invalid divisor', () => {
    expect(
      planStaffProration(
        input({
          employments: [{ effectiveFrom: d('2027-01-01'), effectiveTo: null }],
        }),
      ),
    ).toMatchObject({ code: 'PRORATION_NO_EMPLOYED_DAYS' });
    for (const divisorDays of [0, 33, 30.5, -1, Number.NaN])
      expect(planStaffProration(input({ divisorDays }))).toMatchObject({
        code: 'PRORATION_DIVISOR_INVALID',
      });
  });

  it('counts a day once when attendance and an approved leave overlap', () => {
    const plan = resolved(
      planStaffProration(
        input({
          presentDates: [
            ...datesBetween('2026-10-18', '2026-11-01'),
            d('2026-11-03'),
          ],
          leaves: [
            {
              startsOn: d('2026-11-02'),
              endsOn: d('2026-11-06'),
              isPaid: true,
              days: 5,
            },
            {
              startsOn: d('2026-11-07'),
              endsOn: d('2026-11-08'),
              isPaid: false,
              days: 2,
            },
          ],
        }),
      ),
    );
    expect(plan.presentDays).toBe(16);
    expect(plan.paidLeaveCenti).toBe(400n);
    expect(plan.unpaidLeaveCenti).toBe(200n);
    expect(plan.overlappingRecordDays).toBe(1);
    expect(formatCenti(plan.paidCenti)).toBe('20.00');
    expect(formatCenti(plan.unpaidCenti)).toBe('10.00');
  });

  it('counts a part-day leave as the part, not a whole day', () => {
    const plan = resolved(
      planStaffProration(
        input({
          presentDates: [],
          leaves: [
            {
              startsOn: d('2026-11-02'),
              endsOn: d('2026-11-02'),
              isPaid: true,
              days: 0.5,
            },
          ],
        }),
      ),
    );
    expect(plan.paidLeaveCenti).toBe(50n);
    expect(formatCenti(plan.paidCenti)).toBe('0.50');
  });

  it('ignores leave and attendance that fall outside the period or the employment', () => {
    const plan = resolved(
      planStaffProration(
        input({
          employments: [{ effectiveFrom: d('2026-11-02'), effectiveTo: null }],
          presentDates: [d('2026-10-20')],
          leaves: [
            {
              startsOn: d('2026-10-01'),
              endsOn: d('2026-10-30'),
              isPaid: true,
              days: 30,
            },
          ],
        }),
      ),
    );
    expect(plan.presentDays).toBe(0);
    expect(plan.paidLeaveCenti).toBe(0n);
  });

  it('never pays more than the divisor, even with more present days than the divisor', () => {
    const plan = resolved(
      planStaffProration(
        input({
          divisorDays: 26,
          presentDates: datesBetween('2026-10-18', '2026-11-16'),
        }),
      ),
    );
    expect(formatCenti(plan.paidCenti)).toBe('26.00');
    expect(formatMinor(plan.totals.gross)).toBe('33000.00');
  });

  it('is deterministic and records one ledger entry per employed day', () => {
    const run = () =>
      planStaffProration(
        input({
          presentDates: datesBetween('2026-10-18', '2026-11-10'),
          leaves: [
            {
              startsOn: d('2026-11-11'),
              endsOn: d('2026-11-12'),
              isPaid: true,
              days: 2,
            },
          ],
        }),
      );
    expect(run()).toEqual(run());
    const plan = resolved(run());
    expect(plan.ledger).toHaveLength(plan.employedDays);
    expect(plan.ledger[0]).toEqual({ d: '2026-10-18', p: true, s: 0 });
    expect(plan.ledger.find((day) => day.d === '2026-11-11')).toEqual({
      d: '2026-11-11',
      p: false,
      l: { c: 100, paid: true },
      s: 0,
    });
  });
});

describe('periodDayCounts / countLedgerDays', () => {
  it('reproduces the plan figures from raw counts', () => {
    const plan = resolved(
      planStaffProration(
        input({
          employments: [
            { effectiveFrom: d('2024-01-01'), effectiveTo: d('2026-10-28') },
          ],
          divisorDays: 31,
        }),
      ),
    );
    const counts = countLedgerDays(plan.ledger);
    expect(
      periodDayCounts({
        divisorDays: 31,
        presentCenti: BigInt(counts.presentDays) * 100n,
        paidLeaveCenti: counts.paidLeaveCenti,
        unpaidLeaveCenti: counts.unpaidLeaveCenti,
        employedDays: plan.employedDays,
        periodCalendarDays: plan.periodCalendarDays,
      }),
    ).toEqual({ paidCenti: plan.paidCenti, unpaidCenti: plan.unpaidCenti });
  });
});
