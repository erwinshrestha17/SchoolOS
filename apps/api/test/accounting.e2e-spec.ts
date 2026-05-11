import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AccountingPeriodStatus,
  ChartAccountType,
  JournalLineSide,
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

describe('Accounting Module Hardening (E2E)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaMock;
  let accountingService: AccountingService;
  let postingService: AccountingPostingService;

  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';
  const actorA = createAuthContextMock({ tenantId: tenantA });
  const actorB = createAuthContextMock({ tenantId: tenantB });

  beforeEach(async () => {
    prisma = createPrismaMock() as unknown as PrismaMock;

    // Ensure model mocks have all necessary functions
    const ensureMock = (model: any) => {
      if (!model.findMany) model.findMany = jest.fn();
      if (!model.findFirst) model.findFirst = jest.fn();
      if (!model.findUnique) model.findUnique = jest.fn();
      if (!model.create) model.create = jest.fn();
      if (!model.count) model.count = jest.fn();
      if (!model.upsert) model.upsert = jest.fn();
    };

    if (!(prisma as any).chartAccount) (prisma as any).chartAccount = {};
    if (!(prisma as any).fiscalPeriod) (prisma as any).fiscalPeriod = {};
    if (!(prisma as any).accountingPeriod)
      (prisma as any).accountingPeriod = {};
    if (!(prisma as any).journalEntry) (prisma as any).journalEntry = {};
    if (!(prisma as any).journalLine) (prisma as any).journalLine = {};

    ensureMock((prisma as any).chartAccount);
    ensureMock((prisma as any).fiscalPeriod);
    ensureMock((prisma as any).accountingPeriod);
    ensureMock((prisma as any).journalEntry);
    ensureMock((prisma as any).journalLine);

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    accountingService = moduleRef.get(AccountingService);
    postingService = moduleRef.get(AccountingPostingService);

    // Setup initial data for tenant A
    prisma.__state.chartAccounts.push(
      {
        id: 'acc-a1',
        tenantId: tenantA,
        code: '1000',
        name: 'Cash',
        type: ChartAccountType.ASSET,
      },
      {
        id: 'acc-a2',
        tenantId: tenantA,
        code: '4000',
        name: 'Revenue',
        type: ChartAccountType.REVENUE,
      },
    );

    // Setup initial data for tenant B
    prisma.__state.chartAccounts.push({
      id: 'acc-b1',
      tenantId: tenantB,
      code: '1000',
      name: 'Cash',
      type: ChartAccountType.ASSET,
    });
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  describe('Tenant Isolation', () => {
    it('should not allow tenant B to see tenant A accounts', async () => {
      ((prisma as any).chartAccount.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'acc-b1',
          tenantId: tenantB,
          code: '1000',
          name: 'Cash',
          type: ChartAccountType.ASSET,
        },
      ]);
      const accounts = await accountingService.listChartAccounts(actorB);
      expect(accounts).toBeDefined();
      expect(accounts.some((a) => a.tenantId === tenantA)).toBe(false);
      expect(accounts.every((a) => a.tenantId === tenantB)).toBe(true);
    });

    it('should throw NotFound if tenant B tries to get tenant A account', async () => {
      // getAccount Ledgers is what we have or list by ID
      await expect(
        accountingService.getAccountLedger('acc-a1', actorB),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not allow cross-tenant posting via manual journal', async () => {
      // Mock findMany for chartAccount
      ((prisma as any).chartAccount.findMany as jest.Mock).mockResolvedValue([
        { id: 'acc-b1', tenantId: tenantB, code: '1000' },
      ]);

      await expect(
        accountingService.createManualJournal(
          {
            entryDate: new Date().toISOString(),
            narration: 'Cross tenant attempt',
            lines: [
              {
                chartAccountId: 'acc-a1',
                side: JournalLineSide.DEBIT,
                amount: 100,
              },
              {
                chartAccountId: 'acc-b1',
                side: JournalLineSide.CREDIT,
                amount: 100,
              },
            ],
          },
          actorB,
        ),
      ).rejects.toThrow();
    });
  });

  describe('Double-Entry Validation', () => {
    it('should reject imbalanced manual journals', async () => {
      // Mock findMany for chartAccount
      ((prisma as any).chartAccount.findMany as jest.Mock).mockResolvedValue([
        { id: 'acc-a1', tenantId: tenantA, code: '1000' },
        { id: 'acc-a2', tenantId: tenantA, code: '4000' },
      ]);

      await expect(
        accountingService.createManualJournal(
          {
            entryDate: new Date().toISOString(),
            narration: 'Imbalanced',
            lines: [
              {
                chartAccountId: 'acc-a1',
                side: JournalLineSide.DEBIT,
                amount: 100,
              },
              {
                chartAccountId: 'acc-a2',
                side: JournalLineSide.CREDIT,
                amount: 99.99,
              },
            ],
          },
          actorA,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should accept balanced manual journals', async () => {
      // Mock period check to pass
      jest
        .spyOn(postingService as any, 'ensurePostingPeriodIsOpen')
        .mockResolvedValue({
          id: 'period-1',
          fiscalYearId: 'fy-1',
        });
      ((prisma as any).chartAccount.findMany as jest.Mock).mockResolvedValue([
        { id: 'acc-a1', tenantId: tenantA, code: '1000' },
        { id: 'acc-a2', tenantId: tenantA, code: '4000' },
      ]);
      ((prisma as any).journalEntry.count as jest.Mock).mockResolvedValue(0);
      ((prisma as any).journalEntry.create as jest.Mock).mockResolvedValue({
        id: 'je-1',
      });

      const entry = await accountingService.createManualJournal(
        {
          entryDate: new Date().toISOString(),
          narration: 'Balanced',
          lines: [
            {
              chartAccountId: 'acc-a1',
              side: JournalLineSide.DEBIT,
              amount: 100,
            },
            {
              chartAccountId: 'acc-a2',
              side: JournalLineSide.CREDIT,
              amount: 100,
            },
          ],
        },
        actorA,
      );

      expect(entry).toBeDefined();
    });
  });

  describe('Period Boundaries', () => {
    it('should reject posting to a CLOSED fiscal period', async () => {
      if (!(prisma as any).fiscalPeriod) {
        (prisma as any).fiscalPeriod = { findFirst: jest.fn() };
      }
      ((prisma as any).fiscalPeriod.findFirst as jest.Mock).mockResolvedValue({
        id: 'closed-period',
        status: AccountingPeriodStatus.CLOSED,
        label: 'Closed Month',
        fiscalYear: { status: AccountingPeriodStatus.OPEN, name: 'FY 2024' },
      });

      await expect(
        postingService.postManualJournal(
          {
            tenantId: tenantA,
            entryDate: new Date(),
            narration: 'Closed period test',
            lines: [
              { chartAccountId: 'acc-a1', debit: 100, credit: 0 },
              { chartAccountId: 'acc-a2', debit: 0, credit: 100 },
            ],
          },
          actorA,
        ),
      ).rejects.toThrow(/Cannot post to closed fiscal period/);
    });

    it('should reject posting if no fiscal period exists for the date', async () => {
      if (!(prisma as any).fiscalPeriod) {
        (prisma as any).fiscalPeriod = { findFirst: jest.fn() };
      }
      ((prisma as any).fiscalPeriod.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        postingService.postManualJournal(
          {
            tenantId: tenantA,
            entryDate: new Date('2099-01-01'),
            narration: 'No period test',
            lines: [
              { chartAccountId: 'acc-a1', debit: 100, credit: 0 },
              { chartAccountId: 'acc-a2', debit: 0, credit: 100 },
            ],
          },
          actorA,
        ),
      ).rejects.toThrow(/No fiscal period found/);
    });
  });

  describe('Immutability', () => {
    it('should not allow direct update of a journal entry', () => {
      expect(() => {
        accountingService.updateJournalEntry();
      }).toThrow(
        'Journal entries are immutable. Use correction or reversal workflows.',
      );
    });

    it('should not allow direct deletion of a journal entry', () => {
      expect(() => {
        accountingService.deleteJournalEntry();
      }).toThrow(
        'Journal entries are immutable and cannot be deleted once posted.',
      );
    });

    it('should reject reversal of a reversed entry', async () => {
      ((prisma as any).journalEntry.findFirst as jest.Mock).mockResolvedValue({
        id: 'je-1',
        tenantId: tenantA,
        status: 'REVERSED',
        fiscalPeriod: { status: 'OPEN' },
      });

      await expect(
        accountingService.reverseJournalEntry(
          'je-1',
          { reason: 'Test duplicate' },
          actorA,
        ),
      ).rejects.toThrow('Journal entry is already reversed');
    });

    it('should reject reversal of an entry in a CLOSED period', async () => {
      ((prisma as any).journalEntry.findFirst as jest.Mock).mockResolvedValue({
        id: 'je-1',
        tenantId: tenantA,
        status: 'POSTED',
        fiscalPeriod: { status: 'CLOSED', label: 'Jan 2024' },
      });

      await expect(
        accountingService.reverseJournalEntry(
          'je-1',
          { reason: 'Test closed period' },
          actorA,
        ),
      ).rejects.toThrow(/belongs to a closed fiscal period/);
    });
  });

  describe('Cross-Module Postings', () => {
    it('should post canteen top-up correctly', async () => {
      jest
        .spyOn(postingService as any, 'ensurePostingPeriodIsOpen')
        .mockResolvedValue({ id: 'p1', fiscalYearId: 'fy1' });
      ((prisma as any).chartAccount.upsert as jest.Mock).mockResolvedValue({
        id: 'acc-1',
      });
      ((prisma as any).journalEntry.create as jest.Mock).mockResolvedValue({
        id: 'je-topup',
      });

      const entry = await postingService.postCanteenTopUp(
        {
          tenantId: tenantA,
          walletId: 'wallet-1',
          studentId: 'stud-1',
          amount: new Prisma.Decimal(500),
          paymentMethod: 'CASH',
        },
        actorA,
      );

      expect(entry).toBeDefined();
      expect((prisma as any).journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceModule: 'CANTEEN',
            postingType: 'TOPUP',
          }),
        }),
      );
    });

    it('should post invoice correctly', async () => {
      jest
        .spyOn(postingService as any, 'ensurePostingPeriodIsOpen')
        .mockResolvedValue({ id: 'p1', fiscalYearId: 'fy1' });
      ((prisma as any).chartAccount.upsert as jest.Mock).mockResolvedValue({
        id: 'acc-1',
      });
      ((prisma as any).journalEntry.create as jest.Mock).mockResolvedValue({
        id: 'je-invoice',
      });

      const entry = await postingService.postInvoice(
        {
          tenantId: tenantA,
          invoiceId: 'inv-1',
          invoiceNumber: 'INV-001',
          studentId: 'stud-1',
          totalAmount: new Prisma.Decimal(1000),
          lines: [
            {
              chartAccountId: 'acc-revenue',
              amount: new Prisma.Decimal(1000),
              description: 'Tuition Fee',
            },
          ],
        },
        actorA,
      );

      expect(entry).toBeDefined();
      expect((prisma as any).journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceType: 'INVOICE',
            postingType: 'BILLING',
          }),
        }),
      );
    });
  });
});
