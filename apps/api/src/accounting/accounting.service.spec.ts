import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AuthMethod,
  JournalLineSide,
  JournalSourceType,
  Prisma,
} from '@prisma/client';
import { AccountingService, reverseJournalSide } from './accounting.service';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'accountant@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['accountant'],
  permissions: ['accounting:reverse'],
};

describe('accounting reversals', () => {
  it('inverts journal lines without mutating the original entry', async () => {
    const original = buildOriginalJournal();
    const reversal = {
      id: 'journal-reversal',
      entryNumber: 'JE-2026-00002',
      reversalOfId: original.id,
      lines: [],
    };
    const { service, prisma, postingService, auditService } = buildService({
      original,
      existingReversal: null,
      closedPeriod: null,
      createdReversal: reversal,
      journalCount: 1,
    });

    const result = await service.reverseJournalEntry(
      original.id,
      {
        reversalDate: '2026-04-27',
        narration: 'Correction for duplicate posting',
      },
      actor,
    );

    expect(result).toBe(reversal);
    expect(postingService.postReversal).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        originalEntryId: original.id,
        reversalDate: new Date('2026-04-27'),
        narration: 'Correction for duplicate posting',
        lines: [
          expect.objectContaining({
            chartAccountId: 'cash',
            side: JournalLineSide.CREDIT,
            amount: original.lines[0].amount,
          }),
          expect.objectContaining({
            chartAccountId: 'income',
            side: JournalLineSide.DEBIT,
            amount: original.lines[1].amount,
          }),
        ],
      }),
      actor,
    );
    expect('update' in prisma.journalEntry).toBe(false);
  });

  it('blocks reversals posted into a closed accounting period', async () => {
    const original = buildOriginalJournal();
    const { service } = buildService({
      original,
      existingReversal: null,
      closedPeriod: { id: 'period-1', name: 'FY 2082 Closed' },
      createdReversal: null,
      journalCount: 1,
    });

    await expect(
      service.reverseJournalEntry(
        original.id,
        { reversalDate: '2026-04-27' },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('prevents duplicate reversals for the same journal entry', async () => {
    const original = buildOriginalJournal();
    const { service } = buildService({
      original,
      existingReversal: { id: 'existing', entryNumber: 'JE-2026-00009' },
      closedPeriod: null,
      createdReversal: null,
      journalCount: 9,
    });

    await expect(
      service.reverseJournalEntry(original.id, {}, actor),
    ).rejects.toThrow('Journal entry already reversed by JE-2026-00009');
  });

  it('rejects unknown journals in the current tenant', async () => {
    const { service } = buildService({
      original: null,
      existingReversal: null,
      closedPeriod: null,
      createdReversal: null,
      journalCount: 0,
    });

    await expect(
      service.reverseJournalEntry('missing', {}, actor),
    ).rejects.toThrow(NotFoundException);
  });

  it('reverses debit and credit sides deterministically', () => {
    expect(reverseJournalSide(JournalLineSide.DEBIT)).toBe(
      JournalLineSide.CREDIT,
    );
    expect(reverseJournalSide(JournalLineSide.CREDIT)).toBe(
      JournalLineSide.DEBIT,
    );
  });
});

describe('AccountingService Immutability', () => {
  it('blocks direct updates to journal entries', async () => {
    const { service } = buildService({});
    await expect(service.updateJournalEntry()).rejects.toThrow(
      'Journal entries are immutable. Use correction or reversal workflows.',
    );
  });

  it('blocks direct deletions of journal entries', async () => {
    const { service } = buildService({});
    await expect(service.deleteJournalEntry()).rejects.toThrow(
      'Journal entries are immutable and cannot be deleted once posted.',
    );
  });
});

describe('fiscal period status updates', () => {
  it('allows locking a period without a reason', async () => {
    const period = { id: 'p1', status: 'OPEN', label: '2026-04' };
    const { service, prisma } = buildService({
      fiscalPeriod: period,
    });

    await service.updateFiscalPeriodStatus(
      'p1',
      'LOCKED' as any,
      {},
      actor as any,
    );

    expect(prisma.fiscalPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'LOCKED' }),
      }),
    );
  });

  it('enforces a mandatory reason when reopening a period', async () => {
    const period = { id: 'p1', status: 'LOCKED', label: '2026-04' };
    const { service } = buildService({
      fiscalPeriod: period,
    });

    await expect(
      service.updateFiscalPeriodStatus('p1', 'OPEN' as any, {}, actor as any),
    ).rejects.toThrow('Reason is mandatory for reopening a fiscal period');
  });

  it('allows reopening with a reason', async () => {
    const period = { id: 'p1', status: 'LOCKED', label: '2026-04' };
    const { service, prisma } = buildService({
      fiscalPeriod: period,
    });

    await service.updateFiscalPeriodStatus(
      'p1',
      'OPEN' as any,
      { reason: 'Correction needed' },
      actor as any,
    );

    expect(prisma.fiscalPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'OPEN' }),
      }),
    );
  });
});

function buildOriginalJournal() {
  return {
    id: 'journal-original',
    entryNumber: 'JE-2026-00001',
    sourceType: JournalSourceType.MANUAL,
    lines: [
      {
        id: 'line-1',
        chartAccountId: 'cash',
        side: JournalLineSide.DEBIT,
        amount: new Prisma.Decimal(100),
        description: 'Cash received',
      },
      {
        id: 'line-2',
        chartAccountId: 'income',
        side: JournalLineSide.CREDIT,
        amount: new Prisma.Decimal(100),
        description: 'Income posted',
      },
    ],
  };
}

function buildService(options: {
  original?: unknown;
  existingReversal?: unknown;
  closedPeriod?: unknown;
  createdReversal?: unknown;
  journalCount?: number;
  fiscalPeriod?: unknown;
}) {
  const prisma = {
    journalEntry: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        if (
          where.id === (options.original as any)?.id ||
          where.id === 'journal-original'
        ) {
          return Promise.resolve(options.original);
        }
        if (where.reversalOfId) {
          return Promise.resolve(options.existingReversal);
        }
        return Promise.resolve(null);
      }),
      count: jest.fn().mockResolvedValue(options.journalCount ?? 0),
      create: jest.fn().mockResolvedValue(options.createdReversal),
    },
    accountingPeriod: {
      findFirst: jest.fn().mockResolvedValue(options.closedPeriod),
    },
    fiscalPeriod: {
      findFirst: jest.fn().mockResolvedValue(options.fiscalPeriod),
      update: jest.fn().mockResolvedValue(options.fiscalPeriod),
    },
  };
  const auditService = {
    record: jest.fn(),
  };
  const postingService = {
    postManualJournal: jest.fn().mockResolvedValue(options.createdReversal),
    postReversal: jest.fn().mockResolvedValue(options.createdReversal),
    ensurePostingPeriodIsOpen: jest.fn().mockImplementation(() => {
      if (options.closedPeriod) {
        throw new ConflictException('Closed period');
      }
      return Promise.resolve();
    }),
  };

  return {
    service: new AccountingService(
      prisma as never,
      auditService as never,
      postingService as never,
    ),
    prisma,
    auditService,
    postingService,
  };
}
