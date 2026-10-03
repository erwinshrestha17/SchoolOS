import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import {
  AccountingPostingBatchStatus,
  CashDepositStatus,
  CashierCloseStatus,
  type ChartAccountType,
  FinanceExpenseStatus,
  FinancePayableStatus,
  FinanceRequestStatus,
  InvoiceStatus,
  JournalEntryStatus,
  OnlinePaymentIntentStatus,
  PayrollRunStatus,
  Prisma,
  WaiverStatus,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { hasDomainPermission } from '../authorization/policies/domain-permission';
import { dayAfter, isIncomeAccountType } from './ledger-scope';

/**
 * Phase 7.11d — the one inventory of everything unfinished in a fiscal period
 * or year. Period readiness, year readiness, the close previews and the
 * closes themselves all read it, so a preview and the close it authorizes
 * cannot disagree.
 *
 * Dates use the ledger's day basis (UTC calendar date, the same as the
 * database posting-period guard): a record "in the period" has its business
 * date between the period's first and last day inclusive.
 *
 * Each item names who may see its count. Another viewer sees the item (its
 * severity still decides whether the close can proceed) as `restricted`,
 * never as a zero.
 */

export type CloseSeverity = 'BLOCKING' | 'WARNING';
export type CloseScopeKind = 'PERIOD' | 'YEAR';

export interface CloseScope {
  kind: CloseScopeKind;
  tenantId: string;
  fiscalYearId: string;
  /** Periods covered: one for a period close, all of the year's for a year close. */
  periodIds: string[];
  /** First and last day (inclusive), stored at UTC midnight. */
  start: Date;
  end: Date;
}

export interface CloseItem {
  code: string;
  severity: CloseSeverity;
  count: number;
  /** NPR, only where the item is monetary. */
  amount: Prisma.Decimal | null;
  message: string;
  /** What closing with this item outstanding means. */
  consequence: string;
  resolutionRoute: string;
  /** Any one of these lets the viewer see the count; null = every viewer. */
  readPermissions: readonly string[] | null;
}

export interface CloseItemView {
  code: string;
  severity: CloseSeverity;
  count: number | null;
  amount: string | null;
  restricted: boolean;
  message: string;
  consequence: string;
  resolutionRoute: string;
}

const JOURNAL_READ = ['accounting:journals:read', 'accounting:read'];
const BATCH_READ = ['accounting:posting-batches:read'];
const PAYROLL_READ = ['payroll:read', 'payroll:run:read'];
const APPROVAL_READ = ['finance:approvals:read'];
const CASH_READ = ['payments:close', 'accounting:reconciliation:read'];
const FEES_READ = ['fees:manage', 'ledger:read', 'payments:collect'];
const WAIVER_READ = ['fees:discount', 'fees:manage'];
const BILL_READ = ['accounting:expenses:read'];
const PAYABLE_READ = ['accounting:payables:read'];

type Client = Pick<
  Prisma.TransactionClient,
  | 'journalEntry'
  | 'accountingPostingBatch'
  | 'payrollRun'
  | 'financeApprovalRequest'
  | 'cashierClose'
  | 'cashDeposit'
  | 'onlinePaymentIntent'
  | 'invoice'
  | 'feeWaiver'
  | 'financeExpense'
  | 'financePayable'
>;

function rangeWhere(scope: CloseScope) {
  return { gte: scope.start, lt: dayAfter(scope.end) };
}

/** Journals belonging to the scope, by period/year or (if unassigned) by date. */
export function scopeJournalWhere(
  scope: CloseScope,
): Prisma.JournalEntryWhereInput {
  return {
    tenantId: scope.tenantId,
    OR: [
      scope.kind === 'PERIOD'
        ? { fiscalPeriodId: { in: scope.periodIds } }
        : { fiscalYearId: scope.fiscalYearId },
      {
        fiscalPeriodId: null,
        fiscalYearId: null,
        entryDate: rangeWhere(scope),
      },
    ],
  };
}

/**
 * Unfinished operational work (everything except the ledger arithmetic,
 * reconciliation and period-state checks, which the accounting service adds).
 */
export async function loadOperationalCloseItems(
  client: Client,
  scope: CloseScope,
): Promise<CloseItem[]> {
  const tenantId = scope.tenantId;
  const range = rangeWhere(scope);
  const periodLabel = scope.kind === 'PERIOD' ? 'period' : 'fiscal year';
  const [
    journalStatuses,
    batches,
    payrollUnposted,
    payrollUnpaid,
    refundRequests,
    cashierSessions,
    cashDeposits,
    onlineIntents,
    draftInvoices,
    pendingWaivers,
    submittedBills,
    draftBills,
    duePayables,
  ] = await Promise.all([
    client.journalEntry.groupBy({
      by: ['status'],
      where: {
        ...scopeJournalWhere(scope),
        status: {
          in: [
            JournalEntryStatus.DRAFT,
            JournalEntryStatus.SUBMITTED,
            JournalEntryStatus.REVIEWED,
            JournalEntryStatus.APPROVED,
          ],
        },
      },
      _count: { _all: true },
    }),
    client.accountingPostingBatch.count({
      where: {
        tenantId,
        ...(scope.kind === 'PERIOD'
          ? { fiscalPeriodId: { in: scope.periodIds } }
          : { fiscalYearId: scope.fiscalYearId }),
        status: {
          in: [
            AccountingPostingBatchStatus.DRAFT,
            AccountingPostingBatchStatus.READY,
            AccountingPostingBatchStatus.POSTING,
            AccountingPostingBatchStatus.FAILED,
          ],
        },
      },
    }),
    // Payroll posts on its period end date (payroll.service), so that date
    // decides which fiscal period a run lands in.
    client.payrollRun.count({
      where: {
        tenantId,
        periodEnd: range,
        status: {
          in: [PayrollRunStatus.APPROVED, PayrollRunStatus.FINALIZED],
        },
      },
    }),
    client.payrollRun.count({
      where: { tenantId, periodEnd: range, status: PayrollRunStatus.POSTED },
    }),
    client.financeApprovalRequest.count({
      where: {
        tenantId,
        status: {
          in: [FinanceRequestStatus.APPROVED, FinanceRequestStatus.PROCESSING],
        },
        createdAt: { lt: dayAfter(scope.end) },
      },
    }),
    client.cashierClose.count({
      where: {
        tenantId,
        openedAt: range,
        status: {
          notIn: [CashierCloseStatus.CLOSED, CashierCloseStatus.DEPOSITED],
        },
      },
    }),
    client.cashDeposit.count({
      where: {
        tenantId,
        depositDate: range,
        status: { in: [CashDepositStatus.DRAFT, CashDepositStatus.SUBMITTED] },
      },
    }),
    client.onlinePaymentIntent.count({
      where: {
        tenantId,
        createdAt: range,
        status: OnlinePaymentIntentStatus.PENDING,
      },
    }),
    client.invoice.count({
      where: { tenantId, status: InvoiceStatus.DRAFT, createdAt: range },
    }),
    client.feeWaiver.count({
      where: { tenantId, status: WaiverStatus.PENDING, createdAt: range },
    }),
    client.financeExpense.aggregate({
      where: {
        tenantId,
        status: FinanceExpenseStatus.SUBMITTED,
        expenseDate: range,
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    client.financeExpense.aggregate({
      where: {
        tenantId,
        status: FinanceExpenseStatus.DRAFT,
        expenseDate: range,
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    client.financePayable.aggregate({
      where: {
        tenantId,
        status: {
          in: [FinancePayableStatus.OPEN, FinancePayableStatus.PARTIALLY_PAID],
        },
        dueDate: range,
      },
      _count: { _all: true },
      _sum: { outstandingAmount: true },
    }),
  ]);

  const journals = (status: JournalEntryStatus) =>
    journalStatuses.find((row) => row.status === status)?._count._all ?? 0;
  const items: CloseItem[] = [];
  const add = (
    item: Omit<CloseItem, 'amount'> & { amount?: CloseItem['amount'] },
  ) => {
    if (item.count > 0) items.push({ amount: null, ...item });
  };
  const unpostable = `Once the ${periodLabel} is closed nothing can post with a date in it, so this work would have to be re-dated into an open period or the ${periodLabel} reopened through approval.`;

  add({
    code: 'DRAFT_JOURNALS',
    severity: 'BLOCKING',
    count: journals(JournalEntryStatus.DRAFT),
    message: 'Draft journals must be completed or cancelled.',
    consequence: unpostable,
    resolutionRoute: '/dashboard/accounting/journals?status=DRAFT',
    readPermissions: JOURNAL_READ,
  });
  add({
    code: 'SUBMITTED_JOURNALS',
    severity: 'BLOCKING',
    count: journals(JournalEntryStatus.SUBMITTED),
    message: 'Submitted journals are still awaiting review.',
    consequence: unpostable,
    resolutionRoute: '/dashboard/accounting/journals?status=SUBMITTED',
    readPermissions: JOURNAL_READ,
  });
  add({
    code: 'REVIEWED_JOURNALS',
    severity: 'BLOCKING',
    count: journals(JournalEntryStatus.REVIEWED),
    message: 'Reviewed journals are still awaiting approval.',
    consequence: unpostable,
    resolutionRoute: '/dashboard/accounting/journals?status=REVIEWED',
    readPermissions: JOURNAL_READ,
  });
  add({
    code: 'APPROVED_UNPOSTED_JOURNALS',
    severity: 'BLOCKING',
    count: journals(JournalEntryStatus.APPROVED),
    message:
      'Approved journals must be posted or returned through the approved workflow.',
    consequence: unpostable,
    resolutionRoute: '/dashboard/accounting/journals?status=APPROVED',
    readPermissions: JOURNAL_READ,
  });
  add({
    code: 'POSTING_BATCHES_INCOMPLETE',
    severity: 'BLOCKING',
    count: batches,
    message:
      'Source posting batches are waiting, in progress or failed for this period.',
    consequence:
      'A failed or waiting batch would try to post into a closed period and be refused.',
    resolutionRoute: '/dashboard/accounting/receivables',
    readPermissions: BATCH_READ,
  });
  add({
    code: 'PAYROLL_POSTING_INCOMPLETE',
    severity: 'BLOCKING',
    count: payrollUnposted,
    message:
      'Approved or finalized payroll runs dated in this period are not yet posted.',
    consequence: `These payroll runs post on their period end date; after close they could no longer post.`,
    resolutionRoute: '/dashboard/payroll/runs',
    readPermissions: PAYROLL_READ,
  });
  add({
    code: 'REFUND_REQUESTS_PENDING',
    severity: 'BLOCKING',
    count: refundRequests,
    message: 'Approved refund or reversal requests have not been executed.',
    consequence:
      'Approved money movements would sit outside the closed books until executed.',
    resolutionRoute: '/dashboard/fees/adjustments',
    readPermissions: APPROVAL_READ,
  });
  add({
    code: 'CASHIER_SESSIONS_OPEN',
    severity: 'BLOCKING',
    count: cashierSessions,
    message:
      'Cashier sessions opened in this period are not yet closed or deposited.',
    consequence:
      'Cash collected in these sessions would not be confirmed before the books close.',
    resolutionRoute: '/dashboard/fees/cashier-close',
    readPermissions: CASH_READ,
  });
  add({
    code: 'VENDOR_BILLS_SUBMITTED',
    severity: 'BLOCKING',
    count: submittedBills._count._all,
    amount: new Prisma.Decimal(submittedBills._sum.totalAmount ?? 0),
    message: 'Vendor bills dated in this period are waiting for approval.',
    consequence:
      'A bill posts on its own date; after close it could no longer be approved.',
    resolutionRoute: '/dashboard/accounting/payables?view=expenses',
    readPermissions: BILL_READ,
  });
  add({
    code: 'ONLINE_PAYMENTS_PENDING',
    severity: 'WARNING',
    count: onlineIntents,
    message: 'Online payments started in this period are still pending.',
    consequence:
      'If they succeed after close they are recorded on the day they settle, not in this period.',
    resolutionRoute: '/dashboard/accounting/collections',
    readPermissions: FEES_READ,
  });
  add({
    code: 'DRAFT_INVOICES',
    severity: 'WARNING',
    count: draftInvoices,
    message: 'Draft fee invoices created in this period were never issued.',
    consequence: 'Draft invoices are not receivables and are not in the books.',
    resolutionRoute: '/dashboard/fees/invoices',
    readPermissions: FEES_READ,
  });
  add({
    code: 'PENDING_WAIVERS',
    severity: 'WARNING',
    count: pendingWaivers,
    message: 'Fee waivers requested in this period are awaiting a decision.',
    consequence:
      'If approved after close, a waiver posts on its approval date.',
    resolutionRoute: '/dashboard/fees/adjustments?view=waivers',
    readPermissions: WAIVER_READ,
  });
  add({
    code: 'CASH_DEPOSITS_UNFINISHED',
    severity: 'WARNING',
    count: cashDeposits,
    message: 'Cash deposits dated in this period are not yet deposited.',
    consequence: 'Cash on hand and the bank balance may not agree at close.',
    resolutionRoute: '/dashboard/accounting/cash-bank',
    readPermissions: CASH_READ,
  });
  add({
    code: 'VENDOR_BILLS_DRAFT',
    severity: 'WARNING',
    count: draftBills._count._all,
    amount: new Prisma.Decimal(draftBills._sum.totalAmount ?? 0),
    message: 'Draft vendor bills are dated in this period.',
    consequence:
      'They are not liabilities yet; after close they can only be recorded with a later date.',
    resolutionRoute: '/dashboard/accounting/payables?view=expenses',
    readPermissions: BILL_READ,
  });
  add({
    code: 'PAYROLL_POSTED_UNPAID',
    severity: 'WARNING',
    count: payrollUnpaid,
    message:
      'Payroll runs dated in this period are posted but not marked paid.',
    consequence:
      'Salaries stay payable in the closed books; payment is recorded when made.',
    resolutionRoute: '/dashboard/payroll/runs',
    readPermissions: PAYROLL_READ,
  });
  add({
    code: 'PAYABLES_DUE_OPEN',
    severity: 'WARNING',
    count: duePayables._count._all,
    amount: new Prisma.Decimal(duePayables._sum.outstandingAmount ?? 0),
    message: 'Vendor payables due in this period are still unpaid.',
    consequence:
      'They stay as liabilities in the closed books (informational).',
    resolutionRoute: '/dashboard/accounting/payables',
    readPermissions: PAYABLE_READ,
  });
  return items;
}

/** What the viewer may see of each item: restricted items keep severity. */
export function projectCloseItems(
  items: readonly CloseItem[],
  actor: AuthContext,
): CloseItemView[] {
  return items.map((item) => {
    const visible =
      item.readPermissions === null ||
      item.readPermissions.some((permission) =>
        hasDomainPermission(actor, permission),
      );
    return {
      code: item.code,
      severity: item.severity,
      count: visible ? item.count : null,
      amount: visible && item.amount ? item.amount.toFixed(2) : null,
      restricted: !visible,
      message: item.message,
      consequence: item.consequence,
      resolutionRoute: item.resolutionRoute,
    };
  });
}

// ─── Fiscal-year closing builder ─────────────────────────────────────

export interface ProfitAndLossBalance {
  accountId: string;
  code: string;
  name: string;
  type: ChartAccountType;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
}

export interface ClosingLine {
  chartAccountId: string;
  code: string;
  name: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  description: string;
}

/**
 * Close every income and expense balance that is still open into retained
 * earnings. Balances are taken AFTER any earlier closing entry of the same
 * year, so a re-close after reopening closes only what changed since.
 * Each account is closed by the opposite of its net balance, whichever side
 * it is on (an income account with a debit balance is credited).
 */
export function buildClosingLines(
  balances: readonly ProfitAndLossBalance[],
  retainedEarnings: { id: string; code: string; name: string },
): { lines: ClosingLine[]; netResult: Prisma.Decimal } {
  const zero = new Prisma.Decimal(0);
  const lines: ClosingLine[] = [];
  let netResult = zero;
  const sorted = [...balances].sort((a, b) =>
    a.code === b.code
      ? a.accountId.localeCompare(b.accountId)
      : a.code.localeCompare(b.code),
  );
  for (const balance of sorted) {
    const net = balance.debit.sub(balance.credit);
    if (net.isZero()) continue;
    const income = isIncomeAccountType(balance.type);
    lines.push({
      chartAccountId: balance.accountId,
      code: balance.code,
      name: balance.name,
      debit: net.lt(0) ? net.abs() : zero,
      credit: net.gt(0) ? net : zero,
      description: `Close ${income ? 'income' : 'expense'}: ${balance.name}`,
    });
    netResult = netResult.sub(net);
  }
  if (lines.length > 0 && !netResult.isZero()) {
    lines.push({
      chartAccountId: retainedEarnings.id,
      code: retainedEarnings.code,
      name: retainedEarnings.name,
      debit: netResult.lt(0) ? netResult.abs() : zero,
      credit: netResult.gt(0) ? netResult : zero,
      description: netResult.gt(0)
        ? 'Net surplus transferred to retained earnings'
        : 'Net deficit transferred to retained earnings',
    });
  }
  return { lines, netResult };
}

/** Posting type of the next closing entry for a year (first close keeps the original key). */
export function closingPostingType(existingClosingEntries: number): string {
  return existingClosingEntries === 0
    ? 'FISCAL_YEAR_CLOSE'
    : `FISCAL_YEAR_CLOSE:${existingClosingEntries + 1}`;
}

/**
 * sha256 over exactly what the viewer was shown and the close will do. A
 * restricted item contributes its code and severity only, so the fingerprint
 * cannot be used to recover a hidden count.
 */
export function closePreviewFingerprint(input: {
  kind: CloseScopeKind;
  targetId: string;
  status: string;
  items: readonly CloseItemView[];
  closing?: {
    postingType: string;
    lines: ReadonlyArray<{
      chartAccountId: string;
      debit: string;
      credit: string;
    }>;
  } | null;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        'fiscal-close-preview:v1',
        input.kind,
        input.targetId,
        input.status,
        [...input.items]
          .sort((a, b) => a.code.localeCompare(b.code))
          .map((item) => [
            item.code,
            item.severity,
            item.restricted,
            item.count,
            item.amount,
          ]),
        input.closing
          ? [
              input.closing.postingType,
              input.closing.lines.map((line) => [
                line.chartAccountId,
                line.debit,
                line.credit,
              ]),
            ]
          : null,
      ]),
    )
    .digest('hex');
}

/** The established readiness issue shape, from an inventory item view. */
export function toReadinessIssue(item: CloseItemView) {
  return {
    code: item.code,
    count: item.count,
    restricted: item.restricted,
    amount: item.amount,
    safeMessage: item.message,
    consequence: item.consequence,
    resolutionRoute: item.resolutionRoute,
  };
}

/**
 * The close presents the fingerprint of the preview the user reviewed and
 * acknowledges each warning in it. Recomputed inside the close transaction.
 */
export function assertClosePreviewAccepted(
  preview: {
    previewFingerprint: string;
    blockers: readonly CloseItemView[];
    requiredAcknowledgements: readonly string[];
  },
  dto: {
    expectedPreviewFingerprint?: string;
    acknowledgedWarningCodes?: string[];
  },
): void {
  if (!dto.expectedPreviewFingerprint)
    throw new ConflictException({
      code: 'CLOSE_PREVIEW_REQUIRED',
      message:
        'Open the close preview, review it, and close from there. The close must present the preview fingerprint.',
    });
  if (dto.expectedPreviewFingerprint !== preview.previewFingerprint)
    throw new ConflictException({
      code: 'CLOSE_PREVIEW_STALE',
      message:
        'Something changed since you opened the close preview. Review the preview again before closing.',
    });
  if (preview.blockers.length > 0)
    throw new ConflictException({
      code: 'CLOSE_BLOCKED',
      message: `The close is blocked until these are resolved: ${preview.blockers.map((item) => item.code).join(', ')}`,
      blockers: preview.blockers.map((item) => item.code),
    });
  const acknowledged = new Set(dto.acknowledgedWarningCodes ?? []);
  const missing = preview.requiredAcknowledgements.filter(
    (code) => !acknowledged.has(code),
  );
  if (missing.length > 0)
    throw new ConflictException({
      code: 'CLOSE_WARNINGS_NOT_ACKNOWLEDGED',
      message: `Acknowledge every warning before closing: ${missing.join(', ')}`,
      missing,
    });
}
