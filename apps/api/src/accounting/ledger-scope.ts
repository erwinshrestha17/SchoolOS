import {
  ChartAccountType,
  JournalEntryStatus,
  JournalLineSide,
  JournalSourceType,
  Prisma,
} from '@prisma/client';

/**
 * Phase 7.11a: the single definition of "what is in the ledger" for every
 * report, close-readiness check and the fiscal-year closing builder.
 *
 * - A journal that was reversed is still ledger history: its lines happened,
 *   and the posted reversal offsets them. Counting only POSTED drops the
 *   original but keeps the reversal, so a reversed entry used to count as
 *   minus itself. The database already holds both POSTED and REVERSED entries
 *   balanced and immutable (7.3), and bank reconciliation already reads both.
 * - Fiscal-year closing entries move income and expense into retained
 *   earnings. Statements of performance (income statement, budget vs actual,
 *   pre-closing trial balance) must exclude them; positions (balance sheet,
 *   ledgers) include them.
 * - The accounting date of an entry is the UTC calendar date of `entryDate`,
 *   the same basis the database posting-period guard uses
 *   (`date_trunc('day', "entryDate")`). A date-only report bound therefore
 *   covers that whole day.
 */

export const LEDGER_EFFECTIVE_STATUSES: JournalEntryStatus[] = [
  JournalEntryStatus.POSTED,
  JournalEntryStatus.REVERSED,
];

export const CLOSING_SOURCE_TYPES: JournalSourceType[] = [
  JournalSourceType.CLOSING_ENTRY,
  JournalSourceType.CLOSING,
];

export type LedgerStage = 'PRE_CLOSING' | 'POST_CLOSING';
export const LEDGER_STAGES: readonly LedgerStage[] = [
  'PRE_CLOSING',
  'POST_CLOSING',
] as const;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Inclusive lower bound: a date-only value means 00:00:00.000 UTC that day. */
export function reportRangeStart(value: string): Date {
  const parsed = new Date(
    DATE_ONLY.test(value) ? `${value}T00:00:00.000Z` : value,
  );
  return parsed;
}

/**
 * Exclusive upper bound. A date-only value covers the whole day, so the bound
 * is the next UTC midnight. A full timestamp is honoured exactly (exclusive
 * of anything after it), expressed as that instant + 1 ms.
 */
export function reportRangeEndExclusive(value: string): Date {
  if (DATE_ONLY.test(value)) {
    return new Date(new Date(`${value}T00:00:00.000Z`).getTime() + DAY_MS);
  }
  return new Date(new Date(value).getTime() + 1);
}

/** Exclusive upper bound for a stored period/year end date (date column). */
export function dayAfter(date: Date): Date {
  const start = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  return new Date(start + DAY_MS);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export interface LedgerEntryScope {
  tenantId: string;
  stage: LedgerStage;
  fiscalYearId?: string;
  fiscalPeriodId?: string;
  /** Inclusive lower bound on entryDate. */
  from?: Date;
  /** Exclusive upper bound on entryDate. */
  toExclusive?: Date;
}

export function ledgerEntryWhere(
  scope: LedgerEntryScope,
): Prisma.JournalEntryWhereInput {
  const where: Prisma.JournalEntryWhereInput = {
    tenantId: scope.tenantId,
    status: { in: LEDGER_EFFECTIVE_STATUSES },
  };
  if (scope.fiscalYearId) where.fiscalYearId = scope.fiscalYearId;
  if (scope.fiscalPeriodId) where.fiscalPeriodId = scope.fiscalPeriodId;
  if (scope.from || scope.toExclusive) {
    where.entryDate = {
      ...(scope.from ? { gte: scope.from } : {}),
      ...(scope.toExclusive ? { lt: scope.toExclusive } : {}),
    };
  }
  if (scope.stage === 'PRE_CLOSING') {
    where.sourceType = { notIn: CLOSING_SOURCE_TYPES };
  }
  return where;
}

/** REVENUE and INCOME are the same statement class (decision R4). */
export function isIncomeAccountType(type: ChartAccountType): boolean {
  return type === ChartAccountType.REVENUE || type === ChartAccountType.INCOME;
}

export function isExpenseAccountType(type: ChartAccountType): boolean {
  return type === ChartAccountType.EXPENSE;
}

export function isProfitAndLossAccountType(type: ChartAccountType): boolean {
  return isIncomeAccountType(type) || isExpenseAccountType(type);
}

export const INCOME_ACCOUNT_TYPES: ChartAccountType[] = [
  ChartAccountType.REVENUE,
  ChartAccountType.INCOME,
];
export const PROFIT_AND_LOSS_ACCOUNT_TYPES: ChartAccountType[] = [
  ...INCOME_ACCOUNT_TYPES,
  ChartAccountType.EXPENSE,
];

export function normalBalanceSide(type: ChartAccountType): JournalLineSide {
  return type === ChartAccountType.ASSET || type === ChartAccountType.EXPENSE
    ? JournalLineSide.DEBIT
    : JournalLineSide.CREDIT;
}

/**
 * Split a signed (debit − credit) amount into the debit/credit column pair
 * used by trial-balance style reports.
 */
export function splitSigned(signed: Prisma.Decimal): {
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
} {
  const zero = new Prisma.Decimal(0);
  return signed.gte(0)
    ? { debit: signed, credit: zero }
    : { debit: zero, credit: signed.abs() };
}

/**
 * Present a signed (debit − credit) balance on the account's natural side:
 * positive amounts on the normal side, otherwise the amount on the other side.
 */
export function presentBalance(
  signed: Prisma.Decimal,
  normalSide: JournalLineSide,
): { amount: Prisma.Decimal; side: JournalLineSide } {
  if (normalSide === JournalLineSide.DEBIT) {
    return signed.gte(0)
      ? { amount: signed, side: JournalLineSide.DEBIT }
      : { amount: signed.abs(), side: JournalLineSide.CREDIT };
  }
  const creditNet = new Prisma.Decimal(0).minus(signed);
  return creditNet.gte(0)
    ? { amount: creditNet, side: JournalLineSide.CREDIT }
    : { amount: creditNet.abs(), side: JournalLineSide.DEBIT };
}
