import { ConflictException } from '@nestjs/common';
import {
  AccountingPostingBatchStatus,
  AuthMethod,
  Prisma,
} from '@prisma/client';
import { AccountingService } from './accounting.service';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'school',
  userId: 'accountant-1',
  email: 'accountant@example.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['accountant'],
  permissions: ['accounting:posting-batches:retry'],
};

describe('AccountingService source posting retry', () => {
  it('returns an already-posted batch without replaying the source', async () => {
    const batch = buildBatch(AccountingPostingBatchStatus.POSTED);
    const { service, prisma, postingService } = buildService(batch);

    const result = await service.retryPostingBatch(batch.id, actor);

    expect(result.sourceTotal).toBe('1000.00');
    expect(prisma.accountingPostingBatch.updateMany).not.toHaveBeenCalled();
    expect(postingService.postPayrollAccrual).not.toHaveBeenCalled();
  });

  it('claims and replays one failed M7 accrual with the same source identity', async () => {
    const batch = buildBatch(AccountingPostingBatchStatus.FAILED);
    const { service, prisma, postingService } = buildService(batch);
    prisma.payrollRun.findFirst.mockResolvedValue({
      id: 'payroll-1',
      periodMonth: 4,
      periodYear: 2083,
      grossAmount: new Prisma.Decimal('1000.00'),
      deductionAmount: new Prisma.Decimal('100.00'),
      netAmount: new Prisma.Decimal('900.00'),
      pfEmployeeAmount: new Prisma.Decimal('0.00'),
      pfEmployerAmount: new Prisma.Decimal('0.00'),
      tdsAmount: new Prisma.Decimal('100.00'),
      periodEnd: new Date('2026-07-16T00:00:00.000Z'),
      updatedAt: new Date('2026-07-16T00:00:00.000Z'),
    });
    prisma.accountingPostingBatch.findFirstOrThrow.mockResolvedValue({
      ...batch,
      status: AccountingPostingBatchStatus.POSTED,
      retryCount: 1,
    });

    const result = await service.retryPostingBatch(batch.id, actor);

    expect(postingService.postPayrollAccrual).toHaveBeenCalledWith(
      expect.objectContaining({
        payrollRunId: 'payroll-1',
        grossAmount: new Prisma.Decimal('1000.00'),
      }),
      actor,
    );
    expect(result.status).toBe(AccountingPostingBatchStatus.POSTED);
    expect(prisma.accountingPostingBatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: AccountingPostingBatchStatus.FAILED,
        }),
        data: expect.objectContaining({
          status: AccountingPostingBatchStatus.POSTING,
          retryCount: { increment: 1 },
        }),
      }),
    );
  });

  it('returns a safe failure and restores FAILED when the source is unsupported', async () => {
    const batch = {
      ...buildBatch(AccountingPostingBatchStatus.FAILED),
      sourceModule: 'UNKNOWN',
    };
    const { service, prisma, auditService } = buildService(batch);

    await expect(
      service.retryPostingBatch(batch.id, actor),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.accountingPostingBatch.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AccountingPostingBatchStatus.FAILED,
          failureCode: 'SOURCE_RETRY_FAILED',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'retry_failed' }),
    );
  });
});

function buildBatch(status: AccountingPostingBatchStatus) {
  return {
    id: 'batch-1',
    tenantId: actor.tenantId,
    fiscalYearId: 'fy-1',
    fiscalPeriodId: 'fp-1',
    sourceModule: 'M7',
    sourceType: 'PAYROLL_RUN',
    sourceBatchId: 'payroll-1',
    postingType: 'APPROVAL',
    status,
    sourceTotal: new Prisma.Decimal('1000.00'),
    postedTotal: new Prisma.Decimal('0.00'),
    reconciliationDifference: new Prisma.Decimal('1000.00'),
    normalizedPayload: {},
    idempotencyKey: 'M7:PAYROLL_RUN:payroll-1:APPROVAL',
    journalEntryId: null,
    failureCode:
      status === AccountingPostingBatchStatus.FAILED ? 'LOCKED' : null,
    failureDetail:
      status === AccountingPostingBatchStatus.FAILED ? 'Locked' : null,
    retryCount: 0,
    requestedById: actor.userId,
    postedById: null,
    postedAt: null,
    reversedAt: null,
    reversalReason: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };
}

function buildService(batch: ReturnType<typeof buildBatch>) {
  const prisma = {
    accountingPostingBatch: {
      findFirst: jest.fn().mockResolvedValue(batch),
      findFirstOrThrow: jest.fn().mockResolvedValue(batch),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    payrollRun: { findFirst: jest.fn() },
    payment: { findFirst: jest.fn() },
    invoice: { findFirst: jest.fn() },
    feeWaiver: { findFirst: jest.fn() },
    paymentRefund: { findFirst: jest.fn() },
    chartAccount: { findUniqueOrThrow: jest.fn() },
  };
  const auditService = {
    record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
  };
  const postingService = {
    postPayrollAccrual: jest.fn().mockResolvedValue({ id: 'journal-1' }),
    postPayrollDisbursement: jest.fn(),
    postFeePayment: jest.fn(),
    postInvoice: jest.fn(),
    postFeeWaiver: jest.fn(),
    postPaymentRefund: jest.fn(),
  };
  const service = new AccountingService(
    prisma as never,
    auditService as never,
    postingService as never,
  );
  return { service, prisma, auditService, postingService };
}
