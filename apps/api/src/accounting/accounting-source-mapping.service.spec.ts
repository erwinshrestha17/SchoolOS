import { BadRequestException, ConflictException } from '@nestjs/common';
import { AccountingSourceMappingService } from './accounting-source-mapping.service';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'accountant@schoolos.test',
  roles: ['accountant'],
  permissions: ['accounting:reports:read', 'accounting:settings:update'],
};

const mapping = {
  id: 'mapping-1',
  tenantId: actor.tenantId,
  sourceModule: 'PAYROLL',
  sourceType: 'PAYROLL_RUN',
  postingType: 'APPROVAL',
  debitAccountId: '11111111-1111-4111-8111-111111111111',
  creditAccountId: '22222222-2222-4222-8222-222222222222',
  description: 'Payroll approval posting',
  effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
  effectiveTo: null,
  isActive: true,
  archivedAt: null,
  createdById: actor.userId,
  updatedById: actor.userId,
  debitAccount: {
    id: '11111111-1111-4111-8111-111111111111',
    code: '5010',
    name: 'Salary Expense',
    type: 'EXPENSE',
    isActive: true,
  },
  creditAccount: {
    id: '22222222-2222-4222-8222-222222222222',
    code: '2200',
    name: 'Salary Payable',
    type: 'LIABILITY',
    isActive: true,
  },
};

describe('AccountingSourceMappingService', () => {
  it('creates a normalized tenant-scoped mapping in a serializable transaction', async () => {
    const { service, tx, prisma, auditService } = buildService();

    await expect(
      service.createMapping(
        {
          sourceModule: 'PAYROLL',
          sourceType: ' payroll run ',
          postingType: ' approval ',
          debitAccountId: mapping.debitAccountId,
          creditAccountId: mapping.creditAccountId,
          description: ' Payroll approval posting ',
          effectiveFrom: '2026-07-01',
        },
        actor as never,
      ),
    ).resolves.toEqual(mapping);

    expect(tx.chartAccount.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        id: { in: [mapping.debitAccountId, mapping.creditAccountId] },
        isActive: true,
      },
      select: { id: true },
    });
    expect(tx.accountingSourceMapping.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
          sourceModule: 'PAYROLL',
          sourceType: 'PAYROLL_RUN',
          postingType: 'APPROVAL',
        }),
      }),
    );
    expect(tx.accountingSourceMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: actor.tenantId,
          sourceType: 'PAYROLL_RUN',
          postingType: 'APPROVAL',
          createdById: actor.userId,
          updatedById: actor.userId,
        }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        resourceId: mapping.id,
        action: 'create',
      }),
    );
  });

  it('fails closed when either account is inactive or belongs to another tenant', async () => {
    const { service, tx } = buildService({
      accounts: [{ id: mapping.debitAccountId }],
    });

    await expect(
      service.createMapping(
        {
          sourceModule: 'PAYROLL',
          sourceType: 'PAYROLL_RUN',
          debitAccountId: mapping.debitAccountId,
          creditAccountId: mapping.creditAccountId,
          effectiveFrom: '2026-07-01',
        },
        actor as never,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(tx.accountingSourceMapping.create).not.toHaveBeenCalled();
  });

  it('rejects an overlapping effective mapping for the same source key', async () => {
    const { service, tx } = buildService({
      overlap: { id: 'existing-mapping' },
    });

    await expect(
      service.createMapping(
        {
          sourceModule: 'PAYROLL',
          sourceType: 'PAYROLL_RUN',
          postingType: 'APPROVAL',
          debitAccountId: mapping.debitAccountId,
          creditAccountId: mapping.creditAccountId,
          effectiveFrom: '2026-07-01',
        },
        actor as never,
      ),
    ).rejects.toThrow(ConflictException);

    expect(tx.accountingSourceMapping.create).not.toHaveBeenCalled();
  });
});

function buildService(
  options: { accounts?: unknown[]; overlap?: unknown } = {},
) {
  const tx = {
    chartAccount: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          options.accounts ?? [
            { id: mapping.debitAccountId },
            { id: mapping.creditAccountId },
          ],
        ),
    },
    accountingSourceMapping: {
      findFirst: jest.fn().mockResolvedValue(options.overlap ?? null),
      create: jest.fn().mockResolvedValue(mapping),
    },
  };
  const prisma = {
    $transaction: jest
      .fn()
      .mockImplementation(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
  };
  const auditService = { record: jest.fn().mockResolvedValue(undefined) };

  return {
    service: new AccountingSourceMappingService(
      prisma as never,
      auditService as never,
    ),
    prisma,
    tx,
    auditService,
  };
}
