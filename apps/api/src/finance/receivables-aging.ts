import { BadRequestException } from '@nestjs/common';
import {
  agingBucketForDays,
  daysOverdueOn,
  getNepalSchoolDay,
  OVERDUE_AGING_BUCKETS,
  RECEIVABLES_AGING_BUCKETS,
  type ReceivablesAgingBucket,
} from '@schoolos/core';
import { InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';

/**
 * Phase 7.11b: one receivables-aging loader for every consumer (defaulter
 * list and reminders, the defaulter aging report, the dues table, the
 * accounting receivables report and the AR-to-ledger reconciliation).
 *
 * Basis, as of a Nepal school day:
 * - Invoices issued before the end of that day, not DRAFT, not VOID. (Invoice
 *   totals are current: a waiver, adjustment or late fee recorded after the
 *   as-of day is already in the total. Allocations are as of the day.)
 * - Amount received = active allocations allocated before the end of the
 *   day and not reversed by then. Invoices that predate allocations fall back
 *   to their legacy payments (paid, not reversed, minus refunds, as of the
 *   day) — the same per-invoice rule as `sumInvoiceAllocationAmount`.
 * - Waivers are never subtracted again: invoice-linked waivers already
 *   reduced the invoice total.
 * - Unapplied advances (allocations with no invoice) are reported once as a
 *   school-wide credit, never netted against an invoice.
 * - Money is Decimal throughout.
 */

export type AgingClient = Pick<
  Prisma.TransactionClient,
  'invoice' | 'paymentAllocation' | 'payment'
>;

export interface AgingAsOf {
  /** Nepal school day, YYYY-MM-DD. */
  asOfDate: string;
  /** End of that Nepal day (exclusive). */
  asOfExclusive: Date;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Resolve a YYYY-MM-DD Nepal school day (default: today in Nepal). */
export function resolveAgingAsOf(asOfDate?: string | null): AgingAsOf {
  const value = asOfDate?.trim();
  if (value && !DATE_ONLY.test(value.slice(0, 10))) {
    throw new BadRequestException('asOfDate must be a YYYY-MM-DD date');
  }
  const day = value
    ? getNepalSchoolDay(`${value.slice(0, 10)}T12:00:00+05:45`)
    : getNepalSchoolDay(new Date());
  if (value && day.gregorianDate !== value.slice(0, 10)) {
    throw new BadRequestException('asOfDate must be a valid calendar date');
  }
  return { asOfDate: day.gregorianDate, asOfExclusive: day.endExclusiveUtc };
}

export interface ReceivableRow {
  invoiceId: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  studentSystemId: string;
  classId: string | null;
  className: string;
  sectionName: string | null;
  dueDate: Date;
  issuedAt: Date;
  status: InvoiceStatus;
  totalAmount: Prisma.Decimal;
  received: Prisma.Decimal;
  outstanding: Prisma.Decimal;
  daysOverdue: number;
  bucket: ReceivablesAgingBucket;
}

export interface ReceivablesLoad {
  asOf: AgingAsOf;
  /** Invoices with an outstanding balance (> 0) on the as-of day. */
  rows: ReceivableRow[];
  /** Unapplied advances held on the as-of day (school-wide credit). */
  advancesHeld: Prisma.Decimal;
}

const ZERO = () => new Prisma.Decimal(0);
const CHUNK = 2000;

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

export async function loadReceivables(
  db: AgingClient,
  tenantId: string,
  asOf: AgingAsOf,
  options: {
    where?: Prisma.InvoiceWhereInput;
    includeAdvances?: boolean;
  } = {},
): Promise<ReceivablesLoad> {
  const { asOfExclusive } = asOf;
  const invoices = await db.invoice.findMany({
    where: {
      ...(options.where ?? {}),
      tenantId,
      issuedAt: { lt: asOfExclusive },
      // A PAID invoice can only have been open on the as-of day if it was
      // settled afterwards (or never stamped).
      OR: [
        { status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] } },
        {
          status: InvoiceStatus.PAID,
          OR: [{ paidAt: null }, { paidAt: { gte: asOfExclusive } }],
        },
      ],
    },
    select: {
      id: true,
      invoiceNumber: true,
      studentId: true,
      status: true,
      totalAmount: true,
      dueDate: true,
      issuedAt: true,
      student: {
        select: {
          firstNameEn: true,
          lastNameEn: true,
          studentSystemId: true,
          classId: true,
          class: { select: { name: true } },
          sectionRef: { select: { name: true } },
        },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
  });

  const ids = invoices.map((invoice) => invoice.id);
  const received = new Map<string, Prisma.Decimal>();
  const hasAllocations = new Set<string>();
  for (const batch of chunks(ids)) {
    const [asOfSums, anyRows] = await Promise.all([
      db.paymentAllocation.groupBy({
        by: ['invoiceId'],
        where: {
          tenantId,
          invoiceId: { in: batch },
          allocatedAt: { lt: asOfExclusive },
          OR: [{ reversedAt: null }, { reversedAt: { gte: asOfExclusive } }],
        },
        _sum: { amount: true },
      }),
      db.paymentAllocation.groupBy({
        by: ['invoiceId'],
        where: { tenantId, invoiceId: { in: batch } },
        _count: { _all: true },
      }),
    ]);
    for (const row of asOfSums) {
      if (row.invoiceId)
        received.set(row.invoiceId, new Prisma.Decimal(row._sum.amount ?? 0));
    }
    for (const row of anyRows)
      if (row.invoiceId) hasAllocations.add(row.invoiceId);
  }

  // Legacy invoices: settled through Payment.invoiceId before allocations.
  const legacyIds = ids.filter((id) => !hasAllocations.has(id));
  for (const batch of chunks(legacyIds)) {
    const payments = await db.payment.findMany({
      where: {
        tenantId,
        invoiceId: { in: batch },
        paidAt: { lt: asOfExclusive },
        status: { not: PaymentStatus.FAILED },
      },
      select: {
        invoiceId: true,
        amount: true,
        status: true,
        reversedAt: true,
        refunds: { select: { amount: true, refundDate: true } },
      },
    });
    for (const payment of payments) {
      if (!payment.invoiceId) continue;
      const reversedByThen =
        payment.status === PaymentStatus.REVERSED &&
        (payment.reversedAt === null || payment.reversedAt < asOfExclusive);
      if (reversedByThen) continue;
      const refunded = payment.refunds
        .filter((refund) => refund.refundDate < asOfExclusive)
        .reduce((sum, refund) => sum.add(refund.amount), ZERO());
      received.set(
        payment.invoiceId,
        (received.get(payment.invoiceId) ?? ZERO())
          .add(payment.amount)
          .sub(refunded),
      );
    }
  }

  const rows: ReceivableRow[] = [];
  for (const invoice of invoices) {
    const paid = received.get(invoice.id) ?? ZERO();
    const outstanding = invoice.totalAmount.sub(paid);
    if (outstanding.lte(0)) continue;
    const daysOverdue = daysOverdueOn(invoice.dueDate, asOf.asOfDate);
    rows.push({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      studentId: invoice.studentId,
      studentName:
        `${invoice.student.firstNameEn} ${invoice.student.lastNameEn}`.trim(),
      studentSystemId: invoice.student.studentSystemId,
      classId: invoice.student.classId,
      className: invoice.student.class.name,
      sectionName: invoice.student.sectionRef?.name ?? null,
      dueDate: invoice.dueDate,
      issuedAt: invoice.issuedAt,
      status: invoice.status,
      totalAmount: invoice.totalAmount,
      received: paid,
      outstanding,
      daysOverdue,
      bucket: agingBucketForDays(daysOverdue),
    });
  }

  let advancesHeld = ZERO();
  if (options.includeAdvances) {
    const advances = await db.paymentAllocation.aggregate({
      where: {
        tenantId,
        invoiceId: null,
        allocatedAt: { lt: asOfExclusive },
        OR: [{ reversedAt: null }, { reversedAt: { gte: asOfExclusive } }],
      },
      _sum: { amount: true },
    });
    advancesHeld = new Prisma.Decimal(advances._sum.amount ?? 0);
  }

  return { asOf, rows, advancesHeld };
}

export interface AgingBucketTotal {
  bucket: ReceivablesAgingBucket;
  invoiceCount: number;
  studentCount: number;
  outstanding: string;
}

/** Totals per bucket over the whole set (never over one page). */
export function summarizeAging(
  rows: ReceivableRow[],
  buckets: readonly ReceivablesAgingBucket[] = RECEIVABLES_AGING_BUCKETS,
) {
  const totals: AgingBucketTotal[] = buckets.map((bucket) => {
    const inBucket = rows.filter((row) => row.bucket === bucket);
    return {
      bucket,
      invoiceCount: inBucket.length,
      studentCount: new Set(inBucket.map((row) => row.studentId)).size,
      outstanding: inBucket
        .reduce((sum, row) => sum.add(row.outstanding), ZERO())
        .toFixed(2),
    };
  });
  const overdueRows = rows.filter((row) => row.bucket !== 'CURRENT');
  return {
    buckets: totals,
    totalOutstanding: rows
      .reduce((sum, row) => sum.add(row.outstanding), ZERO())
      .toFixed(2),
    overdueOutstanding: overdueRows
      .reduce((sum, row) => sum.add(row.outstanding), ZERO())
      .toFixed(2),
    invoiceCount: rows.length,
    studentCount: new Set(rows.map((row) => row.studentId)).size,
  };
}

export const OVERDUE_BUCKETS = OVERDUE_AGING_BUCKETS;
