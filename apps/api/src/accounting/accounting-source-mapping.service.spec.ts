import { BadRequestException, ConflictException } from '@nestjs/common';
import { JournalSourceType } from '@prisma/client';
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

  describe('getSourceMappingHealth', () => {
    it('classifies posted entries by source module and flags missing source ids', async () => {
      const prisma = {
        journalEntry: {
          findMany: jest.fn().mockResolvedValue([
            sourceEntry({
              id: 'fees-entry',
              sourceModule: 'FINANCE',
              sourceType: JournalSourceType.FEE_PAYMENT,
              sourceId: 'payment-1',
              accountCodes: ['1000', '4000'],
            }),
            sourceEntry({
              id: 'payroll-entry',
              sourceModule: 'PAYROLL',
              sourceType: JournalSourceType.PAYROLL_RUN,
              sourceId: 'payroll-run-1',
              accountCodes: ['5010', '2200'],
            }),
            sourceEntry({
              id: 'canteen-entry',
              sourceModule: 'CANTEEN',
              sourceType: JournalSourceType.FEE_PAYMENT,
              sourceId: 'canteen-sale-1',
              accountCodes: ['1000', '4050'],
            }),
            sourceEntry({
              id: 'library-entry',
              sourceModule: 'FINANCE',
              sourceType: JournalSourceType.INVOICE,
              sourceId: 'library-fine-1',
              accountCodes: ['1200', '4040'],
            }),
            sourceEntry({
              id: 'transport-entry',
              sourceModule: 'FINANCE',
              sourceType: JournalSourceType.INVOICE,
              sourceId: null,
              accountCodes: ['1200', '4030'],
            }),
          ]),
        },
        accountingSourceMapping: {
          groupBy: jest.fn().mockResolvedValue([
            { sourceModule: 'FEES', _count: { _all: 1 } },
            { sourceModule: 'PAYROLL', _count: { _all: 1 } },
            { sourceModule: 'CANTEEN', _count: { _all: 1 } },
            { sourceModule: 'LIBRARY', _count: { _all: 1 } },
          ]),
        },
      };
      const service = new AccountingSourceMappingService(
        prisma as never,
        { record: jest.fn() } as never,
      );

      const result = await service.getSourceMappingHealth(actor as never);

      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: actor.tenantId }),
          take: 1000,
        }),
      );
      expect(result.sampledPostedSourceEntries).toBe(5);
      expect(result.modules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceModule: 'FEES',
            postedCount: 1,
            missingSourceIdCount: 0,
            configuredMappingCount: 1,
          }),
          expect.objectContaining({
            sourceModule: 'PAYROLL',
            postedCount: 1,
            missingSourceIdCount: 0,
            configuredMappingCount: 1,
          }),
          expect.objectContaining({
            sourceModule: 'CANTEEN',
            postedCount: 1,
            missingSourceIdCount: 0,
            configuredMappingCount: 1,
          }),
          expect.objectContaining({
            sourceModule: 'LIBRARY',
            postedCount: 1,
            missingSourceIdCount: 0,
            configuredMappingCount: 1,
          }),
          expect.objectContaining({
            sourceModule: 'TRANSPORT',
            postedCount: 1,
            missingSourceIdCount: 1,
            configuredMappingCount: 0,
          }),
        ]),
      );
      expect(result.missingSourceId).toEqual(
        expect.objectContaining({
          count: 1,
          samples: [
            expect.objectContaining({
              id: 'transport-entry',
              sourceModule: 'FINANCE',
              sourceType: JournalSourceType.INVOICE,
            }),
          ],
        }),
      );
      expect(result.isClean).toBe(false);
    });

    it('flags unclean when a module has posted activity but no configured mapping, even with no missing source ids', async () => {
      const prisma = {
        journalEntry: {
          findMany: jest.fn().mockResolvedValue([
            sourceEntry({
              id: 'payroll-entry',
              sourceModule: 'PAYROLL',
              sourceType: JournalSourceType.PAYROLL_RUN,
              sourceId: 'payroll-run-1',
              accountCodes: ['5010', '2200'],
            }),
          ]),
        },
        accountingSourceMapping: {
          groupBy: jest.fn().mockResolvedValue([]),
        },
      };
      const service = new AccountingSourceMappingService(
        prisma as never,
        { record: jest.fn() } as never,
      );

      const result = await service.getSourceMappingHealth(actor as never);

      expect(result.missingSourceId.count).toBe(0);
      expect(result.modules.find((m) => m.sourceModule === 'PAYROLL')).toEqual(
        expect.objectContaining({
          postedCount: 1,
          missingSourceIdCount: 0,
          configuredMappingCount: 0,
        }),
      );
      expect(result.isClean).toBe(false);
    });

    it('is clean when every module with posted activity has a configured mapping and no missing source ids', async () => {
      const prisma = {
        journalEntry: { findMany: jest.fn().mockResolvedValue([]) },
        accountingSourceMapping: { groupBy: jest.fn().mockResolvedValue([]) },
      };
      const service = new AccountingSourceMappingService(
        prisma as never,
        { record: jest.fn() } as never,
      );

      const result = await service.getSourceMappingHealth(actor as never);

      expect(result.sampledPostedSourceEntries).toBe(0);
      expect(result.isClean).toBe(true);
    });
  });
});

function sourceEntry(input: {
  id: string;
  sourceModule: string;
  sourceType: JournalSourceType;
  sourceId: string | null;
  accountCodes: string[];
}) {
  return {
    id: input.id,
    entryNumber: `JE-${input.id}`,
    sourceModule: input.sourceModule,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    lines: input.accountCodes.map((code) => ({
      chartAccount: {
        code,
        type: code.startsWith('4') ? 'REVENUE' : 'ASSET',
      },
    })),
  };
}

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
