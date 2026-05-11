import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AccountingService } from './accounting.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AccountingPostingService } from './accounting-posting.service';
import { JournalLineSide } from '@prisma/client';

describe('AccountingService - Slices 2-5', () => {
  let service: AccountingService;
  let prisma: any;
  let auditService: any;
  let postingService: any;

  const actor = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    role: 'ADMIN',
    permissions: [],
  } as any;

  beforeEach(async () => {
    prisma = {
      fiscalYear: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        create: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      chartAccount: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      journalEntry: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      journalLine: {
        findFirst: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { debit: 0, credit: 0 } }),
      },
      accountingPeriod: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        create: jest.fn(),
      },
      accountingReportAccountMapping: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      bankStatement: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } }),
      },
      $transaction: jest.fn(),
    };

    auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    postingService = {
      createDraftJournal: jest.fn(),
      postManualJournal: jest.fn(),
      ensurePostingPeriodIsOpen: jest.fn().mockResolvedValue(null),
      generateJournalEntryNumber: jest.fn().mockResolvedValue('JE-2026-000001'),
      updateJournalStatus: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AccountingService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: AccountingPostingService, useValue: postingService },
      ],
    }).compile();

    service = module.get(AccountingService);
  });

  // ─── Slice 2: Opening Balance ──────────────────────────────────────

  describe('createOpeningBalance', () => {
    it('should create a balanced opening balance journal entry', async () => {
      const fiscalYear = {
        id: 'fy-1',
        tenantId: 'tenant-1',
        name: 'FY 2026',
        status: 'OPEN',
        startDate: new Date('2026-04-01'),
        periods: [{ id: 'p-1', periodNumber: 1 }],
      };

      prisma.fiscalYear.findFirst.mockResolvedValue(fiscalYear);
      prisma.chartAccount.findMany.mockResolvedValue([
        { id: 'acc-1' },
        { id: 'acc-2' },
      ]);

      const draftEntry = {
        id: 'je-1',
        status: 'DRAFT',
        lines: [],
      };
      postingService.createDraftJournal.mockResolvedValue(draftEntry);

      const dto = {
        fiscalYearId: 'fy-1',
        lines: [
          {
            chartAccountId: 'acc-1',
            side: JournalLineSide.DEBIT,
            amount: 50000,
          },
          {
            chartAccountId: 'acc-2',
            side: JournalLineSide.CREDIT,
            amount: 50000,
          },
        ],
      };

      const result = await service.createOpeningBalance(dto, actor);

      expect(result.id).toBe('je-1');
      expect(postingService.createDraftJournal).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          resource: 'opening_balance',
          tenantId: 'tenant-1',
        }),
      );
    });

    it('should reject unbalanced opening balance', async () => {
      prisma.fiscalYear.findFirst.mockResolvedValue({
        id: 'fy-1',
        tenantId: 'tenant-1',
        status: 'OPEN',
        startDate: new Date(),
        periods: [],
      });

      const dto = {
        fiscalYearId: 'fy-1',
        lines: [
          {
            chartAccountId: 'acc-1',
            side: JournalLineSide.DEBIT,
            amount: 50000,
          },
          {
            chartAccountId: 'acc-2',
            side: JournalLineSide.CREDIT,
            amount: 30000,
          },
        ],
      };

      await expect(service.createOpeningBalance(dto, actor)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reject opening balance for closed fiscal year', async () => {
      prisma.fiscalYear.findFirst.mockResolvedValue({
        id: 'fy-1',
        tenantId: 'tenant-1',
        status: 'CLOSED',
        periods: [],
      });

      const dto = {
        fiscalYearId: 'fy-1',
        lines: [
          {
            chartAccountId: 'acc-1',
            side: JournalLineSide.DEBIT,
            amount: 1000,
          },
          {
            chartAccountId: 'acc-2',
            side: JournalLineSide.CREDIT,
            amount: 1000,
          },
        ],
      };

      await expect(service.createOpeningBalance(dto, actor)).rejects.toThrow(
        'Cannot post opening balance to a closed fiscal year',
      );
    });

    it('should reject opening balance with cross-tenant accounts', async () => {
      prisma.fiscalYear.findFirst.mockResolvedValue({
        id: 'fy-1',
        tenantId: 'tenant-1',
        status: 'OPEN',
        startDate: new Date(),
        periods: [],
      });
      // Only 1 account found instead of 2
      prisma.chartAccount.findMany.mockResolvedValue([{ id: 'acc-1' }]);

      const dto = {
        fiscalYearId: 'fy-1',
        lines: [
          {
            chartAccountId: 'acc-1',
            side: JournalLineSide.DEBIT,
            amount: 1000,
          },
          {
            chartAccountId: 'acc-other-tenant',
            side: JournalLineSide.CREDIT,
            amount: 1000,
          },
        ],
      };

      await expect(service.createOpeningBalance(dto, actor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getOpeningBalance', () => {
    it('should return the opening balance for a fiscal year', async () => {
      const entry = { id: 'je-1', lines: [] };
      prisma.journalEntry.findFirst.mockResolvedValue(entry);

      const result = await service.getOpeningBalance('fy-1', actor);
      expect(result.id).toBe('je-1');
    });

    it('should throw NotFoundException when no opening balance exists', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);

      await expect(service.getOpeningBalance('fy-1', actor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Slice 3: Voucher Workflows ────────────────────────────────────

  describe('createExpenseVoucher', () => {
    it('should create a DRAFT journal with DR Expense CR Cash', async () => {
      prisma.chartAccount.findMany.mockResolvedValue([
        { id: 'expense-acc' },
        { id: 'bank-acc' },
      ]);
      postingService.createDraftJournal.mockResolvedValue({
        id: 'je-v1',
        status: 'DRAFT',
        lines: [],
      });
      postingService.ensurePostingPeriodIsOpen.mockResolvedValue(null);

      const result = await service.createExpenseVoucher(
        {
          expenseAccountId: 'expense-acc',
          paymentAccountId: 'bank-acc',
          amount: 5000,
          entryDate: '2026-04-15',
          narration: 'Office supplies',
        },
        actor,
      );

      expect(result.id).toBe('je-v1');
      expect(postingService.createDraftJournal).toHaveBeenCalled();
    });
  });

  describe('createPaymentVoucher', () => {
    it('should create a DRAFT journal with DR Payee CR Cash', async () => {
      prisma.chartAccount.findMany.mockResolvedValue([
        { id: 'payee-acc' },
        { id: 'bank-acc' },
      ]);
      postingService.createDraftJournal.mockResolvedValue({
        id: 'je-v2',
        status: 'DRAFT',
        lines: [],
      });
      postingService.ensurePostingPeriodIsOpen.mockResolvedValue(null);

      const result = await service.createPaymentVoucher(
        {
          payeeAccountId: 'payee-acc',
          paymentAccountId: 'bank-acc',
          amount: 10000,
          entryDate: '2026-04-15',
          narration: 'Vendor payment',
        },
        actor,
      );

      expect(result.id).toBe('je-v2');
    });
  });

  describe('createReceiptVoucher', () => {
    it('should create a DRAFT journal with DR Cash CR Income', async () => {
      prisma.chartAccount.findMany.mockResolvedValue([
        { id: 'deposit-acc' },
        { id: 'receipt-acc' },
      ]);
      postingService.createDraftJournal.mockResolvedValue({
        id: 'je-v3',
        status: 'DRAFT',
        lines: [],
      });
      postingService.ensurePostingPeriodIsOpen.mockResolvedValue(null);

      const result = await service.createReceiptVoucher(
        {
          receiptAccountId: 'receipt-acc',
          depositAccountId: 'deposit-acc',
          amount: 8000,
          entryDate: '2026-04-15',
          narration: 'Fee collection',
        },
        actor,
      );

      expect(result.id).toBe('je-v3');
    });
  });

  describe('createContraVoucher', () => {
    it('should create a DRAFT journal for cash-to-bank transfer', async () => {
      prisma.chartAccount.findMany.mockResolvedValue([
        { id: 'from-acc' },
        { id: 'to-acc' },
      ]);
      postingService.createDraftJournal.mockResolvedValue({
        id: 'je-v4',
        status: 'DRAFT',
        lines: [],
      });
      postingService.ensurePostingPeriodIsOpen.mockResolvedValue(null);

      const result = await service.createContraVoucher(
        {
          fromAccountId: 'from-acc',
          toAccountId: 'to-acc',
          amount: 20000,
          entryDate: '2026-04-15',
          narration: 'Cash deposit to bank',
        },
        actor,
      );

      expect(result.id).toBe('je-v4');
    });
  });

  // ─── Slice 4: Fiscal Year Close ────────────────────────────────────

  describe('closeFiscalYear', () => {
    it('should reject closing when periods are still open', async () => {
      prisma.fiscalYear.findFirst.mockResolvedValue({
        id: 'fy-1',
        tenantId: 'tenant-1',
        name: 'FY 2026',
        status: 'OPEN',
        endDate: new Date('2027-03-31'),
        periods: [
          { id: 'p-1', label: '2026-04', status: 'OPEN' },
          { id: 'p-2', label: '2026-05', status: 'CLOSED' },
        ],
      });

      await expect(service.closeFiscalYear('fy-1', actor)).rejects.toThrow(
        'All fiscal periods must be closed',
      );
    });

    it('should reject closing an already closed fiscal year', async () => {
      prisma.fiscalYear.findFirst.mockResolvedValue({
        id: 'fy-1',
        tenantId: 'tenant-1',
        status: 'CLOSED',
        periods: [],
      });

      await expect(service.closeFiscalYear('fy-1', actor)).rejects.toThrow(
        'Fiscal year is already closed',
      );
    });

    it('should reject when no revenue/expense balances exist', async () => {
      prisma.fiscalYear.findFirst.mockResolvedValue({
        id: 'fy-1',
        tenantId: 'tenant-1',
        name: 'FY 2026',
        status: 'OPEN',
        endDate: new Date('2027-03-31'),
        periods: [{ id: 'p-1', status: 'CLOSED' }],
      });

      prisma.journalLine.groupBy.mockResolvedValue([]);
      prisma.chartAccount.findMany.mockResolvedValue([]);
      // Mock retained earnings so it passes that check
      prisma.accountingReportAccountMapping.findFirst.mockResolvedValue({
        accountId: 're-1',
      });

      await expect(service.closeFiscalYear('fy-1', actor)).rejects.toThrow(
        'No revenue or expense balances to close',
      );
    });

    it('should throw when retained earnings account not found', async () => {
      prisma.fiscalYear.findFirst.mockResolvedValue({
        id: 'fy-1',
        tenantId: 'tenant-1',
        name: 'FY 2026',
        status: 'OPEN',
        endDate: new Date('2027-03-31'),
        periods: [{ id: 'p-1', status: 'CLOSED' }],
      });

      prisma.chartAccount.findMany.mockResolvedValue([
        { id: 'rev-1', type: 'REVENUE', name: 'Tuition Fee' },
      ]);
      prisma.journalLine.groupBy.mockResolvedValue([
        { chartAccountId: 'rev-1', _sum: { debit: 0, credit: 100000 } },
      ]);
      prisma.accountingReportAccountMapping.findFirst.mockResolvedValue(null);
      prisma.chartAccount.findFirst.mockResolvedValue(null);

      await expect(service.closeFiscalYear('fy-1', actor)).rejects.toThrow(
        'Retained Earnings account not found',
      );
    });
  });

  describe('reopenFiscalYear', () => {
    it('should reopen a closed fiscal year', async () => {
      prisma.fiscalYear.findFirst.mockResolvedValue({
        id: 'fy-1',
        tenantId: 'tenant-1',
        status: 'CLOSED',
      });

      prisma.fiscalYear.update.mockResolvedValue({
        id: 'fy-1',
        status: 'OPEN',
      });

      const result = await service.reopenFiscalYear(
        'fy-1',
        { reason: 'Need to adjust entries' },
        actor,
      );

      expect(result.status).toBe('OPEN');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'reopen',
          resource: 'fiscal_year',
        }),
      );
    });

    it('should reject reopening an open fiscal year', async () => {
      prisma.fiscalYear.findFirst.mockResolvedValue({
        id: 'fy-1',
        status: 'OPEN',
      });

      await expect(
        service.reopenFiscalYear('fy-1', { reason: 'test' }, actor),
      ).rejects.toThrow('Fiscal year is not closed');
    });
  });

  // ─── Slice 5: Bank Reconciliation ──────────────────────────────────

  describe('importBankStatement', () => {
    it('should import bank statement lines', async () => {
      prisma.chartAccount.findFirst.mockResolvedValue({
        id: 'bank-acc',
        tenantId: 'tenant-1',
      });

      const createdStatements = [
        { id: 'bs-1', description: 'Payment received' },
        { id: 'bs-2', description: 'Rent paid' },
      ];
      prisma.$transaction.mockResolvedValue(createdStatements);

      const result = await service.importBankStatement(
        'bank-acc',
        [
          {
            statementDate: '2026-04-01',
            description: 'Payment received',
            debitAmount: 5000,
          },
          {
            statementDate: '2026-04-02',
            description: 'Rent paid',
            creditAmount: 10000,
          },
        ],
        actor,
      );

      expect(result.count).toBe(2);
      expect(result.importBatchId).toMatch(/^IMPORT-/);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'import',
          resource: 'bank_statement',
        }),
      );
    });

    it('should reject import for non-existent account', async () => {
      prisma.chartAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.importBankStatement('bad-acc', [], actor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reconcileStatement', () => {
    it('should match a bank statement line to a journal line', async () => {
      prisma.bankStatement.findFirst.mockResolvedValue({
        id: 'bs-1',
        tenantId: 'tenant-1',
        isReconciled: false,
      });

      prisma.journalLine.findFirst.mockResolvedValue({
        id: 'jl-1',
        tenantId: 'tenant-1',
      });

      prisma.bankStatement.update.mockResolvedValue({
        id: 'bs-1',
        isReconciled: true,
        journalLineId: 'jl-1',
      });

      const result = (await service.reconcileStatement(
        'bs-1',
        'jl-1',
        actor,
      )) as any;

      expect(result.isReconciled).toBe(true);
      expect(result.journalLineId).toBe('jl-1');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'reconcile',
          resource: 'bank_statement',
        }),
      );
    });

    it('should reject reconciling already reconciled statement', async () => {
      prisma.bankStatement.findFirst.mockResolvedValue({
        id: 'bs-1',
        tenantId: 'tenant-1',
        isReconciled: true,
      });

      await expect(
        service.reconcileStatement('bs-1', 'jl-1', actor),
      ).rejects.toThrow('Statement line is already reconciled');
    });
  });

  describe('getReconciliationSummary', () => {
    it('should return reconciliation summary for an account', async () => {
      prisma.chartAccount.findFirst.mockResolvedValue({
        id: 'bank-acc',
        code: '1010',
        name: 'Bank Account',
      });

      prisma.bankStatement.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(7); // reconciled

      prisma.bankStatement.aggregate.mockResolvedValue({
        _sum: { debitAmount: 50000, creditAmount: 30000 },
      });

      prisma.journalLine.aggregate.mockResolvedValue({
        _sum: { debit: 45000, credit: 28000 },
      });

      const result = await service.getReconciliationSummary('bank-acc', actor);

      expect(result.totalStatements).toBe(10);
      expect(result.reconciledStatements).toBe(7);
      expect(result.unreconciledStatements).toBe(3);
      expect(result.accountCode).toBe('1010');
    });
  });

  describe('getUnreconciledStatements', () => {
    it('should return only unreconciled statements', async () => {
      const unreconciled = [
        { id: 'bs-1', isReconciled: false },
        { id: 'bs-2', isReconciled: false },
      ];
      prisma.bankStatement.findMany.mockResolvedValue(unreconciled);

      const result = await service.getUnreconciledStatements('bank-acc', actor);

      expect(result).toHaveLength(2);
      expect(prisma.bankStatement.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          accountId: 'bank-acc',
          isReconciled: false,
        },
        orderBy: { statementDate: 'asc' },
      });
    });
  });
});
