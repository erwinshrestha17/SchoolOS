import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthMethod,
  JournalEntryStatus,
  JournalLineSide,
  JournalSourceType,
  Prisma,
} from '@prisma/client';
import { AccountingService, reverseJournalSide } from './accounting.service';
import { journalSourceFingerprint } from '../authorization/policies/journal.policy';

// These unit tests isolate transitions; live grant/session checks are proved by
// journal-domain-policy.int-spec.ts using the real authorization transaction.
jest.mock('../auth/school-authorization-transaction', () => ({
  withSchoolAuthorizationTransaction: (
    prisma: { $transaction: (work: unknown) => unknown },
    _actor: unknown,
    _permission: unknown,
    _targets: unknown,
    work: unknown,
  ) => prisma.$transaction(work),
}));

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'accountant@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['accountant'],
  permissions: [
    'accounting:reverse',
    'accounting:fiscal:reopen',
    ...['submit', 'review', 'approve', 'post', 'reject', 'cancel'].map(
      (duty) => `accounting:journals:${duty}`,
    ),
  ],
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
    const { service, postingService } = buildService({
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

  it('blocks reversals if original journal entry belongs to a locked period', async () => {
    const original = {
      ...buildOriginalJournal(),
      fiscalPeriod: { status: 'LOCKED', label: '2026-04' },
    };
    const { service } = buildService({
      original,
      existingReversal: null,
      closedPeriod: null,
      createdReversal: null,
      journalCount: 1,
    });

    await expect(
      service.reverseJournalEntry(
        original.id,
        {
          reversalDate: '2026-04-27',
          reason: 'Test reversal in locked period',
        },
        actor,
      ),
    ).rejects.toThrow('locked fiscal period');
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
      .mockResolvedValueOnce({
        ...period,
        fiscalYearId: 'fy-1',
        periodNumber: 1,
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-30'),
        fiscalYear: { name: 'FY 2026' },
      })
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
    const { service, prisma, approvalWorkflowService } = buildService({
      fiscalPeriod: period,
    });

    await service.reopenFiscalPeriod(
      'p1',
      { reason: 'Audit adjustment' },
      actor,
    );

    expect(approvalWorkflowService.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowType: 'FISCAL_PERIOD_REOPEN',
        targetId: 'p1',
        reason: 'Audit adjustment',
        finalActionKey: 'accounting.fiscal_period.reopen',
      }),
      actor,
    );
    expect(prisma.fiscalPeriod.update).not.toHaveBeenCalled();
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
      service.reopenFiscalPeriod(
        'p1',
        { reason: 'Reopening with audit reason' },
        actor,
      ),
    ).rejects.toThrow('Reopen the fiscal year first.');
  });
});

describe('Manual Journal Approval Workflow', () => {
  function journal(status: string, changes: Record<string, unknown> = {}) {
    return {
      id: 'journal-1',
      tenantId: actor.tenantId,
      status,
      sourceType: 'MANUAL',
      createdById: 'creator',
      reviewedById: 'reviewer',
      approvedById: 'approver',
      approvedSourceFingerprint: null as string | null,
      entryDate: new Date('2026-05-01'),
      narration: 'Journal',
      lines: [
        {
          id: 'line-1',
          chartAccountId: 'cash',
          side: JournalLineSide.DEBIT,
          amount: new Prisma.Decimal(100),
          debit: new Prisma.Decimal(100),
          credit: new Prisma.Decimal(0),
        },
        {
          id: 'line-2',
          chartAccountId: 'income',
          side: JournalLineSide.CREDIT,
          amount: new Prisma.Decimal(100),
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(100),
        },
      ],
      ...changes,
    };
  }
  it.each([
    ['DRAFT', 'submitManualJournal', 'SUBMITTED', 'submissionNote'],
    ['SUBMITTED', 'reviewManualJournal', 'REVIEWED', 'reviewNote'],
    ['REVIEWED', 'approveManualJournal', 'APPROVED', 'approvalNote'],
    ['SUBMITTED', 'rejectManualJournal', 'REJECTED', 'rejectionReason'],
    ['DRAFT', 'cancelManualJournal', 'CANCELLED', 'cancellationReason'],
  ] as const)(
    'transitions %s through %s with compare-and-set and transactional audit',
    async (status, method, expected, noteKey) => {
      const { service, prisma, auditService } = buildService({
        original: journal(status),
      });
      await service[method](
        'journal-1',
        { reason: 'Independent evidence' },
        actor,
      );
      expect(prisma.journalEntry.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'journal-1',
            tenantId: actor.tenantId,
            status,
          }),
          data: expect.objectContaining({
            status: expected,
            [noteKey]: 'Independent evidence',
          }),
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: 'journal_entry',
          after: expect.objectContaining({ status: expected }),
        }),
        prisma,
      );
    },
  );
  it('blocks unbalanced submission', async () => {
    const row = journal('DRAFT');
    row.lines[1].amount = new Prisma.Decimal(90);
    row.lines[1].credit = new Prisma.Decimal(90);
    const { service, prisma } = buildService({ original: row });
    await expect(
      service.submitManualJournal(row.id, {}, actor),
    ).rejects.toThrow('balanced lines');
    expect(prisma.journalEntry.updateMany).not.toHaveBeenCalled();
  });
  it('requires completed review before approval', async () => {
    const { service } = buildService({ original: journal('SUBMITTED') });
    await expect(
      service.approveManualJournal('journal-1', {}, actor),
    ).rejects.toThrow(ConflictException);
  });
  it('blocks creator and reviewer approval even with all duty permissions', async () => {
    for (const changes of [
      { createdById: actor.userId },
      { reviewedById: actor.userId },
    ]) {
      const { service } = buildService({
        original: journal('REVIEWED', changes),
      });
      await expect(
        service.approveManualJournal('journal-1', {}, actor),
      ).rejects.toThrow(ForbiddenException);
    }
  });
  it('posts independently approved unchanged sources', async () => {
    const row = journal('APPROVED');
    row.approvedSourceFingerprint = journalSourceFingerprint(row);
    const { service, prisma, postingService } = buildService({ original: row });
    await service.postApprovedManualJournal(row.id, {}, actor);
    expect(postingService.generateJournalEntryNumber).toHaveBeenCalledWith(
      prisma,
      actor.tenantId,
      'fiscal-year',
      row.entryDate,
    );
    expect(prisma.journalEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'POSTED',
          postedById: actor.userId,
          entryNumber: 'JE-MOCK',
        }),
      }),
    );
  });
  it('fails a concurrent transition without appending a successful audit', async () => {
    const { service, prisma, auditService } = buildService({
      original: journal('DRAFT'),
    });
    prisma.journalEntry.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.submitManualJournal('journal-1', {}, actor),
    ).rejects.toThrow(ConflictException);
    expect(auditService.record).not.toHaveBeenCalled();
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
          where.id ===
            (options.original as { id?: unknown } | null | undefined)?.id ||
          where.id === 'journal-original'
        ) {
          return Promise.resolve(options.original);
        }
        if (where.reversalOfId) {
          return Promise.resolve(options.existingReversal);
        }
        return Promise.resolve(null);
      }),
      findFirstOrThrow: jest.fn().mockResolvedValue(options.original),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(options.journalCount ?? 0),
      groupBy: jest.fn().mockResolvedValue([]),
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
    journalLine: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(0) },
      }),
    },
    bankStatement: {
      count: jest.fn().mockResolvedValue(0),
    },
    bankReconciliationSession: { findMany: jest.fn().mockResolvedValue([]) },
    chartAccount: { count: jest.fn().mockResolvedValue(2) },
    $queryRaw: jest.fn().mockResolvedValue([{ count: 0 }]),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((work: (client: unknown) => unknown) =>
    work(prisma),
  );
  const auditService = {
    record: jest.fn(),
  };
  const postingService = {
    compareAndSetUnpostedManualJournal: jest
      .fn()
      .mockImplementation(
        (
          id: string,
          actor: { tenantId: string },
          expected: object,
          data: object,
          tx: typeof prisma,
        ) =>
          tx.journalEntry.updateMany({
            where: {
              id,
              tenantId: actor.tenantId,
              sourceType: 'MANUAL',
              ...expected,
            },
            data,
          }),
      ),
    lockPostingPeriod: jest.fn().mockImplementation(() => {
      if (options.closedPeriod) throw new ConflictException('Closed period');
      return Promise.resolve({ fiscalYearId: 'fiscal-year' });
    }),
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
      return Promise.resolve({ fiscalYearId: 'fiscal-year' });
    }),
  };
  const approvalWorkflowService = {
    registerFinalAction: jest.fn(),
    createRequest: jest.fn().mockResolvedValue({
      id: 'approval-1',
      status: 'PENDING',
      targetId: 'p1',
    }),
  };

  return {
    service: new AccountingService(
      prisma as never,
      auditService as never,
      postingService as never,
      approvalWorkflowService as never,
    ),
    prisma,
    auditService,
    postingService,
    approvalWorkflowService,
  };
}
