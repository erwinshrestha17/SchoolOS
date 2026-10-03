import { JournalSourceType, Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import type { PrismaService } from '../prisma/prisma.service';
import { AccountingSourceResolverService } from './accounting-source-resolver.service';

const D = (value: number) => new Prisma.Decimal(value);

function actorWith(permissions: string[]): AuthContext {
  return {
    userId: 'accountant',
    tenantId: 'tenant-a',
    roles: ['accountant'],
    permissions,
  } as unknown as AuthContext;
}

function fakePrisma() {
  const calls: Record<string, unknown[]> = {};
  const delegate = (name: string, rows: unknown[]) => ({
    findMany: jest.fn((args: unknown) => {
      (calls[name] ??= []).push(args);
      return Promise.resolve(rows);
    }),
  });
  const prisma = {
    invoice: delegate('invoice', [
      {
        id: 'inv-1',
        invoiceNumber: 'INV-2083-0001',
        status: 'ISSUED',
        studentId: 'stu-1',
      },
    ]),
    feeWaiver: delegate('feeWaiver', []),
    payment: delegate('payment', [
      {
        id: 'pay-1',
        status: 'SUCCESS',
        collectedById: 'cashier',
        paidAt: new Date('2026-08-01T05:00:00Z'),
        reversedById: null,
        reversedAt: null,
        receipt: { receiptNumber: 'RCP-0009', fileAssetId: 'file-9' },
      },
    ]),
    paymentRefund: delegate('paymentRefund', [
      {
        id: 'ref-1',
        refundNumber: 'RF-0001',
        paymentId: 'pay-1',
        amount: D(500),
        createdById: 'executor',
        createdAt: new Date('2026-08-03T00:00:00Z'),
      },
    ]),
    financeApprovalRequest: delegate('financeApprovalRequest', [
      {
        id: 'req-other',
        paymentId: 'pay-1',
        amount: D(100),
        requestedById: 'someone',
        createdAt: new Date('2026-08-02T00:00:00Z'),
        reviewedById: null,
        reviewedAt: null,
        executedById: 'executor',
        executedAt: new Date('2026-08-02T01:00:00Z'),
        decisions: [],
      },
      {
        id: 'req-1',
        paymentId: 'pay-1',
        amount: D(500),
        requestedById: 'cashier',
        createdAt: new Date('2026-08-02T00:00:00Z'),
        reviewedById: 'reviewer',
        reviewedAt: new Date('2026-08-02T02:00:00Z'),
        executedById: 'executor',
        executedAt: new Date('2026-08-03T00:00:00Z'),
        decisions: [
          { actorUserId: 'approver', createdAt: new Date('2026-08-02T03:00Z') },
        ],
      },
    ]),
    payrollRun: delegate('payrollRun', [
      {
        id: 'run-1',
        periodYear: 2083,
        periodMonth: 4,
        revision: 1,
        status: 'POSTED',
        generatedById: 'preparer',
        createdAt: new Date('2026-08-10T00:00:00Z'),
        validatedById: null,
        validatedAt: null,
        reviewedById: 'reviewer',
        reviewedAt: new Date('2026-08-11T00:00:00Z'),
        approvedById: 'approver',
        approvedAt: new Date('2026-08-12T00:00:00Z'),
        finalizedById: null,
        finalizedAt: null,
        postedById: 'poster',
        postedAt: new Date('2026-08-13T00:00:00Z'),
        paidById: null,
        paidAt: null,
      },
    ]),
    canteenPurchaseBill: delegate('canteenPurchaseBill', []),
    journalEntry: delegate('journalEntry', [
      { id: 'je-orig', entryNumber: 'JE-2026-000010', status: 'REVERSED' },
    ]),
    fiscalYear: delegate('fiscalYear', []),
    user: delegate('user', [
      {
        id: 'cashier',
        email: 'cashier@school.test',
        phone: null,
        staff: { firstName: 'Sita', lastName: 'Karki' },
      },
      {
        id: 'approver',
        email: 'approver@school.test',
        phone: null,
        staff: null,
      },
      { id: 'executor', email: null, phone: '9800000000', staff: null },
    ]),
  };
  return { prisma, calls };
}

const entries = [
  {
    id: 'je-invoice',
    sourceModule: 'FINANCE',
    sourceType: JournalSourceType.INVOICE,
    sourceId: 'inv-1',
    postingType: 'BILLING',
  },
  {
    id: 'je-receipt',
    sourceModule: 'FINANCE',
    sourceType: JournalSourceType.FEE_PAYMENT,
    sourceId: 'pay-1',
    postingType: 'RECEIPT',
  },
  {
    id: 'je-refund',
    sourceModule: 'FINANCE',
    sourceType: JournalSourceType.PAYMENT_REFUND,
    sourceId: 'ref-1',
    postingType: 'REFUND',
  },
  {
    id: 'je-payroll',
    sourceModule: 'PAYROLL',
    sourceType: JournalSourceType.PAYROLL_RUN,
    sourceId: 'run-1',
    postingType: 'APPROVAL',
  },
  {
    id: 'je-reversal',
    sourceModule: 'ACCOUNTING',
    sourceType: JournalSourceType.REVERSAL,
    sourceId: 'je-orig',
    postingType: 'REVERSAL',
    reversalOfId: 'je-orig',
  },
];

describe('AccountingSourceResolverService (Phase 7.11a)', () => {
  it('resolves fee and payroll sources with approvals and documents', async () => {
    const { prisma } = fakePrisma();
    const resolver = new AccountingSourceResolverService(
      prisma as unknown as PrismaService,
    );
    const result = await resolver.resolve(
      actorWith(['ledger:read', 'payroll:read', 'accounting:journals:read']),
      entries,
    );

    expect(result.get('je-invoice')).toMatchObject({
      kind: 'FEE_INVOICE',
      reference: 'INV-2083-0001',
      href: '/dashboard/fees/ledgers/stu-1',
      restricted: false,
    });
    const receipt = result.get('je-receipt');
    expect(receipt?.reference).toBe('RCP-0009');
    expect(receipt?.documents).toEqual([
      { label: 'Receipt RCP-0009', fileAssetId: 'file-9' },
    ]);
    expect(receipt?.approvals[0]).toMatchObject({
      duty: 'COLLECT',
      actor: { id: 'cashier', name: 'Sita Karki' },
    });

    // The refund is matched to the request with the same amount and executor.
    const refund = result.get('je-refund');
    expect(refund?.approvals.map((a) => a.duty)).toEqual([
      'REQUEST',
      'REVIEW',
      'APPROVE',
      'EXECUTE',
    ]);
    expect(refund?.approvals[2].actor?.name).toBe('approver@school.test');

    const payroll = result.get('je-payroll');
    expect(payroll?.reference).toBe('Shrawan 2083');
    expect(payroll?.approvals.map((a) => a.duty)).toEqual([
      'GENERATE',
      'REVIEW',
      'APPROVE',
      'POST',
    ]);

    expect(result.get('je-reversal')).toMatchObject({
      kind: 'REVERSAL',
      relatedJournalId: 'je-orig',
      reference: 'JE-2026-000010',
    });
  });

  it('restricts sources from domains the actor cannot read and never queries them', async () => {
    const { prisma, calls } = fakePrisma();
    const resolver = new AccountingSourceResolverService(
      prisma as unknown as PrismaService,
    );
    const result = await resolver.resolve(
      actorWith(['accounting:journals:read']),
      entries,
    );

    expect(result.get('je-payroll')).toMatchObject({
      kind: 'PAYROLL_ACCRUAL',
      restricted: true,
      reference: null,
      approvals: [],
    });
    expect(result.get('je-receipt')).toMatchObject({
      restricted: true,
      documents: [],
    });
    expect(calls.payrollRun).toBeUndefined();
    expect(calls.payment).toBeUndefined();
    // Journals are within accounting's own domain.
    expect(result.get('je-reversal')?.restricted).toBe(false);
  });

  it('scopes every lookup to the actor tenant', async () => {
    const { prisma, calls } = fakePrisma();
    const resolver = new AccountingSourceResolverService(
      prisma as unknown as PrismaService,
    );
    await resolver.resolve(actorWith(['ledger:read', 'payroll:read']), entries);
    for (const [name, list] of Object.entries(calls)) {
      for (const args of list) {
        expect({
          name,
          tenantId: (args as { where: { tenantId: string } }).where.tenantId,
        }).toEqual({ name, tenantId: 'tenant-a' });
      }
    }
  });
});
