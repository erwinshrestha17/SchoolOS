import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AccountingPeriodStatus,
  ChartAccountType,
  JournalEntryStatus,
  JournalLineSide,
  JournalSourceType,
  Prisma,
} from '@prisma/client';
import { AccountingService } from '../src/accounting/accounting.service';
import { AccountingPostingService } from '../src/accounting/accounting-posting.service';
import { AppModule } from '../src/app.module';
import { AuthContext } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createAuthContextMock,
  createPrismaMock,
  PrismaMock,
} from './test-helpers';

describe('Accounting M9 Hardening (E2E)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaMock;
  let accountingService: AccountingService;
  let postingService: AccountingPostingService;

  const tenantId = 'tenant-hardening';
  const actor = createAuthContextMock({ tenantId });

  beforeEach(async () => {
    prisma = createPrismaMock() as unknown as PrismaMock;

    // Ensure model mocks have all necessary functions
    const ensureMock = (model: any) => {
      if (!model.findMany) model.findMany = jest.fn().mockResolvedValue([]);
      if (!model.findFirst) model.findFirst = jest.fn();
      if (!model.findUnique) model.findUnique = jest.fn();
      if (!model.findUniqueOrThrow) model.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'mock-id', code: 'mock-code' });
      if (!model.create) model.create = jest.fn();
      if (!model.count) model.count = jest.fn();
      if (!model.upsert) model.upsert = jest.fn();
      if (!model.update) model.update = jest.fn();
    };

    if (!(prisma as any).chartAccount) (prisma as any).chartAccount = {};
    if (!(prisma as any).fiscalPeriod) (prisma as any).fiscalPeriod = {};
    if (!(prisma as any).accountingPeriod) (prisma as any).accountingPeriod = {};
    if (!(prisma as any).journalEntry) (prisma as any).journalEntry = {};
    if (!(prisma as any).journalLine) (prisma as any).journalLine = {};
    if (!(prisma as any).auditLog) (prisma as any).auditLog = {};

    ensureMock((prisma as any).chartAccount);
    ensureMock((prisma as any).fiscalPeriod);
    ensureMock((prisma as any).accountingPeriod);
    ensureMock((prisma as any).journalEntry);
    ensureMock((prisma as any).journalLine);
    ensureMock((prisma as any).auditLog);

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    accountingService = moduleRef.get(AccountingService);
    postingService = moduleRef.get(AccountingPostingService);

    // Setup base accounts
    prisma.__state.chartAccounts.push(
      {
        id: 'acc-cash',
        tenantId,
        code: '1000',
        name: 'Cash',
        type: ChartAccountType.ASSET,
      },
      {
        id: 'acc-revenue',
        tenantId,
        code: '4000',
        name: 'Tuition Fee Revenue',
        type: ChartAccountType.REVENUE,
      },
    );

    // Mock successful period check by default
    jest.spyOn(postingService as any, 'ensurePostingPeriodIsOpen').mockResolvedValue({
      id: 'period-open',
      tenantId,
      fiscalYearId: 'fy-2026',
      label: 'May 2026',
      status: AccountingPeriodStatus.OPEN,
      fiscalYear: { status: 'OPEN', name: 'FY 2026' },
    });
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  describe('Correction Workflow', () => {
    it('should correctly reverse and re-post during correction', async () => {
      // 1. Create an original entry
      const originalEntry = {
        id: 'original-je',
        entryNumber: 'JE-2026-0001',
        status: JournalEntryStatus.POSTED,
        tenantId,
        sourceType: JournalSourceType.MANUAL,
        lines: [
          { chartAccountId: 'acc-cash', side: JournalLineSide.DEBIT, amount: new Prisma.Decimal(1000) },
          { chartAccountId: 'acc-revenue', side: JournalLineSide.CREDIT, amount: new Prisma.Decimal(1000) },
        ],
      };

      (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue(originalEntry);
      (prisma.journalEntry.create as jest.Mock)
        .mockResolvedValueOnce({ id: 'reversal-je', entryNumber: 'JE-2026-0002' }) // Reversal
        .mockResolvedValueOnce({ id: 'correction-je', entryNumber: 'JE-2026-0003' }); // Correction

      const result = await accountingService.correctJournalEntry(
        originalEntry.id,
        {
          reversalDate: new Date().toISOString(),
          narration: 'Correcting wrong amount',
        },
        actor,
      );

      expect(result.reversal).toBeDefined();
      expect(result.correction).toBeDefined();
      
      // Verify reversal is linked to original
      expect(prisma.journalEntry.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          reversalOfId: originalEntry.id,
          sourceType: JournalSourceType.REVERSAL,
        })
      }));

      // Verify correction is linked to original
      expect(prisma.journalEntry.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          sourceType: JournalSourceType.CORRECTION,
          sourceId: originalEntry.id,
        })
      }));
    });
  });

  describe('Double-Entry Enforcement', () => {
    it('should reject imbalanced postings from all sources', async () => {
      // Manual Journal
      await expect(
        postingService.postManualJournal({
          tenantId,
          entryDate: new Date(),
          narration: 'Imbalanced',
          lines: [{ chartAccountId: 'acc-cash', debit: 100, credit: 0 }]
        }, actor)
      ).rejects.toThrow(/balanced/i);

      // Fee Payment
      await expect(
        postingService.postFeePayment({
          tenantId,
          paymentId: 'pay-1',
          invoiceNumber: 'INV-1',
          receiptNumber: 'RCP-1',
          paymentAmount: new Prisma.Decimal(100),
          paymentMethod: 'CASH',
          lines: [{ chartAccountId: 'acc-revenue', amount: new Prisma.Decimal(90), description: 'Partial' }]
        }, actor)
      ).rejects.toThrow(/balanced/i);
    });
  });

  describe('Locked Period Behavior', () => {
    it('should reject posting to a LOCKED period for regular users', async () => {
      // Mock period as LOCKED
      jest.spyOn(postingService as any, 'ensurePostingPeriodIsOpen').mockImplementation(async (tx, tid, date, allowLocked) => {
        if (!allowLocked) {
          throw new ConflictException('Fiscal period is locked for posting.');
        }
        return { id: 'period-locked', status: AccountingPeriodStatus.LOCKED };
      });

      await expect(
        postingService.postManualJournal({
          tenantId,
          entryDate: new Date(),
          narration: 'Trying to post to locked',
          lines: [
            { chartAccountId: 'acc-cash', debit: 100, credit: 0 },
            { chartAccountId: 'acc-revenue', debit: 0, credit: 100 }
          ]
        }, actor)
      ).rejects.toThrow(/locked/i);
    });
  });

  describe('Audit Logging', () => {
    it('should log all major accounting actions', async () => {
      const spy = jest.spyOn(moduleRef.get(PrismaService).auditLog, 'create');
      
      // Mock create to pass
      (prisma.journalEntry.create as jest.Mock).mockResolvedValue({ id: 'je-audit', entryNumber: 'JE-AUDIT' });

      await postingService.postManualJournal({
        tenantId,
        entryDate: new Date(),
        narration: 'Audit test',
        lines: [
          { chartAccountId: 'acc-cash', debit: 100, credit: 0 },
          { chartAccountId: 'acc-revenue', debit: 0, credit: 100 }
        ]
      }, actor);

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          action: 'post',
          resource: 'journal_entry',
        })
      }));

      await accountingService.runConsistencyCheck(actor);
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          action: 'reconcile',
          resource: 'ledger',
        })
      }));
    });
  });

  describe('Reconciliation Consistency Checks', () => {
    it('should identify imbalanced entries in the ledger', async () => {
      // Mock one imbalanced entry in DB (simulating data corruption or bypass)
      (prisma.journalEntry.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'imbalanced-1',
          entryNumber: 'BAD-01',
          lines: [
            { debit: new Prisma.Decimal(100), credit: new Prisma.Decimal(0) },
            { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(99) },
          ]
        }
      ]);

      const result = await accountingService.runConsistencyCheck(actor);
      expect(result.isConsistent).toBe(false);
      expect(result.imbalancedEntries.length).toBe(1);
    });
  });

  describe('Report Correctness', () => {
    it('should verify that Trial Balance totals match', async () => {
      // Mock balanced ledger
      (prisma.chartAccount.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'acc-1', code: '1000', name: 'Cash', type: ChartAccountType.ASSET,
          journalLines: [{ debit: new Prisma.Decimal(1000), credit: new Prisma.Decimal(0) }]
        },
        {
          id: 'acc-2', code: '4000', name: 'Revenue', type: ChartAccountType.REVENUE,
          journalLines: [{ debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(1000) }]
        }
      ]);

      const reports = await accountingService.buildReports(actor);
      expect(reports.balanced).toBe(true);
      expect(reports.totals.debit).toBe(1000);
      expect(reports.totals.credit).toBe(1000);
    });
  });
});
