import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { FinanceCompatService } from './finance-compat.service';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'accountant@school.test',
  roles: ['admin'],
  permissions: [],
  authMethod: 'PASSWORD',
};

function createService() {
  const prisma = {
    receipt: { findFirst: jest.fn() },
    receiptReprintHistory: { findMany: jest.fn() },
    student: { findFirst: jest.fn() },
    invoice: { findMany: jest.fn() },
  };
  const auditService = { record: jest.fn() };

  return {
    service: new FinanceCompatService(prisma as never, auditService as never),
    prisma,
    auditService,
  };
}

describe('FinanceCompatService', () => {
  it('requires a receipt number before verification', async () => {
    const { service } = createService();

    await expect(service.verifyReceipt('   ', actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects receipt verification outside tenant scope', async () => {
    const { service, prisma } = createService();
    prisma.receipt.findFirst.mockResolvedValue(null);

    await expect(
      service.verifyReceipt('REC-OTHER-TENANT', actor),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.receipt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: actor.tenantId,
          receiptNumber: 'REC-OTHER-TENANT',
        },
      }),
    );
  });

  it('returns tenant-scoped active receipt verification and audits the read', async () => {
    const { service, prisma, auditService } = createService();
    prisma.receipt.findFirst.mockResolvedValue(
      buildReceiptForVerification({
        receiptNumber: 'REC-2026-00001',
      }),
    );

    const result = await service.verifyReceipt(' REC-2026-00001 ', actor);

    expect(result.status).toBe('VALID');
    expect(result.warnings).toEqual([]);
    expect(result.receipt.receiptNumber).toBe('REC-2026-00001');
    expect(result.student.studentSystemId).toBe('SCH-001');
    expect(result.payment.amount).toBe(1000);
    expect(result.payment.refundedAmount).toBe(0);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'verify_receipt',
        resource: 'receipt',
        resourceId: 'receipt-verify-1',
        tenantId: actor.tenantId,
        userId: actor.userId,
      }),
    );
  });

  it('flags reversed and refunded receipts during verification', async () => {
    const { service, prisma } = createService();
    prisma.receipt.findFirst.mockResolvedValue(
      buildReceiptForVerification({
        reversedAt: new Date('2026-05-10T00:00:00.000Z'),
        reversalReason: 'Duplicate payment',
        refunds: [{ amount: new Prisma.Decimal(1000) }],
      }),
    );

    const result = await service.verifyReceipt('REC-2026-00001', actor);

    expect(result.status).toBe('REVERSED');
    expect(result.warnings).toContain('Payment has been reversed');
    expect(result.warnings).toContain('Refunded amount: 1000.00');
    expect(result.payment.reversalReason).toBe('Duplicate payment');
    expect(result.payment.refundedAmount).toBe(1000);
    expect(result.payment.netAmount).toBe(0);
  });

  it('rejects receipt reprint history lookup outside tenant', async () => {
    const { service, prisma } = createService();
    prisma.receipt.findFirst.mockResolvedValue(null);

    await expect(
      service.getReceiptReprintHistory('receipt-other-tenant', actor),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.receipt.findFirst).toHaveBeenCalledWith({
      where: { id: 'receipt-other-tenant', tenantId: actor.tenantId },
      select: { id: true, receiptNumber: true },
    });
  });

  it('returns tenant-scoped receipt reprint history and audits the read', async () => {
    const { service, prisma, auditService } = createService();
    prisma.receipt.findFirst.mockResolvedValue({
      id: 'receipt-1',
      receiptNumber: 'R-001',
    });
    prisma.receiptReprintHistory.findMany.mockResolvedValue([
      {
        id: 'history-1',
        paymentId: 'payment-1',
        studentId: 'student-1',
        fileAssetId: 'file-1',
        reprintedAt: new Date('2026-05-09T08:00:00.000Z'),
        reason: 'Parent requested copy',
        format: 'pdf',
        delivery: 'download',
        reprintedBy: { id: 'user-1', email: 'accountant@school.test' },
      },
    ]);

    const result = await service.getReceiptReprintHistory('receipt-1', actor);

    expect(prisma.receiptReprintHistory.findMany).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId, receiptId: 'receipt-1' },
      include: {
        reprintedBy: { select: { id: true, email: true } },
      },
      orderBy: [{ reprintedAt: 'desc' }],
      take: 100,
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'read_reprint_history',
        resource: 'receipt',
        resourceId: 'receipt-1',
        tenantId: actor.tenantId,
        userId: actor.userId,
      }),
    );
    expect(result).toEqual({
      receiptId: 'receipt-1',
      receiptNumber: 'R-001',
      items: [
        {
          id: 'history-1',
          paymentId: 'payment-1',
          studentId: 'student-1',
          fileAssetId: 'file-1',
          reprintedAt: new Date('2026-05-09T08:00:00.000Z'),
          reason: 'Parent requested copy',
          format: 'pdf',
          delivery: 'download',
          reprintedBy: { id: 'user-1', email: 'accountant@school.test' },
        },
      ],
    });
  });

  it('rejects student fee ledger export for cross-tenant student', async () => {
    const { service, prisma } = createService();
    prisma.student.findFirst.mockResolvedValue(null);

    await expect(
      service.exportStudentFeeLedgerCsv('student-other-tenant', actor),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: { id: 'student-other-tenant', tenantId: actor.tenantId },
      include: { class: true, sectionRef: true },
    });
  });

  it('exports student fee ledger CSV from tenant-scoped invoice data and audits the export', async () => {
    const { service, prisma, auditService } = createService();
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      tenantId: actor.tenantId,
      studentSystemId: 'S-001',
      firstNameEn: 'Sita',
      lastNameEn: 'Shrestha',
      class: { name: 'Class 1' },
      sectionRef: { name: 'A' },
    });
    prisma.invoice.findMany.mockResolvedValue([
      {
        id: 'invoice-1',
        invoiceNumber: 'INV-001',
        dueDate: new Date('2026-05-15T00:00:00.000Z'),
        totalAmount: new Prisma.Decimal(1000),
        status: 'PARTIAL',
        lines: [
          {
            totalAmount: new Prisma.Decimal(1000),
            feeHead: { name: 'Tuition Fee' },
          },
        ],
        payments: [
          {
            amount: new Prisma.Decimal(600),
            receipt: { receiptNumber: 'R-001' },
            refunds: [{ amount: new Prisma.Decimal(100) }],
          },
        ],
      },
    ]);

    const csv = await service.exportStudentFeeLedgerCsv('student-1', actor);

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: actor.tenantId, studentId: 'student-1' },
      }),
    );
    expect(csv).toContain('Student ID,Student Name,Class,Section');
    expect(csv).toContain('S-001,Sita Shrestha,Class 1,A,INV-001');
    expect(csv).toContain('Tuition Fee,1000,500,100,500,PARTIAL,R-001');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'export',
        resource: 'student_fee_ledger',
        resourceId: 'student-1',
        tenantId: actor.tenantId,
        userId: actor.userId,
      }),
    );
  });
});

function buildReceiptForVerification(
  overrides: {
    receiptNumber?: string;
    reversedAt?: Date | null;
    reversalReason?: string | null;
    refunds?: Array<{ amount: Prisma.Decimal }>;
  } = {},
) {
  return {
    id: 'receipt-verify-1',
    tenantId: actor.tenantId,
    paymentId: 'payment-1',
    receiptNumber: overrides.receiptNumber ?? 'REC-2026-00001',
    fiscalYear: '2082/83',
    schoolPan: 'PAN-001',
    issuedAt: new Date('2026-05-09T08:00:00.000Z'),
    tenant: {
      name: 'Tenant School',
      panNumber: 'PAN-001',
    },
    payment: {
      id: 'payment-1',
      invoiceId: 'invoice-1',
      studentId: 'student-1',
      method: 'CASH',
      status: 'SUCCESS',
      amount: new Prisma.Decimal(1000),
      paidAt: new Date('2026-05-09T07:55:00.000Z'),
      referenceNumber: 'CASH-001',
      reversedAt: overrides.reversedAt ?? null,
      reversalReason: overrides.reversalReason ?? null,
      invoice: {
        id: 'invoice-1',
        invoiceNumber: 'INV-001',
        status: 'PAID',
        totalAmount: new Prisma.Decimal(1000),
      },
      student: {
        id: 'student-1',
        studentSystemId: 'SCH-001',
        firstNameEn: 'Sita',
        lastNameEn: 'Shrestha',
      },
      collectedBy: {
        id: 'user-1',
        email: 'cashier@school.test',
      },
      refunds: overrides.refunds ?? [],
    },
  };
}
