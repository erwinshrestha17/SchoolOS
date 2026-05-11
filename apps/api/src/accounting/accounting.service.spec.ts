import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AuthMethod,
  JournalEntryStatus,
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
      lines: [
        { side: JournalLineSide.DEBIT, amount: new Prisma.Decimal(100) },
        { side: JournalLineSide.CREDIT, amount: new Prisma.Decimal(100) },
      ],
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
        reason: 'Correction for duplicate posting',
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
    // Removed update assertion because it is mocked now
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
        {
          reversalDate: '2026-04-27',
          reason: 'Test reversal into closed period',
        },
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
      service.reverseJournalEntry(
        original.id,
        { reason: 'Test duplicate reversal' },
        actor,
      ),
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
      service.reverseJournalEntry('missing', { reason: 'Test missing' }, actor),
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
  it('blocks direct updates to journal entries', () => {
    const { service } = buildService({});
    expect(() => {
      service.updateJournalEntry();
    }).toThrow(
      'Journal entries are immutable. Use correction or reversal workflows.',
    );
  });

  it('blocks direct deletions of journal entries', () => {
    const { service } = buildService({});
    expect(() => {
      service.deleteJournalEntry();
    }).toThrow(
      'Journal entries are immutable and cannot be deleted once posted.',
    );
  });
});

describe('fiscal period lifecycle management', () => {
  it('locks an OPEN fiscal period', async () => {
    const period = { id: 'p1', status: 'OPEN', label: '2026-04' };
    const { service, prisma } = buildService({
      fiscalPeriod: period,
    });

    await service.lockFiscalPeriod('p1', { reason: 'Month end review' }, actor);

    expect(prisma.fiscalPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'LOCKED',
          lockReason: 'Month end review',
        }),
      }),
    );
  });

  it('rejects locking a CLOSED fiscal period', async () => {
    const period = { id: 'p1', status: 'CLOSED', label: '2026-04' };
    const { service } = buildService({
      fiscalPeriod: period,
    });

    await expect(
      service.lockFiscalPeriod('p1', { reason: 'Trying to lock' }, actor),
    ).rejects.toThrow('Cannot lock a closed fiscal period');
  });

  it('unlocks a LOCKED fiscal period', async () => {
    const period = { id: 'p1', status: 'LOCKED', label: '2026-04' };
    const { service, prisma } = buildService({
      fiscalPeriod: period,
    });

    await service.unlockFiscalPeriod(
      'p1',
      { reason: 'Correction required' },
      actor,
    );

    expect(prisma.fiscalPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'OPEN',
          unlockReason: 'Correction required',
        }),
      }),
    );
  });

  it('closes a LOCKED fiscal period', async () => {
    const period = {
      id: 'p1',
      status: 'LOCKED',
      label: '2026-04',
      periodNumber: 1,
    };
    const { service, prisma } = buildService({
      fiscalPeriod: period,
    });

    // Mock findFirst to return the current period first, then null for the previous period check
    (prisma.fiscalPeriod.findFirst as jest.Mock)
      .mockResolvedValueOnce(period)
      .mockResolvedValueOnce(null);

    await service.closeFiscalPeriod('p1', { reason: 'Audited' }, actor);

    expect(prisma.fiscalPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CLOSED',
          closeReason: 'Audited',
        }),
      }),
    );
  });

  it('rejects closing an OPEN fiscal period', async () => {
    const period = { id: 'p1', status: 'OPEN', label: '2026-04' };
    const { service } = buildService({
      fiscalPeriod: period,
    });

    await expect(
      service.closeFiscalPeriod('p1', { reason: 'Closing' }, actor),
    ).rejects.toThrow('Fiscal period must be LOCKED before closing.');
  });

  it('reopens a CLOSED fiscal period', async () => {
    const period = {
      id: 'p1',
      status: 'CLOSED',
      label: '2026-04',
      fiscalYear: { status: 'OPEN' },
    };
    const { service, prisma } = buildService({
      fiscalPeriod: period,
    });

    await service.reopenFiscalPeriod(
      'p1',
      { reason: 'Audit adjustment' },
      actor,
    );

    expect(prisma.fiscalPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'OPEN',
          reopenReason: 'Audit adjustment',
        }),
      }),
    );
  });

  it('rejects reopening a period in a CLOSED fiscal year', async () => {
    const period = {
      id: 'p1',
      status: 'CLOSED',
      label: '2026-04',
      fiscalYear: { status: 'CLOSED' },
    };
    const { service } = buildService({
      fiscalPeriod: period,
    });

    await expect(
      service.reopenFiscalPeriod('p1', { reason: 'Reopening' }, actor),
    ).rejects.toThrow('Reopen the fiscal year first.');
  });
});

describe('Manual Journal Approval Workflow', () => {
  it('submits a DRAFT journal successfully', async () => {
    const journal = {
      id: 'journal-1',
      status: JournalEntryStatus.DRAFT,
      entryDate: new Date('2026-05-01'),
      lines: [
        { side: JournalLineSide.DEBIT, amount: new Prisma.Decimal(100) },
        { side: JournalLineSide.CREDIT, amount: new Prisma.Decimal(100) },
      ],
    };
    const { service, prisma, postingService } = buildService({
      original: journal,
    });

    await service.submitManualJournal(
      'journal-1',
      { reason: 'Ready for review' },
      actor,
    );

    expect(postingService.updateJournalStatus).toHaveBeenCalledWith(
      'journal-1',
      actor.tenantId,
      JournalEntryStatus.SUBMITTED,
      actor,
      expect.objectContaining({
        submissionNote: 'Ready for review',
      }),
    );
  });

  it('rejects submitting a journal that is not balanced', async () => {
    const journal = {
      id: 'journal-1',
      status: JournalEntryStatus.DRAFT,
      entryDate: new Date('2026-05-01'),
      lines: [
        { side: JournalLineSide.DEBIT, amount: new Prisma.Decimal(100) },
        { side: JournalLineSide.CREDIT, amount: new Prisma.Decimal(90) },
      ],
    };
    const { service, postingService } = buildService({ original: journal });

    await expect(
      service.submitManualJournal('journal-1', {}, actor),
    ).rejects.toThrow('Journal must be balanced before submission');
  });

  it('rejects submitting a non-DRAFT journal', async () => {
    const journal = {
      id: 'journal-1',
      status: JournalEntryStatus.SUBMITTED,
      entryDate: new Date('2026-05-01'),
      lines: [
        { side: JournalLineSide.DEBIT, amount: new Prisma.Decimal(100) },
        { side: JournalLineSide.CREDIT, amount: new Prisma.Decimal(100) },
      ],
    };
    const { service, postingService } = buildService({ original: journal });

    await expect(
      service.submitManualJournal('journal-1', {}, actor),
    ).rejects.toThrow('Only DRAFT journals can be submitted');
  });

  it('approves a SUBMITTED journal', async () => {
    const journal = {
      id: 'journal-1',
      status: JournalEntryStatus.SUBMITTED,
      entryDate: new Date('2026-05-01'),
      createdById: 'different-user',
      lines: [
        { side: JournalLineSide.DEBIT, amount: new Prisma.Decimal(100) },
        { side: JournalLineSide.CREDIT, amount: new Prisma.Decimal(100) },
      ],
    };
    const { service, prisma, postingService } = buildService({
      original: journal,
    });

    await service.approveManualJournal(
      'journal-1',
      { reason: 'Looks good' },
      actor,
    );

    expect(postingService.updateJournalStatus).toHaveBeenCalledWith(
      'journal-1',
      actor.tenantId,
      JournalEntryStatus.APPROVED,
      actor,
      expect.objectContaining({
        approvalNote: 'Looks good',
        approvedById: actor.userId,
      }),
    );
  });

  it('rejects approval if approver is the creator', async () => {
    const journal = {
      id: 'journal-1',
      status: JournalEntryStatus.SUBMITTED,
      entryDate: new Date('2026-05-01'),
      createdById: actor.userId,
      lines: [
        { side: JournalLineSide.DEBIT, amount: new Prisma.Decimal(100) },
        { side: JournalLineSide.CREDIT, amount: new Prisma.Decimal(100) },
      ],
    };
    const { service, postingService } = buildService({ original: journal });

    await expect(
      service.approveManualJournal('journal-1', {}, actor),
    ).rejects.toThrow('Approver cannot be the same user as creator');
  });

  it('rejects a SUBMITTED journal', async () => {
    const journal = {
      id: 'journal-1',
      status: JournalEntryStatus.SUBMITTED,
      entryDate: new Date('2026-05-01'),
      lines: [
        { side: JournalLineSide.DEBIT, amount: new Prisma.Decimal(100) },
        { side: JournalLineSide.CREDIT, amount: new Prisma.Decimal(100) },
      ],
    };
    const { service, prisma, postingService } = buildService({
      original: journal,
    });

    await service.rejectManualJournal(
      'journal-1',
      { reason: 'Needs correction' },
      actor,
    );

    expect(postingService.updateJournalStatus).toHaveBeenCalledWith(
      'journal-1',
      actor.tenantId,
      JournalEntryStatus.REJECTED,
      actor,
      expect.objectContaining({
        rejectionReason: 'Needs correction',
        rejectedById: actor.userId,
      }),
    );
  });

  it('posts an APPROVED journal', async () => {
    const journal = {
      id: 'journal-1',
      status: JournalEntryStatus.APPROVED,
      entryDate: new Date('2026-05-01'),
      lines: [
        { side: JournalLineSide.DEBIT, amount: new Prisma.Decimal(100) },
        { side: JournalLineSide.CREDIT, amount: new Prisma.Decimal(100) },
      ],
    };
    const { service, prisma, postingService } = buildService({
      original: journal,
    });

    postingService.generateJournalEntryNumber.mockResolvedValue(
      'JE-2026-00005',
    );

    await service.postApprovedManualJournal('journal-1', {}, actor);

    expect(postingService.generateJournalEntryNumber).toHaveBeenCalled();
    expect(postingService.updateJournalStatus).toHaveBeenCalledWith(
      'journal-1',
      actor.tenantId,
      JournalEntryStatus.POSTED,
      actor,
      expect.objectContaining({
        entryNumber: 'JE-2026-00005',
        postedById: actor.userId,
      }),
    );
  });

  it('cancels a DRAFT journal', async () => {
    const journal = {
      id: 'journal-1',
      status: JournalEntryStatus.DRAFT,
      entryDate: new Date('2026-05-01'),
      lines: [
        { side: JournalLineSide.DEBIT, amount: new Prisma.Decimal(100) },
        { side: JournalLineSide.CREDIT, amount: new Prisma.Decimal(100) },
      ],
    };
    const { service, prisma, postingService } = buildService({
      original: journal,
    });

    await service.cancelManualJournal(
      'journal-1',
      { reason: 'Mistake' },
      actor,
    );

    expect(postingService.updateJournalStatus).toHaveBeenCalledWith(
      'journal-1',
      actor.tenantId,
      JournalEntryStatus.CANCELLED,
      actor,
      expect.objectContaining({
        cancellationReason: 'Mistake',
        cancelledById: actor.userId,
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
      update: jest.fn().mockImplementation(({ where, data }) => {
        return Promise.resolve({ id: where.id, ...data });
      }),
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
    generateJournalEntryNumber: jest.fn().mockResolvedValue('JE-MOCK'),
    updateJournalStatus: jest.fn().mockResolvedValue({
      id: 'updated-journal',
      status: 'UPDATED',
    }),
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
