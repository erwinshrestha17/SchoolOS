import { Test, TestingModule } from '@nestjs/testing';
import { AccountingReportsService } from './accounting-reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChartAccountType, JournalLineSide } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

const D = (value: string | number) => new Prisma.Decimal(value);
const FY = {
  id: 'fy1',
  startDate: new Date('2023-01-01T00:00:00.000Z'),
  endDate: new Date('2023-12-31T00:00:00.000Z'),
};
const sum = (debit: number, credit: number) => ({
  _sum: { debit: D(debit), credit: D(credit) },
});

describe('AccountingReportsService', () => {
  let service: AccountingReportsService;
  let prisma: {
    fiscalYear: { findUnique: jest.Mock };
    fiscalPeriod: { findUnique: jest.Mock };
    chartAccount: { findMany: jest.Mock; findFirst: jest.Mock };
    journalLine: {
      groupBy: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
      aggregate: jest.Mock;
    };
    accountingReportAccountMapping: {
      findMany: jest.Mock;
      createMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    fiscalBudget: { findFirst: jest.Mock };
    journalEntry: { findMany: jest.Mock; findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      fiscalYear: { findUnique: jest.fn() },
      fiscalPeriod: { findUnique: jest.fn() },
      chartAccount: { findMany: jest.fn(), findFirst: jest.fn() },
      journalLine: {
        groupBy: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn().mockResolvedValue(sum(0, 0)),
      },
      accountingReportAccountMapping: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      fiscalBudget: { findFirst: jest.fn() },
      journalEntry: {
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const auditService = {
      record: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<AccountingReportsService>(AccountingReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTrialBalance', () => {
    it('returns balanced trial balance for simple posted journal', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue(FY);
      prisma.chartAccount.findMany.mockResolvedValue([
        {
          id: 'a1',
          code: '1000',
          name: 'Cash',
          type: ChartAccountType.ASSET,
          parentId: null,
        },
        {
          id: 'a2',
          code: '4000',
          name: 'Sales',
          type: ChartAccountType.REVENUE,
          parentId: null,
        },
      ]);
      prisma.journalLine.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { chartAccountId: 'a1', _sum: { debit: D(100), credit: D(0) } },
          { chartAccountId: 'a2', _sum: { debit: D(0), credit: D(100) } },
        ]);

      const result = await service.getTrialBalance('tenant1', {
        fiscalYearId: 'fy1',
      });

      expect(result.isBalanced).toBe(true);
      expect(result.totalClosingDebit.toString()).toBe('100');
      expect(result.totalClosingCredit.toString()).toBe('100');
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].closingDebit.toString()).toBe('100');
      expect(result.rows[1].closingCredit.toString()).toBe('100');
    });

    it('rejects cross-tenant fiscalYearId', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue(null);
      await expect(
        service.getTrialBalance('tenant1', { fiscalYearId: 'fy1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('calculates asset debit balances correctly when credit exceeds debit', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue(FY);
      prisma.chartAccount.findMany.mockResolvedValue([
        {
          id: 'a1',
          code: '1000',
          name: 'Cash',
          type: ChartAccountType.ASSET,
          parentId: null,
        },
      ]);
      prisma.journalLine.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { chartAccountId: 'a1', _sum: { debit: D(100), credit: D(150) } },
        ]);

      const result = await service.getTrialBalance('tenant1', {
        fiscalYearId: 'fy1',
      });
      expect(result.rows[0].closingCredit.toString()).toBe('50');
      expect(result.rows[0].closingDebit.toString()).toBe('0');
      expect(result.rows[0].normalBalanceSide).toBe(JournalLineSide.DEBIT);
    });
  });

  describe('getGeneralLedger', () => {
    it('returns ledger rows for selected account', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue(FY);
      prisma.chartAccount.findFirst.mockResolvedValue({
        id: 'a1',
        code: '1000',
        name: 'Cash',
        type: ChartAccountType.ASSET,
      });
      prisma.journalLine.count.mockResolvedValue(1);
      prisma.journalLine.aggregate
        .mockResolvedValueOnce(sum(0, 0))
        .mockResolvedValueOnce(sum(200, 0));
      prisma.journalLine.findMany.mockResolvedValue([
        {
          id: 'l1',
          debit: D(200),
          credit: D(0),
          journalEntryId: 'je1',
          description: 'test',
          journalEntry: {
            status: 'POSTED',
            entryDate: new Date('2023-01-01'),
            postedAt: new Date('2023-01-01'),
            entryNumber: 'JE-001',
            narration: 'test',
          },
        },
      ]);

      const result = await service.getGeneralLedger('tenant1', {
        fiscalYearId: 'fy1',
        accountId: 'a1',
      });
      expect(result.rows).toHaveLength(1);
      expect(result.totals.debit.toString()).toBe('200');
      expect(result.closingBalance.toString()).toBe('200');
      expect(result.closingBalanceSide).toBe(JournalLineSide.DEBIT);
    });

    it('rejects if no account is provided', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue(FY);
      await expect(
        service.getGeneralLedger('tenant1', {
          fiscalYearId: 'fy1',
        } as unknown as Parameters<typeof service.getGeneralLedger>[1]),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCashBook', () => {
    it('returns cash receipts and payments', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue(FY);
      prisma.accountingReportAccountMapping.findMany.mockResolvedValue([
        {
          accountId: 'a1',
          mappingType: 'CASH',
          account: { id: 'a1', code: '1000', name: 'Cash' },
        },
      ]);
      prisma.chartAccount.findFirst.mockResolvedValue({
        id: 'a1',
        code: '1000',
        name: 'Cash',
        type: ChartAccountType.ASSET,
      });
      prisma.journalLine.count.mockResolvedValue(2);
      prisma.journalLine.aggregate
        .mockResolvedValueOnce(sum(0, 0))
        .mockResolvedValueOnce(sum(200, 50));
      prisma.journalLine.findMany.mockResolvedValue([
        {
          id: 'l1',
          debit: D(200),
          credit: D(0),
          journalEntryId: 'je1',
          journalEntry: {
            entryDate: new Date('2023-01-01'),
            postedAt: new Date('2023-01-01'),
            entryNumber: 'JE-001',
            lines: [
              {
                chartAccountId: 'a1',
                chartAccount: { id: 'a1', code: '1000', name: 'Cash' },
              },
              {
                chartAccountId: 'a2',
                chartAccount: { id: 'a2', code: '4000', name: 'Sales' },
              },
            ],
          },
        },
        {
          id: 'l2',
          debit: D(0),
          credit: D(50),
          journalEntryId: 'je2',
          journalEntry: {
            entryDate: new Date('2023-01-02'),
            postedAt: new Date('2023-01-02'),
            entryNumber: 'JE-002',
            lines: [
              {
                chartAccountId: 'a1',
                chartAccount: { id: 'a1', code: '1000', name: 'Cash' },
              },
              {
                chartAccountId: 'a3',
                chartAccount: { id: 'a3', code: '5000', name: 'Rent' },
              },
            ],
          },
        },
      ]);

      const result = await service.getCashBook('tenant1', {
        fiscalYearId: 'fy1',
        accountId: 'a1',
      });
      expect(result.rows).toHaveLength(2);
      expect(result.totalReceipts.toString()).toBe('200');
      expect(result.totalPayments.toString()).toBe('50');
      expect(result.closingBalance.toString()).toBe('150');
      expect(result.closingBalanceSide).toBe(JournalLineSide.DEBIT);
    });

    it('rejects if account is not ASSET', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue(FY);
      prisma.accountingReportAccountMapping.findMany.mockResolvedValue([
        {
          accountId: 'a1',
          mappingType: 'CASH',
          account: { id: 'a1', code: '4000', name: 'Sales' },
        },
      ]);
      prisma.chartAccount.findFirst.mockResolvedValue({
        id: 'a1',
        code: '4000',
        name: 'Sales',
        type: ChartAccountType.REVENUE,
      });
      await expect(
        service.getCashBook('tenant1', {
          fiscalYearId: 'fy1',
          accountId: 'a1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getIncomeStatement', () => {
    it('calculates income and expense correctly', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue(FY);
      prisma.chartAccount.findMany.mockResolvedValue([
        {
          id: 'a1',
          code: '4000',
          name: 'Sales',
          type: ChartAccountType.REVENUE,
        },
        {
          id: 'a2',
          code: '5000',
          name: 'Rent',
          type: ChartAccountType.EXPENSE,
        },
      ]);
      prisma.journalLine.groupBy.mockResolvedValue([
        { chartAccountId: 'a1', _sum: { debit: D(0), credit: D(500) } },
        { chartAccountId: 'a2', _sum: { debit: D(200), credit: D(0) } },
      ]);

      const result = await service.getIncomeStatement('tenant1', {
        fiscalYearId: 'fy1',
      });
      expect(result.totalIncome.toString()).toBe('500');
      expect(result.totalExpense.toString()).toBe('200');
      expect(result.netSurplusOrDeficit.toString()).toBe('300');
      expect(result.resultType).toBe('SURPLUS');
      expect(result.sections).toHaveLength(2);
    });
  });

  describe('getBalanceSheet', () => {
    it('calculates assets, liabilities, equity, and includes surplus if unclosed', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue(FY);
      prisma.chartAccount.findMany.mockResolvedValue([
        { id: 'a1', code: '1000', name: 'Cash', type: ChartAccountType.ASSET },
        {
          id: 'a2',
          code: '2000',
          name: 'Payable',
          type: ChartAccountType.LIABILITY,
        },
        {
          id: 'a3',
          code: '3000',
          name: 'Equity',
          type: ChartAccountType.EQUITY,
        },
        {
          id: 'a4',
          code: '4000',
          name: 'Sales',
          type: ChartAccountType.REVENUE,
        }, // for surplus
      ]);
      prisma.journalLine.groupBy.mockResolvedValue([
        { chartAccountId: 'a1', _sum: { debit: D(1000), credit: D(0) } },
        { chartAccountId: 'a2', _sum: { debit: D(0), credit: D(300) } },
        { chartAccountId: 'a3', _sum: { debit: D(0), credit: D(200) } },
        { chartAccountId: 'a4', _sum: { debit: D(0), credit: D(500) } }, // 500 surplus
      ]);

      const result = await service.getBalanceSheet('tenant1', {
        fiscalYearId: 'fy1',
      });
      expect(result.totalAssets.toString()).toBe('1000');
      expect(result.totalLiabilities.toString()).toBe('300');

      // Total equity should be original equity (200) + surplus (500) = 700
      expect(result.totalEquity.toString()).toBe('700');

      expect(result.totalLiabilitiesAndEquity.toString()).toBe('1000');
      expect(result.isBalanced).toBe(true);
    });
  });

  describe('getTaxSummary', () => {
    it('calculates VAT and returns setup warnings if missing mappings', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue(FY);
      prisma.accountingReportAccountMapping.findMany.mockResolvedValue([
        {
          accountId: 'a1',
          mappingType: 'VAT_OUTPUT',
          account: { id: 'a1', code: 'VAT-OUT-1' },
        },
        {
          accountId: 'a2',
          mappingType: 'VAT_INPUT',
          account: { id: 'a2', code: 'VAT-IN-1' },
        },
      ]);
      prisma.chartAccount.findMany.mockResolvedValue([
        { id: 'a1', code: 'VAT-OUT-1', name: 'VAT Output' },
        { id: 'a2', code: 'VAT-IN-1', name: 'VAT Input' },
      ]);
      prisma.journalLine.groupBy.mockResolvedValue([
        { chartAccountId: 'a1', _sum: { debit: D(0), credit: D(100) } }, // 100 Output
        { chartAccountId: 'a2', _sum: { debit: D(60), credit: D(0) } }, // 60 Input
      ]);

      const result = await service.getTaxSummary('tenant1', {
        fiscalYearId: 'fy1',
      } as unknown as Parameters<typeof service.getTaxSummary>[1]);
      expect(result.vat?.outputVat.toString()).toBe('100');
      expect(result.vat?.inputVat.toString()).toBe('60');
      expect(result.vat?.netVat.toString()).toBe('40');
      expect(result.vat?.status).toBe('PAYABLE');
    });
  });

  describe('getCashFlowStatement', () => {
    it('returns empty sections when cash/bank mappings are missing', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue(FY);
      prisma.accountingReportAccountMapping.findMany.mockResolvedValue([]);

      const result = await service.getCashFlowStatement('tenant1', {
        fiscalYearId: 'fy1',
      } as unknown as Parameters<typeof service.getCashFlowStatement>[1]);

      expect(result.openingCash.toString()).toBe('0');
      expect(result.sections).toHaveLength(3);
      expect(result.setupWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('getBudgetVsActual', () => {
    it('throws when no approved budget exists', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue(FY);
      prisma.fiscalBudget.findFirst.mockResolvedValue(null);

      await expect(
        service.getBudgetVsActual('tenant1', {
          fiscalYearId: 'fy1',
        } as unknown as Parameters<typeof service.getBudgetVsActual>[1]),
      ).rejects.toThrow('No approved fiscal budget found');
    });
  });

  describe('Phase 7.11a correctness', () => {
    it('carries opening balances into the trial balance and stays balanced', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue(FY);
      prisma.chartAccount.findMany.mockResolvedValue([
        {
          id: 'cash',
          code: '1000',
          name: 'Cash',
          type: ChartAccountType.ASSET,
          parentId: null,
        },
        {
          id: 'eq',
          code: '3000',
          name: 'Capital',
          type: ChartAccountType.EQUITY,
          parentId: null,
        },
        {
          id: 'inc',
          code: '4000',
          name: 'Fees',
          type: ChartAccountType.INCOME,
          parentId: null,
        },
      ]);
      prisma.journalLine.groupBy
        .mockResolvedValueOnce([
          { chartAccountId: 'cash', ...sum(1000, 0) },
          { chartAccountId: 'eq', ...sum(0, 1000) },
        ])
        .mockResolvedValueOnce([
          { chartAccountId: 'cash', ...sum(300, 0) },
          { chartAccountId: 'inc', ...sum(0, 300) },
        ]);

      const result = await service.getTrialBalance('tenant1', {
        fiscalYearId: 'fy1',
      });

      const cash = result.rows.find((row) => row.accountId === 'cash');
      expect(cash?.openingDebit.toString()).toBe('1000');
      expect(cash?.closingDebit.toString()).toBe('1300');
      expect(result.totalOpeningDebit.toString()).toBe('1000');
      expect(result.totalOpeningCredit.toString()).toBe('1000');
      expect(result.isBalanced).toBe(true);
      expect(result.stage).toBe('PRE_CLOSING');
      // The opening query covers every year before the window.
      const openingWhere = prisma.journalLine.groupBy.mock.calls[0][0].where;
      expect(openingWhere.journalEntry.fiscalYearId).toBeUndefined();
      expect(openingWhere.journalEntry.entryDate).toEqual({
        lt: new Date('2023-01-01T00:00:00.000Z'),
      });
    });

    it('reports INCOME accounts in the income statement and excludes closing entries', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue(FY);
      prisma.chartAccount.findMany.mockResolvedValue([
        {
          id: 'inc',
          code: '4100',
          name: 'Other income',
          type: ChartAccountType.INCOME,
        },
      ]);
      prisma.journalLine.groupBy.mockResolvedValue([
        { chartAccountId: 'inc', ...sum(0, 80) },
      ]);

      const result = await service.getIncomeStatement('tenant1', {
        fiscalYearId: 'fy1',
      });

      expect(result.totalIncome.toString()).toBe('80');
      expect(result.comparisonSupported).toBe(false);
      const where = prisma.journalLine.groupBy.mock.calls[0][0].where;
      expect(where.journalEntry.sourceType).toEqual({
        notIn: ['CLOSING_ENTRY', 'CLOSING'],
      });
      expect(where.journalEntry.status).toEqual({ in: ['POSTED', 'REVERSED'] });
      expect(prisma.chartAccount.findMany.mock.calls[0][0].where.type).toEqual({
        in: ['REVENUE', 'INCOME', 'EXPENSE'],
      });
    });

    it('continues running balances across general-ledger pages and totals the full filter', async () => {
      prisma.fiscalYear.findUnique.mockResolvedValue(FY);
      prisma.chartAccount.findFirst.mockResolvedValue({
        id: 'a1',
        code: '1000',
        name: 'Cash',
        type: ChartAccountType.ASSET,
      });
      prisma.journalLine.count.mockResolvedValue(3);
      prisma.journalLine.aggregate
        .mockResolvedValueOnce(sum(100, 0))
        .mockResolvedValueOnce(sum(60, 10));
      prisma.journalLine.findMany
        .mockResolvedValueOnce([
          { debit: D(50), credit: D(0) },
          { debit: D(0), credit: D(10) },
        ])
        .mockResolvedValueOnce([
          {
            id: 'l3',
            debit: D(10),
            credit: D(0),
            journalEntryId: 'je3',
            description: null,
            journalEntry: {
              status: 'REVERSED',
              entryDate: new Date('2023-02-01'),
              postedAt: null,
              entryNumber: 'JE-3',
              narration: 'third',
            },
          },
        ]);

      const result = await service.getGeneralLedger('tenant1', {
        fiscalYearId: 'fy1',
        accountId: 'a1',
        page: 2,
        limit: 2,
      });

      expect(result.pageOpeningBalance.toString()).toBe('140');
      expect(result.rows[0].runningBalance.toString()).toBe('150');
      expect(result.rows[0].entryStatus).toBe('REVERSED');
      expect(result.totals.debit.toString()).toBe('60');
      expect(result.closingBalance.toString()).toBe('150');
    });
  });
});
