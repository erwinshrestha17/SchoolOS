import {
  ChartAccountType,
  JournalLineSide,
  JournalSourceType,
  Prisma,
} from '@prisma/client';
import {
  dayAfter,
  isIncomeAccountType,
  ledgerEntryWhere,
  normalBalanceSide,
  presentBalance,
  reportRangeEndExclusive,
  reportRangeStart,
  splitSigned,
} from './ledger-scope';

const D = (value: number | string) => new Prisma.Decimal(value);

describe('ledger scope (Phase 7.11a)', () => {
  it('counts reversed originals as ledger history, alongside their reversals', () => {
    const where = ledgerEntryWhere({ tenantId: 't1', stage: 'POST_CLOSING' });
    expect(where.status).toEqual({ in: ['POSTED', 'REVERSED'] });
    expect(where.sourceType).toBeUndefined();
  });

  it('excludes fiscal-year closing entries only before closing', () => {
    const where = ledgerEntryWhere({ tenantId: 't1', stage: 'PRE_CLOSING' });
    expect(where.sourceType).toEqual({
      notIn: [JournalSourceType.CLOSING_ENTRY, JournalSourceType.CLOSING],
    });
  });

  it('applies year, period and half-open date bounds', () => {
    const from = new Date('2026-07-17T00:00:00.000Z');
    const toExclusive = new Date('2026-08-17T00:00:00.000Z');
    const where = ledgerEntryWhere({
      tenantId: 't1',
      stage: 'POST_CLOSING',
      fiscalYearId: 'fy',
      fiscalPeriodId: 'fp',
      from,
      toExclusive,
    });
    expect(where).toMatchObject({
      tenantId: 't1',
      fiscalYearId: 'fy',
      fiscalPeriodId: 'fp',
      entryDate: { gte: from, lt: toExclusive },
    });
  });

  it('treats a date-only end bound as the whole UTC day', () => {
    expect(reportRangeStart('2026-10-03').toISOString()).toBe(
      '2026-10-03T00:00:00.000Z',
    );
    expect(reportRangeEndExclusive('2026-10-03').toISOString()).toBe(
      '2026-10-04T00:00:00.000Z',
    );
    // An entry at 23:59 on the end date is inside the window.
    expect(
      new Date('2026-10-03T23:59:59.999Z') <
        reportRangeEndExclusive('2026-10-03'),
    ).toBe(true);
    // A full timestamp is honoured exactly.
    expect(
      reportRangeEndExclusive('2026-10-03T10:00:00.000Z').toISOString(),
    ).toBe('2026-10-03T10:00:00.001Z');
  });

  it('computes the day after a stored date at UTC midnight', () => {
    expect(dayAfter(new Date('2027-07-16T00:00:00.000Z')).toISOString()).toBe(
      '2027-07-17T00:00:00.000Z',
    );
  });

  it('treats INCOME exactly like REVENUE', () => {
    expect(isIncomeAccountType(ChartAccountType.INCOME)).toBe(true);
    expect(isIncomeAccountType(ChartAccountType.REVENUE)).toBe(true);
    expect(isIncomeAccountType(ChartAccountType.EXPENSE)).toBe(false);
    expect(normalBalanceSide(ChartAccountType.INCOME)).toBe(
      JournalLineSide.CREDIT,
    );
    expect(normalBalanceSide(ChartAccountType.EXPENSE)).toBe(
      JournalLineSide.DEBIT,
    );
  });

  it('presents signed balances on the natural side', () => {
    expect(presentBalance(D(50), JournalLineSide.DEBIT)).toEqual({
      amount: D(50),
      side: JournalLineSide.DEBIT,
    });
    expect(presentBalance(D(-50), JournalLineSide.DEBIT)).toEqual({
      amount: D(50),
      side: JournalLineSide.CREDIT,
    });
    expect(presentBalance(D(-50), JournalLineSide.CREDIT)).toEqual({
      amount: D(50),
      side: JournalLineSide.CREDIT,
    });
    const zero = presentBalance(D(0), JournalLineSide.CREDIT);
    expect(zero.amount.toString()).toBe('0');
    expect(zero.side).toBe(JournalLineSide.CREDIT);
  });

  it('splits signed amounts into debit/credit columns', () => {
    expect(splitSigned(D(-12.5))).toEqual({ debit: D(0), credit: D(12.5) });
    expect(splitSigned(D(7))).toEqual({ debit: D(7), credit: D(0) });
  });
});
