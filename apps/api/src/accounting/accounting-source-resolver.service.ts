import { Injectable } from '@nestjs/common';
import { formatPayrollPeriodLabel } from '@schoolos/core';
import { JournalSourceType, type Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { hasDomainPermission } from '../authorization/policies/domain-permission';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Phase 7.11a: resolves the business record behind a journal entry so every
 * report figure can drill through statement → ledger → journal → source →
 * approval/document.
 *
 * Rules:
 * - Batched: one query per source kind for any number of entries (no N+1).
 * - Tenant-scoped: every lookup filters on the actor's tenant.
 * - Least privilege: accounting access is not a path into another domain. If
 *   the actor cannot read the source domain (payroll, fees, canteen), the
 *   source is returned as `restricted` with its kind and label only.
 * - Approval evidence carries duty, actor display name and time; never notes.
 * - Documents are file-asset ids; the file registry enforces its own access.
 */

export type JournalSourceKind =
  | 'FEE_INVOICE'
  | 'FEE_INVOICE_ADJUSTMENT'
  | 'FEE_WAIVER'
  | 'FEE_RECEIPT'
  | 'FEE_REFUND'
  | 'PAYROLL_ACCRUAL'
  | 'PAYROLL_DISBURSEMENT'
  | 'CANTEEN'
  | 'MANUAL_JOURNAL'
  | 'REVERSAL'
  | 'CORRECTION'
  | 'OPENING_BALANCE'
  | 'FISCAL_YEAR_CLOSE'
  | 'UNKNOWN';

export interface SourceActorEvent {
  duty: string;
  actor: { id: string; name: string } | null;
  at: Date | null;
}

export interface SourceDocument {
  label: string;
  fileAssetId: string;
}

export interface JournalSourceSummary {
  kind: JournalSourceKind;
  label: string;
  reference: string | null;
  status: string | null;
  href: string | null;
  /** Another journal this entry points to (reversal/correction original). */
  relatedJournalId: string | null;
  restricted: boolean;
  approvals: SourceActorEvent[];
  documents: SourceDocument[];
}

export interface ResolvableJournal {
  id: string;
  sourceModule: string | null;
  sourceType: JournalSourceType;
  sourceId: string | null;
  postingType: string | null;
  reversalOfId?: string | null;
  correctionOfId?: string | null;
  fiscalYearId?: string | null;
}

const FINANCE_READ = [
  'ledger:read',
  'fees:manage',
  'receipts:read',
  'payments:collect',
];
const PAYROLL_READ = ['payroll:read', 'payroll:run:read'];
const CANTEEN_READ = [
  'canteen:reports:read',
  'canteen:pos:read',
  'canteen:inventory:read',
];

const CANTEEN_LABELS: Record<string, { label: string; href: string }> = {
  TOPUP: { label: 'Canteen wallet top-up', href: '/dashboard/canteen/wallets' },
  SALE: { label: 'Canteen sale', href: '/dashboard/canteen/pos' },
  SALE_REVERSAL: {
    label: 'Canteen sale reversal',
    href: '/dashboard/canteen/pos',
  },
  PURCHASE: {
    label: 'Canteen purchase bill',
    href: '/dashboard/canteen/stock',
  },
};

type Kind = JournalSourceKind;

function classify(entry: ResolvableJournal): Kind {
  const { sourceModule, sourceType, postingType } = entry;
  if (sourceType === JournalSourceType.REVERSAL) return 'REVERSAL';
  if (sourceType === JournalSourceType.CORRECTION) return 'CORRECTION';
  if (sourceType === JournalSourceType.OPENING_BALANCE)
    return 'OPENING_BALANCE';
  if (
    sourceType === JournalSourceType.CLOSING_ENTRY ||
    sourceType === JournalSourceType.CLOSING
  )
    return 'FISCAL_YEAR_CLOSE';
  if (sourceModule === 'CANTEEN') return 'CANTEEN';
  if (sourceModule === 'PAYROLL') {
    if (sourceType === JournalSourceType.PAYROLL_DISBURSEMENT)
      return 'PAYROLL_DISBURSEMENT';
    return 'PAYROLL_ACCRUAL';
  }
  if (sourceModule === 'FINANCE') {
    if (sourceType === JournalSourceType.INVOICE) return 'FEE_INVOICE';
    if (sourceType === JournalSourceType.FEE_PAYMENT) return 'FEE_RECEIPT';
    if (sourceType === JournalSourceType.PAYMENT_REFUND) return 'FEE_REFUND';
    if (sourceType === JournalSourceType.ADJUSTMENT)
      return postingType === 'WAIVER' ? 'FEE_WAIVER' : 'FEE_INVOICE_ADJUSTMENT';
  }
  if (
    sourceType === JournalSourceType.MANUAL ||
    sourceType === JournalSourceType.EXPENSE_VOUCHER ||
    sourceType === JournalSourceType.PAYMENT_VOUCHER ||
    sourceType === JournalSourceType.RECEIPT_VOUCHER ||
    sourceType === JournalSourceType.CONTRA_VOUCHER
  )
    return 'MANUAL_JOURNAL';
  return 'UNKNOWN';
}

const KIND_LABELS: Record<Kind, string> = {
  FEE_INVOICE: 'Fee invoice',
  FEE_INVOICE_ADJUSTMENT: 'Fee invoice adjustment',
  FEE_WAIVER: 'Fee waiver',
  FEE_RECEIPT: 'Fee receipt',
  FEE_REFUND: 'Fee refund',
  PAYROLL_ACCRUAL: 'Payroll run (approval accrual)',
  PAYROLL_DISBURSEMENT: 'Payroll run (salary payment)',
  CANTEEN: 'Canteen',
  MANUAL_JOURNAL: 'Manual journal',
  REVERSAL: 'Reversal of a journal',
  CORRECTION: 'Correction of a journal',
  OPENING_BALANCE: 'Opening balance',
  FISCAL_YEAR_CLOSE: 'Fiscal-year close',
  UNKNOWN: 'Source record',
};

function domainPermissions(kind: Kind): string[] | null {
  switch (kind) {
    case 'FEE_INVOICE':
    case 'FEE_INVOICE_ADJUSTMENT':
    case 'FEE_WAIVER':
    case 'FEE_RECEIPT':
    case 'FEE_REFUND':
      return FINANCE_READ;
    case 'PAYROLL_ACCRUAL':
    case 'PAYROLL_DISBURSEMENT':
      return PAYROLL_READ;
    case 'CANTEEN':
      return CANTEEN_READ;
    default:
      return null;
  }
}

function when<T>(condition: boolean, run: () => Promise<T[]>): Promise<T[]> {
  return condition ? run() : Promise.resolve([]);
}

function idsOf(
  entries: Array<{ entry: ResolvableJournal; kind: Kind }>,
  kinds: Kind[],
): string[] {
  return [
    ...new Set(
      entries
        .filter((item) => kinds.includes(item.kind))
        .map((item) => item.entry.sourceId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

@Injectable()
export class AccountingSourceResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    actor: AuthContext,
    entries: ResolvableJournal[],
  ): Promise<Map<string, JournalSourceSummary>> {
    const tenantId = actor.tenantId;
    const classified = entries.map((entry) => ({
      entry,
      kind: classify(entry),
    }));
    const allowed = (kind: Kind) => {
      const permissions = domainPermissions(kind);
      return (
        permissions === null ||
        permissions.some((permission) => hasDomainPermission(actor, permission))
      );
    };
    const visible = classified.filter((item) => allowed(item.kind));

    const invoiceIds = idsOf(visible, [
      'FEE_INVOICE',
      'FEE_INVOICE_ADJUSTMENT',
    ]);
    const waiverIds = idsOf(visible, ['FEE_WAIVER']);
    const paymentIds = idsOf(visible, ['FEE_RECEIPT']);
    const refundIds = idsOf(visible, ['FEE_REFUND']);
    const payrollRunIds = idsOf(visible, [
      'PAYROLL_ACCRUAL',
      'PAYROLL_DISBURSEMENT',
    ]);
    const purchaseBillIds = visible
      .filter(
        (item) =>
          item.kind === 'CANTEEN' && item.entry.postingType === 'PURCHASE',
      )
      .map((item) => item.entry.sourceId)
      .filter((id): id is string => Boolean(id));
    const journalIds = idsOf(classified, ['REVERSAL', 'CORRECTION']);
    const fiscalYearIds = idsOf(classified, [
      'OPENING_BALANCE',
      'FISCAL_YEAR_CLOSE',
    ]);

    const [
      invoices,
      waivers,
      payments,
      refunds,
      payrollRuns,
      purchaseBills,
      journals,
      fiscalYears,
    ] = await Promise.all([
      when(invoiceIds.length > 0, () =>
        this.prisma.invoice.findMany({
          where: { tenantId, id: { in: invoiceIds } },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            studentId: true,
          },
        }),
      ),
      when(waiverIds.length > 0, () =>
        this.prisma.feeWaiver.findMany({
          where: { tenantId, id: { in: waiverIds } },
          select: {
            id: true,
            status: true,
            invoiceId: true,
            studentId: true,
            approvedById: true,
            approvedAt: true,
          },
        }),
      ),
      when(paymentIds.length > 0, () =>
        this.prisma.payment.findMany({
          where: { tenantId, id: { in: paymentIds } },
          select: {
            id: true,
            status: true,
            collectedById: true,
            paidAt: true,
            reversedById: true,
            reversedAt: true,
            receipt: {
              select: { receiptNumber: true, fileAssetId: true },
            },
          },
        }),
      ),
      when(refundIds.length > 0, () =>
        this.prisma.paymentRefund.findMany({
          where: { tenantId, id: { in: refundIds } },
          select: {
            id: true,
            refundNumber: true,
            paymentId: true,
            amount: true,
            createdById: true,
            createdAt: true,
          },
        }),
      ),
      when(payrollRunIds.length > 0, () =>
        this.prisma.payrollRun.findMany({
          where: { tenantId, id: { in: payrollRunIds } },
          select: {
            id: true,
            periodYear: true,
            periodMonth: true,
            revision: true,
            status: true,
            generatedById: true,
            createdAt: true,
            validatedById: true,
            validatedAt: true,
            reviewedById: true,
            reviewedAt: true,
            approvedById: true,
            approvedAt: true,
            finalizedById: true,
            finalizedAt: true,
            postedById: true,
            postedAt: true,
            paidById: true,
            paidAt: true,
          },
        }),
      ),
      when(purchaseBillIds.length > 0, () =>
        this.prisma.canteenPurchaseBill.findMany({
          where: { tenantId, id: { in: purchaseBillIds } },
          select: { id: true, billNumber: true, isPaid: true },
        }),
      ),
      when(journalIds.length > 0, () =>
        this.prisma.journalEntry.findMany({
          where: { tenantId, id: { in: journalIds } },
          select: { id: true, entryNumber: true, status: true },
        }),
      ),
      when(fiscalYearIds.length > 0, () =>
        this.prisma.fiscalYear.findMany({
          where: { tenantId, id: { in: fiscalYearIds } },
          select: {
            id: true,
            name: true,
            status: true,
            closedById: true,
            closedAt: true,
          },
        }),
      ),
    ]);

    const refundRequests = refunds.length
      ? await this.prisma.financeApprovalRequest.findMany({
          where: {
            tenantId,
            type: 'REFUND',
            paymentId: { in: [...new Set(refunds.map((r) => r.paymentId))] },
            status: 'EXECUTED',
          },
          select: {
            id: true,
            paymentId: true,
            amount: true,
            requestedById: true,
            createdAt: true,
            reviewedById: true,
            reviewedAt: true,
            executedById: true,
            executedAt: true,
            decisions: {
              select: { actorUserId: true, createdAt: true },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { executedAt: 'asc' },
        })
      : [];

    const userIds = new Set<string>();
    const note = (id: string | null | undefined) => {
      if (id) userIds.add(id);
    };
    waivers.forEach((w) => {
      note(w.approvedById);
    });
    payments.forEach((p) => {
      note(p.collectedById);
      note(p.reversedById);
    });
    refunds.forEach((r) => {
      note(r.createdById);
    });
    refundRequests.forEach((r) => {
      note(r.requestedById);
      note(r.reviewedById);
      note(r.executedById);
      r.decisions.forEach((d) => {
        note(d.actorUserId);
      });
    });
    payrollRuns.forEach((run) => {
      [
        run.generatedById,
        run.validatedById,
        run.reviewedById,
        run.approvedById,
        run.finalizedById,
        run.postedById,
        run.paidById,
      ].forEach(note);
    });
    fiscalYears.forEach((fy) => {
      note(fy.closedById);
    });
    const names = await resolveActorNames(this.prisma, tenantId, [...userIds]);
    const who = (id: string | null | undefined) =>
      id ? { id, name: names.get(id) ?? 'Unknown user' } : null;
    const event = (
      duty: string,
      id: string | null | undefined,
      at: Date | null | undefined,
    ): SourceActorEvent[] =>
      id ? [{ duty, actor: who(id), at: at ?? null }] : [];

    const invoiceById = new Map(invoices.map((row) => [row.id, row]));
    const waiverById = new Map(waivers.map((row) => [row.id, row]));
    const paymentById = new Map(payments.map((row) => [row.id, row]));
    const refundById = new Map(refunds.map((row) => [row.id, row]));
    const runById = new Map(payrollRuns.map((row) => [row.id, row]));
    const billById = new Map(purchaseBills.map((row) => [row.id, row]));
    const journalById = new Map(journals.map((row) => [row.id, row]));
    const fiscalYearById = new Map(fiscalYears.map((row) => [row.id, row]));
    const waiverInvoiceNumbers = new Map(
      invoices.map((row) => [row.id, row.invoiceNumber]),
    );
    const extraWaiverInvoiceIds = waivers
      .map((w) => w.invoiceId)
      .filter((id): id is string => !!id && !waiverInvoiceNumbers.has(id));
    if (extraWaiverInvoiceIds.length) {
      const rows = await this.prisma.invoice.findMany({
        where: { tenantId, id: { in: extraWaiverInvoiceIds } },
        select: { id: true, invoiceNumber: true },
      });
      rows.forEach((row) =>
        waiverInvoiceNumbers.set(row.id, row.invoiceNumber),
      );
    }

    const result = new Map<string, JournalSourceSummary>();
    for (const { entry, kind } of classified) {
      const base: JournalSourceSummary = {
        kind,
        label: KIND_LABELS[kind],
        reference: null,
        status: null,
        href: null,
        relatedJournalId: null,
        restricted: false,
        approvals: [],
        documents: [],
      };
      if (!allowed(kind)) {
        result.set(entry.id, { ...base, restricted: true });
        continue;
      }
      const id = entry.sourceId ?? '';
      switch (kind) {
        case 'FEE_INVOICE':
        case 'FEE_INVOICE_ADJUSTMENT': {
          const invoice = invoiceById.get(id);
          if (invoice) {
            base.reference = invoice.invoiceNumber;
            base.status = invoice.status;
            base.href = `/dashboard/fees/ledgers/${encodeURIComponent(invoice.studentId)}`;
          }
          break;
        }
        case 'FEE_WAIVER': {
          const waiver = waiverById.get(id);
          if (waiver) {
            base.reference = waiver.invoiceId
              ? (waiverInvoiceNumbers.get(waiver.invoiceId) ?? null)
              : null;
            base.status = waiver.status;
            base.href = '/dashboard/fees/adjustments?view=waivers';
            base.approvals = event(
              'APPROVE',
              waiver.approvedById,
              waiver.approvedAt,
            );
          }
          break;
        }
        case 'FEE_RECEIPT': {
          const payment = paymentById.get(id);
          if (payment) {
            base.reference = payment.receipt?.receiptNumber ?? null;
            base.status = payment.status;
            base.href = payment.receipt
              ? `/dashboard/fees/receipts?receiptSearch=${encodeURIComponent(payment.receipt.receiptNumber)}`
              : '/dashboard/fees/receipts';
            base.approvals = [
              ...event('COLLECT', payment.collectedById, payment.paidAt),
              ...event('REVERSE', payment.reversedById, payment.reversedAt),
            ];
            if (payment.receipt?.fileAssetId) {
              base.documents = [
                {
                  label: `Receipt ${payment.receipt.receiptNumber}`,
                  fileAssetId: payment.receipt.fileAssetId,
                },
              ];
            }
          }
          break;
        }
        case 'FEE_REFUND': {
          const refund = refundById.get(id);
          if (refund) {
            base.reference = refund.refundNumber;
            base.status = 'EXECUTED';
            base.href = '/dashboard/fees/adjustments';
            const request = pickRefundRequest(refundRequests, refund);
            base.approvals = request
              ? [
                  ...event('REQUEST', request.requestedById, request.createdAt),
                  ...event('REVIEW', request.reviewedById, request.reviewedAt),
                  ...request.decisions.flatMap((d) =>
                    event('APPROVE', d.actorUserId, d.createdAt),
                  ),
                  ...event(
                    'EXECUTE',
                    request.executedById ?? refund.createdById,
                    request.executedAt ?? refund.createdAt,
                  ),
                ]
              : event('EXECUTE', refund.createdById, refund.createdAt);
          }
          break;
        }
        case 'PAYROLL_ACCRUAL':
        case 'PAYROLL_DISBURSEMENT': {
          const run = runById.get(id);
          if (run) {
            const period = formatPayrollPeriodLabel(
              run.periodYear,
              run.periodMonth,
            );
            base.reference =
              run.revision > 1
                ? `${period} (revision ${run.revision})`
                : period;
            base.status = run.status;
            base.href = '/dashboard/payroll/runs';
            base.approvals = [
              ...event('GENERATE', run.generatedById, run.createdAt),
              ...event('VALIDATE', run.validatedById, run.validatedAt),
              ...event('REVIEW', run.reviewedById, run.reviewedAt),
              ...event('APPROVE', run.approvedById, run.approvedAt),
              ...event('FINALIZE', run.finalizedById, run.finalizedAt),
              ...event('POST', run.postedById, run.postedAt),
              ...event('MARK_PAID', run.paidById, run.paidAt),
            ];
          }
          break;
        }
        case 'CANTEEN': {
          const meta = CANTEEN_LABELS[entry.postingType ?? ''];
          if (meta) {
            base.label = meta.label;
            base.href = meta.href;
          }
          const bill = billById.get(id);
          if (bill) {
            base.reference = bill.billNumber;
            base.status = bill.isPaid ? 'PAID' : 'UNPAID';
          }
          break;
        }
        case 'REVERSAL':
        case 'CORRECTION': {
          const originalId =
            kind === 'REVERSAL'
              ? (entry.reversalOfId ?? entry.sourceId)
              : (entry.correctionOfId ?? entry.sourceId);
          base.relatedJournalId = originalId ?? null;
          const original = originalId ? journalById.get(originalId) : undefined;
          if (original) {
            base.reference = original.entryNumber;
            base.status = original.status;
          }
          break;
        }
        case 'OPENING_BALANCE':
        case 'FISCAL_YEAR_CLOSE': {
          const fiscalYear = fiscalYearById.get(id);
          base.href = '/dashboard/accounting/fiscal-periods';
          if (fiscalYear) {
            base.reference = fiscalYear.name;
            base.status = fiscalYear.status;
            if (kind === 'FISCAL_YEAR_CLOSE') {
              base.approvals = event(
                'CLOSE',
                fiscalYear.closedById,
                fiscalYear.closedAt,
              );
            }
          }
          break;
        }
        case 'MANUAL_JOURNAL':
          // The journal's own submit/review/approve/post chain is its evidence.
          break;
        default:
          base.reference = entry.sourceId;
      }
      result.set(entry.id, base);
    }
    return result;
  }
}

interface RefundRequestRow {
  paymentId: string;
  amount: Prisma.Decimal | null;
  executedById: string | null;
}

function pickRefundRequest<T extends RefundRequestRow>(
  requests: T[],
  refund: {
    paymentId: string;
    amount: Prisma.Decimal;
    createdById: string | null;
  },
): T | undefined {
  const candidates = requests.filter((r) => r.paymentId === refund.paymentId);
  return (
    candidates.find(
      (r) =>
        r.executedById === refund.createdById &&
        r.amount !== null &&
        r.amount.equals(refund.amount),
    ) ??
    candidates.find((r) => r.amount !== null && r.amount.equals(refund.amount))
  );
}

/**
 * Display names for users of one tenant: staff name when the user is staff,
 * otherwise the sign-in email or phone. Users outside the tenant never resolve.
 */
export async function resolveActorNames(
  prisma: PrismaService,
  tenantId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { tenantId, id: { in: userIds } },
    select: {
      id: true,
      email: true,
      phone: true,
      staff: { select: { firstName: true, lastName: true } },
    },
  });
  return new Map(
    users.map((user) => [
      user.id,
      user.staff
        ? `${user.staff.firstName} ${user.staff.lastName}`.trim()
        : (user.email ?? user.phone ?? 'School user'),
    ]),
  );
}
