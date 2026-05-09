import { NotFoundException } from '@nestjs/common';
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
        reprintedAt: new Date('2026-05-09T08:00:00.000Z'),
        reason: 'Parent requested copy',
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
          reprintedAt: new Date('2026-05-09T08:00:00.000Z'),
          reason: 'Parent requested copy',
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
